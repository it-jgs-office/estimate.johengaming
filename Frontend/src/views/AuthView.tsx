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
  Sparkles,
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
  const [email, setEmail] = useState('admin@gmail.com');
  const [password, setPassword] = useState('admin');
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

  const handleAdminFill = () => {
    setEmail('admin@gmail.com');
    setPassword('admin');
    setError('');
    showToast('Kredensial Terisi', 'Kredensial administrator siap digunakan', 'info');
  };

  return (
    <div className="auth-screen relative isolate min-h-screen w-full overflow-hidden flex flex-col justify-between text-slate-900 select-none antialiased">
      <div className="w-full h-1 bg-blue-600" />
      <div className="auth-decoration pointer-events-none absolute -top-32 -right-24 -z-10 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="auth-decoration pointer-events-none absolute -bottom-40 -left-28 -z-10 h-80 w-80 rounded-full bg-indigo-100/70 blur-3xl" />

      {/* Main Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="w-full max-w-md">
          {/* Card Wrapper */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
            {/* Brand Header */}
            <div className="text-center space-y-2">
              <img
                src="/logo.webp"
                alt="Johen Gaming"
                className="mx-auto h-16 w-16 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">
                  JOHEN GAMING
                </h1>
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                  Smart Game Account Valuation System
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Portal Autentikasi Internal Tim Valuator
                </p>
              </div>
            </div>

            {/* Role & Access Badge (1 Role 1 System 1 User) */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2.5 text-xs">
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                  <span>Role: Administrator & Valuator</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                    Full Access
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 block truncate">
                  1 Sistem Terpadu · Akses Penuh Seluruh Modul
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
            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Email Akun Internal
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@gmail.com"
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1.5 flex items-center justify-between">
                  <span>Kata Sandi (Password)</span>
                  <span className="text-[10px] font-normal text-slate-400">admin</span>
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan password"
                    className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-xs transition-all font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 p-0.5 text-slate-400 hover:text-slate-600"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300"
                  />
                  <span>Ingat sesi saya di browser ini</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
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

            {/* Admin Fill Button */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleAdminFill}
                className="w-full py-2 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Isi Otomatis Kredensial Administrator</span>
              </button>
            </div>
          </div>

          {/* Security Notice Footer */}
          <div className="mt-4 text-center space-y-1 text-slate-500 text-[11px]">
            <p className="flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Sistem Internal Khusus Tim Johen Gaming</span>
            </p>
            <p className="text-slate-400 text-[10px]">
              &copy; 2026 Johen Gaming · Smart Game Account Valuation Platform
            </p>
          </div>
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
};
