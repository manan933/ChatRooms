import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Palette,
  Bell,
  Building2,
  Lock,
  Upload,
  Loader2,
  Check,
  Copy,
  Volume2,
  KeyRound,
  Download,
  Laptop,
  BellOff,
  Ban,
  SendHorizontal,
  LogOut,
  ShieldCheck,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import Avatar from '../ui/Avatar';
import useThemeStore from '../../store/themeStore';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import api from '../../api/api';
import BrandLogo from '../ui/BrandLogo';
import notificationService from '../../utils/notificationService';
import { playReceivedSound } from '../../utils/zyntraSound';

const STATUS_PRESETS = [
  'Deep in Code 💻',
  'Coffee break ☕',
  'Deploying updates 🚀',
  'Focused / DND 🔕',
  'Available to chat ✨',
];

export const SettingsModal = ({
  isOpen,
  onClose,
  user,
  onUpdateProfile,
  onOpenWorkspaceModal,
}) => {
  const [activeTab, setActiveTab] = useState('profile');

  // Profile Form state
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || 'Communicating on ChatRooms.');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Sync user prop when opening
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || 'Communicating on ChatRooms.');
      setPhone(user.phone || '');
      setAvatarUrl(user.avatar || '');
    }
  }, [user, isOpen]);

  // Preferences with localStorage persistence
  const [readReceipts, setReadReceipts] = useState(() => {
    try {
      return localStorage.getItem('chatrooms_read_receipts') !== 'false';
    } catch {
      return true;
    }
  });

  const [desktopPush, setDesktopPush] = useState(() => {
    try {
      return localStorage.getItem('chatrooms_desktop_push') !== 'false';
    } catch {
      return true;
    }
  });

  const [dndMode, setDndMode] = useState(() => {
    try {
      return localStorage.getItem('chatrooms_dnd') === 'true';
    } catch {
      return false;
    }
  });

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const fileInputRef = useRef(null);

  const { theme, setTheme, soundEnabled, setSoundEnabled } = useThemeStore();
  const { logout } = useAuthStore();
  const {
    workspaces,
    mutedChats = [],
    blockedUsers = [],
    toggleMuteChat,
    unblockUser,
    contacts = [],
    groups = [],
  } = useChatStore();

  const [notifPermission, setNotifPermission] = useState(
    notificationService.getPermissionState()
  );
  const [testNotifSent, setTestNotifSent] = useState(false);

  const handleToggleReadReceipts = (val) => {
    setReadReceipts(val);
    try {
      localStorage.setItem('chatrooms_read_receipts', String(val));
    } catch {}
  };

  const handleToggleDesktopPush = (val) => {
    setDesktopPush(val);
    try {
      localStorage.setItem('chatrooms_desktop_push', String(val));
    } catch {}
  };

  const handleToggleDnd = (val) => {
    setDndMode(val);
    try {
      localStorage.setItem('chatrooms_dnd', String(val));
    } catch {}
  };

  const handleRequestPushPermission = async () => {
    const res = await notificationService.requestPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      setSuccessMsg('Realtime system notifications are active!');
      setTimeout(() => setSuccessMsg(null), 3500);
    }
  };

  const handleTestSystemNotification = async () => {
    await notificationService.notifyMessage({
      title: 'ChatRooms 🔔',
      body: 'Realtime notifications are working on your device just like WhatsApp!',
      chatId: null,
    });
    setTestNotifSent(true);
    setTimeout(() => setTestNotifSent(false), 3000);
  };

  const handleAvatarFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);
    try {
      const res = await api.upload.file(file);
      if (res.ok && res.data?.url) {
        setAvatarUrl(res.data.url);
      } else {
        setErrorMsg('Failed to upload picture. Please try another file.');
      }
    } catch {
      setErrorMsg('Failed to upload picture. Network error.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const res = await onUpdateProfile({
      name: name.trim(),
      avatar: avatarUrl.trim() || null,
      bio: bio.trim(),
      phone: phone.trim(),
    });

    setIsSaving(false);
    if (res?.success) {
      setSuccessMsg('Profile changes saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3500);
    } else {
      setErrorMsg(res?.error || 'Failed to update profile');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('Please provide both your current and new password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const res = await api.auth.updatePassword({
        currentPassword: currentPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (res.ok && res.data?.success) {
        setPasswordMsg('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMsg(null), 4000);
      } else {
        setPasswordError(res.error || res.data?.message || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError(err.message || 'Error communicating with server');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleInstallPwa = async () => {
    if (window.chatroomsInstallPrompt) {
      try {
        window.chatroomsInstallPrompt.prompt();
        const choice = await window.chatroomsInstallPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setSuccessMsg('ChatRooms installed successfully!');
        }
      } catch (e) {
        console.error('Install prompt error:', e);
      }
    } else {
      alert(
        'To install ChatRooms app:\n' +
        '• On Windows Chrome / Edge: Click the install icon (⊕) on the right side of the address bar.\n' +
        '• On Android Chrome: Tap the 3 dots menu ⋮ and select "Add to Home screen" or "Install App".\n' +
        '• On iOS Safari: Tap the Share button and tap "Add to Home Screen".'
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <BrandLogo variant="icon" size="sm" />
          <span className="font-heading font-bold text-base sm:text-lg">Settings</span>
        </div>
      }
      size="lg"
    >
      <div className="flex flex-col md:flex-row gap-5 min-h-[460px] font-heading">
        {/* ── Left Sidebar Navigation ────────────────────────────────── */}
        <div className="w-full md:w-52 shrink-0 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 border-b md:border-b-0 md:border-r border-[var(--border)] pr-0 md:pr-4">
          {[
            { id: 'profile', label: 'My Profile', icon: User },
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'notifications', label: 'Notifications & Sound', icon: Bell },
            { id: 'workplaces', label: 'Workplaces', icon: Building2 },
            { id: 'account', label: 'Security & Login', icon: Lock },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setSuccessMsg(null);
                  setErrorMsg(null);
                  setPasswordMsg(null);
                  setPasswordError(null);
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border-none text-left shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-hover)] text-white shadow-md'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] bg-transparent'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-white' : 'text-[var(--accent)]'} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          <div className="mt-auto pt-4 hidden md:flex flex-col items-center border-t border-[var(--border)]">
            <BrandLogo variant="lockup" size="sm" className="opacity-90" />
            <span className="text-[11px] font-body text-[var(--text-muted)] mt-1.5 font-medium">v2.0 · ChatRooms</span>
          </div>
        </div>

        {/* ── Right Content Panel ────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col justify-between overflow-y-auto custom-scrollbar pr-1 font-body">
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm mb-4 flex items-center gap-2 font-heading font-semibold">
              <Check size={16} /> <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs sm:text-sm mb-4 font-heading font-semibold">
              {errorMsg}
            </div>
          )}

          {/* ──────────────── TAB 1: PROFILE ──────────────────────────── */}
          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
              {/* Avatar Preview & Upload */}
              <div className="flex items-center gap-4 p-4 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleAvatarFile(e.target.files[0]);
                    e.target.value = '';
                  }}
                />

                <Avatar name={name || user?.name} src={avatarUrl} size="lg" />

                <div className="flex flex-col gap-2 min-w-0 font-heading">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="py-1.5 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-colors flex items-center gap-2 border-none shadow-sm"
                    >
                      {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      <span>Upload Picture</span>
                    </button>
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setAvatarUrl('')}
                        className="py-1.5 px-3 text-xs sm:text-sm text-red-400 hover:bg-red-500/10 rounded-xl bg-transparent border-none cursor-pointer font-semibold"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-[var(--text-muted)] font-body">
                    Visible across connected ChatRooms channels.
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1.5">
                    Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  />
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1.5">
                    Username
                  </label>
                  <div className="flex items-center gap-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl px-3.5 py-2.5">
                    <span className="text-sm font-heading font-semibold text-[var(--text-muted)] flex-1 truncate">
                      @{user?.primaryUsername || 'user'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(`@${user?.primaryUsername || 'user'}`, 'username')}
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer"
                      title="Copy handle"
                    >
                      {copiedCode === 'username' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1.5">
                  Status Note / Bio
                </label>
                <input
                  type="text"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What are you working on?"
                  className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] mb-2"
                />
                <div className="flex flex-wrap gap-1.5 font-heading">
                  {STATUS_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setBio(preset)}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || 'user@chatrooms.app'}
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-muted)] opacity-75 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1.5">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full mt-2 py-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-heading font-bold transition-all cursor-pointer border-none shadow-md flex items-center justify-center gap-2"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>Save Profile Changes</span>
              </button>
            </form>
          )}

          {/* ──────────────── TAB 2: APPEARANCE ───────────────────────── */}
          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-5 font-heading">
              <div>
                <label className="text-sm font-bold text-[var(--text-primary)] block mb-3">
                  Color Theme (Exclusive Two Modes)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Theme 2: Midnight Dark */}
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      theme === 'dark'
                        ? 'bg-[var(--bg-secondary)] border-[#0297DE] ring-2 ring-[#0297DE]/40 shadow-lg'
                        : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {theme === 'dark' && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#0297DE] text-black text-[11px] font-bold flex items-center gap-1 shadow-xs">
                        <Check size={12} strokeWidth={3} />
                        <span>Active</span>
                      </div>
                    )}
                    <div className="w-full h-16 rounded-xl bg-[#02070A] border border-[#0297DE]/30 p-2.5 flex flex-col justify-between mb-3 shadow-inner">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#0297DE]" />
                        <div className="w-14 h-2 rounded-full bg-[#0297DE]/60" />
                      </div>
                      <div className="w-10 h-2.5 rounded-full bg-[#FC734D] self-end" />
                    </div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Midnight Dark</div>
                    <div className="text-xs font-body text-[var(--text-muted)] mt-1">
                      Midnight Black <code className="text-[#0297DE]">#02070A</code> · Electric Blue <code className="text-[#0297DE]">#0297DE</code> · Cantaloupe Orange <code className="text-[#FC734D]">#FC734D</code>
                    </div>
                  </button>

                  {/* Theme 1: Skyblue Vibrant */}
                  <button
                    type="button"
                    onClick={() => setTheme('light')}
                    className={`relative p-3.5 rounded-2xl border text-left cursor-pointer transition-all ${
                      theme === 'light'
                        ? 'bg-[var(--bg-secondary)] border-[#0593C6] ring-2 ring-[#0593C6]/40 shadow-lg'
                        : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {theme === 'light' && (
                      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-[#0593C6] text-white text-[11px] font-bold flex items-center gap-1 shadow-xs">
                        <Check size={12} strokeWidth={3} />
                        <span>Active</span>
                      </div>
                    )}
                    <div className="w-full h-16 rounded-xl bg-[#FCFFFF] border border-[#0593C6]/30 p-2.5 flex flex-col justify-between mb-3 shadow-inner">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#0593C6]" />
                        <div className="w-14 h-2 rounded-full bg-[#0593C6]/60" />
                      </div>
                      <div className="w-10 h-2.5 rounded-full bg-[#D83995] self-end" />
                    </div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Skyblue Vibrant</div>
                    <div className="text-xs font-body text-[var(--text-muted)] mt-1">
                      Sky Blue <code className="text-[#0593C6]">#0593C6</code> · White <code className="text-[var(--text-primary)]">#FCFFFF</code> · Hot Pink <code className="text-[#D83995]">#D83995</code>
                    </div>
                  </button>
                </div>
              </div>

              {/* Progressive Web App Status & Install Section */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Laptop size={16} className="text-[var(--accent)]" />
                      <span>Progressive Web App (PWA)</span>
                    </div>
                    <div className="text-xs font-body text-[var(--text-muted)] mt-1">
                      Install ChatRooms as a fast standalone app on Windows, Mac, Android, or iOS.
                    </div>
                  </div>
                  {typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 shrink-0">
                      <Check size={14} /> Installed as App
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleInstallPwa}
                      className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs sm:text-sm font-bold cursor-pointer transition-colors flex items-center gap-2 border-none shadow-sm shrink-0"
                    >
                      <Download size={14} />
                      <span>Install App</span>
                    </button>
                  )}
                </div>
                <div className="text-xs font-body text-[var(--text-muted)] border-t border-[var(--border)] pt-2.5 flex items-center justify-between">
                  <span>Service Worker Cache: Active</span>
                  <span>Hardware accelerated · Instant wakeup</span>
                </div>
              </div>
            </div>
          )}

          {/* ──────────────── TAB 3: NOTIFICATIONS & PRIVACY ────────── */}
          {activeTab === 'notifications' && (
            <div className="flex flex-col gap-4 font-heading">
              {/* Native System Push Notifications (Android & Windows WhatsApp Style) */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                      <Bell size={16} className="text-[var(--accent)]" />
                      <span>Realtime System Notifications (Android & Windows)</span>
                    </div>
                    <div className="text-xs font-body text-[var(--text-muted)] mt-1 leading-relaxed">
                      Receive heads-up banners, vibration, and audio rings just like WhatsApp on Android and Windows Action Center, even when ChatRooms is minimized.
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${
                      notifPermission === 'granted'
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : notifPermission === 'denied'
                        ? 'bg-red-500/15 border-red-500/30 text-red-400'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {notifPermission === 'granted'
                      ? '● Active'
                      : notifPermission === 'denied'
                      ? '✕ Blocked in Browser'
                      : '○ Needs Permission'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-[var(--border)]">
                  {notifPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestPushPermission}
                      className="py-2 px-3.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs sm:text-sm font-bold border-none cursor-pointer flex items-center gap-2 shadow-sm transition-transform active:scale-95"
                    >
                      <Check size={14} />
                      <span>Enable System Notifications</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTestSystemNotification}
                    disabled={testNotifSent}
                    className="py-2 px-3.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl text-xs sm:text-sm font-semibold cursor-pointer flex items-center gap-2 transition-colors"
                  >
                    <SendHorizontal size={14} />
                    <span>{testNotifSent ? 'Notification Sent!' : 'Send Test Notification'}</span>
                  </button>
                </div>
              </div>

              {/* Synthesized Audio Effects */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Volume2 size={16} className="text-[var(--accent)]" />
                    <span>Synthesized Audio Effects</span>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--accent)]/15 text-[var(--accent)] text-[10px] font-bold">
                      Web Audio
                    </span>
                  </div>
                  <div className="text-xs font-body text-[var(--text-muted)] mt-1">
                    Play gentle synthesized audio chimes for incoming messages and reactions
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => playReceivedSound()}
                    className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer flex items-center gap-1.5"
                  >
                    <Volume2 size={13} /> Test Sound
                  </button>
                  <input
                    type="checkbox"
                    checked={soundEnabled}
                    onChange={(e) => setSoundEnabled(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Do Not Disturb & Read Receipts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Do Not Disturb</div>
                    <div className="text-xs font-body text-[var(--text-muted)] mt-0.5">Mute incoming sound rings</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={dndMode}
                    onChange={(e) => handleToggleDnd(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--text-primary)]">Read Receipts</div>
                    <div className="text-xs font-body text-[var(--text-muted)] mt-0.5">1 tick sent · 2 ticks seen</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={readReceipts}
                    onChange={(e) => handleToggleReadReceipts(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* ── Muted Conversations Manager ───────────────────────── */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <BellOff size={16} className="text-[var(--accent-highlight)]" />
                    <span>Muted Conversations ({mutedChats.length})</span>
                  </div>
                </div>
                {mutedChats.length === 0 ? (
                  <p className="text-xs font-body text-[var(--text-muted)] m-0 italic">
                    No chats or channels are currently muted.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                    {mutedChats.map((chatId) => {
                      const matchContact = contacts.find((c) => c.id === chatId);
                      const matchGroup = groups.find((g) => g.id === chatId);
                      const label = matchContact?.name || matchGroup?.name || chatId;
                      return (
                        <div
                          key={chatId}
                          className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
                              {label}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => toggleMuteChat(chatId)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)] cursor-pointer"
                          >
                            Unmute
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ── Blocked Contacts Manager ─────────────────────────── */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Ban size={16} className="text-red-400" />
                    <span>Blocked Users ({blockedUsers.length})</span>
                  </div>
                </div>
                {blockedUsers.length === 0 ? (
                  <p className="text-xs font-body text-[var(--text-muted)] m-0 italic">
                    You have not blocked any contacts.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                    {blockedUsers.map((ident) => (
                      <div
                        key={ident}
                        className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between gap-2"
                      >
                        <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] truncate">
                          @{ident}
                        </span>
                        <button
                          type="button"
                          onClick={() => unblockUser(ident)}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──────────────── TAB 4: WORKPLACES ───────────────────────── */}
          {activeTab === 'workplaces' && (
            <div className="flex flex-col gap-4 font-heading">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">Active Workplaces</div>
                  <div className="text-xs font-body text-[var(--text-muted)] mt-0.5">
                    Teams and workspaces you are participating in
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenWorkspaceModal?.();
                  }}
                  className="px-3.5 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs sm:text-sm font-bold border-none cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  + Add Workplace
                </button>
              </div>

              <div className="space-y-3">
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className="p-3.5 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-white font-bold text-sm flex items-center justify-center shadow-xs">
                        {ws.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-xs sm:text-sm font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          <span>{ws.name}</span>
                        </div>
                        <div className="text-xs font-body text-[var(--text-muted)] mt-0.5">
                          {ws.membersCount || 1} members · {ws.nodes?.length || 1} channels
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(ws.joinCode || 'WS-001', ws.id)}
                        className="px-3 py-1.5 bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-[var(--text-secondary)] rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5 transition-colors"
                        title="Copy Invite Code"
                      >
                        {copiedCode === ws.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        <span>Code</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ──────────────── TAB 5: ACCOUNT & SECURITY ───────────────── */}
          {activeTab === 'account' && (
            <div className="flex flex-col gap-5 font-heading">
              {/* Account Overview Box */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-3">
                <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-400" />
                  <span>Account Credentials & Session</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-body">
                  <div className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Primary Handle</span>
                    <span className="text-[var(--text-primary)] font-bold text-sm font-heading">@{user?.primaryUsername || 'user'}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)]">
                    <span className="text-[var(--text-muted)] block text-[11px]">Registered Email</span>
                    <span className="text-[var(--text-primary)] font-semibold text-xs truncate block">{user?.email || 'user@chatrooms.app'}</span>
                  </div>
                </div>
              </div>

              {/* Password Change Form */}
              <form onSubmit={handlePasswordSubmit} className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex flex-col gap-3.5">
                <div className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <KeyRound size={16} className="text-[var(--accent)]" />
                  <span>Update Account Password</span>
                </div>

                {passwordMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs sm:text-sm font-semibold flex items-center gap-2">
                    <Check size={15} /> <span>{passwordMsg}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs sm:text-sm font-semibold">
                    {passwordError}
                  </div>
                )}

                <div className="space-y-3 font-body">
                  <div>
                    <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      required
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="At least 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        placeholder="Re-enter new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-sm font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="self-end py-2 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs sm:text-sm font-bold rounded-xl border-none cursor-pointer shadow-sm flex items-center gap-2 mt-1 transition-all"
                >
                  {isUpdatingPassword ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>Update Password</span>
                </button>
              </form>

              {/* Logout Session Button */}
              <div className="p-4 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">Log Out Session</div>
                  <div className="text-xs font-body text-[var(--text-muted)] mt-0.5">Sign out on this device</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    logout();
                  }}
                  className="py-2 px-3.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 text-xs sm:text-sm font-bold cursor-pointer flex items-center gap-2 transition-colors"
                >
                  <LogOut size={15} />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default SettingsModal;
