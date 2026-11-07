import React, { useState } from 'react';
import { Hash, Folder, Loader2 } from '../ui/Icons';
import Modal from '../ui/Modal';
import BrandLogo from '../ui/BrandLogo';

export const CreateChannelModal = ({ isOpen, onClose, activeWorkspace, onAddChannel }) => {
  const [channelName, setChannelName] = useState('');
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    setIsSubmitting(true);
    await onAddChannel?.(activeWorkspace?.id, channelName.trim(), folderName.trim() || null);
    setIsSubmitting(false);
    setChannelName('');
    setFolderName('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <BrandLogo variant="icon" size="sm" />
          <span>New Channel in {activeWorkspace?.name || 'Workspace'}</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="text-[11px] font-bold text-[var(--text-secondary)] font-heading block mb-1">
            Channel Name *
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-3 text-[var(--text-muted)] font-bold text-sm">#</span>
            <input
              type="text"
              required
              placeholder="e.g. general, announcements, tech"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] font-body outline-none focus:border-[var(--accent)] lowercase"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-[var(--text-secondary)] font-heading block mb-1">
            Category / Folder (Optional)
          </label>
          <div className="relative flex items-center">
            <Folder size={14} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="e.g. Engineering, Product, General"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className="w-full pl-8 pr-3 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] font-body outline-none focus:border-[var(--accent)]"
            />
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-body mt-1 block">
            Leave blank to place this channel at the root of the workspace.
          </span>
        </div>

        <button
          type="submit"
          disabled={!channelName.trim() || isSubmitting}
          className="w-full mt-2 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-xs font-bold font-heading transition-all cursor-pointer border-none shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Hash size={14} />}
          <span>Create Channel</span>
        </button>
      </form>
    </Modal>
  );
};

export default CreateChannelModal;
