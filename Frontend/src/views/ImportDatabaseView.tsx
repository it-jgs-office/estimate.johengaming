/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  FileCheck,
  ArrowRight,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { ImportBatch, User } from '../types';
import { repository } from '../services/repository';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';

interface ImportDatabaseViewProps {
  currentUser: User;
  onNavigateToItems: () => void;
}

interface ParsedImportRow {
  rowNumber: number;
  game: string;
  category: string;
  rarity: string;
  estimatedCurrency: number;
  isValid: boolean;
  errors: string[];
  isDuplicate: boolean;
  gameIdResolved?: string;
  categoryIdResolved?: string;
  rarityIdResolved?: string;
}

export const ImportDatabaseView: React.FC<ImportDatabaseViewProps> = ({
  currentUser,
  onNavigateToItems,
}) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [gameName, setGameName] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [conflictMode, setConflictMode] = useState<
    'skip_duplicates' | 'update_existing' | 'import_new_only'
  >('update_existing');

  const [importHistory, setImportHistory] = useState<ImportBatch[]>(() =>
    repository.getImportBatches()
  );

  // Download matrix template
  const handleDownloadTemplate = () => {
    const csvContent = 'Kategori,Special,Heroic,Legendary\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'johen_item_database_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Template Diunduh', 'Berkas matriks kategori dan rarity siap dibuka di Excel.', 'success');
  };

  // Handle File Input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void readSpreadsheet(file);
  };

  // Drag and Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) void readSpreadsheet(file);
  };

  const readSpreadsheet = async (file: File) => {
    if (!gameName.trim()) {
      showToast('Nama game diperlukan', 'Masukkan nama game sebelum mengunggah data harga.', 'warning');
      return;
    }
    setFileName(file.name);
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const source = isExcel ? await file.arrayBuffer() : await file.text();
      const workbook = XLSX.read(source, { type: isExcel ? 'array' : 'string' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '' });
      processMatrix(matrix);
    } catch {
      showToast('Berkas tidak dapat dibaca', 'Gunakan file Excel (.xlsx/.xls) atau CSV dengan format matriks.', 'error');
    }
  };

  const processMatrix = (matrix: unknown[][]) => {
    if (matrix.length < 2 || matrix[0].length < 2) {
      showToast('Berkas Kosong', 'Berkas harus memiliki kolom Kategori dan minimal satu rarity.', 'error');
      return;
    }
    const games = repository.getGames();
    const categories = repository.getCategories();
    const rarities = repository.getRarities();
    const existingItems = repository.getItems();
    const rarityHeaders = matrix[0].slice(1).map((header) => String(header).trim());
    const rows: ParsedImportRow[] = [];

    matrix.slice(1).forEach((line, rowIndex) => {
      const categoryRaw = String(line[0] ?? '').trim();
      rarityHeaders.forEach((rarityRaw, rarityIndex) => {
        const rawValue = line[rarityIndex + 1];
        if (!categoryRaw || !rarityRaw || rawValue === '' || rawValue === null || rawValue === undefined) return;
        const currencyRaw = Number(String(rawValue).replace(/[^\d]/g, ''));
        const errors = isNaN(currencyRaw) || currencyRaw <= 0 ? ['Nilai currency harus angka > 0'] : [];
        const matchedGame = games.find((game) => game.name.toLowerCase() === gameName.trim().toLowerCase());
        const matchedCategory = matchedGame ? categories.find((category) => category.gameId === matchedGame.id && category.name.toLowerCase() === categoryRaw.toLowerCase()) : undefined;
        const matchedRarity = matchedGame ? rarities.find((rarity) => rarity.gameId === matchedGame.id && rarity.name.toLowerCase() === rarityRaw.toLowerCase()) : undefined;
        const isDuplicate = Boolean(matchedGame && matchedCategory && matchedRarity && existingItems.some((item) => item.gameId === matchedGame.id && item.categoryId === matchedCategory.id && item.rarityId === matchedRarity.id));
        rows.push({ rowNumber: rowIndex + 2, game: gameName.trim(), category: categoryRaw, rarity: rarityRaw, estimatedCurrency: currencyRaw, isValid: errors.length === 0, errors, isDuplicate, gameIdResolved: matchedGame?.id, categoryIdResolved: matchedCategory?.id, rarityIdResolved: matchedRarity?.id });
      });
    });

    if (rows.length === 0) {
      showToast('Data tidak ditemukan', 'Isi nilai currency pada minimal satu kolom rarity.', 'warning');
      return;
    }

    setParsedRows(rows);
    setStep(2);
    showToast('Berkas Berhasil Dibaca', `${rows.length} harga kategori–rarity berhasil dimuat untuk pratinjau.`, 'info');
  };

  // Execute Import
  const handleConfirmImport = async () => {
    const validRows = parsedRows.filter((row) => row.isValid);
    const failedCount = parsedRows.length - validRows.length;
    if (validRows.length === 0) return;

    try {
      const result = await api<{ created: number; updated: number; skipped: number }>('/catalog/import', {
        method: 'POST',
        body: JSON.stringify({
          mode: conflictMode,
          rows: validRows.map(({ game, category, rarity, estimatedCurrency }) => ({ game, category, rarity, estimatedCurrency })),
        }),
      });
      await repository.hydrate();
      const successfulCount = result.created + result.updated;

    // Log Batch
    const batch: ImportBatch = {
      id: `BATCH-${Date.now()}`,
      fileName,
      timestamp: new Date().toISOString(),
      totalRows: parsedRows.length,
      successfulRows: successfulCount,
      failedRows: failedCount,
      userId: currentUser.id,
      userName: currentUser.name,
      mode: conflictMode,
    };
    repository.logImportBatch(batch);
    setImportHistory(repository.getImportBatches());

    setStep(3);
      showToast('Impor Selesai!', `${successfulCount} item berhasil diimpor ke database master.`, 'success');
    } catch (error) {
      showToast('Impor Gagal', error instanceof Error ? error.message : 'Data tidak dapat disimpan ke server.', 'error');
    }
  };

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.filter((r) => !r.isValid).length;
  const duplicateRowsCount = parsedRows.filter((r) => r.isDuplicate).length;
  const previewRarities = Array.from(new Set(parsedRows.map((row) => row.rarity)));
  const previewCategories = Array.from(new Set(parsedRows.map((row) => row.category)));
  const previewCells = new Map(parsedRows.map((row) => [`${row.category}::${row.rarity}`, row]));

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Database Import (CSV / Excel)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Unggah dan perbarui katalog item ribuan skin game secara massal melalui berkas spreadsheet.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-2xs transition-colors self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-blue-600" />
          Download Template
        </button>
      </div>

      {/* STEP 1: Upload Interface */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="max-w-md">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama game</label>
            <input
              type="text"
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              placeholder="Nama game untuk data harga ini"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
            />
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-slate-900 rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-3 group"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Pilih atau Tarik Berkas Excel/CSV ke Sini
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Format matriks yang didukung: .xlsx, .xls, atau .csv.
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Pilih Berkas
            </button>
          </div>

          {/* Guidelines Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Format matriks harga:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div>
                Masukkan nama game pada form sebelum memilih file.
                <br />
                Kolom pertama: <span className="font-semibold text-slate-800 dark:text-slate-200">Kategori</span>
                <br />
                Kolom berikutnya: nama <span className="font-semibold text-slate-800 dark:text-slate-200">Rarity</span>
              </div>
              <div>
                Setiap nilai pada perpotongan kategori dan rarity menjadi harga currency.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Preview & Validation */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Baris</span>
              <span className="font-mono font-bold text-lg text-slate-900 dark:text-slate-100">
                {parsedRows.length}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/30">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Valid Rows</span>
              <span className="font-mono font-bold text-lg text-emerald-800 dark:text-emerald-200">
                {validRowsCount}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/40 dark:bg-rose-950/30">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Invalid Rows</span>
              <span className="font-mono font-bold text-lg text-rose-800 dark:text-rose-200">
                {invalidRowsCount}
              </span>
            </div>
            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/30">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Duplikat Terdeteksi</span>
              <span className="font-mono font-bold text-lg text-amber-800 dark:text-amber-200">
                {duplicateRowsCount}
              </span>
            </div>
          </div>

          {/* Conflict Resolution Selector */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2">
              Kebijakan Konflik Data Duplikat:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictMode === 'update_existing'}
                  onChange={() => setConflictMode('update_existing')}
                  className="text-blue-600"
                />
                <div>
                  <span className="font-semibold block text-slate-900 dark:text-slate-100">Perbarui Item Yang Ada</span>
                  <span className="text-[10px] text-slate-500">Update harga bila ditemukan</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictMode === 'skip_duplicates'}
                  onChange={() => setConflictMode('skip_duplicates')}
                  className="text-blue-600"
                />
                <div>
                  <span className="font-semibold block text-slate-900 dark:text-slate-100">Lewati Duplikat</span>
                  <span className="text-[10px] text-slate-500">Pertahankan data lama tanpa perubahan</span>
                </div>
              </label>

              <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
                <input
                  type="radio"
                  name="conflict"
                  checked={conflictMode === 'import_new_only'}
                  onChange={() => setConflictMode('import_new_only')}
                  className="text-blue-600"
                />
                <div>
                  <span className="font-semibold block text-slate-900 dark:text-slate-100">Hanya Item Baru</span>
                  <span className="text-[10px] text-slate-500">Abaikan seluruh item yang sudah ada</span>
                </div>
              </label>
            </div>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                Pratinjau Berkas: <span className="font-mono text-blue-600">{fileName}</span>
              </span>
              <span className="text-slate-500">{parsedRows.length} baris diproses</span>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="sticky left-0 z-10 min-w-44 bg-slate-50 py-3 px-4 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Kategori</th>
                    {previewRarities.map((rarity) => (
                      <th key={rarity} className="min-w-32 py-3 px-4 text-right font-bold text-slate-700 dark:text-slate-200">{rarity}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewCategories.map((category) => (
                    <tr key={category} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <th className="sticky left-0 z-[1] bg-white py-3 px-4 font-semibold text-slate-800 dark:bg-slate-900 dark:text-slate-200">{category}</th>
                      {previewRarities.map((rarity) => {
                        const cell = previewCells.get(`${category}::${rarity}`);
                        return (
                          <td key={rarity} className={`py-3 px-4 text-right font-mono font-semibold ${!cell ? 'text-slate-300' : cell.isValid ? 'text-slate-900 dark:text-slate-100' : 'bg-rose-50 text-rose-600 dark:bg-rose-950/20'}`}>
                            {cell ? new Intl.NumberFormat('id-ID').format(cell.estimatedCurrency) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Step 2 Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium"
              >
                Pilih Berkas Lain
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={validRowsCount === 0}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-2"
              >
                <span>Impor {validRowsCount} Item ke Master Database</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Success Screen */}
      {step === 3 && (
        <div className="p-8 border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-center space-y-4 max-w-lg mx-auto shadow-xs">
          <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Impor Database Berhasil!
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Katalog item berhasil diperbarui. Item-item baru ini sekarang langsung dapat dikenali secara instan oleh AI Estimator.
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                setStep(1);
                setParsedRows([]);
              }}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
            >
              Impor Berkas Lain
            </button>
            <button
              onClick={onNavigateToItems}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Buka Katalog Item Database
            </button>
          </div>
        </div>
      )}

      {/* Import History Table */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-500" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
            Riwayat Impor Spreadsheet
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium">
              <tr>
                <th className="py-2.5 px-3">Nama Berkas</th>
                <th className="py-2.5 px-3">Waktu Impor</th>
                <th className="py-2.5 px-3 text-center">Total Baris</th>
                <th className="py-2.5 px-3 text-center">Berhasil</th>
                <th className="py-2.5 px-3 text-center">Gagal</th>
                <th className="py-2.5 px-3">Pengunggah</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {importHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    Belum ada riwayat impor berkas sebelumnya.
                  </td>
                </tr>
              ) : (
                importHistory.map((batch) => (
                  <tr key={batch.id}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {batch.fileName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">
                      {new Date(batch.timestamp).toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">{batch.totalRows}</td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-emerald-600">
                      {batch.successfulRows}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono text-rose-600">
                      {batch.failedRows}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      {batch.userName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
