/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { repository } from '../services/repository';
import { useToast } from '../context/ToastContext';

interface AuthViewProps {
  onLoginSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onLoginSuccess }) => {
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email wajib diisi');
      return;
    }

    if (!password) {
      setError('Password wajib diisi');
      return;
    }

    setIsLoading(true);

    const ok = await repository.login(email, password);
    setIsLoading(false);
    if (ok) {
      showToast('Login Berhasil', 'Selamat datang di Johen Gaming Price Estimator', 'success');
      onLoginSuccess();
    } else {
      setError('Kredensial tidak valid. Periksa email dan kata sandi Anda.');
    }
  };

  return (
    <div className="auth-screen relative isolate min-h-screen w-full overflow-hidden flex flex-col justify-between text-slate-900 select-none antialiased">
      <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-500" />
      <div className="auth-decoration pointer-events-none absolute -top-32 -right-24 -z-10 h-96 w-96 rounded-full bg-blue-200/45 blur-3xl" />
      <div className="auth-decoration pointer-events-none absolute -bottom-40 -left-28 -z-10 h-80 w-80 rounded-full bg-indigo-100/75 blur-3xl" />

      {/* Main Container */}
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-[27rem]">
          {/* Card Wrapper */}
          <div className="space-y-7 rounded-3xl border border-white/80 bg-white/95 p-7 shadow-[0_24px_70px_rgba(37,72,138,0.14)] backdrop-blur-sm sm:p-9">
            {/* Brand Header */}
            <div className="space-y-3 text-center">
              <img
                src="/logo.webp"
                alt="Johen Gaming"
                className="mx-auto h-[4.5rem] w-[4.5rem] object-contain drop-shadow-sm"
              />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                  JOHEN GAMING
                </h1>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-blue-600">
                  Price Estimator
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Masuk untuk mengelola estimasi harga akun game.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-4 py-3 text-left">
              <div className="shrink-0 rounded-xl bg-white p-2 text-blue-600 shadow-sm ring-1 ring-blue-100">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">Akses khusus tim Johen Gaming</p>
                <span className="mt-0.5 block text-[11px] leading-4 text-slate-500">
                  Gunakan kredensial akun yang sudah terdaftar.
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5 text-xs">
              <div>
                <label className="mb-2 block font-semibold text-slate-700">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@johengaming.com"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block font-semibold text-slate-700">
                  Kata sandi
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition-colors hover:text-blue-600"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5 text-xs">
                <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Ingat sesi saya di browser ini</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_20px_rgba(37,99,235,0.24)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_24px_rgba(37,99,235,0.3)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? (
                  <span>Memverifikasi Akses...</span>
                ) : (
                  <>
                    <span>Masuk ke Sistem Estimasi</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

          </div>

          {/* Security Notice Footer */}
          <div className="mt-5 space-y-1.5 text-center text-[11px] text-slate-500">
            <p className="flex items-center justify-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Portal internal Johen Gaming</span>
            </p>
            <p className="text-[10px] text-slate-400">
              &copy; 2026 Johen Gaming · Smart Game Account Valuation Platform
            </p>
          </div>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
};
