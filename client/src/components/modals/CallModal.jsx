import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, ShieldCheck } from '../ui/Icons';
import Avatar from '../ui/Avatar';
import { playCallStartSound, playCallEndSound } from '../../utils/zyntraSound';

export const CallModal = ({ isOpen, onClose, chat, isVideo = false }) => {
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(!isVideo);
  const [screenSharing, setScreenSharing] = useState(false);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (isOpen) {
      playCallStartSound();
      setDuration(0);
      const timer = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isOpen]);

  if (!isOpen || !chat) return null;

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    playCallEndSound();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl flex flex-col items-center relative overflow-hidden">
        {/* Top Header */}
        <div className="w-full flex items-center justify-between mb-8 z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-heading font-bold">
            <ShieldCheck size={12} />
            <span>Encrypted Direct Call (Beta)</span>
          </div>

          <div className="px-3 py-1 rounded-full bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-secondary)] font-body text-xs font-semibold">
            {formatDuration(duration)}
          </div>
        </div>

        {/* Center Stage: Video View or Audio Wave Avatar */}
        <div className="my-6 flex flex-col items-center justify-center z-10 w-full">
          {!cameraOff ? (
            <div className="w-full h-56 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] relative overflow-hidden flex items-center justify-center">
              <Avatar name={chat.name} src={chat.avatar} size="lg" />
              <div className="absolute bottom-3 left-3 px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-xs text-white text-[11px] font-heading font-semibold">
                {chat.name} · 1080p
              </div>
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-heading font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="mb-4">
                <Avatar name={chat.name} src={chat.avatar} size="xl" />
              </div>
              <h3 className="text-lg font-bold font-heading text-[var(--text-primary)] m-0">{chat.name}</h3>
              <p className="text-xs font-body text-[var(--text-muted)] mt-1 m-0">Voice connection active · ChatRooms Call</p>

              {/* Audio Waveform Bars */}
              <div className="flex items-center gap-1.5 mt-6 h-8">
                {[14, 24, 32, 18, 28, 12, 22, 30, 16, 26, 14, 20].map((h, i) => (
                  <span
                    key={i}
                    className="w-1 bg-[var(--accent)] rounded-full"
                    style={{
                      height: `${h}px`,
                      opacity: 0.7 + (i % 3) * 0.15,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div className="flex items-center gap-3 mt-4 z-10">
          <button
            type="button"
            onClick={() => setMicMuted(!micMuted)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              micMuted
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={micMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          >
            {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            type="button"
            onClick={() => setCameraOff(!cameraOff)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              cameraOff
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title={cameraOff ? 'Turn Camera On' : 'Turn Camera Off'}
          >
            {cameraOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>

          <button
            type="button"
            onClick={() => setScreenSharing(!screenSharing)}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              screenSharing
                ? 'bg-[var(--accent-subtle)] border-[var(--accent)] text-[var(--accent)]'
                : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
            title="Share Screen"
          >
            <Monitor size={18} />
          </button>

          <button
            type="button"
            onClick={handleEndCall}
            className="py-3 px-5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-heading font-semibold cursor-pointer transition-colors flex items-center gap-2 border-none"
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
