import React, { useState } from 'react';
import { CheckCheck, Download, FileText, SmilePlus, Pencil, Trash2, Copy, Check, Phone, PhoneOff, Video } from '../ui/Icons';
import Avatar from '../ui/Avatar';
import ImageViewer from '../ui/ImageViewer';
import { getFileUrl } from '../../api/api';
import { normalizeEmoji, renderContentWithEmojis } from '../../utils/emojiMap';

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '⭐', '🤝', '🎉'];

export const MessageBubble = ({
  message,
  isOwn = false,
  onReply,
  onEdit,
  onDelete,
  onReaction,
  onCallBack,
  currentUserId,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.content || '');
  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const { id, senderName, senderAvatar, content, timestamp, attachment, reactions = [], isEdited, isRead } = message;

  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleCopy = () => {
    if (content) {
      navigator.clipboard?.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      setShowMenu(false);
    }
  };

  const handleSaveEdit = () => {
    if (editText.trim() && editText.trim() !== content) {
      onEdit?.(id, editText.trim());
    }
    setIsEditing(false);
  };

  const isImage =
    attachment && (attachment.type === 'image' || attachment.mimeType?.startsWith('image/'));

  return (
    <div
      className={`group relative flex items-end gap-2 w-full my-1 ${
        isOwn ? 'flex-row-reverse' : 'flex-row'
      }`}
      onMouseLeave={() => {
        setShowMenu(false);
        setShowEmojiPicker(false);
      }}
    >
      {/* Sender Avatar (received only) */}
      {!isOwn && (
        <Avatar name={senderName || 'Member'} src={senderAvatar} size="sm" className="mb-1" />
      )}

      {/* Bubble Container */}
      <div
        className={`relative max-w-[85%] sm:max-w-[70%] flex flex-col ${
          isOwn ? 'items-end' : 'items-start'
        }`}
      >
        {/* Sender Name in group contexts */}
        {!isOwn && (senderName || message.senderUsername) && (
          <div className="flex items-center gap-1.5 px-2 mb-0.5 select-none max-w-full font-heading">
            <span className="text-[11px] font-bold text-[var(--accent)] truncate">
              {senderName}
            </span>
            {message.senderUsername && (
              <span className="text-[9px] text-[var(--text-muted)] truncate">
                @{message.senderUsername}
              </span>
            )}
          </div>
        )}

        {/* Floating Quick Action Toolbar */}
        <div
          className={`absolute -top-7 ${
            isOwn ? 'right-0' : 'left-0'
          } flex items-center gap-1 bg-[var(--bg-primary)] border border-[var(--border)] rounded-full px-1.5 py-0.5 shadow-md z-20 transition-opacity ${
            showMenu || showEmojiPicker ? 'opacity-100 pointer-events-auto' : 'opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto'
          }`}
        >
          {/* Reaction Trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
              title="Add Reaction"
            >
              <SmilePlus size={14} />
            </button>

            {/* Quick Reaction Popover */}
            {showEmojiPicker && (
              <div
                className={`absolute bottom-full mb-1.5 ${
                  isOwn ? 'right-0' : 'left-0'
                } flex items-center gap-1.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-full px-2.5 py-1 shadow-xl z-30 font-heading backdrop-blur-md animate-in fade-in zoom-in-95 duration-100`}
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onReaction?.(id, normalizeEmoji(emoji));
                      setShowEmojiPicker(false);
                    }}
                    title={emoji}
                    className="p-1 rounded-full text-sm leading-none hover:bg-[var(--bg-hover)] hover:scale-125 transition-transform cursor-pointer border-none bg-transparent flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Copy Message */}
          <button
            type="button"
            onClick={handleCopy}
            className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
            title="Copy Text"
          >
            {copied ? <Check size={14} className="text-[var(--accent)]" /> : <Copy size={14} />}
          </button>

          {/* Own Message Actions: Edit & Delete */}
          {isOwn && (
            <>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                title="Edit"
              >
                <Pencil size={14} />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(id)}
                className="p-1 rounded-full text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-red-500/10 transition-colors cursor-pointer border-none bg-transparent flex items-center justify-center"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>

        {/* Message Bubble Body */}
        <div
          onClick={() => {
            if (window.innerWidth < 768) setShowMenu((prev) => !prev);
          }}
          style={{
            background: isOwn ? 'var(--bubble-sent)' : 'var(--bubble-received)',
            backgroundColor: isOwn ? 'var(--bubble-sent-bg)' : 'var(--bubble-received-bg)',
            color: isOwn ? '#FFFFFF' : 'var(--bubble-received-text)',
          }}
          className={`relative px-3.5 py-2 rounded-2xl text-[15.5px] sm:text-[16px] font-body leading-relaxed break-words transition-all shadow-sm ${
            isOwn
              ? 'bubble-sent rounded-br-xs'
              : 'bubble-received rounded-bl-xs'
          }`}
        >
          {/* Attachment Presentation */}
          {attachment && (
            <div className="mb-2">
              {isImage ? (
                <>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreviewOpen(true);
                    }}
                    className="cursor-pointer overflow-hidden rounded-xl border border-white/10 max-w-[280px] max-h-[200px]"
                  >
                    <img
                      src={getFileUrl(attachment.url)}
                      alt={attachment.name || 'Photo'}
                      className="w-full h-full object-cover hover:scale-102 transition-transform duration-200"
                      loading="lazy"
                    />
                  </div>
                  <ImageViewer
                    isOpen={imagePreviewOpen}
                    onClose={() => setImagePreviewOpen(false)}
                    src={attachment.url}
                    title={attachment.name}
                  />
                </>
              ) : (
                <div
                  className={`flex items-center gap-3 p-2.5 rounded-xl border ${
                    isOwn ? 'bg-white/15 border-white/20' : 'bg-[var(--bg-secondary)] border-[var(--border)]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--accent)] text-white flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="min-w-0 flex-1 font-heading">
                    <div className="text-xs font-semibold truncate">{attachment.name}</div>
                    {attachment.size && (
                      <div className="text-[10px] opacity-75">{attachment.size}</div>
                    )}
                  </div>
                  <a
                    href={getFileUrl(attachment.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={attachment.name}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-current flex items-center justify-center shrink-0 transition-colors"
                  >
                    <Download size={14} />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Call Details Card or Text Content */}
          {message.type === 'call' || message.callDetails ? (
            <div className="flex items-center gap-3 py-1 px-0.5 font-heading min-w-[210px] sm:min-w-[260px]">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                  message.callDetails?.status === 'missed' || message.callDetails?.status === 'declined'
                    ? isOwn
                      ? 'bg-red-400/25 text-red-100 border border-red-300/40'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : isOwn
                      ? 'bg-emerald-400/25 text-emerald-100 border border-emerald-300/40'
                      : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {message.callDetails?.isVideo ? (
                  <Video size={18} />
                ) : message.callDetails?.status === 'missed' || message.callDetails?.status === 'declined' ? (
                  <PhoneOff size={18} />
                ) : (
                  <Phone size={18} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className={`text-xs font-bold truncate flex items-center gap-1.5 ${isOwn ? 'text-white' : 'text-[var(--text-primary)]'}`}>
                  <span>{message.callDetails?.isVideo ? 'Video Call' : 'Voice Call'}</span>
                  {message.callDetails?.status === 'missed' && (
                    <span className={`text-[10px] font-semibold ${isOwn ? 'text-red-200' : 'text-red-400'}`}>(Missed)</span>
                  )}
                  {message.callDetails?.status === 'declined' && (
                    <span className={`text-[10px] font-semibold ${isOwn ? 'text-red-200' : 'text-red-400'}`}>(Declined)</span>
                  )}
                </div>
                <div className={`text-[11px] font-body truncate mt-0.5 ${isOwn ? 'text-white/90' : 'text-[var(--text-secondary)]'}`}>
                  {content}
                </div>
              </div>

              {onCallBack && (
                <button
                  type="button"
                  onClick={() => onCallBack?.(message.callDetails?.isVideo)}
                  className={`p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                    isOwn
                      ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30'
                      : 'bg-[var(--accent-subtle)] hover:bg-[var(--accent)] text-[var(--accent)] hover:text-white border border-[var(--border)]'
                  }`}
                  title={message.callDetails?.isVideo ? 'Call back with Video' : 'Call back'}
                >
                  {message.callDetails?.isVideo ? <Video size={14} /> : <Phone size={14} />}
                </button>
              )}
            </div>
          ) : isEditing ? (
            <div className="flex flex-col gap-2 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setIsEditing(false);
                }}
                className="w-full px-2.5 py-1 rounded-lg bg-white/20 text-white border border-white/30 outline-none text-xs font-body"
                autoFocus
              />
              <div className="flex items-center justify-end gap-1.5 font-heading">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-2 py-0.5 rounded text-[11px] bg-white/15 hover:bg-white/25 cursor-pointer border-none text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-2 py-0.5 rounded text-[11px] bg-white font-bold text-[var(--accent)] hover:opacity-90 cursor-pointer border-none"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            content && <div className={`whitespace-pre-wrap ${isOwn ? 'text-white' : 'text-inherit'}`}>{renderContentWithEmojis(content)}</div>
          )}

          {/* Time & Read Status Indicator */}
          <div
            className={`flex items-center justify-end gap-1 mt-1 text-[11px] sm:text-[12px] select-none font-body ${
              isOwn ? 'text-white/85' : 'text-[var(--text-muted)]'
            }`}
          >
            {isEdited && <span className="italic">edited</span>}
            <span>{time}</span>
            {isOwn && (
              isRead ? (
                <CheckCheck size={14} className="text-white/95 inline-block shrink-0" title="Seen" />
              ) : (
                <Check size={13} className="text-white/70 inline-block shrink-0" title="Sent (not seen yet)" />
              )
            )}
          </div>
        </div>

        {/* Reaction Badges */}
        {reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 font-heading">
            {reactions.map((r, i) => {
              const displayEmoji = normalizeEmoji(r.emoji);
              const hasReacted = r.users && r.users.map(String).includes(String(currentUserId));
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onReaction?.(id, displayEmoji)}
                  title={`${displayEmoji} (${r.count})`}
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    hasReacted
                      ? 'bg-[var(--accent-highlight)]/20 border-[var(--accent-highlight)] text-[var(--accent-highlight)] font-bold shadow-sm'
                      : 'bg-[var(--bg-secondary)] border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--border-focus)]'
                  }`}
                >
                  <span className="text-sm leading-none">{displayEmoji}</span>
                  <span className="text-[10px] font-bold">{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
