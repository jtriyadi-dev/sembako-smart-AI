import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PageId } from '../types';
import {
  KeyRound,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  Store,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { motion } from 'motion/react';

interface LicenseActivationGateProps {
  onNavigate?: (page: PageId) => void;
  onActivateSuccess?: () => void;
}

export const LicenseActivationGate: React.FC<LicenseActivationGateProps> = ({
  onNavigate,
  onActivateSuccess,
}) => {
  const { activateLicenseKey, storeConfig, updateStoreConfig } = useStore();
  const { demoLogin } = useAuth();
  const { success, error: toastError } = useToast();

  const [inputKey, setInputKey] = useState('');
  const [storeName, setStoreName] = useState(storeConfig.namaToko || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!inputKey.trim()) {
      setErrorMessage('Harap masukkan License Key 16-karakter Anda.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await activateLicenseKey(inputKey.trim(), storeName.trim() || 'Pemilik Toko Official');
      setIsLoading(false);

      if (result.success) {
        if (storeName.trim()) {
          updateStoreConfig({ namaToko: storeName.trim() });
        }
        success('Aktivasi Berhasil!', result.message);
        if (onActivateSuccess) {
          onActivateSuccess();
        } else if (onNavigate) {
          onNavigate('dashboard');
        }
      } else {
        setErrorMessage(result.message);
        toastError('Aktivasi Gagal', result.message);
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || 'Terjadi kesalahan sistem saat mendeteksi lisensi.');
    }
  };

  const handleDemoMode = () => {
    const successDemo = demoLogin();
    if (successDemo) {
      success('Mode Coba Demo 6 Jam', 'Selamat mencoba aplikasi Sembako Smart POS AI.');
      if (onNavigate) {
        onNavigate('dashboard');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Glow Effects */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg bg-slate-900/90 border border-slate-800 backdrop-blur-2xl rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 space-y-6"
      >
        {/* Header Branding */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-[11px] font-extrabold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Sembako Smart POS AI v2.5</span>
          </div>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-amber-500 p-0.5 mx-auto shadow-lg shadow-emerald-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-amber-400" />
            </div>
          </div>

          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Menu Aktivasi Lisensi
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Masukkan License Key resmi 16-karakter yang terdaftar saat pembelian untuk membuka akses penuh ke aplikasi.
            </p>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5 font-medium"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleActivate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>Kode License Key (16 Karakter Wajib)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={inputKey}
                onChange={(e) => {
                  setInputKey(e.target.value.toUpperCase());
                  setErrorMessage('');
                }}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full pl-10 pr-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-sm font-mono font-black text-amber-300 placeholder:text-slate-600 uppercase focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 tracking-wider"
              />
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-4" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-2">
              <Store className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nama Toko / Pemilik (Opsional)</span>
            </label>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="Contoh: Toko Sembako Berkah / Sembako Smart AI"
              className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-xs font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 hover:from-emerald-500 hover:to-amber-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 mt-2"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Memverifikasi Lisensi...</span>
              </span>
            ) : (
              <>
                <span>Aktivasi & Masuk Aplikasi</span>
                <ArrowRight className="w-4 h-4 text-amber-200" />
              </>
            )}
          </button>
        </form>

        {/* Alternative Actions / Back Buttons */}
        <div className="pt-2 border-t border-slate-800 space-y-2 text-center">
          <button
            type="button"
            onClick={handleDemoMode}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Atau Masuk Coba Mode Demo 6 Jam</span>
          </button>

          {onNavigate && (
            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="hover:text-emerald-400 font-semibold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Kembali ke Login</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('landing')}
                className="hover:text-emerald-400 font-semibold cursor-pointer"
              >
                <span>Halaman Beranda</span>
              </button>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 text-center leading-relaxed">
          Lisensi ini seumur hidup (Lifetime) dan terkunci untuk penggunaan toko Anda.
        </p>
      </motion.div>
    </div>
  );
};
