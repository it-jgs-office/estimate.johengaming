/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { X, Check, Bookmark, Sparkles } from 'lucide-react';
import { Estimation, EstimationCalculation, Game, RecognizedItem, User } from '../types';
import { formatGameCurrency, formatIDR } from '../services/pricingCalculationService';
import { repository } from '../services/repository';

interface SaveEstimationModalProps {
  isOpen: boolean;
  game: Game;
  items: RecognizedItem[];
  calculation: EstimationCalculation;
  currentUser: User;
  originalText?: string;
  onClose: () => void;
  onSaved: (savedEstimation: Estimation) => void;
}

export const SaveEstimationModal: React.FC<SaveEstimationModalProps> = ({
  isOpen,
  game,
  items,
  calculation,
  currentUser,
  originalText = '',
  onClose,
  onSaved,
}) => {
  const [nextId, setNextId] = useState('');
  const [title, setTitle] = useState('');
  const [accountIdentifier, setAccountIdentifier] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  // Generate a smart suggested title and ID on open
  useEffect(() => {
    if (isOpen) {
      setNextId(repository.getNextEstimationId());
      if (items.length > 0) {
        const topItems = items.slice(0, 2).map((i) => i.itemName).join(' + ');
        const more = items.length > 2 ? ` (+${items.length - 2} items)` : '';
        setTitle(`${game.name} Account - ${topItems}${more}`);
      } else {
        setTitle(`${game.name} Account Valuation`);
      }
      setError('');
    }
  }, [isOpen, items, game.name]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Judul estimasi wajib diisi');
      return;
    }

    const newEstimation: Estimation = {
      id: nextId,
      gameId: game.id,
      userId: currentUser.id,
      userName: currentUser.name,
      title: title.trim(),
      accountIdentifier: accountIdentifier.trim() || undefined,
      originalSpecification: originalText.trim() || items.map((i) => `${i.itemName} (${i.quantity}x)`).join(', '),
      totalCurrency: calculation.totalCurrency,
      conversionRateSnapshot: calculation.conversionRate,
      lowPercentageSnapshot: calculation.lowPercentage,
      mediumPercentageSnapshot: calculation.mediumPercentage,
      highPercentageSnapshot: calculation.highPercentage,
      baseValue: calculation.baseValue,
      lowPrice: calculation.lowPrice,
      mediumPrice: calculation.mediumPrice,
      highPrice: calculation.highPrice,
      notes: notes.trim() || undefined,
      itemsSnapshot: JSON.parse(JSON.stringify(items)),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    repository.saveEstimation(newEstimation);
    onSaved(newEstimation);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Bookmark className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Simpan Hasil Estimasi
              </h3>
              <span className="text-xs font-mono text-slate-500">ID: {nextId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Valuation Snapshot Summary Box */}
        <div className="my-4 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 text-xs">
          <div className="grid grid-cols-2 gap-2 mb-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/60">
            <div>
              <span className="text-slate-500 block">Game:</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">{game.name}</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Total {game.currencyName}:</span>
              <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                {formatGameCurrency(calculation.totalCurrency, game.currencySymbol)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">Low ({calculation.lowPercentage}%)</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formatIDR(calculation.lowPrice)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
              <span className="text-[10px] text-blue-700 dark:text-blue-300 block font-medium">
                Medium ({calculation.mediumPercentage}%)
              </span>
              <span className="font-mono font-bold text-blue-900 dark:text-blue-100 text-xs">
                {formatIDR(calculation.mediumPrice)}
              </span>
            </div>
            <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
              <span className="text-[10px] text-slate-500 block">High ({calculation.highPercentage}%)</span>
              <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                {formatIDR(calculation.highPrice)}
              </span>
            </div>
          </div>
        </div>

        {/* Form Fields */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Judul / Nama Estimasi *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 text-xs"
              placeholder="Nama estimasi"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Account Identifier (Opsional, misal UID / IGN)
            </label>
            <input
              type="text"
              value={accountIdentifier}
              onChange={(e) => setAccountIdentifier(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 text-xs"
              placeholder="UID atau IGN"
            />
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
              Catatan Internal (Opsional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 text-xs"
              placeholder="Catatan kondisi akun, binder/unbind, kelengkapan vault..."
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Simpan ke Riwayat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
