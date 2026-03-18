import React from 'react';

export const StandardFloatBar: React.FC<{
  visible: boolean;
  children: React.ReactNode;
  className?: string;
}> = ({ visible, children, className }) => {
  if (!visible) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[90] w-[min(920px,calc(100%-24px))] -translate-x-1/2 px-0">
      <div
        className={[
          'rounded-2xl border border-brand-surface bg-white px-4 py-3 shadow-lg',
          'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          className ?? '',
        ].join(' ')}
      >
        {children}
      </div>
    </div>
  );
};

