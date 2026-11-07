import React from 'react';

// Reusable Skeleton Loading components for ChatRooms (Item 1)

export const Skeleton = ({ className = '', width, height, rounded = 'rounded-md' }) => {
  return (
    <div
      className={`skeleton-shimmer ${rounded} ${className}`}
      style={{
        width: width || '100%',
        height: height || '1rem',
      }}
    />
  );
};

export const ChatListSkeleton = ({ count = 6 }) => {
  return (
    <div className="space-y-2 p-2" aria-busy="true" aria-label="Loading conversations">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
          <Skeleton width="40px" height="40px" rounded="rounded-full" className="shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton width="45%" height="13px" />
              <Skeleton width="18%" height="10px" />
            </div>
            <Skeleton width="75%" height="11px" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const MessageFeedSkeleton = ({ count = 5 }) => {
  return (
    <div className="space-y-4 p-4 flex-1" aria-busy="true" aria-label="Loading messages">
      {Array.from({ length: count }).map((_, i) => {
        const isOwn = i % 2 === 1;
        return (
          <div
            key={i}
            className={`flex items-end gap-2.5 max-w-[75%] ${
              isOwn ? 'ml-auto flex-row-reverse' : 'mr-auto'
            }`}
          >
            {!isOwn && (
              <Skeleton width="32px" height="32px" rounded="rounded-full" className="shrink-0 mb-1" />
            )}
            <div className="space-y-1.5 flex-1">
              {!isOwn && <Skeleton width="80px" height="11px" />}
              <Skeleton
                width={isOwn ? '180px' : '240px'}
                height="48px"
                rounded={isOwn ? 'rounded-2xl rounded-br-xs' : 'rounded-2xl rounded-bl-xs'}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Skeleton;
