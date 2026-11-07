import React from 'react';

export const NotFoundPage = ({ onReturnHome }) => {
  return (
    <div className="w-full h-full min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-primary)] text-[var(--text-primary)] text-center select-none">
      <div className="w-16 h-16 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border)] flex items-center justify-center mb-4 text-[var(--accent)] font-bold text-2xl font-brand">
        404
      </div>
      <h1 className="text-2xl sm:text-3xl font-heading mb-2 text-[var(--text-primary)]">
        Room Not Found
      </h1>
      <p className="text-sm font-body text-[var(--text-secondary)] max-w-md mb-6 leading-relaxed">
        The conversation, channel, or link you are trying to access does not exist or has been removed.
      </p>
      <button
        type="button"
        onClick={() => {
          if (onReturnHome) {
            onReturnHome();
          } else {
            window.location.href = '/';
          }
        }}
        className="px-5 py-2.5 rounded-xl bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--text-primary)] font-heading text-xs font-bold transition-all cursor-pointer border-none shadow-sm"
      >
        Back to Conversations
      </button>
    </div>
  );
};

export default NotFoundPage;
