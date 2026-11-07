import React, { useState, useEffect } from 'react';
import { Download, X, WifiOff, Wifi } from './Icons';
import BrandLogo from './BrandLogo';

export function InstallPwaPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [onlineNotice, setOnlineNotice] = useState(false);

  useEffect(() => {
    // Check if already in standalone PWA mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if dismissed recently (within 5 days)
    const dismissedAt = localStorage.getItem('chatrooms_pwa_dismissed');
    if (dismissedAt && Date.now() - Number(dismissedAt) < 5 * 24 * 60 * 60 * 1000) {
      setIsDismissed(true);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      window.chatroomsInstallPrompt = e;
    };

    const handleAppInstalled = () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
      window.chatroomsInstallPrompt = null;
    };

    const handleOnline = () => {
      setIsOnline(true);
      setOnlineNotice(true);
      setTimeout(() => setOnlineNotice(false), 3500);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.chatroomsInstallPrompt;
    if (!promptEvent) return;

    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
    window.chatroomsInstallPrompt = null;
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('chatrooms_pwa_dismissed', Date.now().toString());
  };

  return (
    <>
      {/* Offline Status Banner */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 bg-[var(--danger,#e11d48)] text-white text-xs font-heading font-medium flex items-center justify-center gap-2 shadow-md transition-transform duration-300"
        >
          <WifiOff size={15} />
          <span>Offline mode. Messages will be sent and synchronized once your connection is restored.</span>
        </div>
      )}

      {/* Reconnected Status Banner */}
      {isOnline && onlineNotice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-[100] px-4 py-2 bg-[var(--accent,#0297DE)] text-white text-xs font-heading font-medium flex items-center justify-center gap-2 shadow-md transition-transform duration-300 animate-fadeIn"
        >
          <Wifi size={15} />
          <span>Connection restored. ChatRooms is synchronized.</span>
        </div>
      )}

      {/* Install PWA Prompt Banner */}
      {isInstallable && !isDismissed && (
        <div
          role="region"
          aria-label="Install ChatRooms App"
          className="fixed bottom-4 right-4 z-50 max-w-sm w-[calc(100%-2rem)] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl p-3.5 shadow-2xl flex items-center gap-3 animate-fadeIn"
        >
          <div className="shrink-0">
            <BrandLogo variant="icon" size="md" />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-heading font-bold text-[var(--text-primary)] leading-tight truncate">
              Install ChatRooms
            </h4>
            <p className="text-[11px] font-body text-[var(--text-secondary)] leading-tight mt-0.5 line-clamp-2">
              Add to desktop or mobile home screen for fast native access and offline support.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-xl text-xs font-heading font-semibold cursor-pointer transition-colors flex items-center gap-1.5 border-none shadow-xs"
              aria-label="Install App"
            >
              <Download size={13} />
              <span>Install</span>
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors border-none bg-transparent cursor-pointer"
              aria-label="Dismiss install prompt"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default InstallPwaPrompt;
