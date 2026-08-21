import React, { useState, useEffect, useMemo } from 'react';
import { SupplierItem, ProdukItem } from '../types';
import { 
  subscribeProducts, 
  addProduct, 
  updateProduct, 
  deleteProduct 
} from '../services/productService';
import { subscribeSuppliers } from '../services/supplierService';
import { ProductFormModal, KATEGORI_LIST } from '../components/ProductFormModal';
import { ProductDeleteModal } from '../components/ProductDeleteModal';
import { ProductCard } from '../components/ProductCard';
import { BarcodeScannerModal } from '../components/BarcodeScannerModal';
import { WhatsAppIntegrationModal } from '../components/WhatsAppIntegrationModal';
import { TableSkeleton } from '../components/SkeletonLoader';
import { useToast } from '../context/ToastContext';
import {
  Package,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  RefreshCw,
  Barcode,
  Tag,
  DollarSign,
  Boxes,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  CheckCircle2,
  ArrowUpDown,
  Copy,
  Info,
  TrendingUp,
  Sparkles,
  MessageSquare
} from 'lucide-react';

export const ProdukPage: React.FC = () => {
  const { success, error: toastError, info } = useToast();

  // Firestore Realtime State
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('Semua');
  const [selectedStockFilter, setSelectedStockFilter] = useState<'semua' | 'aman' | 'menipis' | 'habis'>('semua');
  const [sortBy, setSortBy] = useState<
    'nama-asc' | 'nama-desc' | 'harga-asc' | 'harga-desc' | 'stok-asc' | 'stok-desc' | 'terlaris'
  >('nama-asc');

  // Layout & Pagination State
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProdukItem | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProdukItem | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);

  // Loading indicator for async actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Subscribe to real-time products snapshot from Firestore
  useEffect(() => {
    setIsLoading(true);

    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
    }, 250);

    const unsubProducts = subscribeProducts(
      (data) => {
        setProducts(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Subscription error:', err);
        setIsLoading(false);
      }
    );

    const unsubSuppliers = subscribeSuppliers((data) => setSuppliers(data));

    return () => {
      clearTimeout(safetyTimer);
      unsubProducts();
      unsubSuppliers();
    };
  }, []);

  // Dynamic Categories (Preset + Products)
  const availableCategories = useMemo(() => {
    const set = new Set<string>(KATEGORI_LIST);
    products.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Filter & Sort Products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => {
        // Search filter
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch =
          !query ||
          p.nama.toLowerCase().includes(query) ||
          p.kode.toLowerCase().includes(query) ||
          (p.barcode && p.barcode.toLowerCase().includes(query)) ||
          p.kategori.toLowerCase().includes(query) ||
          (p.deskripsi && p.deskripsi.toLowerCase().includes(query));

        // Category filter
        const matchesCategory =
          selectedKategori === 'Semua' || p.kategori === selectedKategori;

        // Stock status filter
        let matchesStock = true;
        if (selectedStockFilter === 'aman') {
          matchesStock = p.stok > p.minStok;
        } else if (selectedStockFilter === 'menipis') {
          matchesStock = p.stok <= p.minStok && p.stok > 0;
        } else if (selectedStockFilter === 'habis') {
          matchesStock = p.stok === 0;
        }

        return matchesSearch && matchesCategory && matchesStock;
      })
      .sort((a, b) => {
        if (sortBy === 'nama-asc') return a.nama.localeCompare(b.nama);
        if (sortBy === 'nama-desc') return b.nama.localeCompare(a.nama);
        if (sortBy === 'harga-asc') return a.hargaJual - b.hargaJual;
        if (sortBy === 'harga-desc') return b.hargaJual - a.hargaJual;
        if (sortBy === 'stok-asc') return a.stok - b.stok;
        if (sortBy === 'stok-desc') return b.stok - a.stok;
        if (sortBy === 'terlaris') return (b.terjual || 0) - (a.terjual || 0);
        return 0;
      });
  }, [products, searchQuery, selectedKategori, selectedStockFilter, sortBy]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedKategori, selectedStockFilter, sortBy, itemsPerPage]);

  // Pagination calculation
  const totalItems = filteredProducts.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, startIndex + itemsPerPage);

  // Statistics Summary
  const stats = useMemo(() => {
    const totalSku = products.length;
    const totalNilaiInventaris = products.reduce((acc, p) => acc + p.hargaBeli * p.stok, 0);
    const totalStokAlert = products.filter((p) => p.stok <= p.minStok).length;
    
    // Average Profit Margin
    const totalMargin = products.reduce((acc, p) => {
      const margin = p.hargaJual > 0 ? ((p.hargaJual - p.hargaBeli) / p.hargaJual) * 100 : 0;
      return acc + margin;
    }, 0);
    const avgMargin = totalSku > 0 ? (totalMargin / totalSku).toFixed(1) : '0';

    return {
      totalSku,
      totalNilaiInventaris,
      totalStokAlert,
      avgMargin,
    };
  }, [products]);

  // Handlers
  const handleCreateProduct = async (productPayload: Omit<ProdukItem, 'id'>) => {
    setIsSubmitting(true);
    try {
      await addProduct(productPayload);
      success('Produk Ditambahkan', `Barang "${productPayload.nama}" berhasil disimpan ke Supabase Database.`);
      setIsAddModalOpen(false);
    } catch (err) {
      toastError('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan produk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProduct = async (productPayload: Omit<ProdukItem, 'id'>) => {
    if (!editingProduct) return;
    setIsSubmitting(true);
    try {
      await updateProduct(editingProduct.id, productPayload);
      success('Produk Diupdate', `Data barang "${productPayload.nama}" berhasil diperbarui di Supabase Database.`);
      setEditingProduct(null);
    } catch (err) {
      toastError('Gagal Update', 'Terjadi kesalahan saat mengupdate produk.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteProduct(id);
      success('Produk Dihapus', 'Data barang telah dihapus dari Supabase Database.');
      setDeletingProduct(null);
    } catch (err) {
      toastError('Gagal Hapus', 'Terjadi kesalahan saat menghapus produk.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCopyBarcode = (barcodeStr: string) => {
    if (!barcodeStr) return;
    navigator.clipboard.writeText(barcodeStr);
    info('Barcode Disalin', `Barcode "${barcodeStr}" berhasil disalin ke clipboard.`);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Page Title Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>Katalog & Inventaris Realtime</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
            Manajemen Produk Sembako
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kelola stok, harga modal, harga jual, SKU, dan barcode secara akurat dengan sinkronisasi Firebase Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-center flex-wrap">
          <button
            onClick={() => setIsWhatsAppModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer border border-emerald-300"
            title="Import Katalog & Notif WhatsApp"
          >
            <MessageSquare className="w-4 h-4 fill-slate-950" />
            <span>Import WA / WhatsApp Center</span>
          </button>

          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-3 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            title="Scan Barcode / SKU"
          >
            <Barcode className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Scanner Barcode</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-300" />
            <span>Tambah Produk Baru</span>
          </button>
        </div>
      </div>

      {/* Top Inventory Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Total Produk SKU</span>
            <Package className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">{stats.totalSku}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Terdaftar di katalog toko</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Nilai Inventaris (Modal)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-400 truncate">
            Rp {stats.totalNilaiInventaris.toLocaleString('id-ID')}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">Aset barang siap jual</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Peringatan Stok</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-xl font-black text-amber-600 dark:text-amber-400">{stats.totalStokAlert}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Stok menipis / habis</p>
        </div>

        <div className="p-4 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 backdrop-blur-md shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Rata-Rata Margin</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-black text-slate-900 dark:text-white">+{stats.avgMargin}%</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Keuntungan rata-rata</p>
        </div>
      </div>

      {/* Control Bar: Search, Category Chips, Filters & Sorting */}
      <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-md space-y-4">
        
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari beras, minyak, tepung, SKU, atau barcode..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-all"
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

          {/* Filters & Sort Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Filter Status Stok */}
            <select
              value={selectedStockFilter}
              onChange={(e) => setSelectedStockFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="semua">Semua Status Stok</option>
              <option value="aman">🟢 Stok Aman</option>
              <option value="menipis">🟠 Stok Menipis</option>
              <option value="habis">🔴 Stok Habis</option>
            </select>

            {/* Sorting Dropdown */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 ml-1 hidden sm:inline" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="nama-asc">Nama A-Z</option>
                <option value="nama-desc">Nama Z-A</option>
                <option value="harga-asc">Harga Jual Terendah</option>
                <option value="harga-desc">Harga Jual Tertinggi</option>
                <option value="stok-asc">Stok Tersedikit</option>
                <option value="stok-desc">Stok Terbanyak</option>
                <option value="terlaris">Terlaris (Penjualan)</option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tabel</span>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Grid</span>
              </button>
            </div>

          </div>
        </div>

        {/* Category Horizontal Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          <Filter className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-1" />
          {availableCategories.map((kat) => (
            <button
              key={kat}
              onClick={() => setSelectedKategori(kat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                selectedKategori === kat
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold border border-amber-400'
                  : 'bg-slate-100/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-emerald-500/40'
              }`}
            >
              {kat}
            </button>
          ))}
        </div>

      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <TableSkeleton rows={6} />
      ) : filteredProducts.length === 0 ? (
        /* Empty State */
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl p-12 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
              <Package className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Produk Tidak Ditemukan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery || selectedKategori !== 'Semua' || selectedStockFilter !== 'semua'
                  ? 'Tidak ada produk yang sesuai dengan kriteria pencarian atau filter yang Anda pilih.'
                  : 'Belum ada produk tersimpan di Firestore. Klik tombol di bawah untuk menambah produk pertama Anda.'}
              </p>
            </div>

            <div className="pt-2 flex justify-center gap-3">
              {(searchQuery || selectedKategori !== 'Semua' || selectedStockFilter !== 'semua') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedKategori('Semua');
                    setSelectedStockFilter('semua');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Reset Filter
                </button>
              )}

              <button
                onClick={() => setIsAddModalOpen(true)}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4 text-amber-300" />
                <span>Tambah Produk Baru</span>
              </button>
            </div>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        
        /* TABLE VIEW */
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Info Produk</th>
                  <th className="py-3.5 px-4">Kategori & Barcode</th>
                  <th className="py-3.5 px-4 text-right">Harga Modal</th>
                  <th className="py-3.5 px-4 text-right">Harga Jual</th>
                  <th className="py-3.5 px-4 text-center">Margin</th>
                  <th className="py-3.5 px-4 text-center">Stok</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {paginatedProducts.map((p) => {
                  const isLow = p.stok <= p.minStok && p.stok > 0;
                  const isOut = p.stok === 0;
                  const marginVal = p.hargaJual - p.hargaBeli;
                  const marginPct = p.hargaJual > 0 
                    ? ((marginVal / p.hargaJual) * 100).toFixed(1) 
                    : '0';

                  return (
                    <tr 
                      key={p.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Product Name & Image */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 overflow-hidden shrink-0">
                            {p.gambarUrl ? (
                              <img src={p.gambarUrl} alt={p.nama} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center font-bold text-[10px] text-slate-400">
                                {(p.kode || p.nama || 'SKU').substring(0, 3)}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-slate-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                              {p.nama}
                            </h4>
                            <span className="font-mono text-[11px] text-slate-400 block mt-0.5">
                              SKU: {p.kode || '-'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category & Barcode */}
                      <td className="py-3 px-4">
                        <span className="inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-1">
                          {p.kategori}
                        </span>
                        {p.barcode ? (
                          <button
                            onClick={() => handleCopyBarcode(p.barcode!)}
                            className="flex items-center gap-1 text-[11px] font-mono text-slate-500 hover:text-emerald-600 cursor-pointer"
                            title="Klik untuk salin barcode"
                          >
                            <Barcode className="w-3 h-3 text-slate-400" />
                            <span>{p.barcode}</span>
                            <Copy className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic block">-</span>
                        )}
                      </td>

                      {/* Modal Price */}
                      <td className="py-3 px-4 text-right font-medium text-slate-600 dark:text-slate-300">
                        Rp {p.hargaBeli.toLocaleString('id-ID')}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-4 text-right font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                        Rp {p.hargaJual.toLocaleString('id-ID')}
                      </td>

                      {/* Margin Badge */}
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          +{marginPct}%
                        </span>
                      </td>

                      {/* Stock Badge */}
                      <td className="py-3 px-4 text-center">
                        {isOut ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20 inline-flex items-center gap-1">
                            Habis (0)
                          </span>
                        ) : isLow ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20 inline-flex items-center gap-1">
                            {p.stok} {p.satuan}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                            {p.stok} {p.satuan}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingProduct(p)}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit Produk"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingProduct(p)}
                            className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Hapus Produk"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      ) : (

        /* GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {paginatedProducts.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={setEditingProduct}
              onDelete={setDeletingProduct}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
          
          <div className="flex items-center gap-3">
            <span>
              Menampilkan <strong>{startIndex + 1}</strong> - <strong>{Math.min(startIndex + itemsPerPage, totalItems)}</strong> dari <strong>{totalItems}</strong> produk
            </span>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Tampilkan:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 font-bold text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-bold">
              Halaman {currentPage} dari {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      )}

      {/* Modal: Tambah Produk Baru */}
      <ProductFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleCreateProduct}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
      />

      {/* Modal: Edit Produk */}
      <ProductFormModal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        initialData={editingProduct}
        onSubmit={handleUpdateProduct}
        suppliers={suppliers}
        isSubmitting={isSubmitting}
      />

      {/* Modal: Hapus Produk */}
      <ProductDeleteModal
        isOpen={!!deletingProduct}
        product={deletingProduct}
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleDeleteConfirm}
        isDeleting={isDeleting}
      />

      {/* Modal: Barcode Scanner Simulator */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        products={products}
        onSelectProduct={(product) => setEditingProduct(product)}
      />

      {/* Modal: WhatsApp Integration (Input Katalog, Cek Stok, Notifikasi Menipis) */}
      <WhatsAppIntegrationModal
        isOpen={isWhatsAppModalOpen}
        onClose={() => setIsWhatsAppModalOpen(false)}
        products={products}
        defaultTab="input"
      />

    </div>
  );
};
