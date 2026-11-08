import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Lock,
  Sun,
  Moon,
} from '../components/ui/Icons';
import useAuthStore from '../store/authStore';
import useThemeStore from '../store/themeStore';
import LegalModal from '../components/modals/LegalModal';
import BrandLogo from '../components/ui/BrandLogo';

export const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Validation errors state
  const [validationErrors, setValidationErrors] = useState({});

  const { login, register, isLoading, error, clearError } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const validate = () => {
    const errs = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const userRegex = /^[a-zA-Z0-9_]{3,20}$/;

    if (isRegister) {
      if (!name.trim()) errs.name = 'Full name is required';
      if (!username.trim()) {
        errs.username = 'Username is required';
      } else if (!userRegex.test(username.replace(/^@/, '').trim())) {
        errs.username = 'Username must be 3-20 letters, numbers, or underscores';
      }
    }

    if (!email.trim()) {
      errs.email = 'Email address or username is required';
    } else if (isRegister && !emailRegex.test(email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (!password) {
      errs.password = 'Password is required';
    } else if (password.trim().length < 6) {
      errs.password = 'Password must be at least 6 characters';
    }

    setValidationErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (isRegister) {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        primaryUsername: username.replace(/^@/, '').trim(),
      });
    } else {
      await login(email.trim(), password);
    }
  };

  return (
    <div
      className="relative min-h-screen w-full flex flex-col justify-between overflow-x-hidden font-body text-[var(--text-primary)] transition-colors select-none"
      style={{
        background: 'var(--bg-app-gradient)',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* ── Luminous Atmospheric Radiant Glows (Pelmatech & FluxEdit Auras) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
        {/* Top-Left Electric Blue / Sky Blue Halo */}
        <div
          className="absolute -top-[12%] -left-[10%] w-[700px] sm:w-[900px] h-[500px] sm:h-[650px] rounded-full opacity-60 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, transparent 68%)',
          }}
        />
        {/* Bottom-Right Cantaloupe Orange / Hot Pink Horizon Bloom */}
        <div
          className="absolute -bottom-[15%] -right-[10%] w-[750px] sm:w-[950px] h-[550px] sm:h-[700px] rounded-full opacity-55 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--accent-highlight) 0%, transparent 68%)',
          }}
        />
        {/* Center Subdued Ambient Core */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
          style={{
            background: 'radial-gradient(circle, var(--accent) 0%, var(--accent-highlight) 60%, transparent 80%)',
          }}
        />
      </div>

      {/* ── Top Header Navigation Bar ──────────────────────────────── */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo variant="lockup" size="md" />
        </div>

        <div className="flex items-center gap-3">
          {/* Quick Theme Switcher */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] text-xs font-heading font-bold cursor-pointer transition-all shadow-xs active:scale-95 text-[var(--text-primary)]"
            title="Toggle Vibrant Theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun size={15} className="text-amber-400" />
                <span className="hidden xs:inline">Skyblue Light</span>
              </>
            ) : (
              <>
                <Moon size={15} className="text-[#0593C6]" />
                <span className="hidden xs:inline">Midnight Dark</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main Showcase & Control Center Grid ──────────────────────── */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 sm:py-8 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-center">
          {/* ── Left Editorial Showcase (FluxEdit & Pelmatech Style) ─── */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-heading font-bold tracking-tight text-[var(--text-primary)] leading-[1.08] m-0">
              Communicate at the speed of{' '}
              <span className="font-body italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-[var(--accent)] via-[var(--accent-highlight)] to-[var(--accent)]">
                thought.
              </span>
            </h1>

            {/* Floating Glassmorphic Product Preview Card */}
            <div className="relative max-w-lg hidden sm:block pt-2">
              {/* Subtle ambient blur behind widget */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[var(--accent)]/20 via-[var(--accent-highlight)]/20 to-[var(--accent)]/10 blur-xl opacity-75 pointer-events-none" />

              <div className="relative rounded-3xl bg-[var(--bg-glass)]/85 backdrop-blur-2xl border border-[var(--border)] p-5 shadow-2xl space-y-3.5">
                {/* Live Channel Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[var(--accent-subtle)] text-[var(--accent)] border border-[var(--border)] flex items-center justify-center font-bold text-xs">
                      #
                    </div>
                    <div>
                      <div className="text-sm font-heading font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                        <span>general</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                      <div className="text-[11px] font-body text-[var(--text-muted)]">Engineering Core · 12 members</div>
                    </div>
                  </div>
                </div>

                {/* Mock Live Message Bubbles */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#0297DE] to-[#0593C6] text-white text-xs font-heading font-bold flex items-center justify-center shrink-0 shadow-sm">
                      SC
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-heading">
                        <span className="font-bold text-[var(--text-primary)]">Sarah Chen</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-body">10:42 AM</span>
                      </div>
                      <div className="mt-1 p-3 rounded-2xl rounded-tl-sm bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-xs sm:text-[13px] font-body text-[var(--text-primary)] leading-relaxed shadow-xs">
                        Database cluster connected. Latency dropped to sub-10ms across all websocket nodes! 🚀
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 pl-6">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D83995] to-[#FC734D] text-white text-xs font-heading font-bold flex items-center justify-center shrink-0 shadow-sm">
                      AP
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs font-heading">
                        <span className="font-bold text-[var(--text-primary)]">Alex Patel</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-body">10:43 AM</span>
                      </div>
                      <div className="mt-1 p-3 rounded-2xl rounded-tl-sm bg-[var(--accent)] text-white text-xs sm:text-[13px] font-body leading-relaxed shadow-md shadow-[var(--accent)]/20">
                        Read receipts and audio calls verified. Ready for deployment. 👍
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right Floating Glass Authentication Card ─────────────── */}
          <div className="lg:col-span-5 w-full flex justify-center">
            <div className="relative w-full max-w-[430px]">
              {/* Outer Luminous Glow behind the Card */}
              <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-[var(--accent)]/35 via-[var(--accent-highlight)]/35 to-[var(--accent)]/25 blur-xl opacity-75 pointer-events-none" />

              <div className="relative rounded-3xl bg-[var(--bg-glass)]/95 backdrop-blur-2xl border border-[var(--border)] p-6 sm:p-8 shadow-2xl">
                {/* Segmented Tab Switcher */}
                <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(false);
                      clearError();
                      setValidationErrors({});
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-heading font-bold transition-all cursor-pointer border-none ${
                      !isRegister
                        ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/30'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegister(true);
                      clearError();
                      setValidationErrors({});
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-heading font-bold transition-all cursor-pointer border-none ${
                      isRegister
                        ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/30'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
                    }`}
                  >
                    Create Account
                  </button>
                </div>

                {/* Form Header */}
                <div className="mb-6">
                  <h2 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight text-[var(--text-primary)] m-0">
                    {isRegister ? (
                      <>
                        Join{' '}
                        <span
                          className="font-brand font-normal text-3xl sm:text-4xl text-[var(--text-primary)]"
                          style={{ fontFamily: "'Lakki Reddy', cursive" }}
                        >
                          ChatRooms
                        </span>
                      </>
                    ) : (
                      'Welcome back'
                    )}
                  </h2>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="p-3.5 rounded-xl bg-[var(--danger)]/15 border border-[var(--danger)]/30 text-[var(--danger)] text-xs sm:text-sm mb-4 flex items-center gap-2 font-heading font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
                  {isRegister && (
                    <>
                      <div>
                        <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Alex Morgan"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: null }));
                          }}
                          className={`w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border ${
                            validationErrors.name ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]' : 'border-[var(--border)]'
                          } rounded-xl text-sm font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-all`}
                        />
                        {validationErrors.name && (
                          <span className="text-[11px] font-body text-[var(--danger)] mt-1 block">
                            {validationErrors.name}
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. alex_m"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            if (validationErrors.username) setValidationErrors((p) => ({ ...p, username: null }));
                          }}
                          className={`w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border ${
                            validationErrors.username ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]' : 'border-[var(--border)]'
                          } rounded-xl text-sm font-heading text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-all`}
                        />
                        {validationErrors.username && (
                          <span className="text-[11px] font-body text-[var(--danger)] mt-1 block">
                            {validationErrors.username}
                          </span>
                        )}
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                      {isRegister ? 'Email address' : 'Email or username'}
                    </label>
                    <input
                      type={isRegister ? 'email' : 'text'}
                      placeholder={isRegister ? 'alex@example.com' : 'Enter username or email'}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationErrors.email) setValidationErrors((p) => ({ ...p, email: null }));
                      }}
                      className={`w-full px-3.5 py-2.5 bg-[var(--bg-secondary)] border ${
                        validationErrors.email ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]' : 'border-[var(--border)]'
                      } rounded-xl text-sm font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-all`}
                    />
                    {validationErrors.email && (
                      <span className="text-[11px] font-body text-[var(--danger)] mt-1 block">
                        {validationErrors.email}
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs sm:text-sm font-heading font-bold text-[var(--text-secondary)] block mb-1">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (validationErrors.password) setValidationErrors((p) => ({ ...p, password: null }));
                        }}
                        className={`w-full px-3.5 pr-10 py-2.5 bg-[var(--bg-secondary)] border ${
                          validationErrors.password ? 'border-[var(--danger)] ring-1 ring-[var(--danger)]' : 'border-[var(--border)]'
                        } rounded-xl text-sm font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-all`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer border-none bg-transparent flex items-center justify-center p-1"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {validationErrors.password && (
                      <span className="text-[11px] font-body text-[var(--danger)] mt-1 block">
                        {validationErrors.password}
                      </span>
                    )}
                  </div>

                  {/* Radiant CTA Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-cta-vibrant w-full h-12 mt-2 rounded-xl text-sm sm:text-base font-heading font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.98] shadow-lg shadow-[var(--accent-highlight)]/30"
                  >
                    {isLoading ? (
                      <Loader2 size={18} className="animate-spin text-white" />
                    ) : (
                      <>
                        <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                        <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                </form>

                {/* Encrypted Protection Note */}
                <div className="mt-6 flex items-center justify-center gap-1.5 text-xs font-body text-[var(--text-muted)] text-center">
                  <Lock size={12} className="text-[var(--accent)] shrink-0" />
                  <span>Encrypted with JWT & bcrypt · </span>
                  <button
                    type="button"
                    onClick={() => setLegalModalOpen(true)}
                    className="text-[var(--accent)] hover:underline bg-transparent border-none cursor-pointer text-xs font-heading font-semibold p-0"
                  >
                    Privacy & Terms
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── Page Footer ────────────────────────────────────────────── */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-body text-[var(--text-muted)] border-t border-[var(--border-subtle)]">
        <div>
          <span
            className="font-brand font-normal text-sm text-[var(--text-primary)]"
            style={{ fontFamily: "'Lakki Reddy', cursive" }}
          >
            ChatRooms
          </span>{' '}
          v2.0 · Focused Real-time Communications
        </div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setLegalModalOpen(true)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent border-none cursor-pointer text-xs transition-colors"
          >
            Privacy Policy & Terms
          </button>
          <span>·</span>
          <span>WebSocket Real-Time Sync</span>
        </div>
      </footer>

      {/* Legal & Consent Modal */}
      <LegalModal isOpen={legalModalOpen} onClose={() => setLegalModalOpen(false)} />
    </div>
  );
};

export default AuthPage;
