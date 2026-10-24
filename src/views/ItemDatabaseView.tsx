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
  Tag,
  CheckSquare,
  Square,
  Sparkles,
  X,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { Category, Game, GameItem, ItemType, Rarity, User } from '../types';
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
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'standard' | 'specific'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'inactive'>('ALL');

  // Selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Add/Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GameItem | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formRarityId, setFormRarityId] = useState('');
  const [formType, setFormType] = useState<ItemType>('standard');
  const [formCurrency, setFormCurrency] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formError, setFormError] = useState('');

  // Delete Modals
  const [deleteTarget, setDeleteTarget] = useState<GameItem | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);

  // All items for this game
  const rawItems = repository.getItemsByGame(selectedGameId);

  // Filter items
  const filteredItems = rawItems.filter((item) => {
    if (categoryFilter !== 'ALL' && item.categoryId !== categoryFilter) return false;
    if (rarityFilter !== 'ALL' && item.rarityId !== rarityFilter) return false;
    if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchAlias = (item.aliases || []).some((a) => a.toLowerCase().includes(q));
      const cat = categories.find((c) => c.id === item.categoryId);
      const rar = rarities.find((r) => r.id === item.rarityId);
      const matchCat = (cat?.name || '').toLowerCase().includes(q);
      const matchRar = (rar?.name || '').toLowerCase().includes(q);
      if (!matchName && !matchAlias && !matchCat && !matchRar) return false;
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
    setFormName('');
    setFormCategoryId(categories[0]?.id || '');
    setFormRarityId(rarities[0]?.id || '');
    setFormType('standard');
    setFormCurrency('5000');
    setFormAliases('');
    setFormDescription('');
    setFormStatus('active');
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
    setFormName(item.name);
    setFormCategoryId(item.categoryId);
    setFormRarityId(item.rarityId);
    setFormType(item.type);
    setFormCurrency(String(item.estimatedCurrency));
    setFormAliases((item.aliases || []).join(', '));
    setFormDescription(item.description || '');
    setFormStatus(item.status);
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

    let finalName = formName.trim();
    if (formType === 'standard' && !finalName) {
      finalName = 'Standard';
    } else if (formType === 'specific' && !finalName) {
      setFormError('Item spesifik wajib memiliki nama skin khusus');
      return;
    }

    // Parse aliases
    const aliasesArray = formAliases
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const itemToSave: GameItem = {
      id: editingItem?.id || `ITEM-${selectedGameId}-${Date.now()}`,
      gameId: selectedGameId,
      categoryId: formCategoryId,
      rarityId: formRarityId,
      name: finalName,
      type: formType,
      estimatedCurrency: cost,
      aliases: aliasesArray,
      description: formDescription.trim() || undefined,
      status: formStatus,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repository.saveItem(itemToSave);
    setIsModalOpen(false);
    refreshList();
    showToast('Database Item Disimpan', `${itemToSave.name} (${itemToSave.type}) berhasil dicatat.`, 'success');
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

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-blue-600" />
            Item Database Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Katalog bertingkat kombinasi Kategori + Rarity dan skin spesifik beserta nilai estimasi diamond.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Game Selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Game:</label>
            <select
              value={selectedGameId}
              onChange={(e) => {
                setSelectedGameId(e.target.value);
                setCategoryFilter('ALL');
                setRarityFilter('ALL');
                setCurrentPage(1);
                setSelectedItemIds([]);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
            >
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.currencySymbol})
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="sm:col-span-1 lg:col-span-2">
            <label className="block text-slate-500 font-medium mb-1">Cari Item / Alias:</label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Cari nama skin, alias, atau kategori..."
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

          {/* Type Filter */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Tipe Biaya:</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as any);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            >
              <option value="ALL">Semua Tipe</option>
              <option value="standard">Standard (Category+Rarity)</option>
              <option value="specific">Specific Skin (Eksklusif)</option>
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
                <th className="py-3 px-3">Nama Item / Skin</th>
                <th className="py-3 px-3">Kategori</th>
                <th className="py-3 px-3">Rarity</th>
                <th className="py-3 px-3">Tipe</th>
                <th className="py-3 px-3 text-right">Estimasi {activeGame.currencyName}</th>
                <th className="py-3 px-3">Sinonim / Alias</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
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
                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                          {item.name === 'Standard' ? `${cat?.name || ''} ${rar?.name || ''} (Standard)` : item.name}
                        </span>
                        {item.description && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-xs">
                            {item.description}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {cat?.name || item.categoryId}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {rar?.name || item.rarityId}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.type === 'specific'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {item.type}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {formatGameCurrency(item.estimatedCurrency, activeGame.currencySymbol)}
                      </td>
                      <td className="py-3 px-3 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {(item.aliases || []).slice(0, 3).map((alias, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                            >
                              {alias}
                            </span>
                          ))}
                          {(item.aliases || []).length > 3 && (
                            <span className="text-[10px] text-slate-400">
                              +{item.aliases.length - 3}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                            item.status === 'active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        {isSuperAdmin ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                              title="Edit item & alias"
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
              {/* Type Switcher */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Tipe Item *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('standard');
                      if (!editingItem) setFormName('Standard');
                    }}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formType === 'standard'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    Standard Cost (Kategori + Rarity)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormType('specific');
                      if (formName === 'Standard') setFormName('');
                    }}
                    className={`py-2 px-3 rounded-xl border text-center font-semibold transition-all ${
                      formType === 'specific'
                        ? 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600'
                    }`}
                  >
                    Specific Skin (Nama Skin Khusus)
                  </button>
                </div>
              </div>

              {/* Item Name */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  {formType === 'specific' ? 'Nama Skin Khusus *' : 'Nama Item (Boleh Standard)'}
                </label>
                <input
                  type="text"
                  placeholder={formType === 'specific' ? 'Contoh: Crimson Blade' : 'Standard'}
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

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
                  placeholder="Contoh: 5000"
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono"
                />
              </div>

              {/* Aliases */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1 flex items-center justify-between">
                  <span>Sinonim / Alias Pencarian (Pisahkan dengan koma)</span>
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                </label>
                <input
                  type="text"
                  placeholder="Contoh: pedang crimson, crimson, katana crimson blade"
                  value={formAliases}
                  onChange={(e) => setFormAliases(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Sistem AI parser akan mencocokkan teks pengguna dengan alias ini secara otomatis.
                </span>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Deskripsi / Keterangan (Opsional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Keterangan tambahan skin..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="active">Active (Tersedia untuk matching)</option>
                  <option value="inactive">Inactive</option>
                </select>
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
    </div>
  );
};
