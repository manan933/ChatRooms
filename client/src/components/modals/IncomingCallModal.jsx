import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video } from '../ui/Icons';
import Avatar from '../ui/Avatar';
import BrandLogo from '../ui/BrandLogo';
import { playCallStartSound, playCallEndSound } from '../../utils/chatroomsSound';

export const IncomingCallModal = ({
  incomingCall,
  onAccept,
  onDecline,
}) => {
  useEffect(() => {
    if (incomingCall) {
      playCallStartSound();
      // Ring periodically every 2.5s
      const ringTimer = setInterval(() => {
        playCallStartSound();
      }, 2500);
      return () => clearInterval(ringTimer);
    }
  }, [incomingCall]);

  if (!incomingCall) return null;

  const { callerName, callerAvatar, isVideo } = incomingCall;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm select-none animate-fadeIn">
      <div className="w-full max-w-sm bg-[var(--bg-primary)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center font-heading">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] text-[11px] font-bold mb-6">
          <BrandLogo variant="icon" size="sm" className="w-4 h-4" />
          <span>Incoming WebRTC {isVideo ? 'Video' : 'Voice'} Call</span>
        </div>

        <div className="relative mb-4">
          <Avatar name={callerName || 'Participant'} src={callerAvatar} size="xl" />
          <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] animate-ping opacity-60" />
        </div>

        <h3 className="text-base font-bold text-[var(--text-primary)] m-0">
          {callerName || 'Participant'}
        </h3>
        <p className="text-xs font-body text-[var(--text-muted)] mt-1 mb-8">
          {isVideo ? 'Incoming video invitation...' : 'Incoming encrypted voice call...'}
        </p>

        {/* Accept / Decline Action Buttons */}
        <div className="flex items-center gap-6">
          {/* Decline */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                playCallEndSound();
                onDecline?.();
              }}
              className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 border-none shadow-lg"
              title="Decline Call"
            >
              <PhoneOff size={22} />
            </button>
            <span className="text-[11px] text-[var(--text-muted)] font-semibold">Decline</span>
          </div>

          {/* Accept */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={onAccept}
              className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center cursor-pointer transition-transform hover:scale-105 active:scale-95 border-none shadow-lg"
              title="Accept Call"
            >
              {isVideo ? <Video size={22} /> : <Phone size={22} />}
            </button>
            <span className="text-[11px] text-emerald-400 font-semibold">Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
