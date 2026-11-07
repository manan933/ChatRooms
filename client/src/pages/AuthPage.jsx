import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, Lock, CheckCircle2 } from '../components/ui/Icons';
import useAuthStore from '../store/authStore';
import LegalModal from '../components/modals/LegalModal';

export const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [legalModalOpen, setLegalModalOpen] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Validation errors state (Smart form validation - Item 4)
  const [validationErrors, setValidationErrors] = useState({});

  const { login, register, isLoading, error, clearError } = useAuthStore();

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
      errs.email = 'Email address is required';
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
    <div className="w-full h-full min-h-screen flex flex-col md:flex-row bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden select-none">
      {/* ── Left Showcase Panel (Desktop / Tablet) ─────────────────── */}
      <div className="hidden md:flex md:w-[48%] lg:w-[50%] h-full flex-col justify-between p-10 lg:p-14 bg-[var(--bg-secondary)] border-r border-[var(--border)] relative overflow-hidden shrink-0">
        {/* Brand Header */}
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] font-brand text-xl flex items-center justify-center shadow-sm">
              C
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-brand tracking-wide text-[var(--text-primary)]">
                ChatRooms
              </span>
            </div>
          </div>

          <div className="space-y-3 max-w-md">
            {/* No gradient hero text - Item 30 */}
            <h1 className="text-3xl lg:text-4xl font-heading font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              Fast, focused messaging for teams and creators.
            </h1>
            <p className="text-sm lg:text-base font-body text-[var(--text-secondary)] leading-relaxed">
              Organize projects into channels, send direct messages, and collaborate in real-time with zero friction.
            </p>
          </div>
        </div>

        {/* Realistic Interactive Product Preview Mockup */}
        <div className="my-auto py-6 max-w-md w-full">
          <div className="rounded-2xl bg-[var(--bg-primary)] border border-[var(--border)] p-4 shadow-sm space-y-3">
            {/* Mock Channel Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="text-sm font-heading font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <span className="text-[var(--text-muted)]">#</span> general
                </span>
                <span className="text-[10px] text-[var(--online)] bg-[var(--accent-subtle)] px-2 py-0.5 rounded font-heading font-semibold border border-[var(--border-subtle)]">
                  Active
                </span>
              </div>
              <span className="text-xs font-heading text-[var(--text-muted)]">Engineering</span>
            </div>

            {/* Mock Message 1 */}
            <div className="flex items-start gap-2.5 pt-1">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)] text-[var(--text-primary)] text-[11px] font-heading font-bold flex items-center justify-center shrink-0">
                SC
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">Sarah Chen</span>
                  <span className="text-[10px] font-body text-[var(--text-muted)]">10:42 AM</span>
                </div>
                <div className="mt-1 text-xs font-body text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-2 rounded-xl rounded-tl-sm leading-relaxed">
                  Database cluster connected and encrypted. Latency dropped to sub-20ms.
                </div>
              </div>
            </div>

            {/* Mock Message 2 */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[var(--accent-highlight)] text-[var(--text-primary)] text-[11px] font-heading font-bold flex items-center justify-center shrink-0">
                AP
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-heading font-semibold text-[var(--text-primary)]">Alex Patel</span>
                  <span className="text-[10px] font-body text-[var(--text-muted)]">10:43 AM</span>
                </div>
                <div className="mt-1 text-xs font-body text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-2 rounded-xl rounded-tl-sm leading-relaxed">
                  Real-time message synchronization verified across all devices.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Legal & Consent Trigger (Item 27) */}
        <div className="pt-4 border-t border-[var(--border-subtle)] max-w-md flex items-center justify-between text-xs font-body text-[var(--text-muted)]">
          <span>Protected with bcrypt & JWT auth</span>
          <button
            type="button"
            onClick={() => setLegalModalOpen(true)}
            className="text-[var(--accent)] hover:underline bg-transparent border-none cursor-pointer text-xs font-heading font-semibold"
          >
            Privacy & Terms
          </button>
        </div>
      </div>

      {/* ── Right Authentication Panel ─────────────────────────────── */}
      <div className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-10">
        <div className="w-full max-w-[420px] my-auto flex flex-col">
          {/* Mobile Brand Header */}
          <div className="md:hidden flex flex-col items-center text-center mb-6">
            <div className="w-10 h-10 rounded-xl bg-[var(--accent)] text-[var(--text-primary)] font-brand text-2xl flex items-center justify-center shadow-sm mb-2">
              C
            </div>
            <h1 className="text-2xl font-brand tracking-wide text-[var(--text-primary)] m-0">
              ChatRooms
            </h1>
            <p className="text-xs font-body text-[var(--text-muted)] mt-1">
              Fast, focused messaging for teams and direct chats.
            </p>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-heading font-bold tracking-tight text-[var(--text-primary)] m-0">
              {isRegister ? 'Create an account' : 'Sign in to ChatRooms'}
            </h2>
            <p className="text-xs sm:text-sm font-body text-[var(--text-secondary)] mt-1 leading-relaxed">
              {isRegister
                ? 'Join to access channels and direct messaging.'
                : 'Enter your account details below to continue.'}
            </p>
          </div>

          {/* Clean Segmented Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setIsRegister(false);
                clearError();
                setValidationErrors({});
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer border-none ${
                !isRegister
                  ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-xs'
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
              className={`flex-1 py-2 rounded-lg text-xs font-heading font-bold transition-all cursor-pointer border-none ${
                isRegister
                  ? 'bg-[var(--accent)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Server Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] text-xs mb-4 flex items-center gap-2 font-body">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--danger)] shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {isRegister && (
              <>
                <div>
                  <label className="text-xs font-heading font-semibold text-[var(--text-secondary)] block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (validationErrors.name) setValidationErrors((p) => ({ ...p, name: null }));
                    }}
                    className={`w-full h-10 px-3 bg-[var(--bg-secondary)] border ${
                      validationErrors.name ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                    } rounded-lg text-sm font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors`}
                  />
                  {validationErrors.name && (
                    <span className="text-[11px] font-body text-[var(--danger)] mt-0.5 block">{validationErrors.name}</span>
                  )}
                </div>

                <div>
                  <label className="text-xs font-heading font-semibold text-[var(--text-secondary)] block mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    placeholder="alex"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (validationErrors.username) setValidationErrors((p) => ({ ...p, username: null }));
                    }}
                    className={`w-full h-10 px-3 bg-[var(--bg-secondary)] border ${
                      validationErrors.username ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                    } rounded-lg text-sm font-heading text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors`}
                  />
                  {validationErrors.username && (
                    <span className="text-[11px] font-body text-[var(--danger)] mt-0.5 block">{validationErrors.username}</span>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-heading font-semibold text-[var(--text-secondary)] block mb-1">
                {isRegister ? 'Email address' : 'Email or username'}
              </label>
              <input
                type={isRegister ? 'email' : 'text'}
                placeholder={isRegister ? 'alex@example.com' : 'username or email'}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (validationErrors.email) setValidationErrors((p) => ({ ...p, email: null }));
                }}
                className={`w-full h-10 px-3 bg-[var(--bg-secondary)] border ${
                  validationErrors.email ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                } rounded-lg text-sm font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors`}
              />
              {validationErrors.email && (
                <span className="text-[11px] font-body text-[var(--danger)] mt-0.5 block">{validationErrors.email}</span>
              )}
            </div>

            <div>
              <label className="text-xs font-heading font-semibold text-[var(--text-secondary)] block mb-1">
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
                  className={`w-full h-10 pl-3 pr-10 bg-[var(--bg-secondary)] border ${
                    validationErrors.password ? 'border-[var(--danger)]' : 'border-[var(--border)]'
                  } rounded-lg text-sm font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--border-focus)] transition-colors`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer border-none bg-transparent flex items-center justify-center p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {validationErrors.password && (
                <span className="text-[11px] font-body text-[var(--danger)] mt-0.5 block">{validationErrors.password}</span>
              )}
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 mt-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] rounded-lg text-sm font-heading font-bold transition-colors cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={16} />
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Privacy & Legal Link on Mobile */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-body text-[var(--text-muted)] text-center">
            <Lock size={12} className="text-[var(--accent)] shrink-0" />
            <span>Encrypted with JWT & bcrypt · </span>
            <button
              type="button"
              onClick={() => setLegalModalOpen(true)}
              className="text-[var(--accent)] hover:underline bg-transparent border-none cursor-pointer text-[11px] font-heading font-semibold p-0"
            >
              Privacy & Terms
            </button>
          </div>
        </div>
      </div>

      {/* Legal & Consent Modal */}
      <LegalModal isOpen={legalModalOpen} onClose={() => setLegalModalOpen(false)} />
    </div>
  );
};

export default AuthPage;
