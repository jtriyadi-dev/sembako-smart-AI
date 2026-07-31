import React, { useState } from 'react';
import { PageId } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Store,
  Sparkles,
  ShoppingCart,
  Receipt,
  Boxes,
  BarChart3,
  Mail,
  FileSpreadsheet,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Zap,
  Clock,
  Printer,
  Smartphone,
  Check,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  Award,
  Users,
  MessageSquare,
  Lock,
  Globe,
  Star,
  ExternalLink,
  Laptop,
  CheckCircle,
  QrCode,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  PackageCheck,
  Layers,
  Sparkle
} from 'lucide-react';

interface LandingPageProps {
  onNavigate: (page: PageId) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const { demoLogin } = useAuth();
  const { success } = useToast();

  // Active Preview Tab in Hero Mockup
  const [heroTab, setHeroTab] = useState<'pos' | 'stok' | 'ai' | 'laporan'>('pos');

  // ROI Calculator State
  const [dailyTxCount, setDailyTxCount] = useState<number>(65);
  const [avgBasketSize, setAvgBasketSize] = useState<number>(45000);

  // FAQ Accordion State
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Calculated ROI values
  const monthlyOmset = dailyTxCount * avgBasketSize * 30;
  const estimatedTimeSavedHours = Math.round((dailyTxCount * 1.5 * 30) / 60); // hours saved per month
  const estimatedLeakageSavings = Math.round(monthlyOmset * 0.035); // 3.5% saved from leakage & expired stock

  const handleStartDemo = () => {
    const successDemo = demoLogin();
    if (successDemo) {
      success('Akses Demo 6 Jam Diaktifkan!', 'Selamat mencoba Sembako Smart POS AI.');
      onNavigate('dashboard');
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const faqs = [
    {
      q: 'Apakah aplikasi ini memerlukan biaya langganan bulanan?',
      a: 'TIDAK! Sembako Smart POS AI harganya CUMA Rp 99.000 (99rb) Sekali Bayar (Lifetime License). Setelah membeli lisensi resmi, Anda mendapatkan akses seumur hidup tanpa biaya bulanan atau tahunan tersembunyi.'
    },
    {
      q: 'Apakah aplikasi tetap bisa dipakai saat koneksi internet mati/putus?',
      a: 'SANGAT BISA! Aplikasi ini dirancang dengan arsitektur Offline-First. Seluruh transaksi kasir, scan barcode, cetak nota Bluetooth, dan pencatatan stok dapat dilakukan 100% tanpa jaringan internet. Begitu terhubung ke internet, data akan otomatis disinkronkan ke Cloud Firestore.'
    },
    {
      q: 'Bagaimana cara cetak struk nota belanja ke printer kasir?',
      a: 'Aplikasi mendukung semua merk printer Thermal Bluetooth (ukuran 58mm & 80mm) serta printer USB/Desktop. Anda hanya perlu menyambungkan Bluetooth perangkat ke printer, lalu klik "Cetak Struk" pada halaman Kasir POS.'
    },
    {
      q: 'Apakah data toko saya aman jika HP atau Laptop saya rusak atau hilang?',
      a: 'Aman 100%! Seluruh data tersimpan secara terenkripsi di Google Cloud Firestore. Jika HP atau Laptop Anda berganti, Anda cukup login kembali dengan email dan password Anda, maka seluruh data produk, riwayat transaksi, dan laporan toko akan muncul kembali utuh.'
    },
    {
      q: 'Apakah aplikasi ini bisa dipakai untuk toko sembako grosir dan eceran sekaligus?',
      a: 'Ya! Sembako Smart POS AI mendukung pengelolaan harga bertingkat (Eceran, Grosir, dan Karton/Dus). Kasir dapat dengan cepat memilih satuan dan harga sesuai tipe pembelian pelanggan.'
    },
    {
      q: 'Bagaimana jika saya memerlukan bantuan saat awal penggunaan aplikasi atau ingin membeli lisensi?',
      a: 'Tim Customer Support kami siap membantu Anda 24/7! Hubungi WhatsApp Customer Support kami untuk bantuan penginstalan, pengisian data produk via Excel, maupun aktivasi kode lisensi Rp 99rb.'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 overflow-x-hidden relative">
      
      {/* TOP PROMO ANNOUNCEMENT BAR */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-amber-500 text-slate-950 font-black text-xs py-2 px-4 text-center flex flex-wrap items-center justify-center gap-2 shadow-md">
        <span>🔥 PROMO KHUSUS HARI INI: HARGA APLIKASI CUMA 99RB (RP 99.000) SEKALI BAYAR SELAMANYA!</span>
      </div>

      {/* 1. TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/85 border-b border-emerald-500/20 shadow-xl shadow-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-amber-400 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Store className="w-6 h-6 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-amber-300 bg-clip-text text-transparent">
                  SEMBAKO SMART
                </span>
                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase rounded bg-amber-400 text-slate-950">
                  POS AI
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Sistem Kasir & Stok Toko Kelontong Modern</p>
            </div>
          </div>

          {/* Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-300">
            <a href="#fitur" className="hover:text-amber-400 transition-colors">Fitur Utama</a>
            <a href="#perangkat" className="hover:text-amber-400 transition-colors">Kompatibilitas</a>
            <a href="#kalkulator" className="hover:text-amber-400 transition-colors">Kalkulator ROI</a>
            <a href="#harga" className="hover:text-amber-400 transition-colors">Paket Harga (99rb)</a>
            <a href="#testimoni" className="hover:text-amber-400 transition-colors">Testimoni</a>
            <a href="#faq" className="hover:text-amber-400 transition-colors">FAQ</a>
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Quick Demo Button */}
            <button
              onClick={handleStartDemo}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-all cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Coba Demo 6 Jam</span>
            </button>

            {/* Login Menu Button */}
            <button
              onClick={() => onNavigate('login')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
              <span>Login Aplikasi</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[450px] bg-emerald-500/15 rounded-full blur-[150px] pointer-events-none" />
        <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 space-y-8">
          
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-extrabold tracking-wide">
            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>🔥 PROMO LISENSI LENGKAP CUMA 99RB SEKALI BAYAR SELAMANYA</span>
          </div>

          {/* Main Title */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight max-w-5xl mx-auto">
            Kelola Toko Sembako & Grosir Lebih{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-200 to-amber-300 bg-clip-text text-transparent">
              Cepat, Akurat, dan Bebas Bocor!
            </span>
          </h1>

          {/* Subtitle Description */}
          <p className="text-slate-300 text-base sm:text-lg max-w-3xl mx-auto leading-relaxed">
            Tinggalkan pencatatan manual! Sembako Smart POS AI membantu Anda mengelola ribuan produk sembako, scan barcode kamera HP, cetak nota Bluetooth, serta deteksi stok kritis & barang kedaluwarsa secara otomatis. Cuma 99rb sekali bayar!
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={handleStartDemo}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Zap className="w-5 h-5 text-slate-950 fill-slate-950" />
              <span>Coba Akses Demo Instant (6 Jam Gratis)</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <a
              href="https://wa.me/6285187869164?text=Halo%20Admin%20Sembako%20Smart%20POS%20AI,%20saya%20ingin%20beli%20paket%20lisensi%2099rb"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <MessageSquare className="w-5 h-5 fill-slate-950" />
              <span>Beli Lisensi 99rb via WhatsApp</span>
            </a>
          </div>

          {/* Guarantee Badges */}
          <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-slate-400">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> 100% Cuma 99rb Sekali Bayar (Tanpa Biaya Bulanan)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Offline Ready (Bisa Tanpa Internet)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Support WhatsApp 24/7
            </span>
          </div>

          {/* LIVE APP INTERACTIVE MOCKUP SHOWCASE */}
          <div className="pt-10 max-w-5xl mx-auto">
            <div className="relative rounded-3xl p-3 bg-gradient-to-b from-emerald-500/30 via-slate-800/40 to-slate-900 border border-emerald-500/30 shadow-2xl shadow-emerald-950/80 overflow-hidden">
              
              {/* Browser Header Bar */}
              <div className="px-4 py-3 bg-slate-900 rounded-t-2xl flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="text-xs font-mono text-slate-400 ml-2">app.sembakosmart.id / dashboard</span>
                </div>

                {/* Mockup Tab Switches */}
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-bold">
                  <button
                    onClick={() => setHeroTab('pos')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      heroTab === 'pos'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Kasir POS
                  </button>
                  <button
                    onClick={() => setHeroTab('stok')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      heroTab === 'stok'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Stok & Expired
                  </button>
                  <button
                    onClick={() => setHeroTab('ai')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      heroTab === 'ai'
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    AI Asisten
                  </button>
                  <button
                    onClick={() => setHeroTab('laporan')}
                    className={`px-3 py-1 rounded-lg transition-all ${
                      heroTab === 'laporan'
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Laporan
                  </button>
                </div>
              </div>

              {/* Mockup Display Canvas with Visual Banner */}
              <div className="bg-slate-950 p-6 rounded-b-2xl text-left space-y-6">
                
                {heroTab === 'pos' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                        <ShoppingCart className="w-3.5 h-3.5" /> KASIR POS ULTRACAPAT
                      </div>
                      <h3 className="text-xl font-bold text-slate-100">
                        Scan Barcode Kamera HP & Cetak Struk Instan
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Proses transaksi kasir belanjaan sembako tanpa kendala. Sistem otomatis menghitung total harga, potongan diskon, kembalian, serta mendukung cetak nota printer thermal Bluetooth.
                      </p>
                      <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Omset Hari Ini</span>
                          <span className="font-extrabold text-emerald-400 text-sm">Rp 4.850.000</span>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block">Total Transaksi</span>
                          <span className="font-extrabold text-teal-300 text-sm">86 Transaksi</span>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-2xl space-y-3 font-sans relative overflow-hidden group">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="font-extrabold text-slate-200 tracking-wider">KASIR POS ACTIVE</span>
                          </div>
                          <span className="text-emerald-400 font-mono font-bold bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[10px]">
                            SCANNER READY
                          </span>
                        </div>

                        {/* Simulated Cart Items */}
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">1x</div>
                              <div>
                                <div className="font-bold text-slate-200 text-[11px]">Beras Setra Ramos 5kg</div>
                                <div className="text-[9px] text-slate-400 font-mono">20891823901</div>
                              </div>
                            </div>
                            <span className="font-mono font-extrabold text-slate-100 text-[11px]">Rp 72.000</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">2x</div>
                              <div>
                                <div className="font-bold text-slate-200 text-[11px]">Minyak Goreng Bimoli 2L</div>
                                <div className="text-[9px] text-slate-400 font-mono">89927610012</div>
                              </div>
                            </div>
                            <span className="font-mono font-extrabold text-slate-100 text-[11px]">Rp 68.000</span>
                          </div>
                        </div>

                        {/* Total Footer & Receipt Button */}
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block uppercase">Total Transaksi</span>
                            <span className="text-base font-black text-emerald-400 font-mono">Rp 140.000</span>
                          </div>
                          <div className="px-3 py-1.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
                            <Printer className="w-3.5 h-3.5 fill-slate-950" />
                            <span>Cetak Struk</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {heroTab === 'stok' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                        <Boxes className="w-3.5 h-3.5" /> STOK & ALERT KEDALUWARSA
                      </div>
                      <h3 className="text-xl font-bold text-slate-100">
                        Kontrol Stok Otomatis & Notifikasi Barang Expired
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Cegah barang berdebu dan busuk di gudang. Sistem memberikan peringatan dini untuk barang mendekati tanggal kedaluwarsa dan stok di bawah batas aman.
                      </p>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs">
                        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                        <div>
                          <span className="font-bold text-red-300 block">Perhatian Stok Kritis!</span>
                          <span className="text-[11px] text-slate-300">MinyakKita 1L tersisa 4 pouch. Segera lakukan pesanan ulang.</span>
                        </div>
                      </div>
                    </div>
                    <div className="lg:col-span-5">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-2xl space-y-3 font-sans relative overflow-hidden group">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                          <div className="flex items-center gap-2">
                            <Boxes className="w-4 h-4 text-amber-400" />
                            <span className="font-extrabold text-slate-200">INVENTARIS GUDANG</span>
                          </div>
                          <span className="text-amber-300 font-mono text-[10px] bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                            RESTOCK ALERT
                          </span>
                        </div>

                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between p-2 rounded-xl bg-rose-950/30 border border-rose-500/30">
                            <div className="flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                              <div>
                                <div className="font-bold text-rose-200 text-[11px]">MinyakKita 1L (Pouch)</div>
                                <div className="text-[9px] text-rose-300/80">Sisa Stok: 4 Pouch</div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-bold text-[9px] uppercase">Stok Kritis</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-950/30 border border-amber-500/30">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                              <div>
                                <div className="font-bold text-amber-200 text-[11px]">Telur Ayam Negeri (Tray)</div>
                                <div className="text-[9px] text-amber-300/80">Expired: 3 Hari Lagi (14 Aug)</div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-bold text-[9px] uppercase">Exp Alert</span>
                          </div>

                          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                              <div>
                                <div className="font-bold text-slate-200 text-[11px]">Tepung Segitiga Biru 1kg</div>
                                <div className="text-[9px] text-slate-400">Sisa Stok: 48 Pcs</div>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-bold text-[9px]">Aman</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {heroTab === 'ai' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                        <Sparkles className="w-3.5 h-3.5" /> GEMINI AI INTELLIGENCE
                      </div>
                      <h3 className="text-xl font-bold text-slate-100">
                        Konsultasi AI Asisten Sembako Smart 24/7
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Dapatkan analisis otomatis mengenai tren produk paling laris minggu ini, perhitungan margin keuntungan optimal, serta strategi promosi paket sembako hemat.
                      </p>
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/30 text-xs space-y-1">
                        <span className="text-amber-400 font-bold text-[11px] flex items-center gap-1.5">
                          <Sparkle className="w-3.5 h-3.5" /> Rekomendasi AI Hari Ini:
                        </span>
                        <p className="text-slate-300 italic text-[11px]">
                          "Penjualan Berhas Setra Ramos meningkat 28%. Pertimbangkan membuat paket Bundling Beras + Minyak Goreng untuk meningkatkan nilai rata-rata nota."
                        </p>
                      </div>
                    </div>
                    <div className="lg:col-span-5">
                      <div className="rounded-2xl border border-amber-500/30 bg-slate-950 p-4 shadow-2xl space-y-3 font-sans relative overflow-hidden group">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                          <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-amber-400" />
                            <span className="font-extrabold text-amber-300">GEMINI AI ASISTEN</span>
                          </div>
                          <span className="text-emerald-400 font-bold text-[10px] bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            ONLINE
                          </span>
                        </div>

                        <div className="space-y-2.5 text-xs">
                          <div className="flex gap-2 items-start justify-end">
                            <div className="bg-emerald-600/90 text-white p-2.5 rounded-2xl rounded-tr-none text-[11px] max-w-[85%] leading-tight">
                              Apa produk paling laris minggu ini dan saran harga jualnya?
                            </div>
                          </div>

                          <div className="flex gap-2 items-start">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-400 to-emerald-400 text-slate-950 font-black flex items-center justify-center text-[10px] shrink-0 shadow-md">
                              AI
                            </div>
                            <div className="bg-slate-900 border border-amber-500/20 text-slate-200 p-2.5 rounded-2xl rounded-tl-none text-[11px] leading-relaxed space-y-1">
                              <p className="font-semibold text-amber-300">📈 Analisis AI Sembako:</p>
                              <p className="text-slate-300 text-[10px]">"Beras Ramos 5kg terjual 42 sak. Naikkan margin Rp 1.500/sak atau buat Paket Hemat bersama Minyak Goreng 1L."</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {heroTab === 'laporan' && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-7 space-y-4">
                      <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-bold">
                        <FileSpreadsheet className="w-3.5 h-3.5" /> LAPORAN KEUSNGAN LENGKAP
                      </div>
                      <h3 className="text-xl font-bold text-slate-100">
                        Ekspor Laporan Harian & Bulanan ke Excel & PDF
                      </h3>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Rekapitulasi omset, HPP (Harga Pokok Penjualan), laba bersih, serta arus kas toko dapat diunduh langsung dalam sekali klik untuk analisa pembukuan.
                      </p>
                      <div className="flex items-center gap-3 pt-1">
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" /> Excel (.XLSX)
                        </span>
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                          <CheckCircle className="w-4 h-4" /> PDF Invoice
                        </span>
                      </div>
                    </div>
                    <div className="lg:col-span-5">
                      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-2xl space-y-3 font-sans relative overflow-hidden group">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px]">
                          <div className="flex items-center gap-2">
                            <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                            <span className="font-extrabold text-slate-200">REKAP KEUANGAN TOKO</span>
                          </div>
                          <span className="text-teal-300 font-mono text-[10px] bg-teal-950 border border-teal-500/30 px-2 py-0.5 rounded-md font-bold">
                            BULAN INI
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Total Omset</span>
                            <span className="font-mono font-extrabold text-emerald-400 text-sm">Rp 48.500.000</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                            <span className="text-[10px] text-slate-400 block">Laba Bersih</span>
                            <span className="font-mono font-extrabold text-teal-300 text-sm">Rp 7.250.000</span>
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
                          <div className="flex-1 py-2 px-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 font-bold text-[10px] flex items-center justify-center gap-1.5">
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Ekspor Excel</span>
                          </div>
                          <div className="flex-1 py-2 px-2.5 rounded-xl bg-teal-950/60 border border-teal-500/30 text-teal-300 font-bold text-[10px] flex items-center justify-center gap-1.5">
                            <Receipt className="w-3.5 h-3.5" />
                            <span>Cetak PDF</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

        </div>
      </section>

      {/* 3. PROBLEM VS SOLUTION COMPARISON */}
      <section className="py-20 bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              Kenapa Toko Sembako Tradisional Sering <span className="text-red-400">Rugi & Bocor?</span>
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl mx-auto">
              Banyak pemilik toko kelontong bekerja keras dari pagi sampai malam, namun laba bersih tidak kelihatan karena pengelolaan manual.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Manual Way (Problem) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-red-950/20 border border-red-500/30 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-lg">
                  ✕
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-300">Cara Manual / Buku Nota Kertas</h3>
                  <p className="text-xs text-slate-400">Resiko tinggi kesalahan hitung & modal tercecer</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">❌</span>
                  <span>Nota kertas sering hilang, sobek, atau lupa dicatat saat toko ramai antrean.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">❌</span>
                  <span>Barang kedaluwarsa (expired) menumpuk di rak belakang tanpa terdeteksi.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">❌</span>
                  <span>Stok barang laris mendadak habis sehingga pembeli lari ke toko sebelah.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-400 font-bold">❌</span>
                  <span>Sulit menghitung laba bersih asli karena tercampur utang bon langganan.</span>
                </li>
              </ul>
            </div>

            {/* Sembako Smart POS AI (Solution) */}
            <div className="p-6 sm:p-8 rounded-3xl bg-emerald-950/20 border border-emerald-500/30 space-y-6 relative overflow-hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-lg">
                  ✓
                </div>
                <div>
                  <h3 className="text-lg font-bold text-emerald-300">Solusi Sembako Smart POS AI</h3>
                  <p className="text-xs text-slate-400">Otomatisasi digital hemat waktu & cegah kebocoran</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-xs sm:text-sm text-slate-300">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Scan barcode HP kilat, hitung total & kembalian otomatis 100% bebas salah.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Notifikasi otomatis untuk barang mendekati tanggal kedaluwarsa.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Peringatan stok kritis & AI analisis rekomendasi belanja modal restock.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>Ekspor laporan harian & bulanan langsung ke berkas PDF & Excel (.xlsx).</span>
                </li>
              </ul>
            </div>

          </div>

        </div>
      </section>

      {/* 4. CORE FEATURES SHOWCASE WITH VISUAL CARDS */}
      <section id="fitur" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Fitur Lengkap Serba Otomatis</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-100">
            Segala Hal Yang Diperlukan Toko Sembako Dalam 1 Aplikasi
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Feature Card 1 */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="relative h-40 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/60 border border-slate-800 overflow-hidden flex flex-col items-center justify-center p-4 gap-2">
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur text-emerald-400 font-bold text-[10px] border border-emerald-500/20">
                  POS KASIR
                </div>
                <div className="relative w-full max-w-[200px] h-20 rounded-xl bg-slate-950 border border-emerald-500/40 p-3 flex flex-col items-center justify-center shadow-lg">
                  <div className="absolute inset-x-3 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse"></div>
                  <div className="flex items-center gap-1.5 opacity-80">
                    <div className="w-1.5 h-10 bg-slate-200 rounded-xs"></div>
                    <div className="w-0.5 h-10 bg-slate-200"></div>
                    <div className="w-2.5 h-10 bg-slate-200 rounded-xs"></div>
                    <div className="w-1 h-10 bg-slate-200"></div>
                    <div className="w-2 h-10 bg-slate-200 rounded-xs"></div>
                    <div className="w-0.5 h-10 bg-slate-200"></div>
                    <div className="w-1.5 h-10 bg-slate-200 rounded-xs"></div>
                    <div className="w-2 h-10 bg-slate-200 rounded-xs"></div>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 font-bold mt-1">899276100123</span>
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">Kasir POS & Scan Barcode Kamera</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Transaksi kasir super cepat dengan scan barcode HP. Mendukung harga grosir vs eceran, potongan diskon per item, transaksi bon utang, serta pembayaran QRIS & Tunai.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-emerald-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Scan Barcode HP Rapid
            </div>
          </div>

          {/* Feature Card 2 */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="relative h-40 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 border border-slate-800 overflow-hidden flex items-center justify-center p-4">
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur text-amber-400 font-bold text-[10px] border border-amber-500/20">
                  PRINTER & PDF
                </div>
                <div className="w-40 bg-slate-100 text-slate-950 p-3 rounded-t-xl rounded-b-md shadow-2xl text-[9px] font-mono space-y-1 transform -rotate-2">
                  <div className="text-center font-bold border-b border-dashed border-slate-400 pb-1 uppercase">TOKO SEMBAKO BERKAH</div>
                  <div className="flex justify-between pt-0.5"><span>Beras 5kg</span><span>72.000</span></div>
                  <div className="flex justify-between"><span>Minyak 2L</span><span>34.000</span></div>
                  <div className="border-t border-dashed border-slate-400 pt-1 flex justify-between font-bold"><span>TOTAL</span><span>106.000</span></div>
                  <div className="text-[8px] text-center text-slate-500 pt-0.5">*** TERIMA KASIH ***</div>
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">Cetak Struk Bluetooth & Invoice PDF</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Cetak struk nota belanjaan langsung ke printer thermal Bluetooth (ukuran 58mm / 80mm). Bebas bagikan struk digital via WhatsApp dalam format PDF resmi.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-amber-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Thermal 58mm & 80mm
            </div>
          </div>

          {/* Feature Card 3 */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="relative h-40 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/40 border border-slate-800 overflow-hidden flex flex-col justify-center p-4 gap-2">
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-slate-950/80 backdrop-blur text-teal-300 font-bold text-[10px] border border-teal-500/20">
                  STOK & EXPIRED
                </div>
                <div className="space-y-1.5 text-[10px] pt-4">
                  <div className="p-2 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-200 font-bold">Beras Setra Ramos 5kg</span>
                    <span className="text-emerald-400 font-mono font-bold">Stok: 85 Sak</span>
                  </div>
                  <div className="p-2 rounded-xl bg-slate-950/80 border border-rose-500/30 flex items-center justify-between">
                    <span className="text-rose-300 font-bold">MinyakKita 1L</span>
                    <span className="text-rose-400 font-mono font-bold">⚠️ Sisa 4 Pouch</span>
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">Manajemen Stok & Batch Kedaluwarsa</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Stok barang otomatis terpotong saat transaksi. Dilengkapi modul Stock Opname, tanggal expired barang, serta manajemen data supplier utama.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-teal-300 font-bold">
              <CheckCircle className="w-4 h-4" /> Warning Barang Expired
            </div>
          </div>

          {/* Feature Card 4 */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">Laporan Keuangan & Unduh Excel/PDF</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sistem merangkum omset, HPP, dan laba kotor harian/bulanan secara presisi. Seluruh data rekapitulasi dapat diunduh kapan saja dalam format file Excel (.xlsx) & PDF.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-indigo-400 font-bold">
              <CheckCircle className="w-4 h-4" /> Rekapitutasi Sekali Klik
            </div>
          </div>

          {/* Feature Card 5 */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">AI Asisten Sembako Smart</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Fitur AI kecerdasan buatan Gemini yang dapat diajak berdiskusi tentang analisis tren barang terlaris, harga jual optimal, hingga saran restock belanja grosir.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-amber-300 font-bold">
              <CheckCircle className="w-4 h-4" /> Powered by Gemini AI
            </div>
          </div>

          {/* Feature Card 6 */}
          <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 transition-all space-y-4 group flex flex-col justify-between">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-300 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-100">Offline-First & Auto Cloud Sync</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Aplikasi tetap lancar digunakan saat jaringan internet terputus. Seluruh data transaksi otomatis tersinkronisasi ke Google Cloud Firestore begitu koneksi kembali aktif.
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 text-xs text-emerald-300 font-bold">
              <CheckCircle className="w-4 h-4" /> Bebas Kuota Internet
            </div>
          </div>

        </div>

      </section>

      {/* 5. HARDWARE & DEVICE COMPATIBILITY SECTION (NEW) */}
      <section id="perangkat" className="py-20 bg-slate-900/80 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/30 text-teal-300 text-xs font-bold">
              <Laptop className="w-3.5 h-3.5 text-teal-400" />
              <span>Dukungan Perangkat Fleksibel</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-100">
              Gunakan Di Mana Saja & Kompatibel Semua Perangkat Kasir
            </h2>
            <p className="text-slate-400 text-sm max-w-2xl mx-auto">
              Tidak perlu beli hardware mahal! Sembako Smart POS AI dapat dijalankan langsung di perangkat yang sudah Anda miliki.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            
            {/* Device 1 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                <Smartphone className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-200">HP Android & iOS</h4>
              <p className="text-[11px] text-slate-400">Scan barcode lewat kamera HP langsung tanpa alat tambahan.</p>
            </div>

            {/* Device 2 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                <Laptop className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-200">Laptop & PC Windows</h4>
              <p className="text-[11px] text-slate-400">Gunakan layar lebar untuk kasir toko grosir & manajemen laporan.</p>
            </div>

            {/* Device 3 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/10 text-teal-300 flex items-center justify-center">
                <Printer className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-200">Printer Thermal Bluetooth</h4>
              <p className="text-[11px] text-slate-400">Support semua merk printer kasir Thermal 58mm & 80mm.</p>
            </div>

            {/* Device 4 */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 hover:border-emerald-500/40 transition-colors">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                <QrCode className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-extrabold text-slate-200">Barcode Scanner USB/BT</h4>
              <p className="text-[11px] text-slate-400">Kompatibel dengan semua barcode scanner fisik USB & wireless.</p>
            </div>

          </div>

        </div>
      </section>

      {/* 6. INTERACTIVE ROI & PROFIT CALCULATOR */}
      <section id="kalkulator" className="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulasi Penghematan & Profit</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            Berapa Banyak Waktu & Potensi Kebocoran Yang Dihindari?
          </h2>
        </div>

        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-8 shadow-2xl">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Slider 1: Transaksi Harian */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-300">Estimasi Transaksi Pembeli / Hari:</span>
                <span className="text-emerald-400 text-sm font-mono">{dailyTxCount} Transaksi</span>
              </div>
              <input
                type="range"
                min="10"
                max="300"
                step="5"
                value={dailyTxCount}
                onChange={(e) => setDailyTxCount(Number(e.target.value))}
                className="w-full accent-emerald-500 h-2 rounded-lg bg-slate-800 cursor-pointer"
              />
            </div>

            {/* Slider 2: Rata-Rata Keranjang */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs font-bold">
                <span className="text-slate-300">Rata-Rata Belanjaan per Nota:</span>
                <span className="text-amber-400 text-sm font-mono">Rp {avgBasketSize.toLocaleString('id-ID')}</span>
              </div>
              <input
                type="range"
                min="10000"
                max="200000"
                step="5000"
                value={avgBasketSize}
                onChange={(e) => setAvgBasketSize(Number(e.target.value))}
                className="w-full accent-amber-500 h-2 rounded-lg bg-slate-800 cursor-pointer"
              />
            </div>

          </div>

          {/* Calculated Results Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-800 text-center">
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
              <span className="text-[11px] text-slate-400">Estimasi Omset Bulanan</span>
              <div className="text-xl font-black text-slate-100 font-mono">
                Rp {monthlyOmset.toLocaleString('id-ID')}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-emerald-500/30 space-y-1">
              <span className="text-[11px] text-emerald-400 font-bold">Waktu Kasir Dihemat</span>
              <div className="text-xl font-black text-emerald-400 font-mono">
                ~{estimatedTimeSavedHours} Jam / Bulan
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-amber-500/30 space-y-1">
              <span className="text-[11px] text-amber-400 font-bold">Potensi Modal Kececer Dicegah</span>
              <div className="text-xl font-black text-amber-400 font-mono">
                Rp {estimatedLeakageSavings.toLocaleString('id-ID')} / Bln
              </div>
            </div>
          </div>

        </div>

      </section>

      {/* 7. PRICING & LICENSE PACKAGES */}
      <section id="harga" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pilihan Paket Lisensi Aplikasi</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-100">
            Lisensi Sekali Bayar Cuma Rp 99.000, Tanpa Biaya Bulanan!
          </h2>
          <p className="text-slate-400 text-sm">Promo spesial terbatas! Dapatkan akses seumur hidup untuk seluruh fitur kasir POS & AI Asisten.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8">
          
          {/* Package 1: Demo Free */}
          <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">Mode Coba</span>
                <h3 className="text-xl font-black text-slate-100">Paket Demo 6 Jam</h3>
                <p className="text-xs text-slate-400">Cocok untuk mencoba seluruh fitur aplikasi secara langsung.</p>
              </div>

              <div className="text-3xl font-black text-slate-100 font-mono">
                GRATIS
              </div>

              <ul className="space-y-2.5 text-xs text-slate-300">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" /> Masa aktif 6 jam penuh
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" /> Bebas tambah & edit produk dummy
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" /> Coba cetak nota Bluetooth
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" /> Fitur AI Asisten Sembako
                </li>
                <li className="flex items-center gap-2 text-slate-500">
                  ⚠️ Data otomatis di-reset setelah 6 jam
                </li>
              </ul>
            </div>

            <button
              onClick={handleStartDemo}
              className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-extrabold text-xs cursor-pointer transition-all"
            >
              Mulai Demo 6 Jam Gratis
            </button>
          </div>

          {/* Package 2: PRO AI SMART (BEST SELLER) */}
          <div className="p-8 rounded-3xl bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 border-2 border-emerald-500 space-y-6 flex flex-col justify-between relative shadow-2xl shadow-emerald-500/10">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-md whitespace-nowrap">
              ★ PROMO TERBAIK - CUMA 99RB SEKALI BAYAR ★
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider">Lifetime License</span>
                <h3 className="text-xl font-black text-slate-100">Paket Pro Smart AI</h3>
                <p className="text-xs text-slate-300">Solusi paling lengkap untuk toko sembako & grosir.</p>
              </div>

              <div className="space-y-1">
                <span className="text-xs text-slate-500 line-through">Rp 499.000</span>
                <div className="text-3xl font-black text-emerald-400 font-mono">
                  Rp 99.000 <span className="text-xs font-sans text-slate-400 font-normal">/ Sekali Bayar</span>
                </div>
                <p className="text-[11px] text-amber-300 font-bold">100% Bebas Biaya Bulanan / Tahunan!</p>
              </div>

              <ul className="space-y-2.5 text-xs text-slate-200">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Lisensi Aktif Permanen Selamanya
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Kasir POS & Scan Barcode Kamera HP
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Unlocked AI Asisten Sembako Smart
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Ekspor Laporan Excel (.xlsx) & PDF
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Peringatan Expired & Stok Kritis
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Cetak Struk Nota Bluetooth & PDF
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 font-bold" /> Pendampingan WA Support Gratis
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <a
                href="https://wa.me/6285187869164?text=Halo%20Admin%20Sembako%20Smart%20POS%20AI,%20saya%20ingin%20beli%20paket%20lisensi%2099rb"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 cursor-pointer transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4 fill-slate-950" />
                <span>Beli Lisensi 99rb via WhatsApp</span>
              </a>
              <button
                onClick={() => onNavigate('login')}
                className="w-full py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs cursor-pointer transition-all"
              >
                Login Ke Aplikasi
              </button>
            </div>
          </div>

        </div>

      </section>

      {/* 8. TESTIMONIALS */}
      <section id="testimoni" className="py-20 bg-slate-900/60 border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
          
          <div className="text-center space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
              Dipercaya Ratusan Pemilik Toko Sembako di Indonesia
            </h2>
            <p className="text-slate-400 text-sm">Inilah kata mereka setelah menggunakan Sembako Smart POS AI.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "Dulu setiap tutup toko malam-malam capek ngitung nota kertas. Sekarang tinggal klik, rekap laporan harian langsung otomatis dihitung akurat. Penjualan minyak & beras terpantau rapi!"
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  HB
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Haji Budi Santoso</div>
                  <div className="text-[10px] text-slate-400">Pemilik Toko Sembako Berkah (Jakarta)</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "Bagus banget ada peringatan barang kedaluwarsa. Jadi mie instan dan bumbu dapur yang mau expired bisa diselesaikan dulu. Tidak ada lagi stok terbuang rugi."
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  BR
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Ibu Rahmawati</div>
                  <div className="text-[10px] text-slate-400">Toko Kelontong Rahma (Surabaya)</div>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "Printer Bluetooth 58mm langsung terhubung lancar. Pembeli makin percaya karena ada nota resmi cetak. AI Asisten juga bantu kasih saran barang mana yang harus di-restock."
              </p>
              <div className="pt-2 border-t border-slate-800 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold text-xs">
                  JY
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200">Pak Joko Yulianto</div>
                  <div className="text-[10px] text-slate-400">Grosir Sembako Jaya (Bandung)</div>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 9. FAQ ACCORDION SECTION */}
      <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Pertanyaan Sering Diajukan</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-slate-100">
            Masih Punya Pertanyaan?
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = openFaqIndex === index;
            return (
              <div
                key={index}
                className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => toggleFaq(index)}
                  className="w-full p-5 text-left font-bold text-sm text-slate-200 flex items-center justify-between gap-4 cursor-pointer hover:text-amber-300"
                >
                  <span>{faq.q}</span>
                  {isOpen ? (
                    <ChevronUp className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </section>

      {/* 10. BOTTOM HERO CTA BANNER */}
      <section className="py-20 bg-gradient-to-tr from-emerald-950 via-slate-950 to-slate-900 border-t border-emerald-500/30 text-center relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Harga Promo Cuma Rp 99.000 Sekali Bayar Selamanya!</span>
          </div>
          <h2 className="text-3xl sm:text-5xl font-black text-slate-100">
            Siap Mengembangkan Toko Sembako Anda Hari Ini?
          </h2>
          <p className="text-slate-300 text-sm max-w-2xl mx-auto">
            Gunakan Sembako Smart POS AI sekarang. Coba mode demo 6 jam gratis atau hubungi WhatsApp Customer Support kami.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              onClick={handleStartDemo}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
            >
              <Clock className="w-5 h-5 text-slate-950" />
              <span>Coba Demo Instant (6 Jam Gratis)</span>
            </button>
            <a
              href="https://wa.me/6285187869164?text=Halo%20Admin%20Sembako%20Smart%20POS%20AI,%20saya%20ingin%20beli%20paket%20lisensi%2099rb"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-xl flex items-center justify-center gap-2 cursor-pointer transition-all hover:scale-105"
            >
              <MessageSquare className="w-5 h-5 fill-slate-950" />
              <span>Beli Lisensi 99rb via WhatsApp</span>
            </a>
          </div>
        </div>
      </section>

      {/* 11. FOOTER */}
      <footer className="py-10 bg-slate-950 border-t border-slate-800 text-center text-xs text-slate-500 space-y-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-slate-400">SEMBAKO SMART POS AI</span>
            </div>
            <span className="hidden sm:inline">•</span>
            <span>Customer Support: <a href="https://wa.me/6285187869164" target="_blank" rel="noopener noreferrer" className="text-emerald-400 font-bold hover:underline">Chat WhatsApp</a></span>
            <span className="hidden sm:inline">•</span>
            <span>Developed by <span className="font-bold text-slate-300">Smart AI Indonesia</span> (<a href="https://www.smart-ai.id" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">www.smart-ai.id</a>)</span>
          </div>
          <div className="flex items-center gap-6">
            <button onClick={() => onNavigate('landing')} className="hover:text-amber-400">Beranda</button>
            <button onClick={() => onNavigate('login')} className="hover:text-amber-400">Login Aplikasi</button>
            <button onClick={handleStartDemo} className="hover:text-amber-400">Mode Demo 6 Jam</button>
          </div>
        </div>
      </footer>

      {/* FLOATING WHATSAPP CUSTOMER SUPPORT BUTTON */}
      <a
        href="https://wa.me/6285187869164?text=Halo%20Admin%20Sembako%20Smart%20POS%20AI,%20saya%20ingin%20tanya%20paket%20lisensi%2099rb"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-2xl shadow-emerald-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-emerald-300"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950"></span>
        </span>
        <MessageSquare className="w-4 h-4 fill-slate-950" />
        <span>Chat WhatsApp</span>
      </a>

    </div>
  );
};
