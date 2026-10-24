/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Menu,
  Sparkles,
  Gamepad2,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Game, User } from '../types';
import { NavView } from './Sidebar';

interface TopBarProps {
  currentView: NavView;
  currentUser: User;
  activeGame?: Game;
  onOpenMobileMenu: () => void;
  onLogout: () => void;
  onQuickNewEstimation: () => void;
}

const VIEW_TITLES: Record<NavView, { name: string; section: string }> = {
  dashboard: { name: 'Dashboard', section: 'Main' },
  estimator: { name: 'AI Estimator', section: 'Valuation' },
  history: { name: 'Estimation History', section: 'Main' },
  games: { name: 'Games Catalog', section: 'Data Management' },
  items: { name: 'Item Database', section: 'Data Management' },
  import: { name: 'Import Database', section: 'Data Management' },
  pricing: { name: 'Pricing Settings', section: 'System & Settings' },
  logs: { name: 'Activity Logs', section: 'System & Settings' },
  settings: { name: 'General Settings', section: 'System & Settings' },
};

export const TopBar: React.FC<TopBarProps> = ({
  currentView,
  currentUser,
  activeGame,
  onOpenMobileMenu,
  onLogout,
  onQuickNewEstimation,
}) => {
  const info = VIEW_TITLES[currentView] || { name: 'App', section: 'Main' };

  return (
    <header className="h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-20 no-print select-none">
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
          <span className="font-bold text-slate-900 tracking-tight truncate">Johen Gaming</span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="hidden sm:inline truncate">{info.section}</span>
          <span className="hidden sm:inline">/</span>
          <span className="font-semibold text-slate-900 truncate">{info.name}</span>
        </nav>
      </div>

      {/* Right Action Zone */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Active game badge */}
        {activeGame && (
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200">
            <Gamepad2 className="w-3.5 h-3.5 text-blue-600" />
            <span className="truncate">{activeGame.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              Rp{activeGame.defaultConversionRate}/{activeGame.currencySymbol}
            </span>
          </div>
        )}

        {/* Quick New Estimation Button */}
        {currentView !== 'estimator' && (
          <button
            onClick={onQuickNewEstimation}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Estimation</span>
          </button>
        )}

        {/* User Identity Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span className="font-semibold text-slate-800 truncate max-w-[140px]">
            {currentUser.name}
          </span>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
          title="Keluar / Logout"
        >
          <LogOut className="w-3.5 h-3.5 text-rose-500" />
          <span className="hidden md:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};
