/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Edit2,
  AlertCircle,
  Gem,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import { Game, RecognizedItem } from '../types';
import { formatGameCurrency, formatNumberID } from '../services/pricingCalculationService';
import { repository } from '../services/repository';

interface ItemReviewModalProps {
  isOpen: boolean;
  game: Game;
  items: RecognizedItem[];
  onClose: () => void;
  onUpdateItems: (updated: RecognizedItem[]) => void;
}

export const ItemReviewModal: React.FC<ItemReviewModalProps> = ({
  isOpen,
  game,
  items,
  onClose,
  onUpdateItems,
}) => {
  const [draftList, setDraftList] = useState<RecognizedItem[]>([]);
  const [showAddManual, setShowAddManual] = useState(false);

  // Manual Item Form State
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualRarity, setManualRarity] = useState('');
  const [manualCurrency, setManualCurrency] = useState('');
  const [manualQuantity, setManualQuantity] = useState(1);
  const [formError, setFormError] = useState('');

  // Sync draftList when modal opens or items change
  React.useEffect(() => {
    if (isOpen) {
      setDraftList([...items]);
      setShowAddManual(false);
      setFormError('');
    }
  }, [isOpen, items]);

  if (!isOpen) return null;

  const availableCategories = repository.getCategoriesByGame(game.id);
  const availableRarities = repository.getRaritiesByGame(game.id);

  const handleQuantityChange = (tempId: string, delta: number) => {
    setDraftList((prev) =>
      prev.map((item) => {
        if (item.tempId === tempId) {
          const newQty = Math.max(1, item.quantity + delta);
          return {
            ...item,
            quantity: newQty,
            totalCurrency: item.unitCurrency * newQty,
          };
        }
        return item;
      })
    );
  };

  const handleUnitCurrencyChange = (tempId: string, val: string) => {
    const num = parseInt(val.replace(/\D/g, ''), 10) || 0;
    setDraftList((prev) =>
      prev.map((item) => {
        if (item.tempId === tempId) {
          return {
            ...item,
            unitCurrency: num,
            totalCurrency: num * item.quantity,
          };
        }
        return item;
      })
    );
  };

  const handleDeleteItem = (tempId: string) => {
    setDraftList((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) {
      setFormError('Nama item wajib diisi');
      return;
    }
    const cost = parseInt(manualCurrency.replace(/\D/g, ''), 10);
    if (isNaN(cost) || cost <= 0) {
      setFormError(`Estimasi ${game.currencyName} harus angka lebih dari 0`);
      return;
    }

    const newItem: RecognizedItem = {
      tempId: `manual-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      gameId: game.id,
      categoryName: manualCategory.trim() || 'Manual Category',
      rarityName: manualRarity.trim() || 'Custom',
      itemName: manualName.trim(),
      itemType: 'manual',
      quantity: Math.max(1, manualQuantity),
      unitCurrency: cost,
      totalCurrency: cost * Math.max(1, manualQuantity),
      matchSource: 'manual',
      confidence: 'manual',
      isManual: true,
      originalRawText: manualName.trim(),
    };

    setDraftList((prev) => [...prev, newItem]);
    setManualName('');
    setManualCategory('');
    setManualRarity('');
    setManualCurrency('');
    setManualQuantity(1);
    setFormError('');
    setShowAddManual(false);
  };

  const handleSaveAndApply = () => {
    onUpdateItems(draftList);
    onClose();
  };

  const totalCurrencySum = draftList.reduce((acc, i) => acc + i.totalCurrency, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-3xl w-full p-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              Review & Kelola Item Estimasi
              <span className="text-xs font-normal text-slate-500">({draftList.length} item)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Periksa kecocokan item, sesuaikan jumlah item, atau masukkan item kustom secara manual.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto py-4 min-h-[220px]">
          {draftList.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <Gem className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm">Belum ada item dalam daftar estimasi.</p>
              <button
                type="button"
                onClick={() => setShowAddManual(true)}
                className="mt-3 text-xs text-blue-600 font-semibold hover:underline"
              >
                + Tambah Item Manual
              </button>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Item / Skin</th>
                    <th className="py-2.5 px-3">Kategori & Rarity</th>
                    <th className="py-2.5 px-3 text-center">Jumlah (Qty)</th>
                    <th className="py-2.5 px-3 text-right">Biaya Satuan</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {draftList.map((item) => (
                    <tr key={item.tempId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                          {item.itemName}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[10px]">
                          {item.matchSource === 'database' ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Database Match</span>
                          ) : item.matchSource === 'alias' ? (
                            <span className="text-blue-600 dark:text-blue-400 font-medium">Alias Match</span>
                          ) : item.matchSource === 'fuzzy' ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium">Fuzzy Match</span>
                          ) : (
                            <span className="text-purple-600 dark:text-purple-400 font-medium">Input Manual</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                        {item.categoryName} · {item.rarityName}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <div className="inline-flex items-center border border-slate-200 dark:border-slate-700 rounded-lg">
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.tempId, -1)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            -
                          </button>
                          <span className="px-2 py-1 font-mono font-medium text-slate-900 dark:text-slate-100">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleQuantityChange(item.tempId, 1)}
                            className="px-2 py-1 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
                          >
                            +
                          </button>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <input
                          type="text"
                          value={item.unitCurrency}
                          onChange={(e) => handleUnitCurrencyChange(item.tempId, e.target.value)}
                          className="w-20 text-right font-mono text-xs p-1 border border-slate-200 dark:border-slate-700 rounded bg-transparent focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                        {formatGameCurrency(item.totalCurrency, game.currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.tempId)}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                          title="Hapus item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Form Tambah Item Manual */}
          {showAddManual && (
            <form
              onSubmit={handleAddManualItem}
              className="mt-4 p-4 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300">
                  Tambah Item Manual ke Estimasi
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddManual(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                >
                  Batal
                </button>
              </div>

              {formError && (
                <p className="text-xs text-rose-600 mb-2 font-medium">{formError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs mb-3">
                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Nama Item / Skin *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nama item atau skin"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Kategori
                  </label>
                  <input
                    type="text"
                    list="cat-suggestions"
                    placeholder="Kategori"
                    value={manualCategory}
                    onChange={(e) => setManualCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="cat-suggestions">
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Rarity
                  </label>
                  <input
                    type="text"
                    list="rar-suggestions"
                    placeholder="Rarity"
                    value={manualRarity}
                    onChange={(e) => setManualRarity(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <datalist id="rar-suggestions">
                    {availableRarities.map((r) => (
                      <option key={r.id} value={r.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">
                    Estimasi {game.currencyName} *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Estimasi currency"
                    value={manualCurrency}
                    onChange={(e) => setManualCurrency(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition-colors"
                >
                  Masukkan ke Daftar
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Summary & Controls */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            {!showAddManual && (
              <button
                type="button"
                onClick={() => setShowAddManual(true)}
                className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Item Manual
              </button>
            )}
            <div className="text-xs text-slate-500">
              Total {game.currencyName}:{' '}
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                {formatGameCurrency(totalCurrencySum, game.currencySymbol)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveAndApply}
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors"
            >
              Terapkan Perubahan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
