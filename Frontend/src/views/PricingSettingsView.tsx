/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  HelpCircle,
  TrendingUp,
  Percent,
  Coins,
  ShieldAlert,
} from 'lucide-react';
import { Game, PricingSetting, RoundingMode, User } from '../types';
import { repository } from '../services/repository';
import {
  applyRounding,
  calculateAccountValuation,
  formatGameCurrency,
  formatIDR,
  formatNumberID,
} from '../services/pricingCalculationService';
import { useToast } from '../context/ToastContext';

interface PricingSettingsViewProps {
  currentUser: User;
}

export const PricingSettingsView: React.FC<PricingSettingsViewProps> = ({ currentUser }) => {
  const { showToast } = useToast();
  const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';

  const games = repository.getGames();
  const [selectedGameId, setSelectedGameId] = useState(games[0]?.id || 'GAME-FF');
  const activeGame = repository.getGameById(selectedGameId) || games[0];

  // Original saved configuration
  const [savedSetting, setSavedSetting] = useState<PricingSetting | undefined>(() =>
    repository.getPricingSettingByGame(selectedGameId)
  );

  // Form Fields
  const [currencyRate, setCurrencyRate] = useState('0');
  const [lowPct, setLowPct] = useState('0');
  const [medPct, setMedPct] = useState('0');
  const [highPct, setHighPct] = useState('0');
  const [roundingMode, setRoundingMode] = useState<RoundingMode>('none');
  const [defaultTier, setDefaultTier] = useState<'low' | 'medium' | 'high'>('medium');

  // Live Test Amount
  const [testAmount, setTestAmount] = useState('0');
  const [error, setError] = useState('');

  // Load configuration on game switch
  useEffect(() => {
    if (!activeGame) return;
    const setting = repository.getPricingSettingByGame(selectedGameId);
    setSavedSetting(setting);
    if (setting) {
      setCurrencyRate(String(setting.currencyRate));
      setLowPct(String(setting.lowPercentage));
      setMedPct(String(setting.mediumPercentage));
      setHighPct(String(setting.highPercentage));
      setRoundingMode(setting.roundingMode);
      setDefaultTier(setting.defaultTier);
    } else {
      setCurrencyRate(String(activeGame.defaultConversionRate));
      setLowPct(String(activeGame.lowPercentage));
      setMedPct(String(activeGame.mediumPercentage));
      setHighPct(String(activeGame.highPercentage));
      setRoundingMode('none');
      setDefaultTier('medium');
    }
    setError('');
  }, [selectedGameId]);

  // Live Simulation Calculation
  const testNumber = parseInt(testAmount.replace(/\D/g, '') || '0', 10);
  const liveRate = parseFloat(currencyRate) || 0;
  const liveLow = parseFloat(lowPct) || 0;
  const liveMed = parseFloat(medPct) || 0;
  const liveHigh = parseFloat(highPct) || 0;

  const liveBaseValue = Math.round(testNumber * liveRate);
  const rawSimLow = (liveBaseValue * liveLow) / 100;
  const rawSimMed = (liveBaseValue * liveMed) / 100;
  const rawSimHigh = (liveBaseValue * liveHigh) / 100;

  const simLowPrice = applyRounding(rawSimLow, roundingMode);
  const simMedPrice = applyRounding(rawSimMed, roundingMode);
  const simHighPrice = applyRounding(rawSimHigh, roundingMode);

  if (!activeGame) {
    return <div className="flex-1 grid place-items-center p-8 text-sm text-slate-500">Impor katalog Excel terlebih dahulu.</div>;
  }

  // Save Settings
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      showToast('Akses Ditolak', 'Hanya Super Admin yang berwenang mengubah konfigurasi harga', 'warning');
      return;
    }

    if (liveRate <= 0) {
      setError('Rate konversi harus lebih besar dari 0');
      return;
    }

    if (liveLow <= 0 || liveHigh > 100) {
      setError('Persentase harus berada di antara 0% dan 100%');
      return;
    }

    if (liveLow > liveMed || liveMed > liveHigh) {
      setError('Urutan persentase tidak valid: Low ≤ Medium ≤ High');
      return;
    }

    const newSetting: PricingSetting = {
      id: savedSetting?.id || `PRICE-${activeGame.slug.toUpperCase()}`,
      gameId: activeGame.id,
      currencyRate: liveRate,
      lowPercentage: liveLow,
      mediumPercentage: liveMed,
      highPercentage: liveHigh,
      roundingMode,
      defaultTier,
      updatedAt: new Date().toISOString(),
    };

    repository.savePricingSetting(newSetting);
    setSavedSetting(newSetting);
    setError('');
    showToast('Pengaturan Disimpan', `Konfigurasi harga untuk ${activeGame.name} berhasil diperbarui.`, 'success');
  };

  // Reset to Defaults
  const handleReset = () => {
    if (!isSuperAdmin) return;
    const def = repository.resetPricingSettingToDefault(selectedGameId);
    if (def) {
      setSavedSetting(def);
      setCurrencyRate(String(def.currencyRate));
      setLowPct(String(def.lowPercentage));
      setMedPct(String(def.mediumPercentage));
      setHighPct(String(def.highPercentage));
      setRoundingMode(def.roundingMode);
      setDefaultTier(def.defaultTier);
      showToast('Pengaturan Direset', `Konfigurasi ${activeGame.name} kembali ke nilai default pabrik.`, 'info');
    }
  };

  // Cancel unsaved changes
  const handleCancel = () => {
    if (savedSetting) {
      setCurrencyRate(String(savedSetting.currencyRate));
      setLowPct(String(savedSetting.lowPercentage));
      setMedPct(String(savedSetting.mediumPercentage));
      setHighPct(String(savedSetting.highPercentage));
      setRoundingMode(savedSetting.roundingMode);
      setDefaultTier(savedSetting.defaultTier);
      setError('');
    }
  };

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Sliders className="w-6 h-6 text-blue-600" />
            Pricing Settings
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pengaturan independen nilai tukar mata uang game dan persentase tier harga (Low / Medium / High).
          </p>
        </div>

        {/* Game Selector */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs font-semibold text-slate-500">Pilih Game:</span>
          <select
            value={selectedGameId}
            onChange={(e) => setSelectedGameId(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-semibold"
          >
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.currencySymbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Role Notice for Staff */}
      {!isSuperAdmin && (
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Mode Staff: Anda hanya dapat melihat konfigurasi harga aktif. Perubahan rate dan tier persentase hanya dapat dilakukan oleh Super Admin.
          </span>
        </div>
      )}

      {/* Main Grid: Form Left, Live Simulation Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* FORM CONFIGURATION (7 Cols) */}
        <div className="lg:col-span-7 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Konfigurasi Valuasi — {activeGame.name}
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">
              Terakhir diubah:{' '}
              {savedSetting?.updatedAt ? new Date(savedSetting.updatedAt).toLocaleDateString('id-ID') : 'Default'}
            </span>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Conversion Rate */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 flex items-center justify-between">
                <span>Nilai Tukar Default (Conversion Rate) *</span>
                <span className="text-[10px] font-normal text-slate-400">
                  Rp per 1 {activeGame.currencyName}
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 font-mono text-slate-400 font-medium">
                  Rp
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  disabled={!isSuperAdmin}
                  value={currencyRate}
                  onChange={(e) => setCurrencyRate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm disabled:opacity-60"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Nilai dasar dihitung dari total currency × rate.
              </p>
            </div>

            {/* Percentage Tiers */}
            <div className="space-y-2">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold">
                Preset Persentase Harga Jual (Low / Medium / High) *
              </label>
              <div className="grid grid-cols-3 gap-3">
                {/* LOW */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      Low %
                    </span>
                    <Percent className="w-3 h-3 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    required
                    disabled={!isSuperAdmin}
                    value={lowPct}
                    onChange={(e) => setLowPct(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-center font-bold text-sm disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block text-center">
                    Perputaran cepat
                  </span>
                </div>

                {/* MEDIUM */}
                <div className="p-3 rounded-xl border-2 border-blue-500/80 bg-blue-50/30 dark:bg-blue-950/20">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
                      Medium %
                    </span>
                    <Percent className="w-3 h-3 text-blue-500" />
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    required
                    disabled={!isSuperAdmin}
                    value={medPct}
                    onChange={(e) => setMedPct(e.target.value)}
                    className="w-full px-2 py-1.5 border border-blue-300 dark:border-blue-700 rounded-md bg-white dark:bg-slate-800 text-blue-900 dark:text-blue-100 font-mono text-center font-bold text-sm disabled:opacity-60"
                  />
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 block text-center font-medium">
                    Standar disarankan
                  </span>
                </div>

                {/* HIGH */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      High %
                    </span>
                    <Percent className="w-3 h-3 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    required
                    disabled={!isSuperAdmin}
                    value={highPct}
                    onChange={(e) => setHighPct(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-center font-bold text-sm disabled:opacity-60"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block text-center">
                    Target kolektor
                  </span>
                </div>
              </div>
            </div>

            {/* Rounding Mode */}
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                Metode Pembulatan Harga Rupiah
              </label>
              <select
                disabled={!isSuperAdmin}
                value={roundingMode}
                onChange={(e) => setRoundingMode(e.target.value as RoundingMode)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs disabled:opacity-60"
              >
                <option value="none">Tanpa Pembulatan (Nominal Asli Rumus Matematika)</option>
                <option value="nearest_1000">Bulatkan ke Rp1.000 Terdekat (Math.round)</option>
                <option value="up_1000">Bulatkan ke Atas Rp1.000 (Math.ceil)</option>
                <option value="up_5000">Bulatkan ke Atas Rp5.000</option>
                <option value="up_10000">Bulatkan ke Atas Rp10.000</option>
              </select>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[11px] text-slate-500">
              * Perubahan konfigurasi ini berlaku otomatis untuk seluruh kalkulasi estimasi baru. Riwayat estimasi yang telah disimpan sebelumnya tetap menggunakan snapshot harga historis masing-masing.
            </div>

            {/* Buttons */}
            {isSuperAdmin && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset ke Default Pabrik
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-3 py-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-medium transition-colors"
                  >
                    Batalkan Perubahan
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-xs transition-colors flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    Simpan Pengaturan
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* LIVE SIMULATION PREVIEW (5 Cols) */}
        <div className="lg:col-span-5 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Live Calculation Preview
              </h3>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                Real-Time
              </span>
            </div>

            {/* Test Amount Input */}
            <div className="mb-4">
              <label className="block text-slate-500 text-[11px] font-medium mb-1">
                Uji Coba dengan Jumlah {activeGame.currencyName}:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-mono text-sm"
                />
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">
                  {activeGame.currencySymbol}
                </span>
              </div>
            </div>

            {/* Formula Breakdown */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2 mb-4">
              <div className="flex justify-between text-slate-500">
                <span>Nilai Dasar (Base Value):</span>
                <span className="font-mono text-slate-900 dark:text-slate-100">
                  {formatNumberID(testNumber)} × Rp{liveRate}
                </span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1 border-t border-slate-200/60 dark:border-slate-700">
                <span>Base Account Value:</span>
                <span className="font-mono text-sm">{formatIDR(liveBaseValue)}</span>
              </div>
            </div>

            {/* 3 Result Cards */}
            <div className="space-y-2.5 text-xs">
              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-500 block text-[11px]">LOW PRICE</span>
                  <span className="text-[10px] text-slate-400 font-mono">{liveLow}% of base</span>
                </div>
                <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatIDR(simLowPrice)}
                </span>
              </div>

              <div className="p-3 rounded-xl border-2 border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-700 dark:text-blue-300 block text-[11px]">
                    MEDIUM PRICE [Disarankan]
                  </span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                    {liveMed}% of base
                  </span>
                </div>
                <span className="text-lg font-extrabold font-mono text-blue-900 dark:text-blue-100">
                  {formatIDR(simMedPrice)}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-500 block text-[11px]">HIGH PRICE</span>
                  <span className="text-[10px] text-slate-400 font-mono">{liveHigh}% of base</span>
                </div>
                <span className="text-base font-bold font-mono text-slate-800 dark:text-slate-200">
                  {formatIDR(simHighPrice)}
                </span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 text-[10px] text-slate-400 leading-relaxed">
            Perhitungan live di atas langsung bereaksi terhadap setiap perubahan angka pada formulir di sebelah kiri tanpa menunggu tombol simpan.
          </div>
        </div>
      </div>
    </div>
  );
};
