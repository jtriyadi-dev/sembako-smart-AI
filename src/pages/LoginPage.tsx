import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import { PageId, CrmUser } from '../types';
import { INITIAL_CRM_USERS } from '../data/defaultRemoteConfig';
import { Store, Sparkles, Mail, Lock, LogIn, ArrowRight, ShieldCheck, CheckCircle2, Globe, AlertCircle, Phone, UserCheck } from 'lucide-react';

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
  const [namaPemilik, setNamaPemilik] = useState('');
  const [namaToko, setNamaToko] = useState('');
  const [noHp, setNoHp] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [customerAccounts, setCustomerAccounts] = useState<CrmUser[]>(INITIAL_CRM_USERS);

  // Load customer accounts dynamically from server & localStorage
  useEffect(() => {
    const loadCustomers = async () => {
      let combined: CrmUser[] = [...INITIAL_CRM_USERS];
      try {
        const cached = localStorage.getItem('sembako_crm_users_v2');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            parsed.forEach((p: CrmUser) => {
              if (!combined.some(c => c.email?.toLowerCase() === p.email?.toLowerCase())) {
                combined.push(p);
              }
            });
          }
        }
      } catch (e) {}

      try {
        const res = await fetch('/api/public/crm-users', { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.users) && data.users.length > 0) {
            data.users.forEach((u: CrmUser) => {
              if (!combined.some(c => c.email?.toLowerCase() === u.email?.toLowerCase())) {
                combined.push(u);
              }
            });
          }
        }
      } catch (e) {}

      setCustomerAccounts(combined.filter(u => u.role !== 'developer'));
    };

    loadCustomers();
  }, []);

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

  const handleStaffQuickLogin = async (username: string, roleName: string) => {
    setEmail(username);
    setPassword('password123');
    setSubmitting(true);
    setAuthError(null);
    try {
      await login(username, 'password123');
      success(`Login ${roleName} Berhasil`, `Selamat bertugas sebagai ${roleName} Toko.`);
      handlePostAuthNavigate();
    } catch (err: any) {
      setAuthError(err.message || `Gagal login sebagai ${roleName}.`);
      error('Gagal Login', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeveloperQuickLogin = async () => {
    setEmail('jtriyadi@gmail.com');
    setPassword('password123');
    setSubmitting(true);
    setAuthError(null);
    try {
      await login('jtriyadi@gmail.com', 'password123');
      success('Selamat Datang Developer J. Triyadi', 'Masuk sebagai Super Admin Developer Sembako Smart AI.');
      handlePostAuthNavigate();
    } catch (err: any) {
      setAuthError(err.message || 'Gagal login developer.');
      error('Gagal Login', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOwnerQuickLogin = async (ownerEmail: string, ownerName: string, pass: string = 'password123') => {
    setEmail(ownerEmail);
    setPassword(pass);
    setSubmitting(true);
    setAuthError(null);
    try {
      await login(ownerEmail, pass);
      success('Selamat Datang', `Masuk sebagai ${ownerName}.`);
      handlePostAuthNavigate();
    } catch (err: any) {
      setAuthError(err.message || 'Gagal login pemilik toko.');
      error('Gagal Login', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!email || !password) {
      error('Input Kurang', 'Masukkan email/no HP dan kata sandi Anda.');
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await signup(email, password, { namaPemilik, namaToko, noHp });
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
        msg = 'Email atau kata sandi tidak cocok. Silakan periksa kembali data Anda.';
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
        msg = 'Domain ini belum diizinkan di Firebase Console. Anda dapat masuk langsung menggunakan Email / Password toko Anda.';
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
              {isRegister
                ? 'Daftar akun pemilik toko untuk kelola kasir dan stok sembako.'
                : 'Masuk dengan Email, No. WhatsApp, atau Akun Pegawai.'}
            </p>
          </div>

          {/* Error Banner */}
          {authError && (
            <div className="mb-4 p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span>{authError}</span>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Pemilik Toko
                  </label>
                  <input
                    type="text"
                    value={namaPemilik}
                    onChange={(e) => setNamaPemilik(e.target.value)}
                    placeholder="Contoh: Haji Budi Santoso"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Nama Toko Sembako
                  </label>
                  <input
                    type="text"
                    value={namaToko}
                    onChange={(e) => setNamaToko(e.target.value)}
                    placeholder="Contoh: Toko Berkah Sembako"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    No. WhatsApp (Opsional)
                  </label>
                  <input
                    type="text"
                    value={noHp}
                    onChange={(e) => setNoHp(e.target.value)}
                    placeholder="Contoh: 081234567890"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email / No. WhatsApp / Username
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Contoh: jtriyadi@gmail.com, 0812..., atau kasir1"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  autoCapitalize="none"
                  autoCorrect="off"
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
                  placeholder="•••••••• (default: password123)"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold text-sm shadow-lg shadow-emerald-900/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
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
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/10 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Masuk Akun Coba Demo (Berlaku 6 Jam)</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </div>

            {/* Dynamic Customer / Store Owner Quick Login */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                <span>👑 Akun Pemilik Toko Terdaftar:</span>
                <span className="text-[10px] text-amber-500 font-mono">1-Klik Masuk</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {customerAccounts.slice(0, 4).map((c) => (
                  <button
                    key={c.id || c.email}
                    type="button"
                    onClick={() => handleOwnerQuickLogin(c.email || c.noHp || c.id, c.namaPemilik || 'Pemilik Toko', c.password || 'password123')}
                    className="w-full py-1.5 px-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-200 text-xs font-medium flex items-center justify-between transition-all cursor-pointer shadow-2xs text-left"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <Store className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold truncate">{c.namaPemilik}</span>
                      <span className="text-[10px] text-slate-400 truncate">({c.email || c.noHp})</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-300 font-mono shrink-0">
                      Masuk
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Staff Login (Kasir & Admin) */}
            <div className="pt-2">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                <span>⚡ Masuk Cepat Pegawai Toko:</span>
                <span className="text-[10px] text-emerald-500 font-mono">Siap Digunakan</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleStaffQuickLogin('kasir1', 'Kasir POS')}
                  className="py-2 px-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>Kasir (kasir1)</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleStaffQuickLogin('admin1', 'Admin Toko')}
                  className="py-2 px-2.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                >
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  <span>Admin (admin1)</span>
                </button>
              </div>
            </div>

            {/* Developer Super Admin Instant Access */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleDeveloperQuickLogin}
                className="w-full py-2 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              >
                <ShieldCheck className="w-4 h-4 text-purple-500 shrink-0" />
                <span>Masuk Developer: J. Triyadi (jtriyadi@gmail.com)</span>
              </button>
            </div>
          </div>

          {/* Toggle Register / Login */}
          <div className="mt-6 flex flex-col items-center gap-3">
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setAuthError(null);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium cursor-pointer"
            >
              {isRegister
                ? 'Sudah punya akun? Masuk di sini'
                : 'Belum punya akun toko? Daftar baru'}
            </button>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Terproteksi Sistem Autentikasi Cloud & Server Sinkron</span>
          </div>

        </div>
      </div>
    </div>
  );
};

