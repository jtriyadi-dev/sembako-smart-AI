import React, { useState, useEffect, useMemo } from 'react';
import { ProdukItem, StockMovement, StockOpname, MovementType, SupplierItem } from '../types';
import { subscribeProducts } from '../services/productService';
import { subscribeSuppliers } from '../services/supplierService';
import { KATEGORI_LIST } from '../components/ProductFormModal';
import { 
  subscribeStockMovements, 
  recordStockMovement, 
  subscribeStockOpnames, 
  recordStockOpname 
} from '../services/stockService';
import { StockMovementModal } from '../components/StockMovementModal';
import { StockOpnameModal } from '../components/StockOpnameModal';
import { WhatsAppIntegrationModal } from '../components/WhatsAppIntegrationModal';
import { TableSkeleton } from '../components/SkeletonLoader';
import { useToast } from '../context/ToastContext';
import {
  Boxes,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  ArrowDownRight,
  ArrowUpRight,
  SlidersHorizontal,
  ClipboardCheck,
  Calendar,
  Clock,
  Package,
  Truck,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  History,
  Tag,
  DollarSign,
  ArrowUpDown,
  Sparkles,
  MessageSquare
} from 'lucide-react';

export const StokPage: React.FC = () => {
  const { success, error: toastError, info, warning } = useToast();

  // Firestore Realtime Subscriptions
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [opnames, setOpnames] = useState<StockOpname[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Main Sub-Tab
  const [activeTab, setActiveTab] = useState<'katalog' | 'history' | 'opname' | 'expired'>('katalog');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStockStatus, setFilterStockStatus] = useState<'semua' | 'aman' | 'menipis' | 'habis' | 'expired'>('semua');
  const [filterMovementType, setFilterMovementType] = useState<'semua' | MovementType>('semua');
  const [selectedKategori, setSelectedKategori] = useState('Semua');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal States
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [isOpnameModalOpen, setIsOpnameModalOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
  const [waModalTab, setWaModalTab] = useState<'input' | 'cek' | 'notif'>('input');
  const [selectedProductForAction, setSelectedProductForAction] = useState<ProdukItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe Realtime Firestore
  useEffect(() => {
    setIsLoading(true);

    const unsubProducts = subscribeProducts(
      (data) => setProducts(data),
      (err) => console.error('Products sub error:', err)
    );

    const unsubMovements = subscribeStockMovements(
      (data) => setMovements(data),
      (err) => console.error('Movements sub error:', err)
    );

    const unsubOpnames = subscribeStockOpnames(
      (data) => {
        setOpnames(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Opnames sub error:', err);
        setIsLoading(false);
      }
    );

    const unsubSuppliers = subscribeSuppliers((data) => setSuppliers(data));

    return () => {
      unsubProducts();
      unsubSuppliers();
      unsubMovements();
      unsubOpnames();
    };
  }, []);

  // Reset page when switching tabs or filters
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchQuery, filterStockStatus, filterMovementType, selectedKategori, itemsPerPage]);

  // Today ISO Date string for expired calculations
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Helper to calculate expiry days remaining
  const getExpiryStatus = (expiredDateStr?: string) => {
    if (!expiredDateStr) return { status: 'none', label: 'Belum diatur', days: 999 };
    const expDate = new Date(expiredDateStr);
    const today = new Date(todayStr);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { status: 'expired', label: `Kadaluarsa (${Math.abs(diffDays)} hari lalu)`, days: diffDays };
    } else if (diffDays <= 7) {
      return { status: 'kritis', label: `Kritis (${diffDays} hari lagi)`, days: diffDays };
    } else if (diffDays <= 30) {
      return { status: 'waspada', label: `Mendekati (${diffDays} hari lagi)`, days: diffDays };
    } else {
      return { status: 'aman', label: `Aman (${diffDays} hari lagi)`, days: diffDays };
    }
  };

  // Stock Summary Statistics
  const stats = useMemo(() => {
    const totalSku = products.length;
    const totalNilaiStok = products.reduce((acc, p) => acc + p.hargaBeli * p.stok, 0);
    const totalAman = products.filter((p) => p.stok > p.minStok).length;
    const totalMenipis = products.filter((p) => p.stok <= p.minStok && p.stok > 0).length;
    const totalHabis = products.filter((p) => p.stok === 0).length;

    const totalExpired = products.filter((p) => {
      if (!p.expiredDate) return false;
      const st = getExpiryStatus(p.expiredDate).status;
      return st === 'expired' || st === 'kritis' || st === 'waspada';
    }).length;

    return {
      totalSku,
      totalNilaiStok,
      totalAman,
      totalMenipis,
      totalHabis,
      totalExpired,
    };
  }, [products, todayStr]);

  // Dynamic Categories list
  const availableCategories = useMemo(() => {
    const set = new Set<string>(KATEGORI_LIST);
    products.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Filtered Products List
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        p.nama.toLowerCase().includes(q) ||
        p.kode.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)) ||
        p.kategori.toLowerCase().includes(q);

      const matchesCat = selectedKategori === 'Semua' || p.kategori === selectedKategori;

      let matchesStatus = true;
      if (filterStockStatus === 'aman') matchesStatus = p.stok > p.minStok;
      if (filterStockStatus === 'menipis') matchesStatus = p.stok <= p.minStok && p.stok > 0;
      if (filterStockStatus === 'habis') matchesStatus = p.stok === 0;
      if (filterStockStatus === 'expired') {
        const expSt = getExpiryStatus(p.expiredDate).status;
        matchesStatus = expSt === 'expired' || expSt === 'kritis' || expSt === 'waspada';
      }

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [products, searchQuery, selectedKategori, filterStockStatus]);

  // Filtered Movement Logs
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        m.namaProduk.toLowerCase().includes(q) ||
        m.kodeProduk.toLowerCase().includes(q) ||
        m.keterangan.toLowerCase().includes(q) ||
        (m.supplier && m.supplier.toLowerCase().includes(q));

      const matchesType = filterMovementType === 'semua' || m.tipe === filterMovementType;

      return matchesSearch && matchesType;
    });
  }, [movements, searchQuery, filterMovementType]);

  // Filtered Stock Opnames
  const filteredOpnames = useMemo(() => {
    return opnames.filter((o) => {
      const q = searchQuery.toLowerCase().trim();
      return (
        !q ||
        o.namaProduk.toLowerCase().includes(q) ||
        o.kodeProduk.toLowerCase().includes(q) ||
        o.alasan.toLowerCase().includes(q)
      );
    });
  }, [opnames, searchQuery]);

  // Expired Products Focus View
  const expiredProducts = useMemo(() => {
    return products
      .filter((p) => p.expiredDate)
      .map((p) => ({
        ...p,
        expiryInfo: getExpiryStatus(p.expiredDate),
      }))
      .sort((a, b) => a.expiryInfo.days - b.expiryInfo.days);
  }, [products, todayStr]);

  // Handlers for Movement Submission
  const handleMovementSubmit = async (params: {
    product: ProdukItem;
    tipe: MovementType;
    jumlah: number;
    keterangan: string;
    supplier?: string;
    expiredDate?: string;
    batchNo?: string;
  }) => {
    setIsSubmitting(true);
    try {
      await recordStockMovement(params);
      success(
        'Mutasi Stok Berhasil',
        `Stok ${params.tipe === 'masuk' ? 'masuk' : params.tipe === 'keluar' ? 'keluar' : 'penyesuaian'} "${params.product.nama}" berhasil diperbarui.`
      );
      setIsMovementModalOpen(false);
      setSelectedProductForAction(null);
    } catch (err) {
      toastError('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan mutasi stok.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handlers for Opname Submission
  const handleOpnameSubmit = async (params: {
    product: ProdukItem;
    stokFisik: number;
    alasan: string;
  }) => {
    setIsSubmitting(true);
    try {
      await recordStockOpname(params);
      success(
        'Stock Opname Disimpan',
        `Hasil audit fisik "${params.product.nama}" telah disinkronkan ke Firestore.`
      );
      setIsOpnameModalOpen(false);
      setSelectedProductForAction(null);
    } catch (err) {
      toastError('Gagal Audit', 'Terjadi kesalahan saat menyimpan hasil opname.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper for pagination on current active tab
  const getPaginatedData = <T,>(dataList: T[]) => {
    const total = dataList.length;
    const totalPages = Math.ceil(total / itemsPerPage) || 1;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const items = dataList.slice(startIdx, startIdx + itemsPerPage);
    return { total, totalPages, startIdx, items };
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Title Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 mb-2">
            <Boxes className="w-3.5 h-3.5 text-amber-500" />
            <span>Manajemen & Pengendalian Stok Enterprise</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
            Pengendalian Stok & Audit Inventaris
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Realtime Firestore: Catat stok masuk distributor, stok keluar, penyesuaian, stock opname fisik, & tanggal kedaluwarsa.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setWaModalTab('input');
              setIsWhatsAppModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-emerald-300"
          >
            <MessageSquare className="w-4 h-4 fill-slate-950" />
            <span>WhatsApp Center (Katalog, Stok & Notif)</span>
          </button>

          <button
            onClick={() => {
              setSelectedProductForAction(null);
              setIsOpnameModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl border border-amber-500/30 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            <span>Audit Opname</span>
          </button>

          <button
            onClick={() => {
              setSelectedProductForAction(null);
              setIsMovementModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-amber-300" />
            <span>Catat Stok Masuk / Keluar</span>
          </button>
        </div>
      </div>

      {/* Metrics Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total SKU Barang</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{stats.totalSku} SKU</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Nilai: Rp {stats.totalNilaiStok.toLocaleString('id-ID')}</p>
        </div>

        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">Stok Aman</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-emerald-700 dark:text-emerald-400">{stats.totalAman} SKU</p>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">Diatas batas minimum</p>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">Stok Menipis</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.totalMenipis} SKU</p>
          <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 mt-0.5">Perlu restock segera</p>
        </div>

        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">Stok Habis</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400">{stats.totalHabis} SKU</p>
          <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 mt-0.5">Stok 0 unit</p>
        </div>

        <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20 backdrop-blur-md shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-orange-700 dark:text-orange-300">Warning Expired</span>
            <Calendar className="w-4 h-4 text-orange-600" />
          </div>
          <p className="text-xl font-black text-orange-600 dark:text-orange-400">{stats.totalExpired} SKU</p>
          <p className="text-[10px] text-orange-600/70 dark:text-orange-400/70 mt-0.5">Kedaluwarsa / Kritis</p>
        </div>
      </div>

      {/* Main Subtabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('katalog')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'katalog'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Status & Peringatan Stok ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Riwayat Pergerakan ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('opname')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'opname'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Stock Opname Log ({opnames.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('expired')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'expired'
              ? 'bg-amber-500 text-slate-950 shadow-md font-bold'
              : 'bg-white/70 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/40'
          }`}
        >
          <Calendar className="w-4 h-4 text-amber-600" />
          <span>Monitoring Kedaluwarsa ({expiredProducts.length})</span>
        </button>
      </div>

      {/* Control Bar: Search & Specific Filters */}
      <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'katalog' ? 'Cari beras, minyak, SKU, barcode...' :
              activeTab === 'history' ? 'Cari produk, supplier, atau catatan...' :
              'Cari log audit opname...'
            }
            className="w-full pl-10 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab-Specific Filters */}
        {activeTab === 'katalog' && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            
            {/* Category Filter */}
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'Semua' ? 'Semua Kategori' : `📂 ${cat}`}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={filterStockStatus}
              onChange={(e) => setFilterStockStatus(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="semua">Semua Status Stok</option>
              <option value="aman">🟢 Stok Aman</option>
              <option value="menipis">🟠 Stok Menipis</option>
              <option value="habis">🔴 Stok Habis</option>
              <option value="expired">⏰ Warning Expired</option>
            </select>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-amber-500" />
            <select
              value={filterMovementType}
              onChange={(e) => setFilterMovementType(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="semua">Semua Tipe Mutasi</option>
              <option value="masuk">⬇️ Stok Masuk (Supplier)</option>
              <option value="keluar">⬆️ Stok Keluar (Manual)</option>
              <option value="penyesuaian">⚙️ Penyesuaian Manual</option>
              <option value="opname">📋 Stock Opname Audit</option>
            </select>
          </div>
        )}

      </div>

      {/* TAB CONTENT AREA */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : activeTab === 'katalog' ? (

        /* ==================== TAB 1: KATALOG & ALERT STOK ==================== */
        (() => {
          const { total, totalPages, startIdx, items } = getPaginatedData<ProdukItem>(filteredProducts);
          if (total === 0) {
            return (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl p-12 text-center">
                <Boxes className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Tidak ada data produk yang cocok dengan filter.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Info Barang</th>
                        <th className="py-3.5 px-4 text-center">Stok & Min Stok</th>
                        <th className="py-3.5 px-4 text-center">Badge Status</th>
                        <th className="py-3.5 px-4 text-center">Kedaluwarsa</th>
                        <th className="py-3.5 px-4 text-right">Harga Modal</th>
                        <th className="py-3.5 px-4 text-right">Aksi Cepat Mutasi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {items.map((p) => {
                        const isLow = p.stok <= p.minStok && p.stok > 0;
                        const isOut = p.stok === 0;
                        const expInfo = getExpiryStatus(p.expiredDate);

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group">
                            
                            {/* Product Info */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center font-black text-xs text-emerald-600 shrink-0 overflow-hidden">
                                  {p.gambarUrl ? (
                                    <img src={p.gambarUrl} alt={p.nama} className="w-full h-full object-cover" />
                                  ) : (
                                    p.kode.substring(0, 3)
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                                    {p.nama}
                                  </h4>
                                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                                    <span>SKU: {p.kode}</span>
                                    <span>•</span>
                                    <span>{p.kategori}</span>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Stock & Min Stock */}
                            <td className="py-3 px-4 text-center">
                              <span className="text-sm font-extrabold text-slate-900 dark:text-white block">
                                {p.stok} {p.satuan}
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                Min Stok: {p.minStok} {p.satuan}
                              </span>
                            </td>

                            {/* Status Badge */}
                            <td className="py-3 px-4 text-center">
                              {isOut ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  <XCircle className="w-3 h-3" />
                                  <span>Habis (0)</span>
                                </span>
                              ) : isLow ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Menipis ({p.stok})</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span>Aman ({p.stok})</span>
                                </span>
                              )}
                            </td>

                            {/* Expired Date Badge */}
                            <td className="py-3 px-4 text-center">
                              {p.expiredDate ? (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                  expInfo.status === 'expired' ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30' :
                                  expInfo.status === 'kritis' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                                  expInfo.status === 'waspada' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}>
                                  <Calendar className="w-3 h-3" />
                                  <span>{p.expiredDate} ({expInfo.label})</span>
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">-</span>
                              )}
                            </td>

                            {/* Buying Price */}
                            <td className="py-3 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                              Rp {p.hargaBeli.toLocaleString('id-ID')}
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedProductForAction(p);
                                    setIsMovementModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1 border border-emerald-500/20 transition-all cursor-pointer"
                                  title="Tambah / Keluar Stok"
                                >
                                  <PlusCircle className="w-3 h-3" />
                                  <span>Mutasi</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedProductForAction(p);
                                    setIsOpnameModalOpen(true);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 text-[11px] font-bold flex items-center gap-1 border border-amber-500/20 transition-all cursor-pointer"
                                  title="Audit Stock Opname"
                                >
                                  <ClipboardCheck className="w-3 h-3" />
                                  <span>Opname</span>
                                </button>
                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span>
                    Menampilkan <strong>{startIdx + 1}</strong> - <strong>{Math.min(startIdx + itemsPerPage, total)}</strong> dari <strong>{total}</strong> produk
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold">Halaman {currentPage} dari {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()

      ) : activeTab === 'history' ? (

        /* ==================== TAB 2: RIWAYAT PERGERAKAN STOK ==================== */
        (() => {
          const { total, totalPages, startIdx, items } = getPaginatedData<StockMovement>(filteredMovements);
          if (total === 0) {
            return (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl p-12 text-center">
                <History className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Belum ada riwayat pergerakan stok tersimpan di Firestore.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Catat stok masuk atau stok keluar pertama Anda dengan mengeklik tombol di kanan atas.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Waktu Log</th>
                        <th className="py-3.5 px-4">Produk</th>
                        <th className="py-3.5 px-4 text-center">Tipe Mutasi</th>
                        <th className="py-3.5 px-4 text-center">Perubahan Stok</th>
                        <th className="py-3.5 px-4">Keterangan / Supplier</th>
                        <th className="py-3.5 px-4 text-right">Operator</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {items.map((m) => {
                        const dateFormatted = new Date(m.createdAt).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        });

                        return (
                          <tr key={m.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                            
                            {/* Timestamp */}
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                              {dateFormatted}
                            </td>

                            {/* Product Name & SKU */}
                            <td className="py-3 px-4">
                              <h4 className="font-bold text-slate-900 dark:text-white">{m.namaProduk}</h4>
                              <span className="font-mono text-[11px] text-slate-400 block">SKU: {m.kodeProduk}</span>
                            </td>

                            {/* Type Badge */}
                            <td className="py-3 px-4 text-center">
                              {m.tipe === 'masuk' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                                  <ArrowDownRight className="w-3 h-3 text-amber-500" />
                                  <span>Stok Masuk</span>
                                </span>
                              ) : m.tipe === 'keluar' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>Stok Keluar</span>
                                </span>
                              ) : m.tipe === 'penyesuaian' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                                  <SlidersHorizontal className="w-3 h-3" />
                                  <span>Penyesuaian</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                                  <ClipboardCheck className="w-3 h-3" />
                                  <span>Opname Audit</span>
                                </span>
                              )}
                            </td>

                            {/* Delta Calculation */}
                            <td className="py-3 px-4 text-center font-mono font-bold">
                              <span className="text-slate-400">{m.stokAwal}</span>
                              <span className="mx-1.5 text-slate-300">➔</span>
                              <span className={m.stokAkhir >= m.stokAwal ? 'text-emerald-600' : 'text-rose-600'}>
                                {m.stokAkhir}
                              </span>
                              <span className="text-[11px] font-normal text-slate-400 block mt-0.5">
                                ({m.stokAkhir >= m.stokAwal ? '+' : ''}{m.stokAkhir - m.stokAwal} unit)
                              </span>
                            </td>

                            {/* Keterangan & Supplier */}
                            <td className="py-3 px-4 max-w-xs">
                              <p className="font-medium text-slate-800 dark:text-slate-200 truncate">{m.keterangan}</p>
                              {m.supplier && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                                  <Truck className="w-3 h-3" />
                                  <span>Distributor: {m.supplier}</span>
                                </span>
                              )}
                            </td>

                            {/* Operator */}
                            <td className="py-3 px-4 text-right text-slate-500 font-medium">
                              {m.operator || 'Admin'}
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span>Menampilkan <strong>{startIdx + 1}</strong> - <strong>{Math.min(startIdx + itemsPerPage, total)}</strong> dari <strong>{total}</strong> log mutasi</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold">Halaman {currentPage} dari {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()

      ) : activeTab === 'opname' ? (

        /* ==================== TAB 3: LOG STOCK OPNAME ==================== */
        (() => {
          const { total, totalPages, startIdx, items } = getPaginatedData<StockOpname>(filteredOpnames);
          if (total === 0) {
            return (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl p-12 text-center">
                <ClipboardCheck className="w-12 h-12 mx-auto text-slate-400 mb-3" />
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  Belum ada catatan Stock Opname audit fisik.
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Lakukan pemeriksaan fisik stok toko dan catat selisihnya melalui tombol Audit Opname.
                </p>
              </div>
            );
          }

          return (
            <div className="space-y-4">
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-3.5 px-4">Tanggal Audit</th>
                        <th className="py-3.5 px-4">Barang Sembako</th>
                        <th className="py-3.5 px-4 text-center">Stok Sistem</th>
                        <th className="py-3.5 px-4 text-center">Stok Fisik</th>
                        <th className="py-3.5 px-4 text-center">Status Selisih</th>
                        <th className="py-3.5 px-4">Alasan / Catatan Audit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                      {items.map((o) => (
                        <tr key={o.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {o.tanggal}
                          </td>

                          <td className="py-3 px-4">
                            <h4 className="font-bold text-slate-900 dark:text-white">{o.namaProduk}</h4>
                            <span className="font-mono text-[11px] text-slate-400 block">SKU: {o.kodeProduk}</span>
                          </td>

                          <td className="py-3 px-4 text-center font-bold text-slate-600 dark:text-slate-300">
                            {o.stokSistem}
                          </td>

                          <td className="py-3 px-4 text-center font-extrabold text-emerald-600 dark:text-emerald-400">
                            {o.stokFisik}
                          </td>

                          <td className="py-3 px-4 text-center">
                            {o.selisih === 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                Sesuai (0)
                              </span>
                            ) : o.selisih < 0 ? (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                                Defisit ({o.selisih})
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                Surplus (+{o.selisih})
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                            {o.alasan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {total > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  <span>Menampilkan <strong>{startIdx + 1}</strong> - <strong>{Math.min(startIdx + itemsPerPage, total)}</strong> dari <strong>{total}</strong> log opname</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="px-3 py-1 font-bold">Halaman {currentPage} dari {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()

      ) : (

        /* ==================== TAB 4: MONITORING KEDALUWARSA ==================== */
        (() => {
          if (expiredProducts.length === 0) {
            return (
              <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl p-12 text-center">
                <Calendar className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Semua Produk Bebas Warning Kedaluwarsa
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Atur tanggal kedaluwarsa pada menu Katalog atau saat mencatat Stok Masuk dari distributor.
                </p>
              </div>
            );
          }

          return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {expiredProducts.map((p) => {
                const isExp = p.expiryInfo.status === 'expired';
                const isKritis = p.expiryInfo.status === 'kritis';
                const isWaspada = p.expiryInfo.status === 'waspada';

                return (
                  <div
                    key={p.id}
                    className={`p-5 rounded-3xl border backdrop-blur-xl shadow-md transition-all space-y-3 ${
                      isExp ? 'bg-rose-500/10 border-rose-500/30' :
                      isKritis ? 'bg-rose-500/5 border-rose-500/20' :
                      isWaspada ? 'bg-amber-500/5 border-amber-500/20' :
                      'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-mono text-slate-400">SKU: {p.kode}</span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm">{p.nama}</h4>
                        <span className="text-[11px] text-slate-500">{p.kategori} • Stok: {p.stok} {p.satuan}</span>
                      </div>

                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${
                        isExp ? 'bg-rose-600 text-white' :
                        isKritis ? 'bg-rose-500 text-white' :
                        isWaspada ? 'bg-amber-500 text-slate-950' :
                        'bg-emerald-500/20 text-emerald-600'
                      }`}>
                        {p.expiryInfo.label}
                      </span>
                    </div>

                    <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 text-xs space-y-1">
                      <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                        <span>Tanggal Expired:</span>
                        <span className="font-bold font-mono text-slate-900 dark:text-white">{p.expiredDate}</span>
                      </div>
                      {p.batchNo && (
                        <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                          <span>Nomor Batch:</span>
                          <span className="font-mono text-[11px]">{p.batchNo}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1 flex items-center justify-end gap-2">
                      <button
                        onClick={() => {
                          setSelectedProductForAction(p);
                          setIsMovementModalOpen(true);
                        }}
                        className="w-full py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer text-center"
                      >
                        Tindak Lanjuti / Mutasi Stok
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          );
        })()

      )}

      {/* Modal: Catat Mutasi Stok (Masuk, Keluar, Penyesuaian) */}
      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => {
          setIsMovementModalOpen(false);
          setSelectedProductForAction(null);
        }}
        products={products}
        suppliers={suppliers}
        preselectedProduct={selectedProductForAction}
        onSubmit={handleMovementSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Modal: Stock Opname Audit */}
      <StockOpnameModal
        isOpen={isOpnameModalOpen}
        onClose={() => {
          setIsOpnameModalOpen(false);
          setSelectedProductForAction(null);
        }}
        products={products}
        preselectedProduct={selectedProductForAction}
        onSubmit={handleOpnameSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Modal: WhatsApp Integration (Input Katalog, Cek Stok, Notifikasi Menipis) */}
      <WhatsAppIntegrationModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        products={products}
        defaultTab={waModalTab}
      />

    </div>
  );
};
