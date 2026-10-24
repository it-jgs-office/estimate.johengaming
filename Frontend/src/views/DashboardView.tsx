/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Gamepad2,
  Database,
  History,
  Calendar,
  Sparkles,
  Plus,
  FileSpreadsheet,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import { Estimation, Game, User } from '../types';
import { repository } from '../services/repository';
import { formatGameCurrency, formatIDR, formatNumberID } from '../services/pricingCalculationService';
import { NavView } from '../components/Sidebar';

interface DashboardViewProps {
  currentUser: User;
  onNavigate: (view: NavView) => void;
  onOpenEstimationDetail: (est: Estimation) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentUser,
  onNavigate,
  onOpenEstimationDetail,
}) => {
  const games = repository.getGames();
  const items = repository.getItems();
  const estimations = repository.getEstimations();
  const categories = repository.getCategories();

  // Time-based calculations
  const now = new Date();
  const thisMonthCount = estimations.filter((e) => {
    const d = new Date(e.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Chart range: 7 days
  const [chartRange, setChartRange] = useState<'7d' | '30d'>('7d');
  const daysToShow = chartRange === '7d' ? 7 : 30;

  const chartData = Array.from({ length: daysToShow }).map((_, i) => {
    const targetDate = new Date();
    targetDate.setDate(now.getDate() - (daysToShow - 1 - i));
    const dateStr = targetDate.toISOString().split('T')[0];
    const count = estimations.filter((e) => e.createdAt.startsWith(dateStr)).length;
    return {
      day: targetDate.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
      count,
    };
  });

  const maxCount = Math.max(1, ...chartData.map((d) => d.count));

  // Completeness indicator
  const itemsWithCurrency = items.filter((i) => i.estimatedCurrency > 0).length;
  const completenessPct = items.length > 0 ? Math.round((itemsWithCurrency / items.length) * 100) : 100;

  return (
    <div className="app-page flex-1 overflow-y-auto p-4 md:p-7 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/90">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Pusat kontrol
          </div>
          <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">
            Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monitor database game, aktivitas estimasi, dan pengaturan harga akun.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-slate-400 block uppercase tracking-wider">Pengguna Aktif</span>
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{currentUser.name}</span>
          </div>
          <button
            onClick={() => onNavigate('estimator')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Estimasi Baru
          </button>
        </div>
      </div>

      {/* 4 Main Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Games */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Games</span>
            <Gamepad2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {games.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {games.filter((g) => g.status === 'active').length} katalog aktif
          </span>
        </div>

        {/* Total Database Items */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Database Items</span>
            <Database className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {items.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {items.filter((i) => i.estimatedCurrency > 0).length} item memiliki harga aktif
          </span>
        </div>

        {/* Total Estimations */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Total Estimations</span>
            <History className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {estimations.length}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Semua riwayat tersimpan permanen
          </span>
        </div>

        {/* Estimations This Month */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium">Estimations This Month</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {thisMonthCount}
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            Bulan {now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* Middle Grid: Activity Chart & Quick Actions / Completeness */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Estimation Activity Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-blue-600" />
                  Aktivitas Estimasi Akun
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Volume valuasi akun yang diproses tim Johen Gaming
                </p>
              </div>

              {/* Range Toggle */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs">
                <button
                  onClick={() => setChartRange('7d')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartRange === '7d'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  onClick={() => setChartRange('30d')}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    chartRange === '30d'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  30 Hari
                </button>
              </div>
            </div>

            {/* Custom Responsive SVG Chart */}
            <div className="h-44 w-full flex items-end gap-2 pt-6 pb-2 border-b border-slate-100 dark:border-slate-800">
              {chartData.map((bar, idx) => {
                const heightPct = Math.max(12, Math.round((bar.count / maxCount) * 100));
                return (
                  <div
                    key={idx}
                    className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative"
                  >
                    {/* Tooltip */}
                    <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-10 font-mono">
                      {bar.count} estimasi
                    </div>

                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full max-w-[28px] rounded-t-md transition-all duration-300 ${
                        bar.count > 0
                          ? 'bg-blue-600 hover:bg-blue-500'
                          : 'bg-slate-100 dark:bg-slate-800'
                      }`}
                    />
                    <span className="text-[10px] text-slate-400 truncate w-full text-center">
                      {bar.day}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
            <span>Data riil diperbarui otomatis setiap kalkulasi disimpan</span>
            <button
              onClick={() => onNavigate('history')}
              className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
            >
              Lihat Histori Lengkap <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Actions & Database Completeness */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3">
              Aksi Cepat
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => onNavigate('estimator')}
                className="p-3 rounded-xl border border-blue-200/80 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/30 hover:bg-blue-100/60 text-blue-700 dark:text-blue-300 font-semibold flex flex-col items-center text-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-5 h-5 text-blue-600" />
                <span>New Estimation</span>
              </button>

              <button
                onClick={() => onNavigate('games')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex flex-col items-center text-center gap-1.5 transition-colors"
              >
                <Gamepad2 className="w-5 h-5 text-indigo-500" />
                <span>Kelola Games</span>
              </button>

              <button
                onClick={() => onNavigate('items')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex flex-col items-center text-center gap-1.5 transition-colors"
              >
                <Plus className="w-5 h-5 text-emerald-500" />
                <span>Tambah Item</span>
              </button>

              <button
                onClick={() => onNavigate('import')}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold flex flex-col items-center text-center gap-1.5 transition-colors"
              >
                <FileSpreadsheet className="w-5 h-5 text-amber-500" />
                <span>Import CSV</span>
              </button>
            </div>
          </div>

          {/* Database Completeness */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs text-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Kelengkapan Database Item
              </span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {completenessPct}%
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden mb-2">
              <div
                style={{ width: `${completenessPct}%` }}
                className="h-full bg-emerald-500 rounded-full transition-all"
              />
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              {itemsWithCurrency} dari {items.length} item telah memiliki nilai currency baku untuk kalkulasi otomatis.
            </p>
          </div>
        </div>
      </div>

      {/* Game Catalog Overview */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Katalog Game & Rate Konversi
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Setiap game memiliki currency dan pengaturan persentase harga independen
            </p>
          </div>
          <button
            onClick={() => onNavigate('games')}
            className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
          >
            Lihat Semua Game <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {games.map((g) => {
            const gameCats = categories.filter((c) => c.gameId === g.id && c.status === 'active');
            const gameItems = items.filter((i) => i.gameId === g.id);
            const pricing = repository.getPricingSettingByGame(g.id);

            return (
              <div
                key={g.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700 transition-all bg-slate-50/50 dark:bg-slate-800/40"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                      {g.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{g.name}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {g.currencyName} ({g.currencySymbol})
                      </span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      g.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {g.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-2 border-y border-slate-200/60 dark:border-slate-700/60 mb-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Kategori</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{gameCats.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Item DB</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{gameItems.length}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Rate Konversi</span>
                    <span className="font-semibold font-mono text-blue-600 dark:text-blue-400">
                      Rp{pricing?.currencyRate ?? g.defaultConversionRate}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Preset:{' '}
                    <span className="font-mono">
                      {pricing?.lowPercentage || g.lowPercentage}% / {pricing?.mediumPercentage || g.mediumPercentage}% / {pricing?.highPercentage || g.highPercentage}%
                    </span>
                  </span>
                  <button
                    onClick={() => onNavigate('estimator')}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Estimasi →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Estimations Table */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Riwayat Estimasi Terbaru
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Valuasi akun terakhir yang disimpan oleh tim valuasi
            </p>
          </div>
          <button
            onClick={() => onNavigate('history')}
            className="text-xs text-blue-600 hover:underline font-semibold flex items-center gap-1"
          >
            Lihat Semua ({estimations.length}) <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 font-medium border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">ID & Judul</th>
                <th className="py-2.5 px-3">Game</th>
                <th className="py-2.5 px-3 text-right">Total Currency</th>
                <th className="py-2.5 px-3 text-right">Medium Price</th>
                <th className="py-2.5 px-3">Dibuat Oleh</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {estimations.slice(0, 5).map((est) => {
                const game = repository.getGameById(est.gameId);
                return (
                  <tr
                    key={est.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 cursor-pointer"
                    onClick={() => onOpenEstimationDetail(est)}
                  >
                    <td className="py-3 px-3">
                      <span className="font-mono text-blue-600 dark:text-blue-400 font-semibold text-xs block">
                        {est.id}
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-slate-100 truncate max-w-xs block">
                        {est.title}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {game?.name || est.gameId}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900 dark:text-slate-100">
                      {formatGameCurrency(est.totalCurrency, game?.currencySymbol || 'DM')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                      {formatIDR(est.mediumPrice)}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-400">
                      {est.userName}
                    </td>
                    <td className="py-3 px-3 text-slate-500 text-[11px]">
                      {new Date(est.createdAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEstimationDetail(est);
                        }}
                        className="text-xs font-semibold text-blue-600 hover:underline"
                      >
                        Detail →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
