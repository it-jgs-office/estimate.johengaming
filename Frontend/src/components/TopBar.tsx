/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, ChevronRight } from 'lucide-react';
import { NavView } from './Sidebar';

interface TopBarProps {
  currentView: NavView;
  onOpenMobileMenu: () => void;
}

const VIEW_TITLES: Record<NavView, { name: string; section: string }> = {
  dashboard: { name: 'Dashboard', section: 'Main' },
  estimator: { name: 'AI Estimator', section: 'Valuation' },
  history: { name: 'Estimation History', section: 'Main' },
  items: { name: 'Item Database', section: 'Data Management' },
  import: { name: 'Import Database', section: 'Data Management' },
  pricing: { name: 'Pricing Settings', section: 'System & Settings' },
  logs: { name: 'Activity Logs', section: 'System & Settings' },
};

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  onOpenMobileMenu,
}) => {
  const info = VIEW_TITLES[currentView] || { name: 'App', section: 'Main' };

  return (
    <header className="app-topbar h-[68px] px-4 md:px-7 backdrop-blur-xl border-b border-blue-100/80 flex items-center sticky top-0 z-20 no-print select-none">
      {/* Left: Mobile trigger & Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="md:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Buka menu navigasi"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 min-w-0">
          <img src="/logo.webp" alt="" className="w-7 h-7 object-contain shrink-0" />
          <span className="font-extrabold text-slate-900 tracking-tight truncate">Johen Gaming</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="hidden sm:inline truncate">{info.section}</span>
          <span className="hidden sm:inline">/</span>
          <span key={currentView} className="page-name-enter font-semibold text-slate-900 truncate">{info.name}</span>
        </nav>
      </div>

    </header>
  );
};
