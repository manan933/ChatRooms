import React, { useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, Shield, MessageSquare, Building2, Lock, CheckCircle2 } from 'lucide-react';
import useAuthStore from '../store/authStore';

export const AuthPage = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  const { login, register, isLoading, error, clearError } = useAuthStore();

  const handleFillDemo = () => {
    setIsRegister(false);
    clearError();
    setEmail('soumya@zyntra.com');
    setPassword('password123');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isRegister) {
      if (!name.trim() || !email.trim() || !password || !username.trim()) return;
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
        primaryUsername: username.trim(),
      });
    } else {
      if (!email.trim() || !password) return;
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
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white font-bold text-base flex items-center justify-center shadow-sm">
              Z
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                Zyntra
              </span>
              <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border)] font-medium">
                Team Chat
              </span>
            </div>
          </div>

          <div className="space-y-3 max-w-md">
            <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              Fast, focused messaging for teams and creators.
            </h1>
            <p className="text-sm lg:text-base text-[var(--text-secondary)] leading-relaxed">
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
                <span className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <span className="text-[var(--text-muted)]">#</span> general
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-medium border border-emerald-500/20">
                  Live
                </span>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-medium">GIET University</span>
            </div>

            {/* Mock Message 1 */}
            <div className="flex items-start gap-2.5 pt-1">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                SM
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Soumya</span>
                  <span className="text-[10px] text-[var(--text-muted)]">10:42 AM</span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded-xl rounded-tl-sm leading-relaxed">
                  Backend cluster is connected to MongoDB Atlas. Latency dropped to sub-20ms! 🚀
                </div>
              </div>
            </div>

            {/* Mock Message 2 */}
            <div className="flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                AP
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Aarav</span>
                  <span className="text-[10px] text-[var(--text-muted)]">10:43 AM</span>
                </div>
                <div className="mt-1 text-xs text-[var(--text-secondary)] bg-[var(--bg-secondary)] border border-[var(--border)] p-2 rounded-xl rounded-tl-sm leading-relaxed">
                  Tested real-time message sync across accounts. Everything works seamlessly.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Features */}
        <div className="grid grid-cols-3 gap-3 pt-6 border-t border-[var(--border)] max-w-md">
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
            <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
            <span>Multi-Tenant</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
            <CheckCircle2 size={15} className="text-blue-500 shrink-0" />
            <span>WebSockets</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] font-medium">
            <CheckCircle2 size={15} className="text-indigo-500 shrink-0" />
            <span>MongoDB</span>
          </div>
        </div>
      </div>

      {/* ── Right Authentication Panel ─────────────────────────────── */}
      <div className="flex-1 h-full min-h-0 overflow-y-auto custom-scrollbar flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 py-10">
        <div className="w-full max-w-[420px] my-auto flex flex-col">
          {/* Mobile Brand Header */}
          <div className="md:hidden flex flex-col items-center text-center mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center shadow-sm mb-2">
              Z
            </div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] m-0">
              Zyntra
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Fast, focused messaging for teams.
            </p>
          </div>

          {/* Form Header */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] m-0">
              {isRegister ? 'Create an account' : 'Sign in to Zyntra'}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              {isRegister
                ? 'Join to access team channels and direct messaging.'
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
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-none ${
                !isRegister
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-xs'
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
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-none ${
                isRegister
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {isRegister && (
              <>
                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Alex Morgan"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full h-10 px-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="alex"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full h-10 px-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm font-mono text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                {isRegister ? 'Email address' : 'Email or username'}
              </label>
              <input
                type={isRegister ? 'email' : 'text'}
                required
                placeholder={isRegister ? 'alex@example.com' : 'soumya@zyntra.com or username'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 px-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-blue-500 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
                Password
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 pl-3 pr-10 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-blue-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer border-none bg-transparent flex items-center justify-center p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-10 mt-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer border-none flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Credentials Helper */}
          <div className="mt-5 p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-[var(--text-primary)]">Demo Account</div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono truncate">soumya@zyntra.com / password123</div>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-2.5 py-1 text-xs font-medium bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-blue-400 hover:text-blue-300 rounded-md border border-[var(--border)] cursor-pointer transition-colors shrink-0"
            >
              Auto-fill
            </button>
          </div>

          {/* Security Reassurance */}
          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-[var(--text-muted)] text-center">
            <Lock size={12} className="text-emerald-500 shrink-0" />
            <span>Encrypted with JWT & bcrypt · Cloud data in MongoDB Atlas</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
