/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Sparkles,
  History,
  Gamepad2,
  Database,
  FileSpreadsheet,
  Sliders,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { User } from '../types';

export type NavView =
  | 'dashboard'
  | 'estimator'
  | 'history'
  | 'games'
  | 'items'
  | 'import'
  | 'pricing'
  | 'logs'
  | 'settings';

interface SidebarProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  currentUser: User;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onLogout: () => void;
}

interface NavItem {
  id: NavView;
  label: string;
  icon: any;
  highlight?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  currentUser,
  isCollapsed,
  onToggleCollapse,
  onLogout,
}) => {
  const navSections: NavSection[] = [
    {
      title: 'MAIN',
      items: [
        { id: 'dashboard' as NavView, label: 'Dashboard', icon: LayoutDashboard },
        { id: 'estimator' as NavView, label: 'AI Estimator', icon: Sparkles, highlight: true },
        { id: 'history' as NavView, label: 'Estimation History', icon: History },
      ],
    },
    {
      title: 'DATA MANAGEMENT',
      items: [
        { id: 'games' as NavView, label: 'Games Catalog', icon: Gamepad2 },
        { id: 'items' as NavView, label: 'Item Database', icon: Database },
        { id: 'import' as NavView, label: 'Import Database', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'SYSTEM & SETTINGS',
      items: [
        { id: 'pricing' as NavView, label: 'Pricing Settings', icon: Sliders },
        { id: 'logs' as NavView, label: 'Activity Logs', icon: FileText },
        { id: 'settings' as NavView, label: 'General Settings', icon: Settings },
      ],
    },
  ];

  return (
    <aside
      className={`h-screen sticky top-0 flex flex-col justify-between border-r border-slate-200 bg-white transition-all duration-200 z-30 select-none shrink-0 no-print ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div>
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs shrink-0">
                J
              </div>
              <div className="min-w-0">
                <span className="block font-bold text-sm tracking-tight text-slate-900 truncate">
                  JOHEN GAMING
                </span>
                <span className="block text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">
                  Price Estimator
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <div className="mx-auto w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
              J
            </div>
          )}

          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
            title={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="py-4 px-2 space-y-6 overflow-y-auto max-h-[calc(100vh-140px)]">
          {navSections.map((sec) => (
            <div key={sec.title}>
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                  {sec.title}
                </div>
              )}
              <div className="space-y-1">
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => onSelectView(item.id)}
                      title={isCollapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left group ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-semibold shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-blue-600'
                            : item.highlight
                            ? 'text-indigo-600'
                            : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />
                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}
                      {!isCollapsed && item.highlight && !isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Footer with Clean Logout */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/50">
        {!isCollapsed ? (
          <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs shrink-0">
                A
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {currentUser.name}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span className="flex items-center gap-0.5 text-blue-600 font-medium">
                    <ShieldCheck className="w-3 h-3" /> System Admin
                  </span>
                  <span>·</span>
                  <span className="truncate">Portal Aktif</span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Keluar / Logout dari Aplikasi"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            title="Keluar / Logout"
            className="w-full flex justify-center p-2 rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  );
};
