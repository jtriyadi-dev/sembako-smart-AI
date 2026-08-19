import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { useToast } from '../context/ToastContext';
import { formatRupiah } from '../utils/formatters';
import { TransaksiItem, ProdukItem } from '../types';
import { subscribeTransactions } from '../services/transaksiService';
import { subscribeProducts } from '../services/productService';
import {
  exportLaporanRingkasanToPDF,
  exportLaporanRingkasanToExcel,
} from '../utils/exportUtils';
import { PrintReportModal } from '../components/laporan/PrintReportModal';
import { CardGridSkeleton } from '../components/SkeletonLoader';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  Calendar,
  Download,
  Printer,
  Sparkles,
  ArrowUpRight,
  ShoppingBag,
  PackageCheck,
  PackageX,
  CreditCard,
  QrCode,
  FileSpreadsheet,
  FileText,
  Filter,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
  Search,
  Tag,
  Boxes,
  Award,
} from 'lucide-react';

export const LaporanPage: React.FC = () => {
  const { success, warning, error: toastError, info } = useToast();

  // Firestore Subscriptions Data State
  const [transactions, setTransactions] = useState<TransaksiItem[]>([]);
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [presetDate, setPresetDate] = useState<'hari_ini' | '7_hari' | 'bulan_ini' | 'tahun_ini' | 'custom'>('bulan_ini');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('semua');

  // UI Active Tab
  const [activeTab, setActiveTab] = useState<'top_products' | 'metode' | 'stok_summary'>('top_products');

  // Print Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Subscribe to Transactions & Products in Realtime
  useEffect(() => {
    setIsLoading(true);

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 400);

    let untermTx: (() => void) | null = null;
    let untermProd: (() => void) | null = null;

    untermTx = subscribeTransactions(
      (data) => {
        setTransactions(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Laporan tx sub error:', err);
        setIsLoading(false);
      }
    );

    untermProd = subscribeProducts(
      (data) => {
        setProducts(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Laporan prod sub error:', err);
        setIsLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      if (untermTx) untermTx();
      if (untermProd) untermProd();
    };
  }, []);

  // Map product modal prices for fast HPP calculations
  const productPriceMap = useMemo(() => {
    const map = new Map<string, { hargaBeli: number; kategori: string }>();
    products.forEach((p) => {
      map.set(p.id, { hargaBeli: p.hargaBeli, kategori: p.kategori });
    });
    return map;
  }, [products]);

  // Unique categories list
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return Array.from(set);
  }, [products]);

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return transactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);

      let matchDate = true;
      if (presetDate === 'hari_ini') {
        matchDate = txDate >= today;
      } else if (presetDate === '7_hari') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(today.getDate() - 7);
        matchDate = txDate >= sevenDaysAgo;
      } else if (presetDate === 'bulan_ini') {
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        matchDate = txDate >= firstDayOfMonth;
      } else if (presetDate === 'tahun_ini') {
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        matchDate = txDate >= firstDayOfYear;
      } else if (presetDate === 'custom') {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          matchDate = matchDate && txDate >= start;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          matchDate = matchDate && txDate <= end;
        }
      }

      // Filter by category if specific category chosen
      let matchCat = true;
      if (selectedKategori !== 'semua') {
        matchCat = tx.items.some((i) => {
          const prodMeta = productPriceMap.get(i.produkId || '');
          return prodMeta?.kategori === selectedKategori;
        });
      }

      return matchDate && matchCat;
    });
  }, [transactions, presetDate, startDate, endDate, selectedKategori, productPriceMap]);

  // Valid (Non-Retur) Transactions
  const validTransactions = useMemo(() => {
    return filteredTransactions.filter((t) => t.statusPembayaran !== 'retur');
  }, [filteredTransactions]);

  // Calculate Key Financial Metrics
  const metrics = useMemo(() => {
    let totalOmset = 0;
    let totalHPP = 0;
    let totalQtyItem = 0;

    validTransactions.forEach((tx) => {
      const totalRefund = tx.totalRefund || 0;
      const netTxTotal = Math.max(0, tx.totalHarga - totalRefund);
      totalOmset += netTxTotal;

      tx.items.forEach((item) => {
        const returQty = item.returQty || 0;
        const activeQty = Math.max(0, item.jumlah - returQty);
        totalQtyItem += activeQty;
        const prodMeta = productPriceMap.get(item.produkId || '');
        const modalHarga = prodMeta ? prodMeta.hargaBeli : item.hargaJual * 0.85; // Fallback ~15% margin estimate
        totalHPP += activeQty * modalHarga;
      });
    });

    const totalLaba = totalOmset - totalHPP;
    const marginLaba = totalOmset > 0 ? (totalLaba / totalOmset) * 100 : 0;
    const totalTxCount = validTransactions.length;
    const avgBasketSize = totalTxCount > 0 ? totalOmset / totalTxCount : 0;
    const totalReturCount = filteredTransactions.filter((t) => t.statusPembayaran === 'retur').length;

    return {
      totalOmset,
      totalHPP,
      totalLaba,
      marginLaba,
      totalQtyItem,
      totalTxCount,
      avgBasketSize,
      totalReturCount,
    };
  }, [validTransactions, filteredTransactions, productPriceMap]);

  // Stock Inventory Metrics
  const stockMetrics = useMemo(() => {
    let totalUnitStok = 0;
    let totalNilaiAset = 0;
    let stokMenipisCount = 0;

    products.forEach((p) => {
      totalUnitStok += p.stok;
      totalNilaiAset += p.stok * p.hargaBeli;
      if (p.stok <= p.minStok) {
        stokMenipisCount += 1;
      }
    });

    return {
      totalProduk: products.length,
      totalUnitStok,
      totalNilaiAset,
      stokMenipisCount,
    };
  }, [products]);

  // Chart 1: Revenue & Profit Trend by Date
  const chartTrendData = useMemo(() => {
    const map = new Map<string, { dateLabel: string; omset: number; laba: number; txCount: number }>();

    validTransactions.forEach((tx) => {
      const d = new Date(tx.createdAt);
      const dateKey = d.toISOString().slice(0, 10);
      const dateLabel = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

      let hppTx = 0;
      tx.items.forEach((i) => {
        const prodMeta = productPriceMap.get(i.produkId || '');
        const modalHarga = prodMeta ? prodMeta.hargaBeli : i.hargaJual * 0.85;
        hppTx += i.jumlah * modalHarga;
      });
      const labaTx = tx.totalHarga - hppTx;

      if (!map.has(dateKey)) {
        map.set(dateKey, { dateLabel, omset: 0, laba: 0, txCount: 0 });
      }

      const cur = map.get(dateKey)!;
      cur.omset += tx.totalHarga;
      cur.laba += labaTx;
      cur.txCount += 1;
    });

    // Sort chronologically
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, val]) => val);
  }, [validTransactions, productPriceMap]);

  // Chart 2: Top Selling Products Ranking
  const topProductsList = useMemo(() => {
    const map = new Map<
      string,
      { id: string; nama: string; kode: string; terjual: number; satuan: string; omset: number; laba: number }
    >();

    validTransactions.forEach((tx) => {
      tx.items.forEach((item) => {
        const key = item.namaProduk;
        const prodMeta = productPriceMap.get(item.produkId || '');
        const modalHarga = prodMeta ? prodMeta.hargaBeli : item.hargaJual * 0.85;
        const itemOmset = item.subtotal;
        const itemLaba = itemOmset - item.jumlah * modalHarga;

        if (!map.has(key)) {
          map.set(key, {
            id: item.produkId || key,
            nama: item.namaProduk,
            kode: item.kodeProduk || 'SKU',
            terjual: 0,
            satuan: item.satuan,
            omset: 0,
            laba: 0,
          });
        }

        const cur = map.get(key)!;
        cur.terjual += item.jumlah;
        cur.omset += itemOmset;
        cur.laba += itemLaba;
      });
    });

    return Array.from(map.values()).sort((a, b) => b.terjual - a.terjual);
  }, [validTransactions, productPriceMap]);

  // Chart 3: Payment Method Distribution
  const paymentMethodChartData = useMemo(() => {
    const map = new Map<string, { name: string; value: number; count: number }>();

    validTransactions.forEach((tx) => {
      const method = tx.metodePembayaran.toUpperCase();
      if (!map.has(method)) {
        map.set(method, { name: method, value: 0, count: 0 });
      }
      const cur = map.get(method)!;
      cur.value += tx.totalHarga;
      cur.count += 1;
    });

    return Array.from(map.values());
  }, [validTransactions]);

  const PIE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'];

  // Periode Label Text Helper
  const periodeLabelText = useMemo(() => {
    if (presetDate === 'hari_ini') return 'Hari Ini';
    if (presetDate === '7_hari') return '7 Hari Terakhir';
    if (presetDate === 'bulan_ini') return 'Bulan Ini';
    if (presetDate === 'tahun_ini') return 'Tahun Ini';
    if (presetDate === 'custom') {
      return `${startDate || 'Awal'} s/d ${endDate || 'Sekarang'}`;
    }
    return 'Semua Periode';
  }, [presetDate, startDate, endDate]);

  // Prepared data for print modal / export
  const summaryForExport = useMemo(() => {
    return {
      periodeLabel: periodeLabelText,
      totalOmset: metrics.totalOmset,
      totalHPP: metrics.totalHPP,
      totalLaba: metrics.totalLaba,
      marginLaba: metrics.marginLaba,
      totalTxCount: metrics.totalTxCount,
      avgBasketSize: metrics.avgBasketSize,
      totalReturCount: metrics.totalReturCount,
      topProducts: topProductsList,
      stockMetrics,
    };
  }, [periodeLabelText, metrics, topProductsList, stockMetrics]);

  // Handlers
  const handleExportPDF = () => {
    if (validTransactions.length === 0) {
      warning('Data Kosong', 'Tidak ada data laporan untuk diekspor ke PDF.');
      return;
    }
    exportLaporanRingkasanToPDF(summaryForExport);
    success('Ekspor PDF Berhasil', 'Laporan Keuangan & Laba Rugi telah diunduh.');
  };

  const handleExportExcel = () => {
    if (validTransactions.length === 0) {
      warning('Data Kosong', 'Tidak ada data laporan untuk diekspor ke Excel.');
      return;
    }
    exportLaporanRingkasanToExcel(summaryForExport);
    success('Ekspor Excel Berhasil', 'File laporan (.xlsx) telah diunduh.');
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Page Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Laporan Keuangan & Laba Rugi Firestore</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
            Analisis & Performa Bisnis Sembako
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Grafik omzet real-time, estimasi margin laba kotor, produk terlaris, dan rekap aset stok toko.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Printer className="w-4 h-4 text-emerald-500" />
            <span>Cetak Ringkasan</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <FileText className="w-4 h-4 text-rose-500" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-emerald-500/20 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 flex-wrap">
          
          {/* Date Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 no-scrollbar">
            {[
              { id: 'hari_ini', label: 'Hari Ini' },
              { id: '7_hari', label: '7 Hari Terakhir' },
              { id: 'bulan_ini', label: 'Bulan Ini' },
              { id: 'tahun_ini', label: 'Tahun Ini' },
              { id: 'custom', label: 'Custom Range' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setPresetDate(p.id as any)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  presetDate === p.id
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Kategori:</span>
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer w-full sm:w-auto"
            >
              <option value="semua">Semua Kategori</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* Custom Range Inputs */}
        {presetDate === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3 text-xs"
          >
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-slate-500 font-bold">Mulai:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-slate-500 font-bold">Sampai:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
              />
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Omzet */}
        <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-xl space-y-2 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Omzet Penjualan</span>
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {formatRupiah(metrics.totalOmset)}
          </h3>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> {metrics.totalTxCount} Transaksi Berhasil
          </p>
        </div>

        {/* Total Laba Kotor */}
        <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Estimasi Laba Kotor</span>
            <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatRupiah(metrics.totalLaba)}
          </h3>
          <p className="text-[11px] text-amber-600 dark:text-amber-300 font-bold">
            Margin Keuntungan: {metrics.marginLaba.toFixed(1)}%
          </p>
        </div>

        {/* Modal HPP */}
        <div className="p-5 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total HPP (Modal Barang)</span>
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-800 dark:text-slate-200 font-mono">
            {formatRupiah(metrics.totalHPP)}
          </h3>
          <p className="text-[11px] text-slate-500">
            Rata-rata Keranjang: {formatRupiah(metrics.avgBasketSize)}
          </p>
        </div>

        {/* Stock & Assets Summary */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-950 text-white border border-amber-500/30 shadow-xl space-y-2">
          <div className="flex items-center justify-between text-amber-300">
            <span className="text-xs font-bold uppercase tracking-wider">Nilai Aset Stok Toko</span>
            <Boxes className="w-5 h-5" />
          </div>
          <h3 className="text-2xl font-black text-emerald-200 font-mono">
            {formatRupiah(stockMetrics.totalNilaiAset)}
          </h3>
          <p className="text-[11px] text-slate-300 flex items-center gap-1">
            <span>{stockMetrics.totalUnitStok} Unit stok</span> |
            <span className="text-rose-300 font-bold">{stockMetrics.stokMenipisCount} Kritis</span>
          </p>
        </div>

      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Revenue & Profit Trend Chart (Span 2) */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <span>Grafik Tren Omzet vs Laba Kotor</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualisasi fluktuasi pendapatan harian ({periodeLabelText})
              </p>
            </div>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {chartTrendData.length} Titik Data
            </span>
          </div>

          {isLoading ? (
            <div className="h-72 flex items-center justify-center">
              <CardGridSkeleton count={1} />
            </div>
          ) : chartTrendData.length === 0 ? (
            <div className="h-72 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-6 space-y-2">
              <BarChart3 className="w-10 h-10 text-slate-300 dark:text-slate-700" />
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                Belum Ada Data Transaksi untuk Periode Ini
              </p>
            </div>
          ) : (
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorOmset" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                    </linearGradient>
                    <linearGradient id="colorLaba" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                  <XAxis dataKey="dateLabel" tick={{ fontSize: 11 }} />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) => `Rp${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(val: any) => [formatRupiah(Number(val)), '']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '16px',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="omset"
                    name="Omzet Bruto"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#colorOmset)"
                  />
                  <Area
                    type="monotone"
                    dataKey="laba"
                    name="Laba Kotor"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorLaba)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Payment Methods Distribution Donut Chart */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-4">
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-500" />
              <span>Metode Pembayaran</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Proporsi tunai, QRIS & transfer
            </p>
          </div>

          {paymentMethodChartData.length === 0 ? (
            <div className="h-60 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center text-xs text-slate-400">
              Belum ada data pembayaran
            </div>
          ) : (
            <div className="h-60 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentMethodChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {paymentMethodChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [formatRupiah(Number(val)), 'Total']}
                    contentStyle={{
                      backgroundColor: 'rgba(15, 23, 42, 0.95)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Custom Legend Under Chart */}
              <div className="mt-2 space-y-1.5 text-xs">
                {paymentMethodChartData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                      ></div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-mono text-slate-500">{formatRupiah(item.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* AI Business Insights Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-900 via-emerald-800 to-slate-900 text-white border border-amber-500/30 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Smart AI Business Advisory</span>
          </div>
          <h3 className="text-base font-bold text-emerald-100">
            {topProductsList.length > 0
              ? `Produk "${topProductsList[0].nama}" Menjadi Top Driver Omzet Toko Anda!`
              : 'Siapkan Inventoris Sembako untuk Lonjakan Pembeli'}
          </h3>
          <p className="text-xs text-slate-300">
            {stockMetrics.stokMenipisCount > 0
              ? `Perhatian: Terdapat ${stockMetrics.stokMenipisCount} produk yang mendekati batas minimum stok. Disarankan segera melakukan Restok sebelum kehabisan.`
              : `Margin rata-rata sembako Anda sehat berada pada angka ${metrics.marginLaba.toFixed(1)}%. Tingkatkan penjualan item bundle/grosir.`}
          </p>
        </div>

        <button
          onClick={() => info('Analisis AI', 'Sistem Smart AI siap menghitung rekomendasi stok.')}
          className="px-4 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg whitespace-nowrap"
        >
          <Sparkles className="w-4 h-4 text-slate-950" />
          <span>Analisis Mendalam AI</span>
        </button>
      </div>

      {/* Tabbed Performance Detail Section */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl overflow-hidden">
        
        {/* Navigation Tab Header */}
        <div className="p-4 bg-slate-100/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'top_products', label: 'Top Produk Terlaris', icon: Award },
            { id: 'metode', label: 'Breakdown Metode Bayar', icon: CreditCard },
            { id: 'stok_summary', label: 'Ringkasan Stok Inventoris', icon: Boxes },
          ].map((tab) => {
            const IconComp = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                <IconComp className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content 1: Top Products */}
        {activeTab === 'top_products' && (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Produk Sembako</th>
                  <th className="px-4 py-3 text-center">Total Terjual</th>
                  <th className="px-4 py-3 text-right">Total Omzet</th>
                  <th className="px-4 py-3 text-right">Estimasi Laba Kotor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {topProductsList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Belum ada data produk terjual
                    </td>
                  </tr>
                ) : (
                  topProductsList.map((p, idx) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3 font-bold">
                        <span
                          className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-[11px] ${
                            idx === 0
                              ? 'bg-amber-400 text-slate-950 font-black'
                              : idx === 1
                              ? 'bg-slate-300 text-slate-900 font-bold'
                              : idx === 2
                              ? 'bg-amber-700 text-white font-bold'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-sans font-bold text-slate-800 dark:text-slate-200">
                        {p.nama}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {p.terjual} {p.satuan}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatRupiah(p.omset)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                        {formatRupiah(p.laba)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 2: Payment Methods */}
        {activeTab === 'metode' && (
          <div className="overflow-x-auto p-4">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Metode Pembayaran</th>
                  <th className="px-4 py-3 text-center">Jumlah Transaksi</th>
                  <th className="px-4 py-3 text-right">Total Nilai (Rp)</th>
                  <th className="px-4 py-3 text-right">Persentase Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                {paymentMethodChartData.map((m) => {
                  const sharePercent = metrics.totalOmset > 0 ? (m.value / metrics.totalOmset) * 100 : 0;
                  return (
                    <tr key={m.name} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                      <td className="px-4 py-3 font-sans font-bold text-slate-800 dark:text-slate-200 uppercase flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-emerald-500" />
                        <span>{m.name}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold">{m.count} TRX</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatRupiah(m.value)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-amber-600 dark:text-amber-400">
                        {sharePercent.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab Content 3: Stock Summary */}
        {activeTab === 'stok_summary' && (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Total SKU Terdaftar</span>
                <span className="text-xl font-black text-slate-900 dark:text-white font-mono">
                  {stockMetrics.totalProduk} Produk
                </span>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 block text-[10px]">Total Unit Fisik Stok</span>
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {stockMetrics.totalUnitStok} Unit
                </span>
              </div>

              <div className="p-4 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900/50">
                <span className="text-rose-600 dark:text-rose-400 block text-[10px] font-bold">
                  Stok Menipis / Kritis
                </span>
                <span className="text-xl font-black text-rose-600 dark:text-rose-400 font-mono">
                  {stockMetrics.stokMenipisCount} Produk
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Print Preview Modal */}
      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        summaryData={summaryForExport}
      />

    </div>
  );
};
