import React, { useState, useEffect } from 'react';
import {
  Building2,
  KeyRound,
  Loader2,
  Plus,
  ArrowRight,
  Copy,
  Check,
  CheckCircle2,
} from '../ui/Icons';
import Modal from '../ui/Modal';
import BrandLogo from '../ui/BrandLogo';

export const WorkspaceModal = ({
  isOpen,
  onClose,
  workspaces = [],
  activeWorkspace = null,
  onSelectWorkspace,
  onCreateWorkspace,
  onJoinWorkspace,
  initialTab = 'select',
}) => {
  const [activeTab, setActiveTab] = useState('select'); // 'select' | 'join' | 'create'
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Sync initial tab when modal opens
  useEffect(() => {
    if (isOpen) {
      if (workspaces.length > 0) {
        setActiveTab(initialTab);
      } else {
        setActiveTab('create');
      }
      setError(null);
      setName('');
      setHandle('');
      setCode('');
    }
  }, [isOpen, workspaces.length, initialTab]);

  const handleCopy = (text, key) => {
    navigator.clipboard?.writeText(text);
    setCopiedCode(key);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onCreateWorkspace(name.trim(), handle.trim());
      if (res?.success) {
        onClose();
        if (res.workspace) {
          onSelectWorkspace(res.workspace);
        }
      } else {
        setError(res?.error || 'Failed to create workspace');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await onJoinWorkspace(code.trim());
      if (res?.success) {
        onClose();
        if (res.workspace) {
          onSelectWorkspace(res.workspace);
        }
      } else {
        setError(res?.error || 'Invalid or expired invite code');
      }
    } catch {
      setError('An error occurred while joining');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon" size="sm" />
          <span>Workspaces Management</span>
        </div>
      }
    >
      <div className="flex flex-col gap-4 font-heading">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl">
          {workspaces.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('select');
                setError(null);
              }}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                activeTab === 'select'
                  ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
              }`}
            >
              <Building2 size={13} />
              <span>Select</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setActiveTab('join');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
              activeTab === 'join'
                ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
            }`}
          >
            <KeyRound size={13} />
            <span>Join with Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('create');
              setError(null);
            }}
            className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-[var(--accent)] to-[var(--accent-highlight)] text-white shadow-md shadow-[var(--accent-highlight)]/25'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] bg-transparent'
            }`}
          >
            <Plus size={13} />
            <span>Create New</span>
          </button>
        </div>

        {error && (
          <div className="p-2.5 rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/25 text-[var(--danger)] text-xs font-body">
            {error}
          </div>
        )}

        {/* ── TAB 1: SELECT WORKSPACE ────────────────────────────── */}
        {activeTab === 'select' && (
          <div className="flex flex-col gap-2.5">
            <span className="text-sm text-[var(--text-muted)] font-body">
              Switch to a workspace to access its team channels:
            </span>

            <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
              {workspaces.map((ws) => {
                const isSelected = activeWorkspace?.id === ws.id;
                return (
                  <div
                    key={ws.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'bg-[var(--accent-subtle)] border-[var(--accent)]'
                        : 'bg-[var(--bg-secondary)] border-[var(--border)] hover:border-[var(--border-focus)]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center shrink-0">
                        {ws.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                          <span>{ws.name}</span>
                          {isSelected && <CheckCircle2 size={13} className="text-[var(--accent)]" />}
                        </div>
                        <div className="text-[10px] text-[var(--text-muted)] font-body flex items-center gap-2">
                          <span>{ws.membersCount || 1} members</span>
                          <span>·</span>
                          <span>{ws.nodes?.length || 1} channels</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleCopy(ws.joinCode || 'WS-001', ws.id)}
                        className="p-1.5 rounded-lg bg-[var(--bg-primary)] hover:bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border)] cursor-pointer"
                        title="Copy Code"
                      >
                        {copiedCode === ws.id ? <Check size={12} className="text-[var(--accent)]" /> : <Copy size={12} />}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onSelectWorkspace(ws);
                          onClose();
                        }}
                        className={`py-1 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer border-none ${
                          isSelected
                            ? 'bg-[var(--bg-primary)] text-[var(--text-primary)] opacity-60 cursor-default'
                            : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)]'
                        }`}
                      >
                        {isSelected ? 'Current' : 'Select'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── TAB 2: JOIN WITH CODE ──────────────────────────────── */}
        {activeTab === 'join' && (
          <form onSubmit={handleJoin} className="flex flex-col gap-3 font-heading">
            <div>
              <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
                Workspace Invite Code *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. WS-001 or ENG-101"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                autoFocus
              />
              <span className="text-[10px] text-[var(--text-muted)] font-body mt-1 block">
                Enter the unique code provided by your workspace admin.
              </span>
            </div>

            <button
              type="submit"
              disabled={!code.trim() || isSubmitting}
              className="btn-cta-vibrant w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 size={14} /> : <ArrowRight size={14} />}
              <span>Join Workspace</span>
            </button>
          </form>
        )}

        {/* ── TAB 3: CREATE WORKSPACE ────────────────────────────── */}
        {activeTab === 'create' && (
          <form onSubmit={handleCreate} className="flex flex-col gap-3 font-heading">
            <div>
              <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
                Workspace Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Design Studio or Engineering"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
                autoFocus
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-[var(--text-secondary)] block mb-1">
                Your Role / Context Handle in this Workspace (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. alex.lead or morgan.eng"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full px-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="btn-cta-vibrant w-full py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none disabled:opacity-50 mt-2 flex items-center justify-center gap-1.5 active:scale-[0.98]"
            >
              {isSubmitting ? <Loader2 size={14} /> : <Plus size={14} />}
              <span>Create Workspace</span>
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default WorkspaceModal;
