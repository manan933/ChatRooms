import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  AlertTriangle,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import BrandLogo from '../ui/BrandLogo';
import socketService from '../../api/socket';
import { playCallStartSound, playCallEndSound } from '../../utils/chatroomsSound';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:80?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turns:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

const extractDmTarget = (dmId, myUsername) => {
  const idStr = String(dmId || '').toLowerCase().trim();
  const me = String(myUsername || '').toLowerCase().trim().replace(/^@/, '');
  if (!idStr.startsWith('dm_') || !me) return null;
  const body = idStr.slice(3);
  const prefix = `${me}_`;
  const suffix = `_${me}`;
  if (body.startsWith(prefix) && !body.endsWith(suffix)) {
    return body.slice(prefix.length) || null;
  }
  if (body.endsWith(suffix) && !body.startsWith(prefix)) {
    return body.slice(0, body.length - suffix.length) || null;
  }
  if (body.startsWith(prefix) && body.endsWith(suffix)) {
    const candAfter = body.slice(prefix.length);
    const candBefore = body.slice(0, body.length - suffix.length);
    return me <= candAfter ? candAfter : candBefore;
  }
  const parts = body.split('_');
  if (parts.length === 2) {
    return parts[0] === me ? parts[1] : parts[0];
  }
  return null;
};

export const CallModal = ({
  callId = null,
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
  const [facingMode, setFacingMode] = useState('user'); // 'user' (front) | 'environment' (back)
  const [duration, setDuration] = useState(0);
  const [callError, setCallError] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteAudioStreamRef = useRef(null);
  const remoteVideoStreamRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const candidateQueue = useRef([]);
  const seenCandidatesRef = useRef(new Set());
  const durationRef = useRef(0);
  const summarySentRef = useRef(false);

  // Keep callback refs stable to prevent unmount on parent re-renders
  const onCloseRef = useRef(onClose);
  const onSummaryRef = useRef(onCallEndedSummary);

  const resolveTargetUsername = () => {
    if (callerInfo?.from) return String(callerInfo.from).toLowerCase().trim().replace(/^@/, '');
    if (callerInfo?.callerUsername) return String(callerInfo.callerUsername).toLowerCase().trim().replace(/^@/, '');
    if (chat?.primaryUsername) return String(chat.primaryUsername).toLowerCase().trim().replace(/^@/, '');
    if (chat?.username) return String(chat.username).toLowerCase().trim().replace(/^@/, '');
    if (chat?.id && String(chat.id).toLowerCase().startsWith('dm_')) {
      const myUsername = (currentUser?.primaryUsername || currentUser?.username || '').toLowerCase().trim().replace(/^@/, '');
      const extracted = extractDmTarget(chat.id, myUsername);
      if (extracted) return extracted;
    }
    if (chat?.userId) return String(chat.userId).toLowerCase();
    return chat?.id ? String(chat.id).toLowerCase() : null;
  };

  const targetId = resolveTargetUsername();
  const targetIdRef = useRef(targetId);

  const chatId = chat?.id || callerInfo?.chatId;
  const chatIdRef = useRef(chatId);

  useEffect(() => {
    onCloseRef.current = onClose;
    onSummaryRef.current = onCallEndedSummary;
    targetIdRef.current = resolveTargetUsername();
    chatIdRef.current = chatId;
  }, [onClose, onCallEndedSummary, chat, callerInfo, chatId]);

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

  const attemptRemoteAudioPlay = async () => {
    const audioEl = remoteAudioRef.current;
    const audioStream = remoteAudioStreamRef.current;
    if (!audioEl || !audioStream) return;
    if (audioEl.srcObject !== audioStream) {
      audioEl.srcObject = audioStream;
    }
    audioEl.muted = false;
    audioEl.volume = 1;
    try {
      await audioEl.play();
      setAudioBlocked(false);
    } catch (err) {
      console.warn('[WebRTC] Remote audio play error:', err?.name || err?.message);
      if (err?.name === 'NotAllowedError') {
        setAudioBlocked(true);
      }
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
    setAudioBlocked(false);
    setMicMuted(false);
    setCameraOff(!isVideo);
    candidateQueue.current = [...(initialIceCandidates || [])];
    seenCandidatesRef.current.clear();

    playCallStartSound();

    const acquireLocalStream = async () => {
      if (isVideo) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          });
        } catch {
          try {
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          } catch (camErr2) {
            console.warn('[WebRTC] Camera unavailable, falling back to audio:', camErr2.message);
            if (isMounted) setCameraOff(true);
            try {
              return await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: false,
              });
            } catch {
              return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
            }
          }
        }
      }

      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch {
        return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
    };

    const startWebRtc = async () => {
      try {
        // 1. Acquire local media stream (Voice or Video) with safe audio constraints fallback
        const stream = await acquireLocalStream();

        if (!isMounted) {
          stream?.getTracks().forEach((t) => t.stop());
          return;
        }

        // Ensure microphone audio tracks start unmuted
        stream.getAudioTracks().forEach((t) => {
          t.enabled = true;
        });

        localStreamRef.current = stream;
        if (localVideoRef.current && isVideo && !cameraOff) {
          localVideoRef.current.srcObject = stream;
        }

        // 2. Instantiate RTCPeerConnection with STUN & TURN servers
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });

        // Setup separate remote audio & video streams so hidden video never blocks call audio
        remoteAudioStreamRef.current = new MediaStream();
        remoteVideoStreamRef.current = new MediaStream();

        // Prime audio element immediately so remote audio starts flowing on first RTP frame
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteAudioStreamRef.current;
          remoteAudioRef.current.muted = false;
          remoteAudioRef.current.volume = 1;
        }

        // Handle incoming remote media tracks (both audio and video)
        pc.ontrack = (event) => {
          const incomingTracks =
            event.streams && event.streams[0]
              ? event.streams[0].getTracks()
              : event.track
              ? [event.track]
              : [];

          incomingTracks.forEach((track) => {
            console.log('[WebRTC] Received remote stream track:', track.kind, track.readyState);
            if (track.kind === 'audio' && remoteAudioStreamRef.current) {
              if (!remoteAudioStreamRef.current.getTracks().some((t) => t.id === track.id)) {
                remoteAudioStreamRef.current.addTrack(track);
              }
              track.onunmute = () => {
                if (isMounted) attemptRemoteAudioPlay();
              };
              attemptRemoteAudioPlay();
            } else if (track.kind === 'video' && remoteVideoStreamRef.current) {
              if (!remoteVideoStreamRef.current.getTracks().some((t) => t.id === track.id)) {
                remoteVideoStreamRef.current.addTrack(track);
              }
              if (remoteVideoRef.current) {
                if (remoteVideoRef.current.srcObject !== remoteVideoStreamRef.current) {
                  remoteVideoRef.current.srcObject = remoteVideoStreamRef.current;
                }
                remoteVideoRef.current.muted = true;
                remoteVideoRef.current.play().catch(() => {});
              }
            }
          });
        };

        // Handle local ICE candidates and relay via Socket.io
        pc.onicecandidate = (event) => {
          if (event.candidate && targetIdRef.current) {
            socketService.sendIceCandidate({
              callId,
              to: targetIdRef.current,
              candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
              chatId: chatIdRef.current,
            });
          }
        };

        // Resilient connection state listeners
        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] Connection state:', pc.connectionState);
          if (pc.connectionState === 'connected' && isMounted) {
            setCallStatus('connected');
            attemptRemoteAudioPlay();
          } else if (pc.connectionState === 'failed') {
            if (pcRef.current && isInitiator) {
              pcRef.current.restartIce?.();
            } else if (isMounted) {
              setCallStatus('ended');
              emitCallSummary('ended');
            }
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log('[WebRTC] ICE state:', pc.iceConnectionState);
          if (pc.iceConnectionState === 'checking' && isMounted) {
            setCallStatus((prev) => (prev === 'calling' ? 'connecting' : prev));
          } else if (
            (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') &&
            isMounted
          ) {
            setCallStatus('connected');
            attemptRemoteAudioPlay();
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
            callId,
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
            callId,
            to: targetIdRef.current,
            signalData: answer,
            chatId: chatIdRef.current,
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
    const handleAnswer = async ({ callId: incomingCallId, signalData }) => {
      if (incomingCallId && callId && incomingCallId !== callId) return;
      if (pcRef.current && signalData) {
        if (pcRef.current.signalingState !== 'have-local-offer') {
          console.warn('[WebRTC] Ignoring duplicate answer in state:', pcRef.current.signalingState);
          return;
        }
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
          if (isMounted) {
            setCallStatus((prev) => (prev === 'calling' ? 'connecting' : prev));
          }
        } catch (e) {
          console.error('[WebRTC] setRemoteDescription error:', e);
        }
      }
    };

    const handleIceCandidate = async ({ callId: incomingCallId, candidate }) => {
      if (incomingCallId && callId && incomingCallId !== callId) return;
      if (!candidate || !candidate.candidate) return;
      const key = `${candidate.candidate}_${candidate.sdpMid}_${candidate.sdpMLineIndex}`;
      if (seenCandidatesRef.current.has(key)) return;
      seenCandidatesRef.current.add(key);

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

    const handleCallEnded = ({ callId: incomingCallId } = {}) => {
      if (incomingCallId && callId && incomingCallId !== callId) return;
      playCallEndSound();
      if (isMounted) {
        setCallStatus('ended');
        emitCallSummary('ended');
        endTimeout = setTimeout(() => {
          if (isMounted) onCloseRef.current?.();
        }, 600);
      }
    };

    const handleCallRejected = ({ callId: incomingCallId } = {}) => {
      if (incomingCallId && callId && incomingCallId !== callId) return;
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

      // Stop local & remote tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (remoteAudioStreamRef.current) {
        remoteAudioStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteAudioStreamRef.current = null;
      }
      if (remoteVideoStreamRef.current) {
        remoteVideoStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteVideoStreamRef.current = null;
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [isOpen]);

  // Synchronize remote audio & video streams whenever call connects
  useEffect(() => {
    if (callStatus === 'connected') {
      attemptRemoteAudioPlay();
      if (isVideo && remoteVideoRef.current && remoteVideoStreamRef.current) {
        if (remoteVideoRef.current.srcObject !== remoteVideoStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteVideoStreamRef.current;
        }
        remoteVideoRef.current.muted = true;
        remoteVideoRef.current.play().catch(() => {});
      }
    }
  }, [callStatus, isVideo]);

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

  // ── Controls: Camera Flip (Front <-> Back Camera) ────────────
  const switchCamera = async () => {
    if (!isVideo || !localStreamRef.current || !pcRef.current) return;

    const nextFacingMode = facingMode === 'user' ? 'environment' : 'user';
    try {
      // 1. Request video stream from the other camera
      let newStream = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: nextFacingMode } },
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: nextFacingMode } },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (!newVideoTrack) return;

      // 2. Stop old video track to release hardware
      const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldVideoTrack) {
        oldVideoTrack.stop();
        localStreamRef.current.removeTrack(oldVideoTrack);
      }

      // 3. Add new track to local stream
      localStreamRef.current.addTrack(newVideoTrack);

      // 4. Hot-swap track on peer connection sender without renegotiation
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      } else {
        pcRef.current.addTrack(newVideoTrack, localStreamRef.current);
      }

      // 5. Update local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }

      setFacingMode(nextFacingMode);
      setCameraOff(false);
    } catch (err) {
      console.warn('[WebRTC] Camera flip failed:', err.message);
    }
  };

  // ── End Call ────────────────────────────────────────────────
  const handleEndCall = () => {
    playCallEndSound();
    if (targetIdRef.current) {
      socketService.endCall({ to: targetIdRef.current, chatId: chatIdRef.current, callId });
    }
    emitCallSummary('ended');
    setCallStatus('ended');
    onCloseRef.current?.();
  };

  const contactName = chat?.name || callerInfo?.callerName || 'Participant';
  const contactAvatar = chat?.avatar || callerInfo?.callerAvatar;

  return (
    <div
      onClick={() => {
        if (audioBlocked) attemptRemoteAudioPlay();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn"
    >
      {/* Dedicated audio element: Guarantees continuous remote voice stream playback for both Voice & Video calls */}
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
                {callStatus === 'connecting' ? 'Connecting...' : isInitiator ? 'Ringing...' : 'Connecting...'}
              </span>
            )}

            <div className="px-2 py-0.5 rounded-md bg-[var(--bg-primary)] text-[10px] text-[var(--text-muted)] border border-[var(--border)] hidden sm:block">
              P2P Encrypted
            </div>
          </div>
        </div>

        {/* Autoplay blocked banner so user can unlock call audio in one tap */}
        {audioBlocked && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              attemptRemoteAudioPlay();
            }}
            className="w-full p-2.5 bg-amber-500/20 hover:bg-amber-500/30 border-b border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 px-4 cursor-pointer border-x-0 border-t-0 animate-pulse"
          >
            <AlertTriangle size={14} className="shrink-0" />
            <span>Tap here to enable call audio</span>
          </button>
        )}

        {/* Call Error Notice if Permissions or Media Failed */}
        {callError && (
          <div className="w-full p-2.5 bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs flex items-center gap-2 px-4">
            <AlertTriangle size={14} className="shrink-0" />
            <span className="line-clamp-1">{callError}</span>
          </div>
        )}

        {/* Center Stage: Video Viewport or Voice Avatar */}
        <div className="relative w-full h-80 sm:h-96 bg-black flex items-center justify-center overflow-hidden">
          {/* Remote Video Stream (Main Stage) - muted so all audio flows cleanly through remoteAudioRef */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
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
              className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : 'scale-x-1'}`}
            />
            <span className="absolute bottom-1 left-1.5 text-[9px] font-bold text-white/90 bg-black/60 px-1.5 py-0.2 rounded">
              You ({facingMode === 'user' ? 'Front' : 'Back'})
            </span>
          </div>
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="w-full p-4 pb-[max(16px,env(safe-area-inset-bottom))] bg-[var(--bg-secondary)] border-t border-[var(--border)] flex items-center justify-center gap-3 z-10">
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

          {/* Flip / Switch Camera Button (Front <-> Back Camera for Video Calls) */}
          {isVideo && (
            <button
              type="button"
              onClick={switchCamera}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                facingMode === 'environment'
                  ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]'
                  : 'bg-[var(--bg-primary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
              title={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
              aria-label={facingMode === 'user' ? 'Switch to Back Camera' : 'Switch to Front Camera'}
            >
              <SwitchCamera size={18} />
            </button>
          )}

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
