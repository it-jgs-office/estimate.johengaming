/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Gamepad2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Coins,
  Percent,
  Sliders,
  AlertCircle,
  X,
  Check,
} from 'lucide-react';
import { Game, User } from '../types';
import { repository } from '../services/repository';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface GamesViewProps {
  currentUser: User;
}

export const GamesView: React.FC<GamesViewProps> = ({ currentUser }) => {
  const { showToast } = useToast();
  const [games, setGames] = useState<Game[]>(() => repository.getGames());
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formIcon, setFormIcon] = useState('Gamepad2');
  const [formCurrencyName, setFormCurrencyName] = useState('Diamond');
  const [formCurrencySymbol, setFormCurrencySymbol] = useState('DM');
  const [formConversionRate, setFormConversionRate] = useState('100');
  const [formLowPct, setFormLowPct] = useState('60');
  const [formMedPct, setFormMedPct] = useState('65');
  const [formHighPct, setFormHighPct] = useState('70');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState('');

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);

  const refreshList = () => {
    setGames(repository.getGames());
  };

  const handleOpenAdd = () => {
    if (!isSuperAdmin) {
      showToast('Akses Terbatas', 'Hanya Super Admin yang dapat menambahkan katalog game baru', 'warning');
      return;
    }
    setEditingGame(null);
    setFormName('');
    setFormSlug('');
    setFormIcon('Gamepad2');
    setFormCurrencyName('Diamond');
    setFormCurrencySymbol('DM');
    setFormConversionRate('100');
    setFormLowPct('60');
    setFormMedPct('65');
    setFormHighPct('70');
    setFormStatus('active');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (game: Game) => {
    if (!isSuperAdmin) {
      showToast('Akses Terbatas', 'Hanya Super Admin yang dapat mengedit katalog game', 'warning');
      return;
    }
    setEditingGame(game);
    setFormName(game.name);
    setFormSlug(game.slug);
    setFormIcon(game.icon || 'Gamepad2');
    setFormCurrencyName(game.currencyName);
    setFormCurrencySymbol(game.currencySymbol);
    setFormConversionRate(String(game.defaultConversionRate));
    setFormLowPct(String(game.lowPercentage));
    setFormMedPct(String(game.mediumPercentage));
    setFormHighPct(String(game.highPercentage));
    setFormStatus(game.status);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Nama game wajib diisi');
      return;
    }

    const rate = parseFloat(formConversionRate);
    if (isNaN(rate) || rate <= 0) {
      setFormError('Rate konversi harus lebih besar dari 0');
      return;
    }

    const low = parseFloat(formLowPct);
    const med = parseFloat(formMedPct);
    const high = parseFloat(formHighPct);

    if (isNaN(low) || isNaN(med) || isNaN(high) || low <= 0 || high > 100) {
      setFormError('Persentase harus berada di antara 0 dan 100%');
      return;
    }

    if (low > med || med > high) {
      setFormError('Persentase harus berurutan: Low ≤ Medium ≤ High');
      return;
    }

    const slug = formSlug.trim() || formName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

    const gameToSave: Game = {
      id: editingGame?.id || `GAME-${Date.now()}`,
      name: formName.trim(),
      slug,
      icon: formIcon,
      currencyName: formCurrencyName.trim(),
      currencySymbol: formCurrencySymbol.trim(),
      defaultConversionRate: rate,
      lowPercentage: low,
      mediumPercentage: med,
      highPercentage: high,
      status: formStatus,
      createdAt: editingGame?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repository.saveGame(gameToSave);
    setIsModalOpen(false);
    refreshList();
    showToast('Katalog Game Disimpan', `Game ${gameToSave.name} berhasil diperbarui.`, 'success');
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    repository.deleteGame(deleteTarget.id);
    setDeleteTarget(null);
    refreshList();
    showToast('Game Diproses', `Tindakan penghapusan/penonaktifan game ${deleteTarget.name} berhasil.`, 'info');
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Gamepad2 className="w-6 h-6 text-blue-600" />
            Games Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola katalog game yang didukung, mata uang, dan pengaturan persentase valuasi dasar.
          </p>
        </div>

        {isSuperAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Tambah Game Baru
          </button>
        )}
      </div>

      {/* Grid of Games */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {games.map((g) => {
          const itemsCount = repository.getItemsByGame(g.id).length;
          const categoriesCount = repository.getCategoriesByGame(g.id).length;
          const pricing = repository.getPricingSettingByGame(g.id);

          return (
            <div
              key={g.id}
              className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-base">
                      {g.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">{g.name}</h3>
                      <span className="text-xs text-slate-500 font-mono">
                        {g.currencyName} ({g.currencySymbol})
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      g.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}
                  >
                    {g.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 text-center text-xs mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Kategori</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{categoriesCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Total Item</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{itemsCount}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Rate Satuan</span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      Rp{pricing?.currencyRate ?? g.defaultConversionRate}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-4">
                  <div className="flex justify-between">
                    <span>Preset Tingkat Harga:</span>
                    <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                      Low {pricing?.lowPercentage || g.lowPercentage}% · Med {pricing?.mediumPercentage || g.mediumPercentage}% · High {pricing?.highPercentage || g.highPercentage}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Slug Identifier:</span>
                    <span className="font-mono text-slate-500">{g.slug}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                {isSuperAdmin ? (
                  <>
                    <button
                      onClick={() => handleOpenEdit(g)}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget(g)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                      title="Hapus game"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">Hanya Super Admin yang dapat mengedit</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Game Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingGame ? 'Edit Katalog Game' : 'Tambah Katalog Game Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-3 p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Nama Game *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Valorant / Genshin Impact"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Nama Mata Uang (Currency) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Diamond / UC / VP"
                    value={formCurrencyName}
                    onChange={(e) => setFormCurrencyName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Simbol Satuan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: DM / UC / VP"
                    value={formCurrencySymbol}
                    onChange={(e) => setFormCurrencySymbol(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Default Conversion Rate (Rp per unit currency) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="Contoh: 118"
                  value={formConversionRate}
                  onChange={(e) => setFormConversionRate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Low % *
                  </label>
                  <input
                    type="number"
                    required
                    value={formLowPct}
                    onChange={(e) => setFormLowPct(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Medium % *
                  </label>
                  <input
                    type="number"
                    required
                    value={formMedPct}
                    onChange={(e) => setFormMedPct(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    High % *
                  </label>
                  <input
                    type="number"
                    required
                    value={formHighPct}
                    onChange={(e) => setFormHighPct(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-center"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Status Katalog
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="active">Active (Tersedia di AI Estimator)</option>
                  <option value="inactive">Inactive (Disembunyikan)</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Simpan Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {Boolean(deleteTarget) && (
        <ConfirmationModal
          isOpen={Boolean(deleteTarget)}
          title={`Hapus Game ${deleteTarget?.name}?`}
          message={`Jika game ini masih memiliki item terdaftar atau riwayat estimasi, sistem akan mengamankannya dengan mengubah status menjadi 'inactive' agar catatan tidak rusak.`}
          confirmLabel="Lanjutkan"
          variant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};
