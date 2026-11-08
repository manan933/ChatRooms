import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Monitor,
  Phone,
  ShieldCheck,
  Check,
  AlertTriangle,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import BrandLogo from '../ui/BrandLogo';
import socketService from '../../api/socket';
import { playCallStartSound, playCallEndSound } from '../../utils/zyntraSound';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
  ],
  iceCandidatePoolSize: 10,
};

export const CallModal = ({
  isOpen,
  onClose,
  onCallEndedSummary,
  chat,
  isVideo = false,
  isInitiator = true,
  incomingSignal = null,
  callerInfo = null,
  currentUser = null,
  initialIceCandidates = [],
}) => {
  const [callStatus, setCallStatus] = useState(isInitiator ? 'calling' : 'connecting');
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(!isVideo);
  const [screenSharing, setScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [callError, setCallError] = useState(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const candidateQueue = useRef([]);
  const durationRef = useRef(0);
  const summarySentRef = useRef(false);

  // Keep callback refs stable to prevent unmount on parent re-renders
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onSummaryRef = useRef(onCallEndedSummary);
  onSummaryRef.current = onCallEndedSummary;

  const targetId = chat?.username || chat?.userId || chat?.id || callerInfo?.from;
  const targetIdRef = useRef(targetId);
  targetIdRef.current = targetId;

  const chatId = chat?.id || callerInfo?.chatId;
  const chatIdRef = useRef(chatId);
  chatIdRef.current = chatId;

  // Format call duration MM:SS
  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // ── Emit Call Summary To Chat Timeline ──────────────────────
  const emitCallSummary = (statusOverride) => {
    if (summarySentRef.current) return;
    summarySentRef.current = true;

    const currentDur = durationRef.current;
    let finalStatus = statusOverride;
    if (!finalStatus) {
      finalStatus = currentDur > 0 ? 'ended' : 'missed';
    }

    if (onSummaryRef.current) {
      onSummaryRef.current({
        chatId: chatIdRef.current,
        targetUsername: targetIdRef.current,
        isVideo,
        duration: currentDur,
        status: finalStatus,
      });
    }
  };

  // ── Initialize WebRTC Call Session ────────────────────────────
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    let endTimeout = null;
    let rejectTimeout = null;

    setCallStatus(isInitiator ? 'calling' : 'connecting');
    setDuration(0);
    durationRef.current = 0;
    summarySentRef.current = false;
    setCallError(null);
    setMicMuted(false);
    setCameraOff(!isVideo);
    setScreenSharing(false);
    candidateQueue.current = [...(initialIceCandidates || [])];

    playCallStartSound();

    const startWebRtc = async () => {
      try {
        // 1. Acquire local media stream (Voice or Video) with fallback
        let stream = null;
        if (isVideo) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
          } catch (camErr1) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true,
              });
            } catch (camErr2) {
              console.warn('[WebRTC] Camera unavailable, falling back to audio:', camErr2.message);
              stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true },
                video: false,
              });
              if (isMounted) setCameraOff(true);
            }
          }
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false,
          });
        }

        if (!isMounted) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && isVideo && !cameraOff) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Instantiate RTCPeerConnection with STUN servers
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Setup persistent remote stream
        remoteStreamRef.current = new MediaStream();

        // Handle incoming remote media tracks (both audio and video)
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote stream track:', event.track.kind);
          if (event.streams && event.streams[0]) {
            event.streams[0].getTracks().forEach((track) => {
              if (!remoteStreamRef.current.getTracks().some((t) => t.id === track.id)) {
                remoteStreamRef.current.addTrack(track);
              }
            });
          } else if (event.track) {
            if (!remoteStreamRef.current.getTracks().some((t) => t.id === event.track.id)) {
              remoteStreamRef.current.addTrack(event.track);
            }
          }

          // Pipe to audio element (uninterrupted audio playback on all devices)
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
            remoteAudioRef.current.play().catch((err) => console.log('Audio autoplay:', err));
          }

          // Pipe to video element
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
            remoteVideoRef.current.play().catch((err) => console.log('Video autoplay:', err));
          }

          if (isMounted) {
            setCallStatus('connected');
          }
        };

        // Handle local ICE candidates and relay via Socket.io
        pc.onicecandidate = (event) => {
          if (event.candidate && targetIdRef.current) {
            socketService.sendIceCandidate({
              to: targetIdRef.current,
              candidate: event.candidate,
              chatId: chatIdRef.current,
            });
          }
        };

        // Resilient connection state listeners
        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected' && isMounted) {
            setCallStatus('connected');
          } else if (pc.connectionState === 'failed') {
            if (isMounted) {
              setCallStatus('ended');
              emitCallSummary('ended');
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC] ICE state:', pc.iceConnectionState);
          if (
            (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') &&
            isMounted
          ) {
            setCallStatus('connected');
          } else if (pc.iceConnectionState === 'failed') {
            if (pcRef.current && isInitiator) {
              pcRef.current.restartIce?.();
            }
          }
        };

        // 3. Signaling: Caller (Offer) vs Callee (Answer)
        if (isInitiator) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: Boolean(isVideo),
          });
          await pc.setLocalDescription(offer);

          socketService.callUser({
            userToCall: targetIdRef.current,
            signalData: offer,
            isVideo,
            chatId: chatIdRef.current,
          });
        } else if (incomingSignal) {
          await pc.setRemoteDescription(new RTCSessionDescription(incomingSignal));

          // Drain queued & initial ICE candidates
          while (candidateQueue.current.length > 0) {
            const cand = candidateQueue.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] Early addIceCandidate err:', e);
            }
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socketService.answerCall({
            to: targetIdRef.current,
            signalData: answer,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Call setup error:', err);
        if (isMounted) {
          setCallError(err.message || 'Could not access media devices or initialize connection.');
        }
      }
    };

    startWebRtc();

    // ── Socket Signaling Listeners ─────────────────────────────
    const handleAnswer = async ({ signalData }) => {
      if (pcRef.current && signalData) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(signalData));
          while (candidateQueue.current.length > 0) {
            const cand = candidateQueue.current.shift();
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(cand));
            } catch (e) {
              console.warn('[WebRTC] drain candidate err:', e);
            }
          }
          if (isMounted) setCallStatus('connected');
        } catch (e) {
          console.error('[WebRTC] setRemoteDescription error:', e);
        }
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      if (!candidate) return;
      if (pcRef.current && pcRef.current.remoteDescription && pcRef.current.remoteDescription.type) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('[WebRTC] addIceCandidate live error:', e);
        }
      } else {
        candidateQueue.current.push(candidate);
      }
    };

    const handleCallEnded = () => {
      playCallEndSound();
      if (isMounted) {
        setCallStatus('ended');
        emitCallSummary('ended');
        endTimeout = setTimeout(() => {
          if (isMounted) onCloseRef.current?.();
        }, 600);
      }
    };

    const handleCallRejected = () => {
      playCallEndSound();
      if (isMounted) {
        setCallStatus('rejected');
        emitCallSummary('declined');
        rejectTimeout = setTimeout(() => {
          if (isMounted) onCloseRef.current?.();
        }, 800);
      }
    };

    socketService.on('call_answered', handleAnswer);
    socketService.on('ice_candidate', handleIceCandidate);
    socketService.on('call_ended', handleCallEnded);
    socketService.on('call_rejected', handleCallRejected);

    // Call Duration Timer
    const timer = setInterval(() => {
      if (isMounted) {
        setCallStatus((currentStatus) => {
          if (currentStatus === 'connected') {
            setDuration((prev) => {
              const next = prev + 1;
              durationRef.current = next;
              return next;
            });
          }
          return currentStatus;
        });
      }
    }, 1000);

    // ── Teardown on unmount / modal close ──────────────────────
    return () => {
      isMounted = false;
      clearInterval(timer);
      if (endTimeout) clearTimeout(endTimeout);
      if (rejectTimeout) clearTimeout(rejectTimeout);

      socketService.off('call_answered', handleAnswer);
      socketService.off('ice_candidate', handleIceCandidate);
      socketService.off('call_ended', handleCallEnded);
      socketService.off('call_rejected', handleCallRejected);

      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (screenTrackRef.current) {
        screenTrackRef.current.stop();
        screenTrackRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [isOpen]);

  // Synchronize remote media tracks when call connects
  useEffect(() => {
    if (callStatus === 'connected' && remoteStreamRef.current) {
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => {});
      }
      if (remoteAudioRef.current && remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
        remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [callStatus]);

  if (!isOpen) return null;

  // ── Controls: Microphone Mute/Unmute ─────────────────────────
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = micMuted;
      });
      setMicMuted(!micMuted);
    }
  };

  // ── Controls: Camera Toggle ─────────────────────────────────
  const toggleCamera = async () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks.forEach((t) => {
          t.enabled = cameraOff;
        });
        setCameraOff(!cameraOff);
      } else if (cameraOff) {
        // Was started audio-only, request camera track dynamically
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          });
          const newVideoTrack = videoStream.getVideoTracks()[0];
          localStreamRef.current.addTrack(newVideoTrack);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          if (pcRef.current) {
            pcRef.current.addTrack(newVideoTrack, localStreamRef.current);
          }
          setCameraOff(false);
        } catch (e) {
          console.warn('[WebRTC] Could not enable camera dynamically:', e.message);
        }
      }
    }
  };

  // ── Controls: Screen Sharing ─────────────────────────────────
  const toggleScreenShare = async () => {
    if (!pcRef.current) return;

    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        screenTrackRef.current = screenTrack;

        const senders = pcRef.current.getSenders();
        const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          pcRef.current.addTrack(screenTrack, screenStream);
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        screenTrack.onended = () => {
          stopScreenSharing();
        };

        setScreenSharing(true);
      } catch (err) {
        console.warn('[WebRTC] Screen share cancelled or failed:', err.message);
      }
    } else {
      stopScreenSharing();
    }
  };

  const stopScreenSharing = () => {
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }

    if (localStreamRef.current && pcRef.current) {
      const originalVideoTrack = localStreamRef.current.getVideoTracks()[0];
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');

      if (videoSender && originalVideoTrack) {
        videoSender.replaceTrack(originalVideoTrack);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
    }

    setScreenSharing(false);
  };

  // ── End Call ────────────────────────────────────────────────
  const handleEndCall = () => {
    playCallEndSound();
    if (targetIdRef.current) {
      socketService.endCall({ to: targetIdRef.current, chatId: chatIdRef.current });
    }
    emitCallSummary('ended');
    setCallStatus('ended');
    onCloseRef.current?.();
  };

  const contactName = chat?.name || callerInfo?.callerName || 'Participant';
  const contactAvatar = chat?.avatar || callerInfo?.callerAvatar;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn">
      {/* Hidden dedicated audio element: Guarantees continuous voice stream playback */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="w-full max-w-2xl bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col items-center relative overflow-hidden font-heading">
        {/* Top Header Bar */}
        <div className="w-full px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <BrandLogo variant="icon" size="sm" className="w-5 h-5" />
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {isVideo ? 'WebRTC Video Conference' : 'WebRTC Voice Call'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {callStatus === 'connected' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{formatDuration(duration)}</span>
              </div>
            ) : callStatus === 'rejected' ? (
              <span className="text-xs text-[var(--danger,#fc734d)] font-semibold">Call Declined</span>
            ) : callStatus === 'ended' ? (
              <span className="text-xs text-[var(--text-muted)] font-semibold">Call Ended</span>
            ) : (
              <span className="text-xs text-[var(--accent)] font-semibold animate-pulse">
                {isInitiator ? 'Ringing...' : 'Connecting...'}
              </span>
            )}

            <div className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-[10px] text-[var(--text-muted)] border border-[var(--border)] hidden sm:block">
              P2P Encrypted
            </div>
          </div>
        </div>

        {/* Call Error Notice if Permissions or Media Failed */}
        {callError && (
          <div className="w-full p-2.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2 px-4">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="line-clamp-1">{callError}</span>
          </div>
        )}

        {/* Center Stage: Video Viewport or Voice Avatar */}
        <div className="relative w-full h-80 sm:h-96 bg-black flex items-center justify-center overflow-hidden">
          {/* Remote Video Stream (Main Stage) */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${callStatus === 'connected' && isVideo ? 'block' : 'hidden'}`}
          />

          {/* Voice Mode or Waiting / Ringing Placeholder */}
          {(callStatus !== 'connected' || !isVideo) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--bg-primary)] p-6 z-0">
              <div className="relative mb-4">
                <Avatar name={contactName} src={contactAvatar} size="xl" />
                {callStatus === 'connected' && (
                  <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[var(--bg-primary)]" />
                )}
              </div>

              <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] m-0">
                {contactName}
              </h3>
              <p className="text-xs font-body text-[var(--text-muted)] mt-1 m-0">
                {callStatus === 'connected'
                  ? 'WebRTC Peer-to-Peer Connection Active'
                  : callStatus === 'calling'
                  ? 'Calling participant...'
                  : 'Establishing secure media channel...'}
              </p>

              {/* Real-time Voice Waveform Visualizer */}
              {callStatus === 'connected' && (
                <div className="flex items-center gap-1.5 mt-6 h-8">
                  {[12, 22, 34, 18, 28, 14, 24, 30, 16, 26, 12, 20].map((h, i) => (
                    <span
                      key={i}
                      className="w-1 bg-[var(--accent)] rounded-full animate-pulse"
                      style={{
                        height: `${h}px`,
                        animationDuration: `${0.6 + (i % 4) * 0.2}s`,
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Picture-in-Picture Local Self Preview (Bottom Right Corner) */}
          <div
            className={`absolute bottom-3 right-3 w-28 sm:w-36 h-20 sm:h-24 rounded-xl overflow-hidden shadow-2xl border border-[var(--border)] bg-black z-20 ${
              cameraOff ? 'hidden' : 'block'
            }`}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
            <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white/90 bg-black/60 px-1.5 py-0.2 rounded">
              You {screenSharing ? '(Screen)' : ''}
            </span>
          </div>
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="w-full p-4 bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center justify-center gap-3 z-10">
          {/* Mic Mute Button */}
          <button
            type="button"
            onClick={toggleMic}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              micMuted
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          {/* Camera Toggle Button */}
          <button
            type="button"
            onClick={toggleCamera}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              cameraOff
                ? 'bg-red-500/15 border-red-500/30 text-red-400'
                : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={cameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>

          {/* Screen Share Button */}
          <button
            type="button"
            onClick={toggleScreenShare}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              screenSharing
                ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]'
                : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}
          >
            <Monitor size={18} />
          </button>

          {/* End Call Button */}
          <button
            type="button"
            onClick={handleEndCall}
            className="py-3 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold cursor-pointer transition-colors flex items-center gap-2 border-none shadow-md active:scale-95"
            title="End Call"
          >
            <PhoneOff size={18} />
            <span className="text-xs">End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
