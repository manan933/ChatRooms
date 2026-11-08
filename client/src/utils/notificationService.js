// ========================================================
// ChatRooms Real-time Native & Web Notification Service
// Cross-platform support: Android PWA, Windows 10/11 Toast, macOS, Linux
// ========================================================

class NotificationService {
  constructor() {
    this.permission = typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default';
  }

  isSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  getPermissionState() {
    if (!this.isSupported()) return 'unsupported';
    return Notification.permission;
  }

  async requestPermission() {
    if (!this.isSupported()) return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      return result;
    } catch (e) {
      console.warn('[Notification] requestPermission error:', e);
      return Notification.permission;
    }
  }

  async notifyMessage({ title, body, icon, tag, chatId }) {
    if (!this.isSupported() || Notification.permission !== 'granted') return null;

    const notifOptions = {
      body: body || 'New message on ChatRooms',
      icon: icon || '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png',
      tag: tag || chatId || 'chatrooms-msg',
      renotify: true,
      vibrate: [200, 100, 200],
      data: { chatId, url: '/' },
    };

    // 1. Android PWA & Windows Service Worker registration (native system integration)
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          return await registration.showNotification(title || 'ChatRooms', notifOptions);
        }
      }
    } catch (swErr) {
      console.warn('[Notification] SW showNotification fallback:', swErr);
    }

    // 2. Direct browser notification fallback (desktop windows / mac)
    try {
      const notif = new Notification(title || 'ChatRooms', notifOptions);
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
      return notif;
    } catch (e) {
      console.warn('[Notification] notification fallback error:', e);
      return null;
    }
  }

  async notifyCall({ callerName, isVideo = false, chatId }) {
    if (!this.isSupported() || Notification.permission !== 'granted') return null;

    const title = isVideo
      ? `📹 Video Call from ${callerName || 'Someone'}`
      : `📞 Voice Call from ${callerName || 'Someone'}`;

    return this.notifyMessage({
      title,
      body: 'Tap to answer or return to ChatRooms',
      icon: '/android-chrome-192x192.png',
      tag: 'chatrooms-call',
      chatId,
    });
  }
}

export const notificationService = new NotificationService();
export default notificationService;
