import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Image as ImageIcon, Smile, SendHorizontal, X, Loader2, FileText } from '../ui/Icons';
import EmojiPicker from '../ui/EmojiPicker';
import socketService from '../../api/socket';
import api from '../../api/api';

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

export const Composer = ({ chatId, onSend, currentUser, policy = {} }) => {
  // Autosave function (Item 3): initialize with draft from sessionStorage if present
  const [text, setText] = useState(() => {
    return chatId ? sessionStorage.getItem(`chatrooms_draft_${chatId}`) || '' : '';
  });
  const [showEmoji, setShowEmoji] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const emojiRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const currentChatIdRef = useRef(chatId);

  // Restore draft when chatId changes
  useEffect(() => {
    currentChatIdRef.current = chatId;
    const savedDraft = chatId ? sessionStorage.getItem(`chatrooms_draft_${chatId}`) || '' : '';
    setText(savedDraft);
    setAttachment(null);
    setShowEmoji(false);
    setIsUploading(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [chatId]);

  // Autosave draft on text change (Item 3)
  const saveDraft = (newText) => {
    if (chatId) {
      if (newText.trim()) {
        sessionStorage.setItem(`chatrooms_draft_${chatId}`, newText);
      } else {
        sessionStorage.removeItem(`chatrooms_draft_${chatId}`);
      }
    }
  };

  // Cleanup object URLs
  useEffect(() => {
    return () => {
      if (attachment?.url?.startsWith('blob:')) {
        URL.revokeObjectURL(attachment.url);
      }
    };
  }, [attachment?.url]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (currentChatIdRef.current && currentUser) {
        socketService.stopTyping(currentChatIdRef.current, currentUser.id || currentUser._id);
      }
    };
  }, [currentUser]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleOutside = (e) => {
      if (
        emojiRef.current &&
        !emojiRef.current.contains(e.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(e.target)
      ) {
        setShowEmoji(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Handle typing emissions
  const handleTyping = () => {
    if (!chatId || !currentUser) return;
    socketService.startTyping(chatId, currentUser.name || 'User', currentUser.id || currentUser._id);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(chatId, currentUser.id || currentUser._id, currentUser.name);
    }, 2500);
  };

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    saveDraft(val);

    if (!val.trim()) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (chatId && currentUser) {
        socketService.stopTyping(chatId, currentUser.id || currentUser._id, currentUser.name);
      }
    } else {
      handleTyping();
    }

    // Auto-expand textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const localBlob = isImage ? URL.createObjectURL(file) : null;

    setAttachment({
      name: file.name,
      size: formatSize(file.size),
      type: isImage ? 'image' : 'file',
      mimeType: file.type,
      url: localBlob,
      isUploading: true,
    });

    setIsUploading(true);
    try {
      const res = await api.upload.file(file);
      if (currentChatIdRef.current !== chatId) return;
      if (res.ok && res.data?.url) {
        setAttachment({
          name: res.data.name || file.name,
          size: res.data.size || formatSize(file.size),
          type: isImage ? 'image' : 'file',
          mimeType: res.data.mimeType || file.type,
          url: res.data.url,
          isUploading: false,
        });
      }
    } catch {
      setAttachment((prev) => (prev ? { ...prev, isUploading: false } : null));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSend = () => {
    if ((!text.trim() && !attachment) || isUploading) return;

    onSend?.(text.trim(), attachment);
    setText('');
    setAttachment(null);
    if (chatId) {
      sessionStorage.removeItem(`chatrooms_draft_${chatId}`);
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (chatId && currentUser) {
      socketService.stopTyping(chatId, currentUser.id || currentUser._id, currentUser.name);
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleInsertEmoji = (emoji) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? text.length;
      const end = textarea.selectionEnd ?? text.length;
      const newText = text.substring(0, start) + emoji + text.substring(end);
      setText(newText);
      saveDraft(newText);

      // Keep cursor position right after the inserted emoji and focus back
      setTimeout(() => {
        if (textareaRef.current) {
          const nextPos = start + emoji.length;
          textareaRef.current.selectionStart = nextPos;
          textareaRef.current.selectionEnd = nextPos;
          textareaRef.current.focus();
        }
      }, 0);
    } else {
      const updated = (text || '') + emoji;
      setText(updated);
      saveDraft(updated);
    }
    // KEEP emoji picker open so user can insert multiple emojis in sequence!
  };

  const hasContent = Boolean(text.trim() || attachment);

  return (
    <div className="relative px-3 sm:px-4 py-2.5 pb-[max(10px,env(safe-area-inset-bottom))] glass-panel border-t border-[var(--border)] shrink-0 font-body">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          e.target.value = '';
        }}
      />
      <input
        type="file"
        ref={imageInputRef}
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          e.target.value = '';
        }}
      />

      {/* Reaction Popover */}
      {showEmoji && (
        <div ref={emojiRef} className="absolute bottom-full left-2 sm:left-4 mb-2 z-50 max-w-[calc(100vw-24px)]">
          <EmojiPicker onSelect={handleInsertEmoji} onClose={() => setShowEmoji(false)} />
        </div>
      )}

      {/* Attachment Preview Chip */}
      {attachment && (
        <div className="mb-2 flex items-center justify-between p-2 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] max-w-sm">
          <div className="flex items-center gap-2.5 min-w-0">
            {attachment.type === 'image' && attachment.url ? (
              <img
                src={attachment.url}
                alt="Attachment preview"
                className="w-10 h-10 rounded-lg object-cover border border-[var(--border)]"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
                <FileText size={18} />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-xs font-heading font-semibold truncate text-[var(--text-primary)]">
                {attachment.name}
              </div>
              <div className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
                <span>{attachment.size}</span>
                {attachment.isUploading && (
                  <span className="text-[var(--accent)] flex items-center gap-1 font-semibold">
                    <Loader2 size={10} /> Uploading...
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAttachment(null)}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer border-none bg-transparent"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Main Composer Pill Input Row */}
      <div className="flex items-center gap-2 bg-[var(--bg-tertiary)]/75 backdrop-blur-md border border-[var(--border)] rounded-2xl px-3 py-1.5 focus-within:border-[var(--border-focus)] transition-all shadow-xs">
        {/* Left Action Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          {policy?.allowAttachments !== false && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                title="Attach Document"
              >
                <Paperclip size={18} />
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                title="Upload Image"
              >
                <ImageIcon size={18} />
              </button>
            </>
          )}
          {policy?.allowEmojis !== false && (
            <button
              ref={emojiButtonRef}
              type="button"
              onClick={() => setShowEmoji((prev) => !prev)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center ${
                showEmoji ? 'text-[var(--accent)] bg-[var(--accent-subtle)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
              title={showEmoji ? 'Close Emoji Picker' : 'Insert Emojis'}
            >
              <Smile size={18} />
            </button>
          )}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          enterKeyHint="send"
          autoCapitalize="sentences"
          autoComplete="on"
          className="flex-1 bg-transparent border-none outline-none resize-none py-1.5 text-[15px] sm:text-[16px] font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] min-h-[38px] max-h-[130px] leading-relaxed"
        />

        {/* Send Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={!hasContent || isUploading}
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-none transition-all ${
            hasContent && !isUploading
              ? 'btn-cta-vibrant cursor-pointer active:scale-95'
              : 'bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed opacity-60'
          }`}
          title="Send Message"
        >
          {isUploading ? (
            <Loader2 size={16} />
          ) : (
            <SendHorizontal size={17} />
          )}
        </button>
      </div>
    </div>
  );
};

export default Composer;
