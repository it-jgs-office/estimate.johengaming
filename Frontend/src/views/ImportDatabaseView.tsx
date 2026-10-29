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
  Link2,
  LoaderCircle,
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
  itemName?: string;
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
  const [importSource, setImportSource] = useState<'file' | 'spreadsheet'>('file');
  const [isImporting, setIsImporting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [gameName, setGameName] = useState('');
  const [currencyName, setCurrencyName] = useState('');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [previewMatrix, setPreviewMatrix] = useState<unknown[][]>([]);
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
    showToast('Template Diunduh', 'Berkas matriks kategori dan item siap dibuka di Excel.', 'success');
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

  const handleConnectSpreadsheet = async () => {
    if (isImporting) return;
    if (!gameName.trim() || !currencyName.trim() || !spreadsheetUrl.trim()) {
      showToast('Data belum lengkap', 'Masukkan nama game, mata uang, dan link Google Spreadsheet publik.', 'warning');
      return;
    }

    try {
      setIsImporting(true);
      setLoadingMessage('Menyinkronkan spreadsheet ke database...');
      const result = await api<{ created: number; updated: number }>('/catalog/spreadsheet-sources', {
        method: 'POST',
        body: JSON.stringify({ gameName: gameName.trim(), currencyName: currencyName.trim(), spreadsheetUrl: spreadsheetUrl.trim() }),
      });
      await repository.hydrate();
      showToast('Spreadsheet Tersambung', `${result.created + result.updated} item disinkronkan. Perubahan akan diperiksa tiap menit.`, 'success');
      setStep(3);
    } catch (error) {
      showToast('Spreadsheet Gagal Tersambung', error instanceof Error ? error.message : 'Link spreadsheet tidak dapat dibaca.', 'error');
    } finally {
      setIsImporting(false);
      setLoadingMessage('');
    }
  };

  const readSpreadsheet = async (file: File) => {
    if (!gameName.trim() || !currencyName.trim()) {
      showToast('Data game belum lengkap', 'Masukkan nama game dan mata uang sebelum mengunggah data harga.', 'warning');
      return;
    }
    setFileName(file.name);
    try {
      const isExcel = /\.(xlsx|xls)$/i.test(file.name);
      const source = isExcel ? await file.arrayBuffer() : await file.text();
      const workbook = XLSX.read(source, { type: isExcel ? 'array' : 'string' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: '' });
      setPreviewMatrix(matrix);
      processMatrix(matrix);
    } catch {
      showToast('Berkas tidak dapat dibaca', 'Gunakan file Excel (.xlsx/.xls) atau CSV dengan format matriks.', 'error');
    }
  };

  const processMatrix = (matrix: unknown[][]) => {
    if (matrix.length < 2 || matrix[0].length < 2) {
      showToast('Berkas Kosong', 'Berkas harus memiliki kolom Kategori dan minimal satu item.', 'error');
      return;
    }
    const games = repository.getGames();
    const categories = repository.getCategories();
    const rarities = repository.getRarities();
    const existingItems = repository.getItems();
    const columnHeaders = matrix[0].slice(1).map((header) => String(header).trim());
    const rows: ParsedImportRow[] = [];

    matrix.slice(1).forEach((line, rowIndex) => {
      const categoryRaw = String(line[0] ?? '').trim();
      columnHeaders.forEach((headerRaw, rarityIndex) => {
        const rawValue = line[rarityIndex + 1];
        if (!categoryRaw || !headerRaw || rawValue === '' || rawValue === null || rawValue === undefined) return;

        const headerCurrency = /^\s*\d[\d.,\s]*(?:VP)?\s*$/i.test(headerRaw)
          ? Number(headerRaw.replace(/[^\d]/g, ''))
          : 0;
        const isVpColumn = headerCurrency > 0;
        const skinEntries = isVpColumn
          ? String(rawValue)
              .split(/\r?\n/)
              .map((entry) => entry.trim())
              .filter(Boolean)
              .map((entry) => {
                const explicitPrice = entry.match(/^(.*?)\s*=\s*(\d+)\s*$/);
                return {
                  name: (explicitPrice?.[1] ?? entry).trim(),
                  currency: Number(explicitPrice?.[2] ?? headerCurrency),
                };
              })
          : [{ name: headerRaw, currency: Number(String(rawValue).replace(/[^\d]/g, '')) }];

        skinEntries.forEach(({ name, currency }) => {
          if (!name) return;
          const errors = isNaN(currency) || currency <= 0 ? ['Nilai currency harus angka > 0'] : [];
          const matchedGame = games.find((game) => game.name.toLowerCase() === gameName.trim().toLowerCase());
          const matchedCategory = matchedGame ? categories.find((category) => category.gameId === matchedGame.id && category.name.toLowerCase() === categoryRaw.toLowerCase()) : undefined;
          const matchedRarity = matchedGame ? rarities.find((rarity) => rarity.gameId === matchedGame.id && rarity.name.toLowerCase() === name.toLowerCase()) : undefined;
          const isDuplicate = Boolean(matchedGame && matchedCategory && matchedRarity && existingItems.some((item) => item.gameId === matchedGame.id && item.categoryId === matchedCategory.id && item.rarityId === matchedRarity.id));
          rows.push({ rowNumber: rowIndex + 2, game: gameName.trim(), category: categoryRaw, rarity: name, itemName: isVpColumn ? `${categoryRaw} ${name}` : undefined, estimatedCurrency: currency, isValid: errors.length === 0, errors, isDuplicate, gameIdResolved: matchedGame?.id, categoryIdResolved: matchedCategory?.id, rarityIdResolved: matchedRarity?.id });
        });
      });
    });

    if (rows.length === 0) {
      showToast('Data tidak ditemukan', 'Isi nilai currency pada minimal satu kolom item.', 'warning');
      return;
    }

    setParsedRows(rows);
    setStep(2);
    showToast('Berkas Berhasil Dibaca', `${rows.length} harga kategori–item berhasil dimuat untuk pratinjau.`, 'info');
  };

  // Execute Import
  const handleConfirmImport = async () => {
    if (isImporting) return;
    const validRows = parsedRows.filter((row) => row.isValid);
    const failedCount = parsedRows.length - validRows.length;
    if (validRows.length === 0) return;

    try {
      setIsImporting(true);
      setLoadingMessage('Menyimpan item ke database...');
      const result = await api<{ created: number; updated: number; skipped: number }>('/catalog/import', {
        method: 'POST',
        body: JSON.stringify({
          mode: conflictMode,
          currencyName: currencyName.trim(),
          rows: validRows.map(({ game, category, rarity, itemName, estimatedCurrency }) => ({ game, category, rarity, itemName, estimatedCurrency })),
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
    } finally {
      setIsImporting(false);
      setLoadingMessage('');
    }
  };

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.filter((r) => !r.isValid).length;
  const duplicateRowsCount = parsedRows.filter((r) => r.isDuplicate).length;
  const canUpload = Boolean(gameName.trim() && currencyName.trim());
  const previewHeaders = previewMatrix[0] ?? [];
  const previewRows = previewMatrix.slice(1);

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {isImporting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/25 p-4 backdrop-blur-[1px]" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-2xl border border-blue-100 bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <LoaderCircle className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-sm font-bold text-slate-900">Memproses impor</p>
            <p className="mt-1 text-xs text-slate-500">{loadingMessage}</p>
            <p className="mt-4 text-[11px] text-slate-400">Jangan tutup halaman sampai proses selesai.</p>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            Database Import
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
          <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama game</label>
              <input
                type="text"
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
                placeholder="Nama game untuk data harga ini"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mata uang game</label>
              <input
                type="text"
                value={currencyName}
                onChange={(event) => setCurrencyName(event.target.value)}
                placeholder="Contoh: VP, Diamond, CV"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
            </div>
          </div>
          <div className="max-w-2xl">
            <span className="mb-1.5 block text-xs font-semibold text-slate-700">Sumber impor</span>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1.5">
              <button
                type="button"
                onClick={() => setImportSource('file')}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${importSource === 'file' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <FileSpreadsheet className="h-4 w-4" />
                File Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => setImportSource('spreadsheet')}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-colors ${importSource === 'spreadsheet' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Link2 className="h-4 w-4" />
                Link Spreadsheet
              </button>
            </div>
          </div>
          {importSource === 'spreadsheet' && (
          <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-2xs">
            <label className="mb-1.5 block font-semibold text-slate-700">Link Google Spreadsheet publik</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={spreadsheetUrl}
                onChange={(event) => setSpreadsheetUrl(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15"
              />
              <button
                type="button"
                onClick={() => void handleConnectSpreadsheet()}
                disabled={isImporting || !canUpload || !spreadsheetUrl.trim()}
                className="rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-300 disabled:text-slate-500"
              >
                Hubungkan Spreadsheet
              </button>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Bagikan sebagai “Siapa saja yang memiliki link dapat melihat”. Katalog disinkronkan ulang setiap menit.</p>
          </div>
          )}
          {importSource === 'file' && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => canUpload && fileInputRef.current?.click()}
            className={`p-10 border-2 border-dashed rounded-2xl text-center transition-all flex flex-col items-center justify-center space-y-3 group ${canUpload ? 'border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-slate-900 cursor-pointer' : 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-70 dark:border-slate-800 dark:bg-slate-900/60'}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.xlsx,.xls"
              disabled={!canUpload}
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
              disabled={!canUpload}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Pilih Berkas
            </button>
          </div>
          )}

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
                Kolom berikutnya: nama <span className="font-semibold text-slate-800 dark:text-slate-200">Item</span>
              </div>
              <div>
                Setiap nilai pada perpotongan kategori dan item menjadi harga currency.
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
              <span className="text-slate-500">{parsedRows.length} item diproses</span>
            </div>

            <div className="overflow-auto max-h-96">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    {previewHeaders.map((header, index) => (
                      <th
                        key={`header-${index}`}
                        className={`min-w-32 py-3 px-4 font-bold text-slate-700 dark:text-slate-200 ${index === 0 ? 'sticky left-0 z-10 min-w-44 bg-slate-50 dark:bg-slate-800' : 'text-center'}`}
                      >
                        {String(header ?? '')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {previewRows.map((row, rowIndex) => (
                    <tr key={`row-${rowIndex}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      {previewHeaders.map((_, columnIndex) => (
                        <td
                          key={`cell-${rowIndex}-${columnIndex}`}
                          className={`whitespace-pre-line px-4 py-3 align-top text-slate-700 dark:text-slate-300 ${columnIndex === 0 ? 'sticky left-0 z-[1] bg-white font-semibold dark:bg-slate-900 dark:text-slate-200' : ''}`}
                        >
                          {String(row[columnIndex] ?? '')}
                        </td>
                      ))}
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
                disabled={isImporting || validRowsCount === 0}
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
