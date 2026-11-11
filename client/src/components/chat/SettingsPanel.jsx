import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Bell,
  Building2,
  Lock,
  Upload,
  Loader2,
  Check,
  Moon,
  Sun,
  Volume2,
  VolumeX,
  LogOut,
  ChevronRight,
} from '../ui/Icons';
import Avatar from '../ui/Avatar';
import useThemeStore from '../../store/themeStore';
import useChatStore from '../../store/chatStore';
import useAuthStore from '../../store/authStore';
import api from '../../api/api';
import notificationService from '../../utils/notificationService';

const STATUS_PRESETS = [
  'Available to chat ✨',
  'Deep in Code 💻',
  'Deploying updates 🚀',
  'Coffee break ☕',
  'Focused / DND 🔕',
];

export const SettingsPanel = ({
  onClose,
  user,
  onUpdateProfile,
  onOpenWorkspaceModal,
}) => {
  const [section, setSection] = useState('main'); // 'main' | 'profile' | 'notifications' | 'privacy' | 'workplaces'
  
  // Profile state
  const [name, setName] = useState(user?.name || '');
  const [bio, setBio] = useState(user?.bio || 'Communicating on ChatRooms.');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || '');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState(null);
  const [passwordError, setPasswordError] = useState(null);

  const fileInputRef = useRef(null);

  const { theme, toggleTheme, soundEnabled, toggleSound } = useThemeStore();
  const { logout } = useAuthStore();
  const {
    workspaces = [],
    blockedUsers = [],
    unblockUser,
  } = useChatStore();

  const [notifPermission, setNotifPermission] = useState(
    notificationService.getPermissionState()
  );

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setBio(user.bio || 'Communicating on ChatRooms.');
      setAvatarUrl(user.avatar || '');
    }
  }, [user]);

  const handleAvatarFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setErrorMsg(null);

    let uploadedUrl = null;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!uploadedUrl && e.target?.result) {
        setAvatarUrl(e.target.result);
      }
    };
    reader.readAsDataURL(file);

    try {
      const res = await api.upload.file(file);
      if (res.ok && res.data?.url) {
        uploadedUrl = res.data.url;
        setAvatarUrl(res.data.url);
      }
    } catch {
      // Fallback to preview data URL if upload fails (server still offloads to Media on save)
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    setIsSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const res = await onUpdateProfile({
      name: name.trim(),
      avatar: avatarUrl.trim() || null,
      bio: bio.trim(),
    });

    setIsSaving(false);
    if (res?.success) {
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    } else {
      setErrorMsg(res?.error || 'Failed to update profile');
    }
  };

  const handleQuickStatus = async (preset) => {
    setBio(preset);
    await onUpdateProfile({
      name: name.trim(),
      avatar: avatarUrl.trim() || null,
      bio: preset,
    });
    setSuccessMsg('Status updated!');
    setTimeout(() => setSuccessMsg(null), 2500);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg(null);
    setPasswordError(null);

    if (!currentPassword || !newPassword) {
      setPasswordError('Please provide both current and new password.');
      return;
    }
    if (newPassword.trim().length < 6) {
      setPasswordError('New password must be at least 6 characters.');
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
        setPasswordMsg('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPasswordMsg(null), 3500);
      } else {
        setPasswordError(res.error || res.data?.message || 'Failed to update password');
      }
    } catch (err) {
      setPasswordError(err.message || 'Error communicating with server');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleEnablePush = async () => {
    const res = await notificationService.requestPermission();
    setNotifPermission(res);
    if (res === 'granted') {
      await notificationService.notifyMessage({
        title: 'ChatRooms 🔔',
        body: 'Realtime notifications are active on this device!',
        chatId: null,
      });
      setSuccessMsg('Push notifications enabled!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  return (
    <div className="flex flex-col w-full h-full bg-[var(--bg-secondary)] border-r border-[var(--border)] overflow-hidden select-none font-heading z-20">
      {/* ── WhatsApp-Style Header ───────────────────────────────────── */}
      <div className="h-16 sm:h-17 px-4 flex items-center gap-3 border-b border-[var(--border)] shrink-0 pt-[env(safe-area-inset-top)] bg-[var(--bg-secondary)]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            if (section !== 'main') {
              setSection('main');
              setSuccessMsg(null);
              setErrorMsg(null);
            } else {
              onClose();
            }
          }}
          className="p-2 -ml-1 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center shrink-0"
          title="Back"
          aria-label="Back"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-base sm:text-lg font-heading font-bold text-[var(--text-primary)] m-0 truncate">
          {section === 'profile'
            ? 'Edit Profile'
            : section === 'notifications'
            ? 'Notifications & Sounds'
            : section === 'privacy'
            ? 'Privacy & Security'
            : section === 'workplaces'
            ? 'Workplaces'
            : 'Settings'}
        </h2>
      </div>

      {successMsg && (
        <div className="p-3 mx-3.5 mt-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <Check size={14} /> <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 mx-3.5 mt-2 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-semibold animate-fadeIn">
          {errorMsg}
        </div>
      )}

      {/* ── MAIN MENU ───────────────────────────────────────────────── */}
      {section === 'main' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {/* User Profile Card (Click to edit) */}
          <div
            onClick={() => setSection('profile')}
            className="p-3.5 rounded-2xl bg-[var(--bg-tertiary)]/80 hover:bg-[var(--bg-tertiary)] border border-[var(--border)] flex items-center gap-3.5 cursor-pointer transition-all shadow-xs"
          >
            <Avatar name={user?.name || 'User'} src={user?.avatar} size="lg" status="online" />
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold text-[var(--text-primary)] truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-xs text-[var(--accent)] font-chat truncate">
                @{user?.primaryUsername || user?.username || 'user'}
              </div>
              <div className="text-xs text-[var(--text-muted)] font-chat truncate mt-0.5">
                {user?.bio || 'Communicating on ChatRooms.'}
              </div>
            </div>
            <ChevronRight size={18} className="text-[var(--text-muted)] shrink-0" />
          </div>

          {/* Quick Status Chips */}
          <div className="p-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] block mb-1.5 px-1">
              Quick Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleQuickStatus(preset)}
                  className={`px-2.5 py-1 rounded-full text-xs font-chat border cursor-pointer transition-all ${
                    bio === preset
                      ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                      : 'bg-[var(--bg-tertiary)]/60 text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Settings Menu List */}
          <div className="rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {/* Theme Toggle Item */}
            <div
              onClick={toggleTheme}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                  {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">Theme</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {theme === 'dark' ? 'Midnight Aurora (Dark)' : 'Daylight Sky (Light)'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-bold text-[var(--accent)] px-2.5 py-1 rounded-lg bg-[var(--accent-subtle)]">
                {theme === 'dark' ? 'Dark' : 'Light'}
              </span>
            </div>

            {/* Notifications & Sounds */}
            <div
              onClick={() => setSection('notifications')}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                  <Bell size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">Notifications & Sounds</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {soundEnabled ? 'In-app sounds enabled' : 'Sounds muted'}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </div>

            {/* Privacy & Security */}
            <div
              onClick={() => setSection('privacy')}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                  <Lock size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">Privacy & Security</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Password, {blockedUsers.length} blocked contacts
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </div>

            {/* Workplaces */}
            <div
              onClick={() => setSection('workplaces')}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                  <Building2 size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">Workplaces</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {workspaces.length} active workspaces
                  </div>
                </div>
              </div>
              <ChevronRight size={18} className="text-[var(--text-muted)]" />
            </div>
          </div>

          {/* Sign Out Action Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                if (window.confirm('Sign out from ChatRooms on this device?')) {
                  logout();
                }
              }}
              className="w-full p-3 rounded-2xl bg-[var(--danger)]/10 hover:bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/20 font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
          </div>

          <div className="text-center pt-4 pb-2 text-[11px] text-[var(--text-muted)]">
            ChatRooms v2.0 · Encrypted P2P Communications
          </div>
        </div>
      )}

      {/* ── SECTION: EDIT PROFILE ───────────────────────────────────── */}
      {section === 'profile' && (
        <form onSubmit={handleSaveProfile} className="flex-1 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-4 font-heading">
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

          {/* Avatar Change */}
          <div className="flex flex-col items-center justify-center gap-2 p-4 bg-[var(--bg-tertiary)]/50 rounded-2xl border border-[var(--border)]">
            <div className="relative">
              <Avatar name={name || 'User'} src={avatarUrl} size="xl" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-2 rounded-full bg-[var(--accent)] text-white shadow-md border-2 border-[var(--bg-primary)] cursor-pointer hover:scale-105 transition-transform"
                title="Change Avatar"
              >
                <Upload size={14} />
              </button>
            </div>
            <span className="text-xs text-[var(--text-muted)]">Tap icon to change profile picture</span>
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
              Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-sm font-chat text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)] block mb-1">
              About / Bio
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-sm font-chat text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none"
            />
          </div>

          <div className="mt-auto pt-2">
            <button
              type="submit"
              disabled={isSaving || isUploading}
              className="btn-cta-vibrant w-full py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-2 shadow-md active:scale-[0.98]"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* ── SECTION: NOTIFICATIONS & SOUNDS ─────────────────────────── */}
      {section === 'notifications' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 font-heading">
          <div className="rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border)] divide-y divide-[var(--border-subtle)] overflow-hidden">
            {/* Sound Toggle */}
            <div
              onClick={toggleSound}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                  {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">In-App Chat Sounds</div>
                  <div className="text-xs text-[var(--text-muted)]">Audio chime on sent & received messages</div>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  soundEnabled
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)]'
                }`}
              >
                {soundEnabled ? 'ON' : 'OFF'}
              </span>
            </div>

            {/* Push Notifications */}
            <div
              onClick={handleEnablePush}
              className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                  <Bell size={16} />
                </div>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">System Push Notifications</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    Status: {notifPermission === 'granted' ? 'Active' : 'Click to enable'}
                  </div>
                </div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-[var(--accent)] text-white'
                }`}
              >
                {notifPermission === 'granted' ? 'Active' : 'Enable'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── SECTION: PRIVACY & SECURITY ─────────────────────────────── */}
      {section === 'privacy' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-4 font-heading">
          {/* Password Change Form */}
          <form onSubmit={handlePasswordSubmit} className="p-3.5 rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border)] flex flex-col gap-3">
            <span className="text-xs font-bold text-[var(--text-primary)]">Change Password</span>

            {passwordMsg && (
              <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                {passwordMsg}
              </div>
            )}
            {passwordError && (
              <div className="p-2.5 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] text-xs font-semibold">
                {passwordError}
              </div>
            )}

            <input
              type="password"
              placeholder="Current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
            <input
              type="password"
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />

            <button
              type="submit"
              disabled={isUpdatingPassword || !currentPassword || !newPassword}
              className="btn-cta-vibrant w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isUpdatingPassword ? <Loader2 size={14} className="animate-spin" /> : <span>Update Password</span>}
            </button>
          </form>

          {/* Blocked Users List */}
          <div className="p-3.5 rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border)]">
            <span className="text-xs font-bold text-[var(--text-primary)] block mb-2">
              Blocked Users ({blockedUsers.length})
            </span>
            {blockedUsers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] font-body m-0">No blocked contacts.</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((bu, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-xl bg-[var(--bg-primary)] border border-[var(--border)] flex items-center justify-between"
                  >
                    <span className="text-xs font-bold text-[var(--text-primary)] truncate">
                      {typeof bu === 'string' ? bu : bu.name || bu.username}
                    </span>
                    <button
                      type="button"
                      onClick={() => unblockUser(bu)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border-none cursor-pointer hover:bg-emerald-500/30"
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

      {/* ── SECTION: WORKPLACES ─────────────────────────────────────── */}
      {section === 'workplaces' && (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3 font-heading">
          <button
            type="button"
            onClick={onOpenWorkspaceModal}
            className="btn-cta-vibrant w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer border-none"
          >
            <Plus size={14} />
            <span>Join or Create Workplace</span>
          </button>

          <div className="space-y-2">
            {workspaces.map((ws) => (
              <div
                key={ws.id}
                className="p-3 rounded-2xl bg-[var(--bg-tertiary)]/60 border border-[var(--border)] flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{ws.name}</div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {ws.nodes?.length || 1} channels · Code: {ws.joinCode || 'CR-WS'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
