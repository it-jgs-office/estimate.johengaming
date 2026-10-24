/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  Palette,
  Sun,
  Moon,
  Database,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { GeneralSettings, User } from '../types';
import { repository } from '../services/repository';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface GeneralSettingsViewProps {
  currentUser: User;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onResetComplete: () => void;
}

export const GeneralSettingsView: React.FC<GeneralSettingsViewProps> = ({
  currentUser,
  isDarkMode,
  onToggleTheme,
  onResetComplete,
}) => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<GeneralSettings>(() => repository.getSettings());
  const games = repository.getGames();

  const [appName, setAppName] = useState(settings.appName);
  const [accentColor, setAccentColor] = useState(settings.accentColor);
  const [defaultGameId, setDefaultGameId] = useState(settings.defaultGameId);
  const [confirmDelete, setConfirmDelete] = useState(settings.confirmDelete);
  const [compactTable, setCompactTable] = useState(settings.compactTable);

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: GeneralSettings = {
      appName: appName.trim() || 'Johen Price Estimator',
      accentColor,
      themeMode: isDarkMode ? 'dark' : 'light',
      compactTable,
      currencyFormat: 'idr',
      defaultGameId,
      confirmDelete,
    };
    repository.saveSettings(updated);
    setSettings(updated);
    showToast('Pengaturan Disimpan', 'Preferensi antarmuka aplikasi berhasil diperbarui.', 'success');
  };

  const handleConfirmReset = () => {
    repository.resetAllDataToSeed();
    setIsResetConfirmOpen(false);
    onResetComplete();
    showToast('Data Direset', 'Seluruh data prototype telah dipulihkan ke seed database asli.', 'info');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600" />
          General Settings
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pengaturan identitas aplikasi, preferensi tampilan, dan pemulihan data uji coba (Reset Seed Data).
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Identity & Display Card */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Identitas Produk & Antarmuka
          </h3>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Nama Aplikasi Internal (Display Name)
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
              Katalog Game Utama (Default On Launch)
            </label>
            <select
              value={defaultGameId}
              onChange={(e) => setDefaultGameId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.currencySymbol})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-blue-600" />
              <span>Warna Aksen Aplikasi (Appearance)</span>
            </label>
            <div className="flex items-center gap-3 mt-1.5">
              {[
                { id: 'blue', label: 'Johen Blue', bg: 'bg-blue-600' },
                { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                { id: 'violet', label: 'Violet', bg: 'bg-violet-600' },
                { id: 'amber', label: 'Amber', bg: 'bg-amber-600' },
              ].map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => setAccentColor(c.id as any)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    accentColor === c.id
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-3.5 h-3.5 rounded-full ${c.bg}`} />
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-slate-100">
            <div>
              <span className="font-semibold text-slate-900 block">
                Mode Tema Tampilan
              </span>
              <span className="text-slate-500 text-[11px]">
                Sistem internal dikonfigurasi dalam Clean Light Mode untuk keterbacaan data numerik optimal.
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200/80 rounded-lg text-xs font-semibold">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span>Clean Light Mode (Aktif)</span>
            </div>
          </div>
        </div>

        {/* Behavior & Safety Card */}
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            Perilaku & Keamanan
          </h3>

          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                Konfirmasi Sebelum Menghapus Data
              </span>
              <span className="text-slate-500 text-[11px]">
                Tampilkan modal konfirmasi untuk mencegah tindakan tidak sengaja pada item dan riwayat.
              </span>
            </div>
            <input
              type="checkbox"
              checked={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded"
            />
          </label>

          <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                Format Mata Uang Rupiah Standar (IDR)
              </span>
              <span className="text-slate-500 text-[11px]">
                Menggunakan tanda titik sebagai pemisah ribuan (contoh: Rp1.132.800).
              </span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
              Rp1.132.800
            </span>
          </label>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Simpan Perubahan Pengaturan
          </button>
        </div>
      </form>

      {/* Danger Zone: Reset Demo Data */}
      <div className="p-6 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
          <AlertTriangle className="w-4 h-4" />
          <span>Zona Pemulihan Data Prototype</span>
        </div>
        <p className="text-xs text-rose-800 dark:text-rose-300 leading-relaxed">
          Fitur ini akan menghapus seluruh modifikasi lokal dan mengembalikan database game, item, estimasi, dan pengaturan ke data awal (Seed Data Johen Gaming). Sangat berguna saat ingin menguji ulang seluruh skenario simulasi dari awal.
        </p>
        <button
          type="button"
          onClick={() => setIsResetConfirmOpen(true)}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Semua Data ke Nilai Pabrik (Seed Data)
        </button>
      </div>

      {/* Reset Confirmation Dialog */}
      {isResetConfirmOpen && (
        <ConfirmationModal
          isOpen={isResetConfirmOpen}
          title="Reset Seluruh Data Prototype?"
          message="Tindakan ini akan mengembalikan seluruh katalog game, item database, riwayat estimasi, dan konfigurasi harga ke data seed awal Johen Gaming. Seluruh perubahan baru Anda akan dihapus."
          confirmLabel="Ya, Pulihkan ke Data Awal"
          variant="danger"
          onConfirm={handleConfirmReset}
          onCancel={() => setIsResetConfirmOpen(false)}
        />
      )}
    </div>
  );
};
