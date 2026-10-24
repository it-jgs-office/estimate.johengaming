/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Database,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  FileSpreadsheet,
  Layers,
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Sparkles,
  X,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Category, Game, GameItem, Rarity, User } from '../types';
import { repository } from '../services/repository';
import { formatGameCurrency, formatNumberID } from '../services/pricingCalculationService';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface ItemDatabaseViewProps {
  currentUser: User;
  onNavigateToImport: () => void;
}

export const ItemDatabaseView: React.FC<ItemDatabaseViewProps> = ({
  currentUser,
  onNavigateToImport,
}) => {
  const { showToast } = useToast();
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const games = repository.getGames();
  const [selectedGameId, setSelectedGameId] = useState<string>(games[0]?.id || 'GAME-FF');
  const activeGame = repository.getGameById(selectedGameId) || games[0];

  const categories = repository.getCategoriesByGame(selectedGameId);
  const rarities = repository.getRaritiesByGame(selectedGameId);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [rarityFilter, setRarityFilter] = useState('ALL');

  // Selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GameItem | null>(null);

  // Form Fields
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formRarityId, setFormRarityId] = useState('');
  const [formCurrency, setFormCurrency] = useState('');
  const [formError, setFormError] = useState('');

  // Delete Modals
  const [deleteTarget, setDeleteTarget] = useState<GameItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isDeleteGameOpen, setIsDeleteGameOpen] = useState(false);

  if (!activeGame) {
    return <div className="flex-1 grid place-items-center p-8 text-sm text-slate-500">Impor katalog Excel terlebih dahulu.</div>;
  }

  // All items for this game
  const rawItems = repository.getItemsByGame(selectedGameId);

  // Filter items
  const filteredItems = rawItems.filter((item) => {
    if (categoryFilter !== 'ALL' && item.categoryId !== categoryFilter) return false;
    if (rarityFilter !== 'ALL' && item.rarityId !== rarityFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const cat = categories.find((c) => c.id === item.categoryId);
      const rar = rarities.find((r) => r.id === item.rarityId);
      const matchCat = (cat?.name || '').toLowerCase().includes(q);
      const matchRar = (rar?.name || '').toLowerCase().includes(q);
      if (!matchCat && !matchRar) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const refreshList = () => {
    // triggers re-render via repository subscription
  };

  // Select all on current page
  const handleToggleSelectAll = () => {
    const pageIds = paginatedItems.map((i) => i.id);
    const allSelected = pageIds.every((id) => selectedItemIds.includes(id));
    if (allSelected) {
      setSelectedItemIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedItemIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Open Add modal
  const handleOpenAdd = () => {
    if (!isSuperAdmin) {
      showToast('Akses Terbatas', 'Hanya Super Admin yang dapat menambah item ke master database', 'warning');
      return;
    }
    setEditingItem(null);
    setFormCategoryId(categories[0]?.id || '');
    setFormRarityId(rarities[0]?.id || '');
    setFormCurrency('5000');
    setFormError('');
    setIsModalOpen(true);
  };

  // Open Edit modal
  const handleOpenEdit = (item: GameItem) => {
    if (!isSuperAdmin) {
      showToast('Akses Terbatas', 'Hanya Super Admin yang dapat mengedit master database item', 'warning');
      return;
    }
    setEditingItem(item);
    setFormCategoryId(item.categoryId);
    setFormRarityId(item.rarityId);
    setFormCurrency(String(item.estimatedCurrency));
    setFormError('');
    setIsModalOpen(true);
  };

  // Submit Add/Edit Form
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCategoryId) {
      setFormError('Kategori harus dipilih');
      return;
    }
    if (!formRarityId) {
      setFormError('Rarity harus dipilih');
      return;
    }

    const cost = parseInt(formCurrency.replace(/\D/g, ''), 10);
    if (isNaN(cost) || cost <= 0) {
      setFormError(`Estimasi ${activeGame.currencyName} harus berupa angka lebih dari 0`);
      return;
    }

    const categoryName = categories.find((category) => category.id === formCategoryId)?.name || 'Kategori';

    const itemToSave: GameItem = {
      id: editingItem?.id || `ITEM-${selectedGameId}-${Date.now()}`,
      gameId: selectedGameId,
      categoryId: formCategoryId,
      rarityId: formRarityId,
      name: categoryName,
      type: editingItem?.type || 'specific',
      estimatedCurrency: cost,
      aliases: [],
      description: undefined,
      status: 'active',
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repository.saveItem(itemToSave);
    setIsModalOpen(false);
    refreshList();
    showToast('Database Item Disimpan', `${itemToSave.name} berhasil dicatat.`, 'success');
  };

  // Delete single
  const handleConfirmDeleteSingle = () => {
    if (!deleteTarget) return;
    repository.deleteItem(deleteTarget.id);
    setDeleteTarget(null);
    setSelectedItemIds((prev) => prev.filter((id) => id !== deleteTarget.id));
    refreshList();
    showToast('Item Dihapus', `Item ${deleteTarget.name} telah dihapus dari master database.`, 'info');
  };

  // Bulk Delete
  const handleConfirmBulkDelete = () => {
    const deletedCount = repository.bulkDeleteItems(selectedItemIds);
    setSelectedItemIds([]);
    setIsBulkDeleteOpen(false);
    refreshList();
    showToast('Hapus Massal Berhasil', `${deletedCount} item telah dihapus dari master database.`, 'info');
  };

  const handleConfirmDeleteGame = async () => {
    const gameToDelete = activeGame;
    const nextGame = games.find((game) => game.id !== gameToDelete.id);

    try {
      const deleted = await repository.deleteGame(gameToDelete.id);
      if (!deleted) throw new Error('Game tidak ditemukan');

      setIsDeleteGameOpen(false);
      setSelectedGameId(nextGame?.id || '');
      setCategoryFilter('ALL');
      setRarityFilter('ALL');
      setSearchQuery('');
      setSelectedItemIds([]);
      setCurrentPage(1);
      showToast(
        'Game Dihapus',
        `${gameToDelete.name} beserta seluruh data terkait berhasil dihapus.`,
        'info'
      );
    } catch (error) {
      showToast(
        'Gagal Menghapus Game',
        error instanceof Error ? error.message : 'Game tidak dapat dihapus dari server.',
        'error'
      );
    }
  };

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Item Database Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Kelola harga tiap item yang bersumber dari data Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={onNavigateToImport}
            className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            Import CSV
          </button>

          {isSuperAdmin && (
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Tambah Item
            </button>
          )}
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Game Selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Game:</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedGameId}
                onChange={(e) => {
                  setSelectedGameId(e.target.value);
                  setCategoryFilter('ALL');
                  setRarityFilter('ALL');
                  setCurrentPage(1);
                  setSelectedItemIds([]);
                }}
                className="min-w-0 flex-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
              >
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.currencySymbol})
                  </option>
                ))}
              </select>
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => setIsDeleteGameOpen(true)}
                  className="p-2 text-rose-600 border border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors shrink-0"
                  title={`Hapus keseluruhan game ${activeGame.name}`}
                  aria-label={`Hapus keseluruhan game ${activeGame.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Search */}
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-slate-500 font-medium mb-1">Cari Kategori / Rarity:</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari kategori atau rarity..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs"
              />
            </div>
          </div>

          {/* Category Filter */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Kategori:</label>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Bulk Action Bar */}
        {selectedItemIds.length > 0 && isSuperAdmin && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-lg">
            <span className="font-semibold text-blue-900 dark:text-blue-200">
              {selectedItemIds.length} item dipilih
            </span>
            <button
              onClick={() => setIsBulkDeleteOpen(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Hapus Item Terpilih ({selectedItemIds.length})
            </button>
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                {isSuperAdmin && (
                  <th className="py-3 px-3 w-8">
                    <button
                      onClick={handleToggleSelectAll}
                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                    >
                      {paginatedItems.length > 0 &&
                      paginatedItems.every((i) => selectedItemIds.includes(i.id)) ? (
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Rarity</th>
                <th className="py-3 px-3 text-right">Estimasi {activeGame.currencyName}</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={isSuperAdmin ? 5 : 4} className="py-12 text-center text-slate-400">
                    Tidak ada item yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item) => {
                  const cat = categories.find((c) => c.id === item.categoryId);
                  const rar = rarities.find((r) => r.id === item.rarityId);
                  const isSelected = selectedItemIds.includes(item.id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-blue-50/30 dark:bg-blue-950/20' : ''
                      }`}
                    >
                      {isSuperAdmin && (
                        <td className="py-3 px-3">
                          <button
                            onClick={() => handleToggleSelectItem(item.id)}
                            className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {cat?.name || item.categoryId}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {rar?.name || item.rarityId}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatGameCurrency(item.estimatedCurrency, activeGame.currencySymbol)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isSuperAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                              title="Edit harga kategori"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Hapus item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Read-only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Menampilkan {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredItems.length)} dari {filteredItems.length} item
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-mono font-medium text-slate-800 dark:text-slate-200">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0 mb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {editingItem ? 'Edit Item Database & Alias' : 'Tambah Item Baru ke Database'}
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

            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto space-y-3.5 text-xs pr-1">
              {/* Category & Rarity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Kategori *
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => setFormCategoryId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Rarity *
                  </label>
                  <select
                    value={formRarityId}
                    onChange={(e) => setFormRarityId(e.target.value)}
                    className="w-full px-2.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium"
                  >
                    {rarities.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Estimated Currency */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Estimasi Biaya ({activeGame.currencyName} / {activeGame.currencySymbol}) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="Estimasi currency"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
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
                  Simpan ke Database
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Single Confirmation */}
      {Boolean(deleteTarget) && (
        <ConfirmationModal
          isOpen={Boolean(deleteTarget)}
          title="Hapus Item Database?"
          message={`Apakah Anda yakin ingin menghapus item "${deleteTarget?.name}"? Item ini tidak lagi dapat dicocokkan otomatis oleh AI Estimator.`}
          confirmLabel="Hapus Item"
          variant="danger"
          onConfirm={handleConfirmDeleteSingle}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Bulk Delete Confirmation */}
      {isBulkDeleteOpen && (
        <ConfirmationModal
          isOpen={isBulkDeleteOpen}
          title="Hapus Massal Item Database?"
          message={`Apakah Anda yakin ingin menghapus ${selectedItemIds.length} item yang dipilih secara permanen?`}
          confirmLabel={`Hapus ${selectedItemIds.length} Item`}
          variant="danger"
          onConfirm={handleConfirmBulkDelete}
          onCancel={() => setIsBulkDeleteOpen(false)}
        />
      )}

      {isDeleteGameOpen && (
        <ConfirmationModal
          isOpen={isDeleteGameOpen}
          title={`Hapus Game ${activeGame.name}?`}
          message={`Seluruh data ${activeGame.name} akan dihapus permanen, termasuk ${rawItems.length} item, kategori, rarity, pengaturan harga, riwayat estimasi, dan sesi chat. Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Hapus Keseluruhan Game"
          variant="danger"
          onConfirm={() => void handleConfirmDeleteGame()}
          onCancel={() => setIsDeleteGameOpen(false)}
        />
      )}
    </div>
  );
};
