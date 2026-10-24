/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { ActivityLog, ActivityModule } from '../types';
import { repository } from '../services/repository';

export const ActivityLogsView: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>(() => repository.getActivityLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');

  const filteredLogs = logs.filter((log) => {
    if (moduleFilter !== 'ALL' && log.module !== moduleFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchDesc = log.description.toLowerCase().includes(q);
      const matchActor = log.actorName.toLowerCase().includes(q);
      const matchAct = log.action.toLowerCase().includes(q);
      if (!matchDesc && !matchActor && !matchAct) return false;
    }
    return true;
  });

  const modules: ActivityModule[] = [
    'GAMES',
    'ITEMS',
    'ESTIMATION',
    'PRICING',
    'IMPORT',
    'AUTH',
    'SETTINGS',
  ];

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <FileText className="w-6 h-6 text-blue-600" />
          Audit Trail & Activity Logs
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Catatan riil setiap tindakan pembuatan, pengubahan data database, perhitungan estimasi, dan impor berkas.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3 text-xs">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari deskripsi aktivitas, nama aktor, atau modul..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 shrink-0">Modul:</span>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
          >
            <option value="ALL">Semua Modul</option>
            {modules.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4 w-44">Waktu (Timestamp)</th>
                <th className="py-3 px-4">Aktor Pengguna</th>
                <th className="py-3 px-4">Modul</th>
                <th className="py-3 px-4">Tindakan (Action)</th>
                <th className="py-3 px-4">Deskripsi Aktivitas</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Tidak ditemukan log aktivitas yang sesuai.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isSuper = log.actorRole === 'SUPER_ADMIN';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div className="flex items-center gap-1.5">
                          {isSuper ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          ) : (
                            <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          <span>{log.actorName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                          {log.module}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                        {log.action}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 max-w-md">
                        {log.description}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Sukses
                          </span>
                        ) : log.status === 'warning' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600">
                            <AlertTriangle className="w-3.5 h-3.5" /> Peringatan
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600">
                            <AlertCircle className="w-3.5 h-3.5" /> Gagal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
