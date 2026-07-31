import React, { useState } from 'react';
import { Modal } from './Modal';
import { useStore } from '../context/StoreContext';
import { useToast } from '../context/ToastContext';
import {
  KeyRound,
  CheckCircle2,
  ShieldCheck,
  Zap,
  Copy,
  Sparkles,
  Lock,
  Unlock,
  AlertCircle,
  Award,
  Clock,
  Store,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseModal: React.FC<LicenseModalProps> = ({ isOpen, onClose }) => {
  const { licenseInfo, activateLicenseKey, deactivateLicense, storeConfig } = useStore();
  const { success, error, info } = useToast();

  const [inputKey, setInputKey] = useState('');
  const [inputClientName, setInputClientName] = useState('');
  const [showGenerator, setShowGenerator] = useState(false);
  const [generatedKey, setGeneratedKey] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      error('Input Kosong', 'Masukkan kode lisensi software Anda.');
      return;
    }

    setIsLoading(true);
    const res = await activateLicenseKey(inputKey, inputClientName || storeConfig.namaToko);
    setIsLoading(false);

    if (res.success) {
      success('Sistem Teraktivasi!', res.message);
      setInputKey('');
      onClose();
    } else {
      error('Aktivasi Gagal', res.message);
    }
  };

  const handleGenerateKey = () => {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newKey = `SEMBAKO-PRO-2026-${randomHex}`;
    setGeneratedKey(newKey);
    info('Kode Lisensi Dibuat', `Kode lisensi siap dijual: ${newKey}`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success('Tersalin!', 'Kode lisensi tersalin ke clipboard.');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Sistem Aktivasi & Lisensi Software"
      subtitle="Sembako POS Smart AI Commercial SaaS Edition"
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        {/* Status License Card */}
        <div
          className={`p-5 rounded-3xl border shadow-lg relative overflow-hidden transition-all ${
            licenseInfo.isActivated
              ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 border-emerald-500/40 text-white'
              : 'bg-gradient-to-r from-amber-950 via-slate-900 to-rose-950 border-amber-500/40 text-amber-100'
          }`}
        >
          <div className="flex items-start justify-between relative z-10 mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-amber-300">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {licenseInfo.licenseType}
                </span>
                <h3 className="text-base font-black text-white mt-1">
                  {licenseInfo.isActivated ? 'LISENSI PRO AKTIF' : 'SISTEM UNREGISTERED'}
                </h3>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-mono uppercase">Status Software</p>
              <p className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Siap Digunakan</span>
              </p>
            </div>
          </div>

          <div className="space-y-1.5 text-xs border-t border-white/10 pt-3 text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-400">Nama Toko / Pemilik:</span>
              <span className="font-bold text-white">{storeConfig.namaToko}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Kode Lisensi:</span>
              <span className="font-mono text-amber-300 font-bold">
                {licenseInfo.licenseKey || 'SEMBAKO-PRO-2026-VIP'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Masa Berlaku:</span>
              <span className="font-bold text-emerald-300">{licenseInfo.expiryDate}</span>
            </div>
          </div>
        </div>

        {/* Form Activation Key */}
        <form onSubmit={handleActivate} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-extrabold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-500" />
              <span>Masukkan License Key Baru</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white uppercase focus:ring-2 focus:ring-emerald-500 outline-none"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Gunakan salah satu dari <strong className="text-emerald-500 font-bold">100 License Key Resmi</strong> yang terhubung dengan email pendaftaran pembelian aplikasi Anda.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500 hover:from-emerald-600 hover:to-amber-400 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 cursor-pointer transition-all hover:scale-[1.01]"
          >
            <ShieldCheck className="w-4 h-4 text-amber-300" />
            <span>Aktivasi Lisensi Software Sekarang</span>
          </button>

          <a
            href="https://wa.me/6285187869164?text=Halo%20Admin%20Sembako%20Smart%20POS%20AI,%20saya%20ingin%20beli%20kode%20lisensi%2099rb"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>Beli Kode Lisensi 99rb via WhatsApp</span>
          </a>
        </form>

        {/* Reseller License Generator Tool */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <span>Sistem Generator Lisensi Reseller (Admin)</span>
            </span>
            <button
              type="button"
              onClick={() => setShowGenerator(!showGenerator)}
              className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
            >
              {showGenerator ? 'Sembunyikan Tool' : 'Buat Kode Lisensi Baru'}
            </button>
          </div>

          {showGenerator && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Fitur khusus vendor / pemilik software untuk mencetak kode lisensi sebelum dijual ke toko pembeli.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleGenerateKey}
                  className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Generate Key Baru</span>
                </button>

                {generatedKey && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedKey)}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer hover:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    <span>{generatedKey}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
