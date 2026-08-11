import React, { useState } from 'react';
import { Modal } from './Modal';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  ShoppingCart,
  Boxes,
  Printer,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Store,
  Bot,
  Zap,
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartKasir?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onStartKasir,
}) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Selamat Datang di Sembako Smart AI',
      subtitle: 'Platform Kasir POS & Intelligence Manajemen Toko Sembako #1',
      icon: Store,
      badge: 'SaaS Enterprise Edition',
      color: 'from-emerald-600 to-amber-500',
      description:
        'Aplikasi pintar khusus pemilik & kasir toko sembako grosir maupun eceran. Dilengkapi kecerdasan AI Asisten Pintar, pencetakan struk thermal Bluetooth, serta sinkronisasi otomatis Cloud Firestore.',
      highlights: [
        'Navigasi Responsif: Touch-Friendly Desktop, Tablet & Mobile App',
        'Pencarian Cepat & Barcode Scanner terintegrasi camera / USB',
        'Laporan Penjualan Realtime & Ekspor PDF / Excel Laba Rugi',
      ],
    },
    {
      title: 'Kasir Cepat POS (Point of Sale)',
      subtitle: 'Transaksi Kilat, Hitung Kembalian & Cetak Struk Thermal',
      icon: ShoppingCart,
      badge: 'Kasir Super Cepat',
      color: 'from-emerald-600 to-emerald-800',
      description:
        'Fitur kasir yang didesain intuitif untuk melayani antrean pembeli dengan cepat. Dukungan pembayaran Tunai, QRIS Standar Nasional, dan Transfer Bank.',
      highlights: [
        'Shortcut Tombol Uang Pas & Pecahan Nominal Populer (Rp10k, Rp50k, Rp100k)',
        'Cetak Struk Otomatis ke Printer Thermal 58mm / 80mm',
        'Kalkulasi otomatis potong stok & riwayat nota terperinci',
      ],
    },
    {
      title: 'Kecerdasan Smart AI Asisten',
      subtitle: 'Asisten AI Bisnis Sembako & Perintah Suara (Voice Command)',
      icon: Sparkles,
      badge: 'Smart AI Engine',
      color: 'from-amber-500 to-emerald-700',
      description:
        'Tanyakan apa saja seputar kesehatan toko Anda kepada AI. Analisis stok mati (deadstock), saran batas restock, hingga rekap barang paling laris dalam hitungan detik.',
      highlights: [
        'Perintah Suara (Voice Command): Tekan mikrofon & bicara dalam Bahasa Indonesia',
        'Rekomendasi Pintar Restock Barang Sebelum Kehabisan',
        'Analisis Margin Keuntungan & Proyeksi Omzet Harian',
      ],
    },
    {
      title: 'Gudang Stok & Opname Sembako',
      subtitle: 'Monitor Min-Stok, Kartu Stok & Riwayat Mutasi Barang',
      icon: Boxes,
      badge: 'Manajemen Inventori',
      color: 'from-emerald-700 to-indigo-800',
      description:
        'Hindari kehabisan stok barang utama seperti beras, minyak goreng, gula, dan telur. Fitur Stock Opname fisik memudahkan penyesuaian selisih stok secara akurat.',
      highlights: [
        'Badge Peringatan Stok Kritis (Merah / Kuning)',
        'Catatan Alasan Opname (Barang Rusak, Kadaluarsa, Selisih)',
        'Fitur Import Massal Produk Katalog via File Excel CSV & JSON',
      ],
    },
  ];

  const currentStepData = steps[step];
  const StepIcon = currentStepData.icon;

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
      if (onStartKasir) onStartKasir();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Panduan Memulai Toko"
      subtitle="Selamat Datang di Sembako Smart AI"
      maxWidth="max-w-xl"
    >
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Header Visual Hero */}
            <div className={`p-6 rounded-3xl bg-gradient-to-r ${currentStepData.color} text-white shadow-xl relative overflow-hidden`}>
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />

              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30 text-amber-300 shadow-lg">
                  <StepIcon className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md border border-white/30 text-white">
                  {currentStepData.badge}
                </span>
              </div>

              <h3 className="text-lg font-extrabold text-white">
                {currentStepData.title}
              </h3>
              <p className="text-xs text-emerald-100/90 mt-0.5">
                {currentStepData.subtitle}
              </p>
            </div>

            {/* Description Body */}
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              {currentStepData.description}
            </p>

            {/* Feature Highlights List */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Keunggulan Utama:
              </h4>
              <div className="space-y-1.5">
                {currentStepData.highlights.map((hl, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Step Indicator & Navigation Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === step
                    ? 'w-6 bg-emerald-600 dark:bg-amber-400'
                    : 'w-2 bg-slate-300 dark:bg-slate-700'
                }`}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500 hover:from-emerald-600 hover:to-amber-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-900/20 cursor-pointer transition-all"
            >
              <span>{step === steps.length - 1 ? 'Mulai Sekarang' : 'Lanjut'}</span>
              <ChevronRight className="w-4 h-4 text-amber-300" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
