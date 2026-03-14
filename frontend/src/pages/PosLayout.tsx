import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const iconCls = 'h-5 w-5 shrink-0';

function IconCart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="9" cy="20" r="1.25" />
      <circle cx="18" cy="20" r="1.25" />
      <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconClipboard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" strokeLinecap="round" />
      <rect x="9" y="3" width="6" height="4" rx="1" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}

function IconTag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M12.586 2.586A2 2 0 0011.172 2H4a2 2 0 00-2 2v7.172a2 2 0 00.586 1.414l8.704 8.704a2 2 0 002.828 0l7.172-7.172a2 2 0 000-2.828L12.586 2.586z" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 19V5M4 19h16M8 19v-6M12 19V9M16 19v-4M20 19V7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconCog({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path
        d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
        strokeLinecap="round"
      />
    </svg>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex flex-col items-center gap-1 rounded-r-lg border-l-[3px] py-2.5 pl-1 pr-1 text-center text-[11px] font-semibold leading-tight transition-colors',
    isActive
      ? 'border-brand-primary bg-forge-sidebar-active text-white'
      : 'border-transparent text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200',
  ].join(' ');

export const PosLayout: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen bg-forge-main">
      <aside className="sticky top-0 flex h-screen max-h-screen w-[5.25rem] shrink-0 flex-col overflow-hidden border-r border-white/10 bg-forge-sidebar">
        <div className="shrink-0 border-b border-white/10 px-1 py-3 text-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/90">POS</span>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col gap-0.5">
          <NavLink to="/pos" className={navClass} end title="收銀">
            <IconCart className={iconCls} />
            <span>收銀</span>
          </NavLink>
          <NavLink to="/pos/orders" className={navClass} data-testid="e2e-nav-orders" title="訂單">
            <IconClipboard className={iconCls} />
            <span>訂單</span>
          </NavLink>
          <NavLink to="/pos/promos" className={navClass} title="促銷">
            <IconTag className={iconCls} />
            <span>促銷</span>
          </NavLink>
          <NavLink to="/pos/reports" className={navClass} title="報表">
            <IconChart className={iconCls} />
            <span>報表</span>
          </NavLink>
        </nav>
        <div className="shrink-0 border-t border-white/10 px-1 py-3">
          <button
            type="button"
            data-testid="e2e-nav-admin-inventory"
            className={`flex w-full flex-col items-center gap-1 rounded-r-lg border-l-[3px] border-transparent py-2.5 text-[11px] font-semibold text-neutral-400 transition-colors hover:bg-white/[0.06] hover:text-white`}
            onClick={() => navigate('/admin')}
            title="後台"
          >
            <IconCog className="mx-auto h-5 w-5" />
            <span>後台</span>
          </button>
        </div>
      </aside>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-forge-main">
        <Outlet />
      </div>
    </div>
  );
};
