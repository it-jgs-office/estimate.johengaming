/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
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
import { GameItem, ImportBatch, ItemType, User } from '../types';
import { repository } from '../services/repository';
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
  itemName: string;
  type: string;
  estimatedCurrency: number;
  aliases: string[];
  description: string;
  status: 'active' | 'inactive';
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
  const [rawText, setRawText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedImportRow[]>([]);
  const [conflictMode, setConflictMode] = useState<
    'skip_duplicates' | 'update_existing' | 'import_new_only'
  >('update_existing');

  const [importHistory, setImportHistory] = useState<ImportBatch[]>(() =>
    repository.getImportBatches()
  );

  // Download Template CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      'game,category,rarity,item_name,type,estimated_currency,aliases,description,status\n' +
      'Free Fire,Melee,Special,Standard,standard,5000,"mele spesial, spec melee","Standard melee special skin",active\n' +
      'Free Fire,Melee,Heroic,Standard,standard,8000,"mele heroik, hero melee","Standard melee heroic skin",active\n' +
      'Free Fire,Melee,Legendary,Standard,standard,11000,"mele legend, golden melee","Standard melee legendary skin",active\n' +
      'Free Fire,Shotgun,Special,Standard,standard,3000,"sg spesial, shotgun spec","Standard shotgun special skin",active\n' +
      'Free Fire,Shotgun,Heroic,Standard,standard,7000,"sg heroik, shotgun hero","Standard shotgun heroic skin",active\n' +
      'Free Fire,Rifle,Special,Standard,standard,4000,"ar spesial, rifle spec","Standard rifle special skin",active\n' +
      'Free Fire,Rifle,Legendary,Standard,standard,9000,"ar legend, rifle golden","Standard rifle legendary skin",active\n' +
      'Free Fire,Melee,Heroic,Crimson Blade,specific,9500,"pedang crimson, katana crimson, crimson blade","High tier signature crimson blade katana",active\n' +
      'Free Fire,Shotgun,Special,Nightfall Shotgun,specific,6200,"nightfall shotgun, sg nightfall","Exclusive nightfall shotgun skin",active\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'johen_item_database_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Template Diunduh', 'Berkas CSV template siap dibuka dan diedit di Excel.', 'success');
  };

  // Handle File Input
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        processCSV(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  // Drag and Drop
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        processCSV(content, file.name);
      }
    };
    reader.readAsText(file);
  };

  // Parse CSV
  const processCSV = (csv: string, name: string) => {
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      showToast('Berkas Kosong', 'Berkas CSV tidak memuat data yang valid.', 'error');
      return;
    }

    const games = repository.getGames();
    const categories = repository.getCategories();
    const rarities = repository.getRarities();
    const existingItems = repository.getItems();

    // Parse header
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
    const rows: ParsedImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      // Split with quotes regex
      const rowTokens = parseCSVLine(lines[i]);
      if (rowTokens.length < 5) continue;

      const gameRaw = rowTokens[0]?.trim() || '';
      const categoryRaw = rowTokens[1]?.trim() || '';
      const rarityRaw = rowTokens[2]?.trim() || '';
      const itemNameRaw = rowTokens[3]?.trim() || '';
      const typeRaw = (rowTokens[4]?.trim().toLowerCase() === 'specific' ? 'specific' : 'standard') as ItemType;
      const currencyRaw = parseInt(rowTokens[5]?.replace(/\D/g, '') || '0', 10);
      const aliasesRaw = (rowTokens[6] || '')
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      const descriptionRaw = rowTokens[7]?.trim() || '';
      const statusRaw = rowTokens[8]?.trim().toLowerCase() === 'inactive' ? 'inactive' : 'active';

      const errors: string[] = [];

      // Game resolution
      const matchedGame = games.find(
        (g) => g.name.toLowerCase() === gameRaw.toLowerCase() || g.slug === gameRaw.toLowerCase()
      );
      if (!matchedGame) {
        errors.push(`Game "${gameRaw}" tidak ditemukan`);
      }

      // Category resolution
      let matchedCategory = undefined;
      if (matchedGame) {
        matchedCategory = categories.find(
          (c) =>
            c.gameId === matchedGame.id &&
            (c.name.toLowerCase() === categoryRaw.toLowerCase() ||
              c.aliases.includes(categoryRaw.toLowerCase()))
        );
        if (!matchedCategory) {
          errors.push(`Kategori "${categoryRaw}" belum terdaftar pada ${matchedGame.name}`);
        }
      }

      // Rarity resolution
      let matchedRarity = undefined;
      if (matchedGame) {
        matchedRarity = rarities.find(
          (r) =>
            r.gameId === matchedGame.id &&
            (r.name.toLowerCase() === rarityRaw.toLowerCase() ||
              r.aliases.includes(rarityRaw.toLowerCase()))
        );
        if (!matchedRarity) {
          errors.push(`Rarity "${rarityRaw}" belum terdaftar pada ${matchedGame.name}`);
        }
      }

      // Currency check
      if (isNaN(currencyRaw) || currencyRaw <= 0) {
        errors.push('Nilai currency harus angka > 0');
      }

      // Duplicate check
      let isDuplicate = false;
      if (matchedGame && matchedCategory && matchedRarity) {
        if (typeRaw === 'standard') {
          isDuplicate = existingItems.some(
            (item) =>
              item.gameId === matchedGame.id &&
              item.categoryId === matchedCategory!.id &&
              item.rarityId === matchedRarity!.id &&
              item.type === 'standard'
          );
        } else {
          isDuplicate = existingItems.some(
            (item) =>
              item.gameId === matchedGame.id &&
              item.name.toLowerCase() === itemNameRaw.toLowerCase()
          );
        }
      }

      rows.push({
        rowNumber: i + 1,
        game: gameRaw,
        category: categoryRaw,
        rarity: rarityRaw,
        itemName: itemNameRaw || 'Standard',
        type: typeRaw,
        estimatedCurrency: currencyRaw,
        aliases: aliasesRaw,
        description: descriptionRaw,
        status: statusRaw,
        isValid: errors.length === 0,
        errors,
        isDuplicate,
        gameIdResolved: matchedGame?.id,
        categoryIdResolved: matchedCategory?.id,
        rarityIdResolved: matchedRarity?.id,
      });
    }

    setParsedRows(rows);
    setStep(2);
    showToast('Berkas Berhasil Dibaca', `${rows.length} baris data berhasil dimuat untuk pratinjau.`, 'info');
  };

  // Helper CSV Line Parser respecting quotes
  function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let insideQuote = false;
    let entry = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        insideQuote = !insideQuote;
      } else if (c === ',' && !insideQuote) {
        result.push(entry.trim());
        entry = '';
      } else {
        entry += c;
      }
    }
    result.push(entry.trim());
    return result;
  }

  // Execute Import
  const handleConfirmImport = () => {
    let successfulCount = 0;
    let failedCount = 0;

    const itemsToSave: GameItem[] = [];
    const existing = repository.getItems();

    for (const row of parsedRows) {
      if (!row.isValid || !row.gameIdResolved || !row.categoryIdResolved || !row.rarityIdResolved) {
        failedCount++;
        continue;
      }

      if (row.isDuplicate && conflictMode === 'skip_duplicates') {
        continue;
      }

      if (row.isDuplicate && conflictMode === 'import_new_only') {
        continue;
      }

      // Check if existing item to update
      let existingItem: GameItem | undefined;
      if (row.type === 'standard') {
        existingItem = existing.find(
          (i) =>
            i.gameId === row.gameIdResolved &&
            i.categoryId === row.categoryIdResolved &&
            i.rarityId === row.rarityIdResolved &&
            i.type === 'standard'
        );
      } else {
        existingItem = existing.find(
          (i) =>
            i.gameId === row.gameIdResolved &&
            i.name.toLowerCase() === row.itemName.toLowerCase()
        );
      }

      const id = existingItem ? existingItem.id : `ITEM-${row.gameIdResolved}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      const newItem: GameItem = {
        id,
        gameId: row.gameIdResolved,
        categoryId: row.categoryIdResolved,
        rarityId: row.rarityIdResolved,
        name: row.itemName,
        type: row.type as ItemType,
        estimatedCurrency: row.estimatedCurrency,
        aliases: row.aliases,
        description: row.description || undefined,
        status: row.status,
        createdAt: existingItem ? existingItem.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      itemsToSave.push(newItem);
      successfulCount++;
    }

    repository.saveItemsBatch(itemsToSave);

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
  };

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.filter((r) => !r.isValid).length;
  const duplicateRowsCount = parsedRows.filter((r) => r.isDuplicate).length;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
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
          Download Template CSV
        </button>
      </div>

      {/* STEP 1: Upload Interface */}
      {step === 1 && (
        <div className="space-y-6">
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
              accept=".csv"
              className="hidden"
            />
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform">
              <Upload className="w-7 h-7" />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
                Pilih atau Tarik Berkas CSV ke Sini
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Format berkas yang didukung: .csv (Comma-Separated Values). Gunakan template resmi kami.
              </p>
            </div>
            <button
              type="button"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
            >
              Browse File CSV
            </button>
          </div>

          {/* Guidelines Card */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-600" />
              Petunjuk Kolom Berkas CSV:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">game:</span> Nama game (misal Free Fire / PUBG Mobile)
                <br />
                <span className="font-semibold text-slate-800 dark:text-slate-200">category:</span> Kategori senjata / item (misal Melee, Shotgun)
                <br />
                <span className="font-semibold text-slate-800 dark:text-slate-200">rarity:</span> Tingkat kelangkaan (Special, Heroic, Legendary)
              </div>
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-200">item_name:</span> Nama skin spesifik (atau "Standard")
                <br />
                <span className="font-semibold text-slate-800 dark:text-slate-200">type:</span> "standard" atau "specific"
                <br />
                <span className="font-semibold text-slate-800 dark:text-slate-200">estimated_currency:</span> Nilai nominal biaya Diamond/UC
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
                  <span className="text-[10px] text-slate-500">Update harga & alias bila ditemukan</span>
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
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium sticky top-0 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 w-12">Baris</th>
                    <th className="py-2.5 px-3">Status Validasi</th>
                    <th className="py-2.5 px-3">Game</th>
                    <th className="py-2.5 px-3">Kategori</th>
                    <th className="py-2.5 px-3">Rarity</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Tipe</th>
                    <th className="py-2.5 px-3 text-right">Biaya Currency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedRows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={`hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${
                        !row.isValid ? 'bg-rose-50/30 dark:bg-rose-950/20' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono text-slate-400">{row.rowNumber}</td>
                      <td className="py-2 px-3">
                        {row.isValid ? (
                          <div className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Valid</span>
                            {row.isDuplicate && (
                              <span className="text-amber-600 text-[10px] font-normal">· Duplikat</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-rose-600 text-[10px]">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{row.errors.join(', ')}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{row.game}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{row.category}</td>
                      <td className="py-2 px-3 text-slate-600 dark:text-slate-400">{row.rarity}</td>
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {row.itemName}
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          {row.type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                        {row.estimatedCurrency}
                      </td>
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
