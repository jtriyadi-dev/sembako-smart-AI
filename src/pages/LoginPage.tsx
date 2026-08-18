import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { PageId } from '../types';
import { Store, Sparkles, Mail, Lock, LogIn, ArrowRight, ShieldCheck, CheckCircle2, Globe, AlertCircle } from 'lucide-react';

interface LoginPageProps {
  onNavigate: (page: PageId) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, signup, demoLogin, loginGoogle, isDemoSession } = useAuth();
  const { licenseInfo } = useStore();
  const { success, error, info } = useToast();

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handlePostAuthNavigate = () => {
    const devAuth = localStorage.getItem('sembako_developer_auth_session');
    const licenseInfoSaved = localStorage.getItem('sembako_license_info');
    let isAct = licenseInfo.isActivated;
    if (licenseInfoSaved) {
      try {
        const p = JSON.parse(licenseInfoSaved);
        if (p.isActivated) isAct = true;
      } catch (e) {}
    }
    if (devAuth === 'true' || isAct || isDemoSession) {
      onNavigate('dashboard');
    } else {
      onNavigate('activation');
    }
  };

  const handleDeveloperQuickLogin = async () => {
    setEmail('developer@sembakosmart.id');
    setPassword('password123');
    setSubmitting(true);
    setAuthError(null);
    try {
      await login('developer@sembakosmart.id', 'password123');
      success('Selamat Datang Developer', 'Masuk sebagai Super Admin Developer Sembako Smart AI.');
      handlePostAuthNavigate();
    } catch (err: any) {
      setAuthError(err.message || 'Gagal login developer.');
      error('Gagal Login', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      error('Input Kurang', 'Masukkan email dan kata sandi Anda.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await signup(email, password);
        success('Pendaftaran Berhasil', 'Akun Toko Sembako Smart AI telah dibuat.');
      } else {
        await login(email, password);
        success('Selamat Datang', 'Login berhasil ke Toko Sembako Anda.');
      }
      handlePostAuthNavigate();
    } catch (err: any) {
      console.error('Email Auth Error:', err);
      let msg = err.message || 'Terjadi kesalahan saat autentikasi.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Email ini sudah terdaftar. Silakan pilih opsi Masuk di bawah.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Kata sandi terlalu pendek. Gunakan minimal 6 karakter.';
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        msg = 'Email atau kata sandi tidak cocok. Bila belum buat akun, silakan klik Daftar.';
      }
      setAuthError(msg);
      error('Gagal Autentikasi', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setSubmitting(true);
    setAuthError(null);
    try {
      await loginGoogle();
      success('Login Google', 'Berhasil masuk dengan akun Google.');
      handlePostAuthNavigate();
    } catch (err: any) {
      console.error('Google Login Error:', err);
      let msg = err?.message || 'Gagal masuk dengan akun Google.';
      if (err?.code === 'auth/unauthorized-domain') {
        msg = 'Domain ini (sembako-smart-ai.vercel.app) belum diizinkan di Firebase Console. Buka Firebase Console > Authentication > Settings > Authorized Domains > Tambahkan domain sembako-smart-ai.vercel.app. Atau gunakan Masuk Mode Demo di bawah.';
      } else if (err?.code === 'auth/popup-blocked') {
        msg = 'Pop-up Google diblokir oleh browser. Harap izinkan pop-up pada browser Anda.';
      } else if (err?.code === 'auth/popup-closed-by-user') {
        msg = 'Jendela login Google ditutup sebelum selesai.';
      }
      setAuthError(msg);
      error('Gagal Google Login', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoAccess = () => {
    const successDemo = demoLogin();
    if (successDemo) {
      success('Mode Demo Aktif', 'Masuk sebagai Haji Budi Santoso (Pemilik Toko).');
      onNavigate('dashboard');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center py-10 px-4">
      <div className="max-w-md w-full relative">
        {/* Decorative Luxury Background Glow */}
        <div className="absolute -top-10 -left-10 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Card Box */}
        <div className="relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border border-emerald-500/20 rounded-3xl p-8 shadow-2xl">
          
          {/* Back to Landing Page Header Link */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigate('landing')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-3.5 h-3.5 rotate-180" />
              <span>Kembali ke Beranda</span>
            </button>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              v2.5 PRO
            </span>
          </div>

          {/* Top Logo */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-amber-500 p-0.5 shadow-xl shadow-emerald-900/30 mb-4">
              <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
                <Store className="w-8 h-8 text-amber-400" />
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Sembako Smart AI Platform
            </div>

            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
              {isRegister ? 'Buat Akun Toko Baru' : 'Masuk ke Toko Anda'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Kelola stok, kasir, dan analisis AI dalam satu platform terpadu.
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{authError}</span>
                {authError.includes('sembako-smart-ai.vercel.app') && (
                  <p className="text-[11px] text-amber-500 font-bold underline cursor-pointer pt-1" onClick={handleDemoAccess}>
                    👉 Klik di sini untuk masuk Mode Demo 6 Jam secara instant.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="pemilik@sembako.id"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-900/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4 text-amber-300" />
                  <span>{isRegister ? 'Daftar Sekarang' : 'Masuk Sekarang'}</span>
                </>
              )}
            </button>
          </form>

          {/* Social / Demo Actions */}
          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 space-y-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Masuk dengan Google</span>
            </button>

            {/* Direct Demo Access Button */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={handleDemoAccess}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Masuk Akun Coba Demo (Berlaku 6 Jam)</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
              <p className="text-[10px] text-slate-400 text-center font-mono">
                ⏱️ Akses demo aktif selama 6 jam. Setelah 6 jam, semua data di-reset kembali kosong/awal.
              </p>
            </div>

            {/* Developer Super Admin Instant Access */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleDeveloperQuickLogin}
                className="w-full py-2 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Masuk Cepat: Developer (Super Admin)</span>
              </button>
            </div>
          </div>

          {/* Toggle Register / Login */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium"
            >
              {isRegister
                ? 'Sudah punya akun? Masuk di sini'
                : 'Belum punya akun toko? Daftar baru'}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Terproteksi Firebase Auth & Firestore Rules</span>
          </div>

        </div>
      </div>
    </div>
  );
};
