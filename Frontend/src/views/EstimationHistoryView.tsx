/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  History,
  Search,
  Filter,
  Download,
  Copy,
  Printer,
  Trash2,
  CopyPlus,
  RefreshCw,
  X,
  ExternalLink,
  Gamepad2,
  Calendar,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Estimation, Game, RecognizedItem, User } from '../types';
import { repository } from '../services/repository';
import {
  calculateAccountValuation,
  formatGameCurrency,
  formatIDR,
  formatNumberID,
} from '../services/pricingCalculationService';
import { useToast } from '../context/ToastContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

interface EstimationHistoryViewProps {
  currentUser: User;
  onDuplicateToEstimator: (items: RecognizedItem[], gameId: string) => void;
  selectedDetailEst?: Estimation | null;
  onCloseDetail?: () => void;
}

export const EstimationHistoryView: React.FC<EstimationHistoryViewProps> = ({
  currentUser,
  onDuplicateToEstimator,
  selectedDetailEst,
  onCloseDetail,
}) => {
  const { showToast } = useToast();
  const [estimations, setEstimations] = useState<Estimation[]>(() => repository.getEstimations());
  const games = repository.getGames();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGameFilter, setSelectedGameFilter] = useState('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState('');

  // Detail Modal
  const [activeDetail, setActiveDetail] = useState<Estimation | null>(selectedDetailEst || null);
  const [recalcResult, setRecalcResult] = useState<any | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<Estimation | null>(null);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<'date' | 'all' | null>(null);

  // Sync when prop changes
  React.useEffect(() => {
    if (selectedDetailEst) {
      setActiveDetail(selectedDetailEst);
      setRecalcResult(null);
    }
  }, [selectedDetailEst]);

  React.useEffect(() => repository.subscribe(() => setEstimations(repository.getEstimations())), []);

  const refreshList = () => {
    setEstimations(repository.getEstimations());
  };

  const getDateKey = (value: string) => {
    const date = new Date(value);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filtered estimations
  const filteredList = estimations.filter((e) => {
    if (selectedGameFilter !== 'ALL' && e.gameId !== selectedGameFilter) return false;
    if (selectedDateFilter && getDateKey(e.createdAt) !== selectedDateFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = e.id.toLowerCase().includes(q);
      const matchTitle = e.title.toLowerCase().includes(q);
      const matchIden = (e.accountIdentifier || '').toLowerCase().includes(q);
      const matchNotes = (e.notes || '').toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchIden && !matchNotes) return false;
    }
    return true;
  });

  // Handle Delete
  const handleDelete = () => {
    if (!deleteTarget) return;
    repository.deleteEstimation(deleteTarget.id);
    setDeleteTarget(null);
    if (activeDetail?.id === deleteTarget.id) {
      setActiveDetail(null);
    }
    refreshList();
    showToast('Estimasi Dihapus', `Data estimasi ${deleteTarget.id} telah dihapus.`, 'info');
  };

  const dateList = selectedDateFilter
    ? estimations.filter((estimation) => getDateKey(estimation.createdAt) === selectedDateFilter)
    : [];

  const handleBulkDelete = () => {
    const targets = bulkDeleteMode === 'date' ? dateList : estimations;
    if (targets.length === 0) {
      setBulkDeleteMode(null);
      return;
    }

    const targetIds = new Set(targets.map((target) => target.id));
    targets.forEach((target) => repository.deleteEstimation(target.id));
    if (activeDetail && targetIds.has(activeDetail.id)) setActiveDetail(null);
    setDeleteTarget(null);
    setBulkDeleteMode(null);
    refreshList();
    showToast(
      bulkDeleteMode === 'date' ? 'Riwayat tanggal dihapus' : 'Seluruh riwayat dihapus',
      `${targets.length} estimasi telah dihapus.`,
      'info',
    );
  };

  // Handle Recalculate with CURRENT database rates
  const handleRecalculateCurrentDB = (est: Estimation) => {
    const game = repository.getGameById(est.gameId);
    if (!game) return;
    const currentPricing = repository.getPricingSettingByGame(est.gameId);
    const newCalc = calculateAccountValuation(est.itemsSnapshot || [], game, currentPricing);
    setRecalcResult({
      currentRate: newCalc.conversionRate,
      currentBase: newCalc.baseValue,
      currentLow: newCalc.lowPrice,
      currentMed: newCalc.mediumPrice,
      currentHigh: newCalc.highPrice,
      diffRate: newCalc.conversionRate - est.conversionRateSnapshot,
      diffMed: newCalc.mediumPrice - est.mediumPrice,
    });
    showToast('Kalkulasi Ulang Berhasil', 'Membandingkan data snapshot lama dengan rate saat ini.', 'info');
  };

  const getExportName = () => {
    const game = selectedGameFilter === 'ALL' ? null : repository.getGameById(selectedGameFilter);
    const gameName = (game?.name || 'semua-game').toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/(^-|-$)/g, '');
    return `${gameName}${selectedDateFilter ? `-${selectedDateFilter}` : ''}`;
  };

  const getFilterLabel = () => {
    const gameLabel = selectedGameFilter === 'ALL' ? 'Semua Game' : repository.getGameById(selectedGameFilter)?.name || 'Game';
    return `${gameLabel}${selectedDateFilter ? ` · ${new Date(`${selectedDateFilter}T00:00:00`).toLocaleDateString('id-ID')}` : ''}`;
  };

  const getExportRows = () => filteredList.map((estimation) => {
    const game = repository.getGameById(estimation.gameId);
    return [
      estimation.id, estimation.title, game?.name || estimation.gameId, estimation.accountIdentifier || '-',
      estimation.totalCurrency, estimation.conversionRateSnapshot, estimation.baseValue, estimation.lowPrice,
      estimation.mediumPrice, estimation.highPrice, estimation.userName || '-',
      new Date(estimation.createdAt).toLocaleString('id-ID'),
    ];
  });

  const ensureExportable = () => {
    if (filteredList.length === 0) {
      showToast('Tidak ada data', 'Tidak ada data untuk diekspor', 'warning');
      return false;
    }
    return true;
  };

  const exportHeaders = [
    'ID Estimasi', 'Judul', 'Game', 'Account Identifier', 'Total Currency', 'Rate Snapshot',
    'Nilai Dasar', 'Harga Low', 'Harga Medium', 'Harga High', 'Estimator', 'Tanggal Dibuat',
  ];

  const handleExportExcel = () => {
    if (!ensureExportable()) return;
    const gameLabel = getFilterLabel();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['JOHEN GAMING - ESTIMATION HISTORY'],
      [`Filter: ${gameLabel}`],
      [`Diekspor: ${new Date().toLocaleString('id-ID')}`],
      [],
      exportHeaders,
      ...getExportRows(),
    ]);
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 34 }, { wch: 20 }, { wch: 22 }, { wch: 16 }, { wch: 15 },
      { wch: 16 }, { wch: 16 }, { wch: 17 }, { wch: 16 }, { wch: 20 }, { wch: 24 },
    ];
    worksheet['!autofilter'] = { ref: `A5:L${filteredList.length + 5}` };
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Estimasi');
    XLSX.writeFile(workbook, `johen-riwayat-${getExportName()}.xlsx`);
    showToast('Excel berhasil diunduh', `${filteredList.length} estimasi ${gameLabel} telah diekspor.`, 'success');
  };

  const handleExportPdf = () => {
    if (!ensureExportable()) return;
    const gameLabel = getFilterLabel();
    const document = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    document.setFontSize(16);
    document.setTextColor(15, 23, 42);
    document.text('JOHEN GAMING - RIWAYAT ESTIMASI', 40, 42);
    document.setFontSize(9);
    document.setTextColor(71, 85, 105);
    document.text(`Filter: ${gameLabel} | Diekspor: ${new Date().toLocaleString('id-ID')}`, 40, 60);
    autoTable(document, {
      startY: 76,
      head: [exportHeaders],
      body: getExportRows(),
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 5 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      columnStyles: { 1: { cellWidth: 110 }, 2: { cellWidth: 70 }, 11: { cellWidth: 82 } },
    });
    document.save(`johen-riwayat-${getExportName()}.pdf`);
    showToast('PDF berhasil diunduh', `${filteredList.length} estimasi ${gameLabel} telah diekspor.`, 'success');
  };

  // Copy Summary text
  const handleCopySummary = (est: Estimation) => {
    const game = repository.getGameById(est.gameId);
    const itemsList = (est.itemsSnapshot || [])
      .map((i) => `• ${i.itemName} (${i.quantity}x) = ${formatGameCurrency(i.totalCurrency, game?.currencySymbol || 'DM')}`)
      .join('\n');

    const text = `JOHEN GAMING — ACCOUNT PRICE ESTIMATION
========================================
ID: ${est.id}
Judul: ${est.title}
Game: ${game?.name || est.gameId}
Total Currency: ${formatGameCurrency(est.totalCurrency, game?.currencySymbol || 'DM')}
Conversion Rate Snapshot: Rp${est.conversionRateSnapshot}
Base Value: ${formatIDR(est.baseValue)}

ESTIMASI HARGA:
• Low Price (${est.lowPercentageSnapshot}%): ${formatIDR(est.lowPrice)}
• Medium Price (${est.mediumPercentageSnapshot}%): ${formatIDR(est.mediumPrice)}
• High Price (${est.highPercentageSnapshot}%): ${formatIDR(est.highPrice)}

Rincian Item:
${itemsList}

Catatan: ${est.notes || '-'}
Estimator: ${est.userName}
Tanggal: ${new Date(est.createdAt).toLocaleDateString('id-ID', { dateStyle: 'full' })}`;

    navigator.clipboard.writeText(text);
    showToast('Ringkasan Disalin', 'Teks estimasi siap dikirim ke tim / buyer', 'success');
  };

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <History className="w-6 h-6 text-blue-600" />
            Estimation History
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Semua hasil estimasi tersimpan di sini dan dapat diekspor berdasarkan game maupun tanggal.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4" />
          Export Excel
        </button>
        <button
          onClick={handleExportPdf}
          className="flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
        >
          <Printer className="w-4 h-4" />
          Export PDF
        </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-3 rounded-xl border border-slate-200 bg-white shadow-2xs flex flex-col md:flex-row items-stretch md:items-center gap-3 text-xs">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari ID estimasi, judul akun, atau UID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-xs focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <span className="text-slate-500 shrink-0">Game</span>
          <select
            value={selectedGameFilter}
            onChange={(e) => setSelectedGameFilter(e.target.value)}
            className="min-w-36 bg-transparent text-slate-900 text-xs font-semibold focus:outline-none"
          >
            <option value="ALL">Semua Game</option>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
          <Calendar className="h-3.5 w-3.5 text-slate-500" />
          <input
            type="date"
            value={selectedDateFilter}
            onChange={(e) => setSelectedDateFilter(e.target.value)}
            aria-label="Filter tanggal estimasi"
            className="min-w-32 bg-transparent text-slate-900 text-xs font-semibold focus:outline-none"
          />
          {selectedDateFilter && (
            <button
              type="button"
              onClick={() => setSelectedDateFilter('')}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
              title="Hapus filter tanggal"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {selectedDateFilter && (
            <button
              type="button"
              onClick={() => setBulkDeleteMode('date')}
              disabled={dateList.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus tanggal
            </button>
          )}
          <button
            type="button"
            onClick={() => setBulkDeleteMode('all')}
            disabled={estimations.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 py-2 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Hapus semua
          </button>
        </div>

        <div className="text-slate-500 md:ml-auto px-2">
          {filteredList.length} estimasi
        </div>
      </div>

      {/* History Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3.5">ID Estimasi</th>
                <th className="py-3 px-3.5">Judul & Spesifikasi</th>
                <th className="py-3 px-3.5">Game</th>
                <th className="py-3 px-3.5 text-right">Total Currency</th>
                <th className="py-3 px-3.5 text-right">Estimasi Harga</th>
                <th className="py-3 px-3.5">Tanggal</th>
                <th className="py-3 px-3.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Belum ada estimasi untuk filter ini.
                  </td>
                </tr>
              ) : (
                filteredList.map((est) => {
                  const game = repository.getGameById(est.gameId);
                  return (
                    <tr
                      key={est.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {est.id}
                      </td>
                      <td className="py-3 px-3.5 max-w-xs">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 block truncate">
                          {est.title}
                        </span>
                        {est.accountIdentifier && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            UID: {est.accountIdentifier}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-slate-600 dark:text-slate-400">
                        {game?.name || est.gameId}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                        {formatGameCurrency(est.totalCurrency, game?.currencySymbol || 'DM')}
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {formatIDR(est.mediumPrice)}
                        </span>
                        <span className="block text-[10px] text-slate-400">Medium {est.mediumPercentageSnapshot}%</span>
                      </td>
                      <td className="py-3 px-3.5 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(est.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setActiveDetail(est);
                              setRecalcResult(null);
                            }}
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 rounded-md font-semibold text-[11px] transition-colors"
                            title="Buka rincian lengkap"
                          >
                            Detail
                          </button>
                          <button
                            onClick={() => onDuplicateToEstimator(est.itemsSnapshot || [], est.gameId)}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded transition-colors"
                            title="Duplikat ke AI Estimator"
                          >
                            <CopyPlus className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(est)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Hapus estimasi"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {activeDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
                  {activeDetail.id.substring(4)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {activeDetail.title}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    Snapshot ID: {activeDetail.id} · Dibuat oleh {activeDetail.userName}
                  </span>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveDetail(null);
                  if (onCloseDetail) onCloseDetail();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
              {/* Snapshot Pricing Info */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Total Currency</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatNumberID(activeDetail.totalCurrency)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Rate Snapshot</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      Rp{activeDetail.conversionRateSnapshot}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Base Value</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatIDR(activeDetail.baseValue)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block">Tanggal Kalkulasi</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {new Date(activeDetail.createdAt).toLocaleDateString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3 Price Cards */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">
                    Low ({activeDetail.lowPercentageSnapshot}%)
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatIDR(activeDetail.lowPrice)}
                  </span>
                </div>

                <div className="p-3 rounded-xl border-2 border-blue-500 bg-blue-50/50 dark:bg-blue-950/40">
                  <span className="text-[10px] text-blue-700 dark:text-blue-300 block uppercase font-bold">
                    Medium ({activeDetail.mediumPercentageSnapshot}%)
                  </span>
                  <span className="font-mono font-extrabold text-blue-900 dark:text-blue-100 text-sm">
                    {formatIDR(activeDetail.mediumPrice)}
                  </span>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-[10px] text-slate-400 block uppercase font-medium">
                    High ({activeDetail.highPercentageSnapshot}%)
                  </span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {formatIDR(activeDetail.highPrice)}
                  </span>
                </div>
              </div>

              {/* Recalculate Simulation Result (if triggered) */}
              {recalcResult && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                    <span>Hasil Uji Ulang dengan Database Sekarang:</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    Rate saat ini adalah Rp{recalcResult.currentRate} (selisih Rp{recalcResult.diffRate} dari snapshot).
                    <br />
                    Medium Price terkini:{' '}
                    <span className="font-mono font-bold">{formatIDR(recalcResult.currentMed)}</span>{' '}
                    ({recalcResult.diffMed >= 0 ? `+${formatIDR(recalcResult.diffMed)}` : formatIDR(recalcResult.diffMed)}).
                  </p>
                  <span className="text-[10px] text-amber-700/80 block mt-1">
                    * Catatan: Data riwayat asli tetap dipertahankan sesuai snapshot historis.
                  </span>
                </div>
              )}

              {/* Items Breakdown Table */}
              <div>
                <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">
                  Daftar Koleksi Item Terpasang:
                </h4>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium">
                      <tr>
                        <th className="py-2 px-3">Item / Skin</th>
                        <th className="py-2 px-3">Kategori</th>
                        <th className="py-2 px-3 text-center">Qty</th>
                        <th className="py-2 px-3 text-right">Biaya Satuan</th>
                        <th className="py-2 px-3 text-right">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(activeDetail.itemsSnapshot || []).map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            {item.itemName}
                          </td>
                          <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                            {item.categoryName} · {item.rarityName}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">
                            {item.quantity}x
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-300">
                            {formatNumberID(item.unitCurrency)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                            {formatNumberID(item.totalCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {activeDetail.notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-bold text-slate-700 dark:text-slate-300 block mb-0.5">
                    Catatan Internal:
                  </span>
                  <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                    {activeDetail.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleRecalculateCurrentDB(activeDetail)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Kalkulasi Ulang (Rate Saat Ini)
                </button>
                <button
                  type="button"
                  onClick={() => handleCopySummary(activeDetail)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Salin Teks
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Lembar
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  onDuplicateToEstimator(activeDetail.itemsSnapshot || [], activeDetail.gameId);
                  setActiveDetail(null);
                }}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                <CopyPlus className="w-3.5 h-3.5" />
                Buka di Estimator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {Boolean(deleteTarget) && (
        <ConfirmationModal
          isOpen={Boolean(deleteTarget)}
          title="Hapus Riwayat Estimasi?"
          message={`Apakah Anda yakin ingin menghapus catatan estimasi ${deleteTarget?.id} (${deleteTarget?.title})? Tindakan ini tidak dapat dibatalkan.`}
          confirmLabel="Hapus Permanen"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {bulkDeleteMode && (
        <ConfirmationModal
          isOpen={Boolean(bulkDeleteMode)}
          title={bulkDeleteMode === 'date' ? 'Hapus Riwayat Tanggal Ini?' : 'Hapus Semua Riwayat?'}
          message={bulkDeleteMode === 'date'
            ? `Sebanyak ${dateList.length} estimasi pada ${new Date(`${selectedDateFilter}T00:00:00`).toLocaleDateString('id-ID')} akan dihapus permanen.`
            : `Seluruh ${estimations.length} riwayat estimasi akan dihapus permanen.`}
          confirmLabel={bulkDeleteMode === 'date' ? 'Hapus Tanggal Ini' : 'Hapus Semua'}
          variant="danger"
          onConfirm={handleBulkDelete}
          onCancel={() => setBulkDeleteMode(null)}
        />
      )}
    </div>
  );
};
