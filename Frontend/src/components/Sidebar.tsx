/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  LayoutDashboard,
  Bot,
  History,
  Database,
  FileSpreadsheet,
  Sliders,
  FileText,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { User } from '../types';

export type NavView =
  | 'dashboard'
  | 'estimator'
  | 'history'
  | 'items'
  | 'import'
  | 'pricing'
  | 'logs';

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
        { id: 'estimator' as NavView, label: 'AI Estimator', icon: Bot, highlight: true },
        { id: 'history' as NavView, label: 'Estimation History', icon: History },
      ],
    },
    {
      title: 'DATA MANAGEMENT',
      items: [
        { id: 'items' as NavView, label: 'Item Database', icon: Database },
        { id: 'import' as NavView, label: 'Import Database', icon: FileSpreadsheet },
      ],
    },
    {
      title: 'SYSTEM & SETTINGS',
      items: [
        { id: 'pricing' as NavView, label: 'Pricing Settings', icon: Sliders },
        { id: 'logs' as NavView, label: 'Activity Logs', icon: FileText },
      ],
    },
  ];

  return (
    <aside
      className={`app-sidebar h-screen sticky top-0 flex flex-col justify-between border-r border-blue-100/80 backdrop-blur-xl transition-[width,box-shadow] duration-300 ease-out z-30 select-none shrink-0 no-print ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="sidebar-waves" aria-hidden="true">
        <svg viewBox="0 0 300 270" preserveAspectRatio="none" focusable="false">
          <defs>
            <linearGradient id="sidebar-wave-back" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f3f8ff" />
              <stop offset="100%" stopColor="#e6f1ff" />
            </linearGradient>
            <linearGradient id="sidebar-wave-front" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#e9f3ff" />
              <stop offset="100%" stopColor="#dceaff" />
            </linearGradient>
          </defs>
          <path d="M0 76 C75 8 170 5 300 88 L300 270 L0 270 Z" fill="url(#sidebar-wave-back)" />
          <path d="M0 202 C90 98 188 77 300 150 L300 270 L0 270 Z" fill="url(#sidebar-wave-front)" />
        </svg>
      </div>
      {/* Brand Header */}
      <div className="relative z-10">
        <div className="h-[68px] flex items-center justify-between px-4 border-b border-blue-100/70">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/logo.webp"
                alt="Johen Gaming"
                className="w-9 h-9 object-contain shrink-0"
              />
              <div className="min-w-0">
                <span className="block font-extrabold text-sm tracking-tight text-slate-900 truncate">
                  JOHEN GAMING
                </span>
                <span className="block text-[10px] text-slate-500 font-medium truncate uppercase tracking-wider">
                  Price Estimator
                </span>
              </div>
            </div>
          )}

          {isCollapsed && (
            <img
              src="/logo.webp"
              alt="Johen Gaming"
              className="mx-auto w-9 h-9 object-contain"
            />
          )}

          <button
            onClick={onToggleCollapse}
            className="hidden md:flex p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation list */}
        <div className="py-5 px-2.5 space-y-6 overflow-visible">
          {navSections.map((sec) => (
            <div key={sec.title}>
              {!isCollapsed && (
                <div className="px-2.5 mb-2 text-[10px] font-bold tracking-[0.12em] text-blue-400 uppercase">
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
                      aria-label={isCollapsed ? item.label : undefined}
                      className={`sidebar-nav-item relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all text-left group ${
                        isActive
                          ? 'is-active bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white font-semibold shadow-[0_8px_18px_rgba(37,99,235,0.24)]'
                          : 'text-slate-600 hover:bg-blue-50/90 hover:text-blue-700'
                      }`}
                    >
                      <span className="sidebar-nav-icon shrink-0">
                        <Icon
                          className={`w-4 h-4 transition-colors ${
                            isActive
                              ? 'text-white'
                              : item.highlight
                              ? 'text-indigo-600'
                              : 'text-slate-400 group-hover:text-blue-600'
                          }`}
                        />
                      </span>
                      {!isCollapsed && (
                        <span className="truncate flex-1">{item.label}</span>
                      )}
                      {isCollapsed && (
                        <span className="sidebar-collapsed-tooltip" aria-hidden="true">
                          {item.label}
                        </span>
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
      <div className="relative z-10 p-3">
        {!isCollapsed ? (
          <div className="bg-white/90 px-3 py-3 rounded-2xl border border-blue-100 shadow-[0_8px_24px_rgba(40,79,154,0.08)] flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-200 flex items-center justify-center text-blue-700 font-extrabold text-xs shrink-0">
                A
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold leading-tight text-slate-900">
                {currentUser.name}
              </p>
              <p className="mt-1 truncate whitespace-nowrap text-[10px] font-medium leading-none text-blue-600">
                System Admin
              </p>
            </div>

            <button
              onClick={onLogout}
              title="Keluar / Logout dari Aplikasi"
              className="ml-auto p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
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
