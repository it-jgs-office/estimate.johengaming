/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  showToast: (title: string, message?: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (title: string, message?: string, type: ToastType = 'success') => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setToasts((prev) => [...prev, { id, title, message, type }]);

      setTimeout(() => {
        removeToast(id);
      }, 4200);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, removeToast }}>
      {children}
      {/* Toast container floating at bottom-right */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none no-print">
        {toasts.map((toast) => {
          let icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;
          let borderClass = 'border-emerald-200 dark:border-emerald-800/40 bg-white dark:bg-slate-900';
          if (toast.type === 'error') {
            icon = <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />;
            borderClass = 'border-rose-200 dark:border-rose-800/40 bg-white dark:bg-slate-900';
          } else if (toast.type === 'warning') {
            icon = <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />;
            borderClass = 'border-amber-200 dark:border-amber-800/40 bg-white dark:bg-slate-900';
          } else if (toast.type === 'info') {
            icon = <Info className="w-5 h-5 text-blue-600 shrink-0" />;
            borderClass = 'border-blue-200 dark:border-blue-800/40 bg-white dark:bg-slate-900';
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-3.5 rounded-lg border shadow-lg flex items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${borderClass}`}
            >
              <div className="mt-0.5">{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{toast.title}</p>
                {toast.message && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{toast.message}</p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label="Tutup notifikasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
