import { Menu, X, type LucideIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

export interface PageSidebarTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Optional group heading shown above the first tab of each group. Tabs that
   *  share a group must be contiguous in the array. */
  group?: string;
}

interface PageSidebarProps {
  /** Uppercase label shown above the tab list, e.g. "SETTINGS". */
  sidebarLabel: string;
  tabs: PageSidebarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  /** Small text at the very bottom of the sidebar (e.g. "v3.0 · self-hosted"). */
  footer?: React.ReactNode;
}

/**
 * Left-sidebar + right-panel layout used by the Settings and Admin pages.
 *
 * Desktop (>=1024px): sidebar is always visible at 260px; panel fills rest.
 * Mobile: sidebar collapses behind a hamburger at the top of the panel; tap
 * the hamburger to slide the sidebar in as an overlay, tap a tab to close.
 */
export default function PageSidebar({
  sidebarLabel,
  tabs,
  activeTab,
  onTabChange,
  children,
  footer,
}: PageSidebarProps): React.ReactElement {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? '';

  // Close the mobile drawer on Escape or on outside click.
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-2xl border border-edge bg-surface-card lg:flex-row"
      style={{
        minHeight: 'min(820px, calc(100vh - var(--nav-h) - 120px))',
      }}
    >
      {/* Mobile top bar with hamburger */}
      <div className="flex items-center justify-between border-b border-edge px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-content transition-colors hover:bg-[var(--bg-hover)]"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <div className="flex items-center gap-2 text-sm font-semibold text-content">{activeLabel}</div>
        <div className="w-9" />
      </div>

      {/* Desktop sidebar (always visible on lg) */}
      <aside
        className="relative hidden shrink-0 flex-col border-r border-edge bg-surface-secondary lg:flex"
        style={{
          width: 260,
          padding: '24px 14px',
        }}
      >
        <SidebarInner
          sidebarLabel={sidebarLabel}
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          footer={footer}
        />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-[rgba(0,0,0,0.35)] lg:hidden"
            role="presentation"
            onClick={() => setMobileOpen(false)}
          />
          <aside
            ref={drawerRef}
            className="fixed bottom-0 left-0 top-0 z-50 flex flex-col bg-surface-secondary shadow-2xl lg:hidden"
            style={{
              width: 280,
              padding: '18px 14px',
            }}
          >
            <div className="mb-3 flex items-center justify-between px-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-content-muted">{sidebarLabel}</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-content transition-colors hover:bg-[var(--bg-hover)]"
                aria-label="Close navigation"
              >
                <X size={16} />
              </button>
            </div>
            <SidebarInner
              sidebarLabel={null}
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={(id) => {
                onTabChange(id);
                setMobileOpen(false);
              }}
              footer={footer}
            />
          </aside>
        </>
      )}

      {/* Panel */}
      <div className="min-w-0 flex-1" style={{ padding: '26px 28px' }}>
        {children}
      </div>
    </div>
  );
}

function SidebarInner({
  sidebarLabel,
  tabs,
  activeTab,
  onTabChange,
  footer,
}: {
  sidebarLabel: string | null;
  tabs: PageSidebarTab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  footer?: React.ReactNode;
}): React.ReactElement {
  return (
    <>
      {sidebarLabel && (
        <div className="mb-3 px-3 text-[11px] font-bold uppercase tracking-widest text-content-muted">
          {sidebarLabel}
        </div>
      )}
      <nav className="flex flex-1 flex-col gap-1">
        {(() => {
          let lastGroup: string | undefined;
          return tabs.map((tab) => {
            const Icon = tab.icon;
            const active = tab.id === activeTab;
            const showHeader = !!tab.group && tab.group !== lastGroup;
            lastGroup = tab.group;
            return (
              <React.Fragment key={tab.id}>
                {showHeader && (
                  <div className="mb-0.5 mt-3 px-3 text-[10px] font-bold uppercase tracking-widest text-content-faint first:mt-0">
                    {tab.group}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'font-semibold text-content' : 'font-medium text-content-secondary'}`}
                  style={{
                    background: active ? 'var(--bg-hover)' : 'transparent',
                  }}
                  onMouseEnter={(e) => {
                    if (!active) e.currentTarget.style.background = 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    if (!active) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </button>
              </React.Fragment>
            );
          });
        })()}
      </nav>
      {footer && (
        <div className="mt-4 border-t border-edge px-3 pt-3 text-[10px] tracking-wide text-content-faint">{footer}</div>
      )}
    </>
  );
}
