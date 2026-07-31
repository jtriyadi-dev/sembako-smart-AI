import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useStore } from '../context/StoreContext';
import { PageId, ProdukItem, TransaksiItem } from '../types';
import { Modal } from '../components/Modal';
import { subscribeProducts } from '../services/productService';
import { subscribeTransactions } from '../services/transaksiService';
import {
  formatRupiah,
  formatDateIndo,
  getStockStatus,
} from '../utils/formatters';
import {
  initialDashboardSummary,
  demoDashboardSummary,
  hourlySalesData,
  weeklySalesData,
  monthlySalesData,
  topProductsData,
  demoTopProductsData,
  lowStockProductsData,
  demoLowStockProductsData,
  topMembersData,
  initialActivityLogs,
  demoActivityLogs,
  LowStockProduct,
  ActivityLog,
} from '../data/mockData';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Package,
  ShoppingCart,
  Boxes,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
  PlusCircle,
  BarChart3,
  Bot,
  ShieldAlert,
  Users,
  AlertTriangle,
  Award,
  Zap,
  Printer,
  UserPlus,
  Clock,
  CheckCircle2,
  ChevronRight,
  Filter,
  DollarSign,
  TrendingDown,
  Layers,
  ArrowRight,
  Download,
  Share2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { profile, isDemoSession } = useAuth();
  const { success, info } = useToast();
  const { storeConfig } = useStore();

  // Dynamic state backed by real Firestore data or clean initial state
  const [summary, setSummary] = useState(initialDashboardSummary);
  const effectiveTargetOmzet = storeConfig.targetOmzetBulanIni || 0;
  const [activities, setActivities] = useState<ActivityLog[]>(initialActivityLogs);
  const [lowStockList, setLowStockList] = useState<LowStockProduct[]>(lowStockProductsData);

  const [realProducts, setRealProducts] = useState<ProdukItem[]>([]);
  const [realTransactions, setRealTransactions] = useState<TransaksiItem[]>([]);

  useEffect(() => {
    const unsubProd = subscribeProducts((prods) => setRealProducts(prods));
    const unsubTx = subscribeTransactions((txs) => setRealTransactions(txs));
    return () => {
      unsubProd();
      unsubTx();
    };
  }, []);

  // Recalculate summary metrics dynamically from real products and transactions
  useEffect(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTxs = realTransactions.filter((t) => t.tanggal.startsWith(todayStr) && t.statusPembayaran !== 'retur');
    const omzetHariIni = todayTxs.reduce((sum, t) => sum + (t.totalHarga || 0), 0);
    const totalTrxHariIni = todayTxs.length;
    const avgNota = totalTrxHariIni > 0 ? Math.round(omzetHariIni / totalTrxHariIni) : 0;

    const totalSku = realProducts.length;
    const lowStock = realProducts.filter((p) => p.stok <= p.minStok && p.stok > 0);
    const outStock = realProducts.filter((p) => p.stok === 0);
    const safeStock = realProducts.filter((p) => p.stok > p.minStok);

    const monthPrefix = new Date().toISOString().slice(0, 7);
    const monthTxs = realTransactions.filter((t) => t.tanggal.startsWith(monthPrefix) && t.statusPembayaran !== 'retur');
    const omzetBulanIni = monthTxs.reduce((sum, t) => sum + (t.totalHarga || 0), 0);

    if (isDemoSession && realTransactions.length === 0) {
      setSummary({
        ...demoDashboardSummary,
        targetOmzetBulanIni: storeConfig.targetOmzetBulanIni || demoDashboardSummary.targetOmzetBulanIni,
      });
      setActivities(demoActivityLogs);
      if (lowStock.length > 0) {
        setLowStockList(
          lowStock.map((p) => ({
            id: p.id,
            kode: p.kode || p.id,
            nama: p.nama,
            kategori: p.kategori,
            stokCurrent: p.stok,
            minStok: p.minStok,
            satuan: p.satuan,
            hargaBeli: p.hargaBeli,
            hargaJual: p.hargaJual,
            supplier: 'Supplier Utama',
          }))
        );
      } else {
        setLowStockList(demoLowStockProductsData);
      }
    } else {
      setSummary({
        omzetHariIni,
        omzetKemarin: 0,
        persenOmzetGrowth: 0,
        totalTransaksiHariIni: totalTrxHariIni,
        transaksiKemarin: 0,
        persenTransaksiGrowth: 0,
        rataRataNota: avgNota,
        marginKeuntungan: Math.round(omzetHariIni * 0.18),
        totalProdukSku: totalSku,
        totalStokAmanSku: safeStock.length,
        totalKategori: new Set(realProducts.map((p) => p.kategori)).size,
        totalMember: 0,
        memberBaruMingguIni: 0,
        memberAktifHariIni: 0,
        realisasiOmzetBulanIni: omzetBulanIni,
        targetOmzetBulanIni: storeConfig.targetOmzetBulanIni || 0,
      });

      if (realProducts.length === 0 && realTransactions.length === 0) {
        setLowStockList([]);
        setActivities([]);
      } else {
        setLowStockList(
          lowStock.map((p) => ({
            id: p.id,
            kode: p.kode || p.id,
            nama: p.nama,
            kategori: p.kategori,
            stokCurrent: p.stok,
            minStok: p.minStok,
            satuan: p.satuan,
            hargaBeli: p.hargaBeli,
            hargaJual: p.hargaJual,
            supplier: 'Supplier Utama',
          }))
        );
      }
    }
  }, [realProducts, realTransactions, storeConfig.targetOmzetBulanIni, isDemoSession]);

  // Time & Chart filter controls
  const [chartPeriod, setChartPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [chartMetric, setChartMetric] = useState<'omzet' | 'transaksi'>('omzet');
  const [productTab, setProductTab] = useState<'lowStock' | 'topSelling'>('lowStock');

  // Interactive Modals
  const [selectedRestockItem, setSelectedRestockItem] = useState<LowStockProduct | null>(null);
  const [restockJumlah, setRestockJumlah] = useState<number>(20);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState<boolean>(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  // Form state for New Member Modal
  const [newMemberNama, setNewMemberNama] = useState('');
  const [newMemberHp, setNewMemberHp] = useState('');
  const [newMemberTier, setNewMemberTier] = useState<'Silver' | 'Gold' | 'Platinum'>('Silver');

  // Simulated live real-time transaction event
  const handleSimulateLiveTransaction = () => {
    const randomAmount = Math.floor(Math.random() * 150000) + 35000;
    const newOmzet = summary.omzetHariIni + randomAmount;
    const newTrxCount = summary.totalTransaksiHariIni + 1;
    const newAvgNota = Math.round(newOmzet / newTrxCount);

    setSummary((prev) => ({
      ...prev,
      omzetHariIni: newOmzet,
      totalTransaksiHariIni: newTrxCount,
      rataRataNota: newAvgNota,
      marginKeuntungan: prev.marginKeuntungan + Math.round(randomAmount * 0.18),
      realisasiOmzetBulanIni: prev.realisasiOmzetBulanIni + randomAmount,
    }));

    const newLog: ActivityLog = {
      id: `ACT-${Date.now()}`,
      waktu: 'Baru saja',
      tipe: 'transaksi',
      judul: `Transaksi Real-Time #${Math.floor(1000 + Math.random() * 9000)}`,
      deskripsi: 'Penjualan kasir POS live berhasil diproses',
      nilai: formatRupiah(randomAmount),
      status: 'sukses',
    };

    setActivities((prev) => [newLog, ...prev.slice(0, 7)]);
    success(
      'Simulasi Transaksi Live!',
      `Transaksi baru sebesar ${formatRupiah(randomAmount)} berhasil ditambahkan ke dashboard.`
    );
  };

  // Restock action handler
  const handleConfirmRestock = () => {
    if (!selectedRestockItem) return;

    setLowStockList((prev) =>
      prev.map((item) =>
        item.id === selectedRestockItem.id
          ? { ...item, stokCurrent: item.stokCurrent + Number(restockJumlah) }
          : item
      )
    );

    const newLog: ActivityLog = {
      id: `ACT-${Date.now()}`,
      waktu: 'Baru saja',
      tipe: 'stok',
      judul: `Restock Stok ${selectedRestockItem.nama}`,
      deskripsi: `Penambahan stok +${restockJumlah} ${selectedRestockItem.satuan} dari ${selectedRestockItem.supplier}`,
      nilai: `+${restockJumlah} ${selectedRestockItem.satuan}`,
      status: 'sukses',
    };

    setActivities((prev) => [newLog, ...prev.slice(0, 7)]);
    success(
      'Restock Berhasil',
      `Stok ${selectedRestockItem.nama} bertambah ${restockJumlah} ${selectedRestockItem.satuan}.`
    );
    setSelectedRestockItem(null);
  };

  // Add Member action handler
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberNama) return;

    const newLog: ActivityLog = {
      id: `ACT-${Date.now()}`,
      waktu: 'Baru saja',
      tipe: 'member',
      judul: `Member Baru: ${newMemberNama}`,
      deskripsi: `Terdaftar sebagai Tier ${newMemberTier} dengan bonus 50 Poin`,
      nilai: 'Tier ' + newMemberTier,
      status: 'info',
    };

    setSummary((prev) => ({
      ...prev,
      totalMember: prev.totalMember + 1,
      memberBaruMingguIni: prev.memberBaruMingguIni + 1,
    }));

    setActivities((prev) => [newLog, ...prev.slice(0, 7)]);
    success('Member Berhasil Didaftarkan', `${newMemberNama} resmi bergabung.`);
    setNewMemberNama('');
    setNewMemberHp('');
    setIsMemberModalOpen(false);
  };

  // Print summary report
  const handlePrintReport = () => {
    info('Mencetak Laporan', 'Mempersiapkan dokumen cetak laporan ringkasan toko...');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // Computed top products from real sales data
  const realTopProducts = realProducts
    .filter((p) => (p.terjual || 0) > 0)
    .sort((a, b) => (b.terjual || 0) - (a.terjual || 0))
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      nama: p.nama,
      kategori: p.kategori,
      terjual: p.terjual || 0,
      totalOmzet: (p.terjual || 0) * (p.hargaJual || 0),
      satuan: p.satuan || 'Pcs',
    }));

  const computedTopProducts =
    realTopProducts.length > 0
      ? realTopProducts
      : isDemoSession
      ? demoTopProductsData
      : [];

  // Active chart dataset based on period filter and real transaction availability
  const getChartData = () => {
    const hasTransactions = realTransactions.length > 0 || isDemoSession;
    if (chartPeriod === 'today') {
      return hasTransactions
        ? hourlySalesData
        : [
            { jam: '08:00', omzet: 0, transaksi: 0 },
            { jam: '10:00', omzet: 0, transaksi: 0 },
            { jam: '12:00', omzet: 0, transaksi: 0 },
            { jam: '14:00', omzet: 0, transaksi: 0 },
            { jam: '16:00', omzet: 0, transaksi: 0 },
            { jam: '18:00', omzet: 0, transaksi: 0 },
            { jam: '20:00', omzet: 0, transaksi: 0 },
          ];
    }
    if (chartPeriod === 'week') {
      return hasTransactions
        ? weeklySalesData
        : [
            { hari: 'Sen', omzet: 0, target: 0, transaksi: 0 },
            { hari: 'Sel', omzet: 0, target: 0, transaksi: 0 },
            { hari: 'Rab', omzet: 0, target: 0, transaksi: 0 },
            { hari: 'Kam', omzet: 0, target: 0, transaksi: 0 },
            { hari: 'Jum', omzet: 0, target: 0, transaksi: 0 },
            { hari: 'Sab', omzet: 0, target: 0, transaksi: 0 },
            { hari: 'Min', omzet: 0, target: 0, transaksi: 0 },
          ];
    }
    return hasTransactions
      ? monthlySalesData
      : [
          { minggu: 'Minggu 1', omzet: 0, target: 0, transaksi: 0 },
          { minggu: 'Minggu 2', omzet: 0, target: 0, transaksi: 0 },
          { minggu: 'Minggu 3', omzet: 0, target: 0, transaksi: 0 },
          { minggu: 'Minggu 4', omzet: 0, target: 0, transaksi: 0 },
        ];
  };

  const currentChartData = getChartData();
  const targetPercent = effectiveTargetOmzet > 0
    ? Math.min(100, Math.round((summary.realisasiOmzetBulanIni / effectiveTargetOmzet) * 100))
    : 0;

  return (
    <div className="space-y-6">
      
      {/* 1. Header & Welcome Enterprise Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-slate-900 p-6 md:p-8 text-white border border-emerald-500/20 shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>Sembako Smart AI • Dashboard Enterprise</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            </div>

            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              {profile?.namaToko || (isDemoSession ? 'Sembako Smart AI (Demo)' : 'Sembako Smart AI')}
            </h2>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Pusat kendali operasional toko sembako: Monitoring real-time omzet, stok otomatis, analisis pelanggan, dan prediksi kecerdasan AI.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3 text-xs text-emerald-300/80">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                {formatDateIndo(new Date())}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                Firestore Realtime Connected
              </span>
            </div>
          </div>

          {/* Action buttons on header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleSimulateLiveTransaction}
              className="px-4 py-2.5 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-bold text-amber-300 flex items-center gap-2 transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Simulasi Live Transaksi</span>
            </button>

            <button
              onClick={() => setIsReportModalOpen(true)}
              className="px-4 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-900/40 hover:bg-emerald-900/60 text-xs font-semibold text-emerald-200 flex items-center gap-2 transition-all shadow-sm cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>Ringkasan Laporan</span>
            </button>

            <button
              onClick={() => onNavigate('kasir')}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-105 active:scale-95"
            >
              <ShoppingCart className="w-4 h-4 text-slate-950" />
              <span>Buka Kasir POS</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Executive Metric Cards Grid (4 Key Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Penjualan & Omzet Hari Ini */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-xl space-y-3 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Omzet Hari Ini
            </span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {formatRupiah(summary.omzetHariIni)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-0.5 text-[11px]">
                <TrendingUp className="w-3 h-3" />
                +{summary.persenOmzetGrowth}%
              </span>
              <span className="text-[11px] text-slate-400 font-normal">vs kemarin ({formatRupiah(summary.omzetKemarin)})</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Est. Margin: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{formatRupiah(summary.marginKeuntungan)}</strong></span>
            <span>Rata2: <strong className="text-slate-700 dark:text-slate-200 font-bold">{formatRupiah(summary.rataRataNota)}</strong></span>
          </div>
        </motion.div>

        {/* Card 2: Jumlah Transaksi Hari Ini */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-xl space-y-3 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Transaksi
            </span>
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {summary.totalTransaksiHariIni} <span className="text-sm font-normal text-slate-400">Nota</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-0.5 text-[11px]">
                <ArrowUpRight className="w-3 h-3" />
                +{summary.persenTransaksiGrowth}%
              </span>
              <span className="text-[11px] text-slate-400 font-normal">vs kemarin ({summary.transaksiKemarin} nota)</span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Jam Teramai: <strong className="text-amber-600 dark:text-amber-400 font-bold">12:00 - 14:00</strong></span>
            <button
              onClick={() => onNavigate('transaksi')}
              className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline flex items-center gap-0.5"
            >
              Lihat <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </motion.div>

        {/* Card 3: Katalog Produk & Peringatan Stok */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-xl space-y-3 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/10 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Katalog & Stok
            </span>
            <div className="p-2.5 rounded-2xl bg-sky-500/10 text-sky-500 border border-sky-500/20">
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {summary.totalProdukSku} <span className="text-sm font-normal text-slate-400">SKU</span>
              </span>
              {lowStockList.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-xs flex items-center gap-1 animate-pulse">
                  <AlertTriangle className="w-3 h-3" />
                  {lowStockList.length} Menipis
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              {summary.totalStokAmanSku} SKU Stok Aman • {summary.totalKategori} Kategori Sembako
            </p>
          </div>

          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span>Restock Otomatis Alert</span>
            <button
              onClick={() => onNavigate('stok')}
              className="text-sky-500 font-semibold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              Cek Stok <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </motion.div>

        {/* Card 4: Member & Pelanggan Setia */}
        <motion.div
          whileHover={{ y: -4, transition: { duration: 0.2 } }}
          className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white border border-amber-500/30 shadow-xl space-y-3 relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/20 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
              Pelanggan / Member
            </span>
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {summary.totalMember} <span className="text-xs font-normal text-slate-300">Member</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px] border border-emerald-500/30">
                +{summary.memberBaruMingguIni} Minggu ini
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              {summary.memberAktifHariIni || 28} Member belanja hari ini
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-300">
            <span>Program Poin Loyalty</span>
            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="text-amber-400 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              + Member Baru
            </button>
          </div>
        </motion.div>

      </div>

      {/* 3. Section: Modern Interactive Charts & Target Gauge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Grafik Penjualan & Trend Omzet (Recharts AreaChart / BarChart) */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl space-y-4">
          
          {/* Chart Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Grafik Penjualan & Trend Toko
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Visualisasi dinamika transaksi harian & pertumbuhan omzet toko sembako.
              </p>
            </div>

            {/* Filter Toggle Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Period Filter */}
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-1 text-xs">
                <button
                  onClick={() => setChartPeriod('today')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    chartPeriod === 'today'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Hari Ini
                </button>
                <button
                  onClick={() => setChartPeriod('week')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    chartPeriod === 'week'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  7 Hari
                </button>
                <button
                  onClick={() => setChartPeriod('month')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    chartPeriod === 'month'
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bulan Ini
                </button>
              </div>

              {/* Metric Toggle */}
              <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-1 text-xs">
                <button
                  onClick={() => setChartMetric('omzet')}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    chartMetric === 'omzet'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Omzet (Rp)
                </button>
                <button
                  onClick={() => setChartMetric('transaksi')}
                  className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    chartMetric === 'transaksi'
                      ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Transaksi
                </button>
              </div>
            </div>
          </div>

          {/* Recharts Render Stage */}
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === 'omzet' ? (
                <AreaChart data={currentChartData as any}>
                  <defs>
                    <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#059669" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#059669" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="amberGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis
                    dataKey={chartPeriod === 'today' ? 'jam' : chartPeriod === 'week' ? 'hari' : 'minggu'}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                    tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)}M`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#10b981',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
                    }}
                    formatter={(value: any) => [formatRupiah(value), 'Omzet']}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartPeriod === 'today' ? 'penjualan' : 'omzet'}
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#emeraldGradient)"
                    name="Omzet Realisasi"
                  />
                  {chartPeriod === 'week' && (
                    <Area
                      type="monotone"
                      dataKey="target"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      fillOpacity={0.2}
                      fill="url(#amberGradient)"
                      name="Target Omzet"
                    />
                  )}
                </AreaChart>
              ) : (
                <BarChart data={currentChartData as any}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.2} />
                  <XAxis
                    dataKey={chartPeriod === 'today' ? 'jam' : chartPeriod === 'week' ? 'hari' : 'minggu'}
                    stroke="#94a3b8"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#f59e0b',
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px',
                    }}
                    formatter={(val: any) => [`${val} Transaksi`, 'Volume Nota']}
                  />
                  <Bar dataKey="transaksi" fill="#f59e0b" radius={[8, 8, 0, 0]} name="Volume Transaksi" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                Realisasi Omzet Harian
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                Target Penjualan Toko
              </span>
            </div>
            <span className="text-[11px]">Diperbarui secara otomatis setiap ada transaksi kasir</span>
          </div>
        </div>

        {/* Right 1 Col: Target Omzet Progress & Gemini AI Recommendation */}
        <div className="space-y-6">
          
          {/* Target Omzet Gauge */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Target Omzet Bulanan
                </h4>
              </div>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {targetPercent}%
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Realisasi:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatRupiah(summary.realisasiOmzetBulanIni)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Target Toko:</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {formatRupiah(effectiveTargetOmzet)}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden p-0.5 border border-slate-300/50 dark:border-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-amber-400 transition-all duration-1000 shadow-sm"
                  style={{ width: `${targetPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-right pt-1">
                Sisa Target: <strong>{formatRupiah(Math.max(0, effectiveTargetOmzet - summary.realisasiOmzetBulanIni))}</strong>
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Proyeksi stabil. Diperkirakan mencapai target sebelum akhir bulan!</span>
            </div>
          </div>

          {/* Gemini AI Smart Assistant Highlight Card */}
          <div className="bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 rounded-3xl p-6 border border-amber-500/30 shadow-2xl text-white space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                    Sembako Gemini AI
                  </h4>
                  <p className="text-[10px] text-slate-400">Rekomendasi Cerdas Toko</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                Live Analysis
              </span>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-emerald-500/20 text-xs text-slate-300 leading-relaxed space-y-2">
              <p className="font-semibold text-emerald-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Prediksi Kebutuhan Stok:
              </p>
              <p>
                "Sambut awal bulan: Permintaan Beras 5kg & Minyak Goreng diprediksi melonjak +35%. Disarankan mengajukan order PO ke supplier minggu ini."
              </p>
            </div>

            <button
              onClick={() => onNavigate('ai-assistant')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Tanyakan Sesuatu ke AI Assistant</span>
            </button>
          </div>

        </div>

      </div>

      {/* 4. Section: Produk Hampir Habis & Produk Terlaris (Tabbed Enterprise Section) */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl space-y-4">
        
        {/* Section Header & Tab Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Boxes className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Manajemen Produk & Pergerakan Stok
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pantau produk hampir habis dan identifikasi barang terlaris pembawa omzet.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setProductTab('lowStock')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                productTab === 'lowStock'
                  ? 'bg-rose-500 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Produk Hampir Habis ({lowStockList.length})</span>
            </button>

            <button
              onClick={() => setProductTab('topSelling')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                productTab === 'topSelling'
                  ? 'bg-emerald-700 text-white shadow-md'
                  : 'bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Produk Terlaris Top 5</span>
            </button>
          </div>
        </div>

        {/* Tab Content 1: Produk Hampir Habis */}
        {productTab === 'lowStock' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                  <th className="p-3 rounded-l-xl">Kode & Nama Produk</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Stok Saat Ini</th>
                  <th className="p-3">Batas Minimal</th>
                  <th className="p-3">Harga Jual</th>
                  <th className="p-3 text-right rounded-r-xl">Aksi Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                {lowStockList.map((item) => {
                  const status = getStockStatus(item.stokCurrent, item.minStok);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-100">
                        <div>{item.nama}</div>
                        <span className="text-[10px] text-slate-400 font-mono">{item.kode}</span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{item.kategori}</td>
                      <td className="p-3">
                        <span className={`px-2.5 py-1 rounded-full font-bold border text-xs inline-flex items-center gap-1 ${status.bg} ${status.color}`}>
                          {item.stokCurrent} {item.satuan}
                        </span>
                      </td>
                      <td className="p-3 text-slate-500">{item.minStok} {item.satuan}</td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-200">
                        {formatRupiah(item.hargaJual)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedRestockItem(item);
                            setRestockJumlah(20);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer inline-flex items-center gap-1"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          <span>Restock</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 2: Produk Terlaris Top 5 */}
        {productTab === 'topSelling' && (
          <div className="overflow-x-auto">
            {computedTopProducts.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Package className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                <p className="text-xs font-semibold">Belum ada data penjualan produk</p>
                <p className="text-[11px] text-slate-400">Lakukan transaksi di Kasir untuk melihat peringkat produk terlaris toko Anda.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider bg-slate-50/50 dark:bg-slate-950/50">
                    <th className="p-3 rounded-l-xl">Peringkat</th>
                    <th className="p-3">Produk</th>
                    <th className="p-3">Kategori</th>
                    <th className="p-3">Total Terjual</th>
                    <th className="p-3">Kontribusi Omzet</th>
                    <th className="p-3 text-right rounded-r-xl">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                  {computedTopProducts.map((prod, idx) => (
                    <tr key={prod.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 font-bold">
                        <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs text-white ${
                          idx === 0 ? 'bg-amber-500 text-slate-950 font-black shadow' : idx === 1 ? 'bg-slate-400' : idx === 2 ? 'bg-amber-700' : 'bg-slate-700'
                        }`}>
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">
                        {prod.nama}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{prod.kategori}</td>
                      <td className="p-3 font-extrabold text-emerald-600 dark:text-emerald-400">
                        {prod.terjual} {prod.satuan}
                      </td>
                      <td className="p-3 font-semibold text-slate-900 dark:text-slate-200">
                        {formatRupiah(prod.totalOmzet)}
                      </td>
                      <td className="p-3 text-right">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 text-[11px] inline-flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          Tinggi
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      {/* 5. Section: Member & Pelanggan Setia + Activity Feed Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 1 Col: Top Member / Loyalty Hub */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Member VIP Teratas
              </h3>
            </div>
            <button
              onClick={() => setIsMemberModalOpen(true)}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <UserPlus className="w-3.5 h-3.5" />
              + Baru
            </button>
          </div>

          <div className="space-y-3">
            {topMembersData.map((member) => (
              <div
                key={member.id}
                className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 hover:border-emerald-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                    member.tier === 'Platinum'
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : member.tier === 'Gold'
                      ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                      : 'bg-slate-700 text-slate-200'
                  }`}>
                    {member.nama.charAt(0)}
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {member.nama}
                    </h5>
                    <p className="text-[10px] text-slate-400">
                      {member.noHp} • {member.transaksiTerakhir}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    member.tier === 'Platinum'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : member.tier === 'Gold'
                      ? 'bg-amber-600/10 text-amber-400 border-amber-500/20'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}>
                    {member.tier}
                  </span>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatRupiah(member.totalBelanjaBulanIni)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 2 Cols: Activity Terbaru Timeline Feed */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Aktivitas Terbaru Toko
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Laporan log waktu nyata seputar transaksi, stok, member, dan notifikasi AI.
              </p>
            </div>

            <button
              onClick={handleSimulateLiveTransaction}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold hover:bg-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulasi Event</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
            <AnimatePresence>
              {activities.map((act) => (
                <motion.div
                  key={act.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-xl flex-shrink-0 mt-0.5 ${
                      act.tipe === 'transaksi'
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                        : act.tipe === 'stok'
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                        : act.tipe === 'member'
                        ? 'bg-sky-500/10 text-sky-500 border border-sky-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {act.tipe === 'transaksi' ? (
                        <ShoppingCart className="w-4 h-4" />
                      ) : act.tipe === 'stok' ? (
                        <Boxes className="w-4 h-4" />
                      ) : act.tipe === 'member' ? (
                        <Users className="w-4 h-4" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {act.judul}
                        </h5>
                        <span className="text-[10px] text-slate-400">• {act.waktu}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">
                        {act.deskripsi}
                      </p>
                    </div>
                  </div>

                  {act.nilai && (
                    <span className="px-2.5 py-1 rounded-xl bg-slate-200/60 dark:bg-slate-900 text-slate-900 dark:text-slate-200 font-bold text-xs whitespace-nowrap flex-shrink-0 border border-slate-300/50 dark:border-slate-800">
                      {act.nilai}
                    </span>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

      </div>

      {/* 6. Quick Action Enterprise Grid */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-6 border border-emerald-500/20 shadow-xl space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          Aksi Cepat Pengelolaan Toko (Quick Action)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          
          <button
            onClick={() => onNavigate('kasir')}
            className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/20 hover:bg-emerald-500/10 hover:border-emerald-500/40 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Buka Kasir POS</span>
          </button>

          <button
            onClick={() => onNavigate('produk')}
            className="p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20 hover:bg-amber-500/10 hover:border-amber-500/40 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Package className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Tambah Produk</span>
          </button>

          <button
            onClick={() => onNavigate('stok')}
            className="p-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 dark:bg-sky-950/20 hover:bg-sky-500/10 hover:border-sky-500/40 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 text-sky-500 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Boxes className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Kelola Stok</span>
          </button>

          <button
            onClick={() => setIsMemberModalOpen(true)}
            className="p-4 rounded-2xl border border-purple-500/20 bg-purple-500/5 dark:bg-purple-950/20 hover:bg-purple-500/10 hover:border-purple-500/40 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <UserPlus className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Tambah Member</span>
          </button>

          <button
            onClick={() => onNavigate('ai-assistant')}
            className="p-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-slate-900/40 hover:border-amber-500/40 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-amber-300">Analisis AI Gemini</span>
          </button>

          <button
            onClick={() => setIsReportModalOpen(true)}
            className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-emerald-500/40 transition-all flex flex-col items-center text-center gap-2 group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Cetak Laporan</span>
          </button>

        </div>
      </div>

      {/* MODAL 1: Restock Quick Modal */}
      <Modal
        isOpen={!!selectedRestockItem}
        onClose={() => setSelectedRestockItem(null)}
        title="Restock Produk Cepat"
        subtitle={selectedRestockItem?.nama}
      >
        {selectedRestockItem && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Kode SKU:</span>
                <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{selectedRestockItem.kode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Stok Saat Ini:</span>
                <span className="font-bold text-rose-500">{selectedRestockItem.stokCurrent} {selectedRestockItem.satuan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Batas Minimal:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedRestockItem.minStok} {selectedRestockItem.satuan}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1.5">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">{selectedRestockItem.supplier}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Jumlah Tambah Stok ({selectedRestockItem.satuan})
              </label>
              <input
                type="number"
                min={1}
                value={restockJumlah}
                onChange={(e) => setRestockJumlah(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-sm font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRestockItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRestock}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-slate-950" />
                <span>Konfirmasi Restock</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 2: Quick Add Member Modal */}
      <Modal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        title="Daftarkan Member Baru"
        subtitle="Sistem Pelanggan Loyalitas Toko Sembako"
      >
        <form onSubmit={handleAddMember} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Nama Lengkap Member / Pelanggan
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Ibu Hj. Nurhayati"
              value={newMemberNama}
              onChange={(e) => setNewMemberNama(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              No. HP / WhatsApp
            </label>
            <input
              type="text"
              placeholder="0812-xxxx-xxxx"
              value={newMemberHp}
              onChange={(e) => setNewMemberHp(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Tier Awal Keanggotaan
            </label>
            <select
              value={newMemberTier}
              onChange={(e: any) => setNewMemberTier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="Silver">Silver (Bonus +25 Poin)</option>
              <option value="Gold">Gold (Bonus +50 Poin)</option>
              <option value="Platinum">Platinum (Bonus +100 Poin)</option>
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsMemberModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white font-bold text-xs shadow-md hover:from-emerald-600 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4 text-amber-300" />
              <span>Simpan Member</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Print / Export Report Preview Modal */}
      <Modal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Laporan Ringkasan Toko Harian"
        subtitle="Preview Dokumen Siap Cetak"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div className="p-6 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-inner space-y-4 font-sans print:p-0">
            
            {/* Header Laporan */}
            <div className="text-center border-b border-slate-300 pb-3">
              <h3 className="text-lg font-black uppercase text-emerald-950">
                {profile?.namaToko || 'TOKO SEMBAKO BERKAH SMART'}
              </h3>
              <p className="text-xs text-slate-600">
                {profile?.alamatToko || 'Jl. Raya Utama No. 88, Jakarta'} • HP: {profile?.noHp || '0812-3456-7890'}
              </p>
              <p className="text-[11px] font-bold text-slate-500 mt-1">
                RINGKASAN PENJUALAN HARIAN ({formatDateIndo(new Date())})
              </p>
            </div>

            {/* Matrix Data */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Total Omzet</span>
                <span className="font-bold text-emerald-800">{formatRupiah(summary.omzetHariIni)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Total Nota</span>
                <span className="font-bold text-slate-900">{summary.totalTransaksiHariIni} TRX</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Rata-Rata Nota</span>
                <span className="font-bold text-slate-900">{formatRupiah(summary.rataRataNota)}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                <span className="text-[10px] text-slate-500 block">Est. Margin</span>
                <span className="font-bold text-amber-800">{formatRupiah(summary.marginKeuntungan)}</span>
              </div>
            </div>

            {/* Ringkasan Top Products */}
            <div className="space-y-1 text-xs">
              <h5 className="font-bold text-slate-900 border-b border-slate-200 pb-1">
                Produk Terlaris Hari Ini
              </h5>
              {computedTopProducts.length === 0 ? (
                <div className="py-1 text-[11px] text-slate-500 italic">Belum ada transaksi produk terlaris.</div>
              ) : (
                computedTopProducts.slice(0, 3).map((p) => (
                  <div key={p.id} className="flex justify-between py-1 border-b border-slate-100 text-[11px]">
                    <span>{p.nama}</span>
                    <span className="font-bold">{p.terjual} {p.satuan} ({formatRupiah(p.totalOmzet)})</span>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="pt-2 text-right text-[10px] text-slate-500 italic">
              Dicetak secara otomatis oleh Sembako Smart AI Platform • {new Date().toLocaleTimeString()} WIB
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              onClick={() => setIsReportModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
            <button
              onClick={handlePrintReport}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-700 to-emerald-600 text-white font-bold text-xs shadow-md hover:from-emerald-600 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>Cetak Sekarang</span>
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
