import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../context/ToastContext';
import { useStore } from '../context/StoreContext';
import { getAccentTheme } from '../utils/themeUtils';
import { SupplierItem, ProdukItem, StockMovement, MovementType } from '../types';
import { 
  subscribeSuppliers, 
  addSupplier, 
  updateSupplier, 
  deleteSupplier 
} from '../services/supplierService';
import { subscribeProducts } from '../services/productService';
import { subscribeStockMovements, recordStockMovement } from '../services/stockService';
import { SupplierFormModal, KATEGORI_SUPPLIER_LIST } from '../components/SupplierFormModal';
import { SupplierDetailModal } from '../components/SupplierDetailModal';
import { StockMovementModal } from '../components/StockMovementModal';
import { 
  Building2, 
  Plus, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  User, 
  Tag, 
  Edit, 
  Trash2, 
  Eye, 
  MessageSquare, 
  Package, 
  Boxes, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Grid,
  List,
  ExternalLink,
  Truck
} from 'lucide-react';

export const SupplierPage: React.FC = () => {
  const { success, warning, error: toastError, info } = useToast();
  const { storeConfig } = useStore();
  const accent = getAccentTheme(storeConfig.accentColor);

  // Real-time Firestore State
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([]);

  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('semua');
  const [selectedStatus, setSelectedStatus] = useState<'semua' | 'aktif' | 'nonaktif'>('semua');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<SupplierItem | null>(null);
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingSupplier, setViewingSupplier] = useState<SupplierItem | null>(null);

  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [prefilledSupplierName, setPrefilledSupplierName] = useState<string>('');

  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Subscribe to Firestore collections
  useEffect(() => {
    setIsLoadingSuppliers(true);
    const unsubSuppliers = subscribeSuppliers((data) => {
      setSuppliers(data);
      setIsLoadingSuppliers(false);
    });

    const unsubProducts = subscribeProducts((data) => setProducts(data));
    const unsubMovements = subscribeStockMovements((data) => setStockMovements(data));

    return () => {
      unsubSuppliers();
      unsubProducts();
      unsubMovements();
    };
  }, []);

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter((sup) => {
    const matchesSearch =
      sup.namaSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sup.kodeSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sup.kontakPerson && sup.kontakPerson.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (sup.telepon && sup.telepon.includes(searchTerm));

    const matchesCategory =
      selectedCategory === 'semua' || sup.kategoriProduk === selectedCategory;

    const matchesStatus =
      selectedStatus === 'semua' || sup.status === selectedStatus;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // KPI Stats
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.status === 'aktif').length;
  const totalProductsLinked = products.filter((p) => p.supplierId || p.supplierNama).length;
  const totalStockInEntries = stockMovements.filter((m) => m.tipe === 'masuk' && m.supplier).length;

  // Handlers
  const handleOpenAddForm = () => {
    setEditingSupplier(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEditForm = (sup: SupplierItem) => {
    setEditingSupplier(sup);
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = (sup: SupplierItem) => {
    setViewingSupplier(sup);
    setIsDetailModalOpen(true);
  };

  const handleOpenRestockForSupplier = (supplierName: string) => {
    setPrefilledSupplierName(supplierName);
    setIsRestockModalOpen(true);
  };

  const handleFormSubmit = async (supplierData: Omit<SupplierItem, 'id'>) => {
    try {
      setIsSubmitting(true);
      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, supplierData);
        success('Berhasil memperbarui data supplier', supplierData.namaSupplier);
      } else {
        await addSupplier(supplierData);
        success('Berhasil menambahkan supplier baru', supplierData.namaSupplier);
      }
      setIsFormModalOpen(false);
      setEditingSupplier(null);
    } catch (err: any) {
      toastError('Gagal menyimpan supplier', err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async (id: string, nama: string) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus data supplier "${nama}"?`)) return;

    try {
      setDeletingSupplierId(id);
      await deleteSupplier(id);
      success('Supplier berhasil dihapus', nama);
    } catch (err: any) {
      toastError('Gagal menghapus supplier', err.message);
    } finally {
      setDeletingSupplierId(null);
    }
  };

  const handleRestockSubmit = async (params: {
    product: ProdukItem;
    tipe: MovementType;
    jumlah: number;
    keterangan: string;
    supplier?: string;
    expiredDate?: string;
    batchNo?: string;
  }) => {
    try {
      setIsSubmitting(true);
      await recordStockMovement({
        ...params,
        operator: 'Admin Toko',
      });
      success(
        'Stok Masuk Berhasil Dicatat!',
        `+${params.jumlah} ${params.product.satuan} ${params.product.nama} dari ${params.supplier || 'Supplier'}`
      );
      setIsRestockModalOpen(false);
    } catch (err: any) {
      toastError('Gagal mencatat mutasi stok', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-xl ${accent.bgLight} ${accent.border} border`}>
              <Building2 className={`w-5 h-5 ${accent.text} ${accent.textDark}`} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Pemasok & Supplier Sembako
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kelola data distributor, kontak sales PIC, dan riwayat pasokan stok barang toko
          </p>
        </div>

        <button
          onClick={handleOpenAddForm}
          className={`px-4 py-2.5 rounded-2xl bg-gradient-to-r ${accent.gradient} hover:opacity-90 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer`}
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Supplier Baru</span>
        </button>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Supplier</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalSuppliers} <span className="text-xs font-normal text-slate-500">Distributor</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Supplier Aktif</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {activeSuppliers} <span className="text-xs font-normal text-slate-500">Aktif</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produk Terhubung</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalProductsLinked} <span className="text-xs font-normal text-slate-500">Produk</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Restock Supplier</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white">
            {totalStockInEntries} <span className="text-xs font-normal text-slate-500">Transaksi</span>
          </div>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="p-4 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama supplier, kode, PIC, No HP..."
            className="w-full pl-10 pr-4 py-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 transition-all"
          />
        </div>

        {/* Dropdown Filters & Layout Toggle */}
        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="semua">Semua Kategori</option>
            {KATEGORI_SUPPLIER_LIST.map((kat) => (
              <option key={kat} value={kat}>{kat}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-700 dark:text-slate-300 font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="semua">Semua Status</option>
            <option value="aktif">Status: Aktif</option>
            <option value="nonaktif">Status: Non-Aktif</option>
          </select>

          {/* Grid / Table Toggle */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Tampilan Grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              title="Tampilan Tabel"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Main Content Area */}
      {isLoadingSuppliers ? (
        <div className="py-20 text-center space-y-3">
          <div className={`w-8 h-8 border-3 ${accent.border} border-t-transparent rounded-full animate-spin mx-auto`} />
          <p className="text-xs text-slate-500 font-medium">Memuat data supplier dari Firestore...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="py-16 text-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-3 p-6">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Tidak ada supplier ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {searchTerm || selectedCategory !== 'semua' || selectedStatus !== 'semua'
              ? 'Coba sesuaikan kata kunci pencarian atau filter kategori supplier.'
              : 'Belum ada data supplier distributor. Klik tombol di bawah untuk menambah supplier pertama.'}
          </p>
          <button
            onClick={handleOpenAddForm}
            className={`px-4 py-2 rounded-xl bg-gradient-to-r ${accent.gradient} text-white font-bold text-xs shadow-md inline-flex items-center gap-1.5 cursor-pointer mt-2`}
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Supplier Pertama</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        
        /* Grid Layout */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((sup) => {
            const cleanPhone = sup.telepon.replace(/[^0-9]/g, '');
            const formattedPhoneForWa = cleanPhone.startsWith('0') ? `62${cleanPhone.substring(1)}` : cleanPhone;
            const waUrl = `https://wa.me/${formattedPhoneForWa}?text=Halo%20${encodeURIComponent(sup.kontakPerson || sup.namaSupplier)},%20saya%20dari%20toko%20${encodeURIComponent(storeConfig.namaToko || 'Sembako')}%20ingin%20menanyakan%20stok.`;

            // Count linked products
            const linkedProdCount = products.filter(
              (p) => p.supplierId === sup.id || (p.supplierNama && p.supplierNama.toLowerCase() === sup.namaSupplier.toLowerCase())
            ).length;

            return (
              <motion.div
                key={sup.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-xl flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition-all group"
              >
                <div>
                  {/* Card Header: Code & Status Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                      {sup.kodeSupplier}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      sup.status === 'aktif'
                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}>
                      {sup.status}
                    </span>
                  </div>

                  {/* Supplier Title & Category */}
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {sup.namaSupplier}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-slate-400" />
                      <span>{sup.kategoriProduk || 'Grosir Sembako'}</span>
                    </p>
                  </div>

                  {/* PIC & Phone Info */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>Sales PIC:</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {sup.kontakPerson || '—'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Telepon / WA:</span>
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {sup.telepon}
                      </span>
                    </div>

                    {sup.alamat && (
                      <div className="flex items-start gap-1.5 text-slate-500 text-[11px] pt-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{sup.alamat}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Badges & Actions */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-amber-500" />
                      <span>{linkedProdCount} Produk Terhubung</span>
                    </span>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WA Sales</span>
                    </a>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="grid grid-cols-4 gap-1.5 pt-1">
                    <button
                      onClick={() => handleOpenDetail(sup)}
                      className="py-1.5 px-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Lihat Detail Supplier"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>

                    <button
                      onClick={() => handleOpenRestockForSupplier(sup.namaSupplier)}
                      className="py-1.5 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Restock Stok Masuk"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Restock</span>
                    </button>

                    <button
                      onClick={() => handleOpenEditForm(sup)}
                      className="py-1.5 px-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="Edit Supplier"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => handleDeleteConfirm(sup.id, sup.namaSupplier)}
                      disabled={deletingSupplierId === sup.id}
                      className="py-1.5 px-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 font-bold text-[11px] flex items-center justify-center gap-1 transition-all cursor-pointer disabled:opacity-50"
                      title="Hapus Supplier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>

              </motion.div>
            );
          })}
        </div>

      ) : (

        /* Table View */
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Kode & Supplier</th>
                  <th className="py-3 px-4">Kategori Utama</th>
                  <th className="py-3 px-4">Sales PIC</th>
                  <th className="py-3 px-4">No. Telepon / WA</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                {filteredSuppliers.map((sup) => {
                  const cleanPhone = sup.telepon.replace(/[^0-9]/g, '');
                  const formattedPhoneForWa = cleanPhone.startsWith('0') ? `62${cleanPhone.substring(1)}` : cleanPhone;
                  const waUrl = `https://wa.me/${formattedPhoneForWa}?text=Halo%20${encodeURIComponent(sup.kontakPerson || sup.namaSupplier)},%20saya%20dari%20toko%20${encodeURIComponent(storeConfig.namaToko || 'Sembako')}%20ingin%20menanyakan%20stok.`;

                  return (
                    <tr key={sup.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400">
                            {sup.kodeSupplier}
                          </span>
                          <div>
                            <span className="font-extrabold text-slate-900 dark:text-white block">{sup.namaSupplier}</span>
                            {sup.email && <span className="text-[10px] text-slate-400 block">{sup.email}</span>}
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {sup.kategoriProduk || 'Grosir Umum'}
                      </td>

                      <td className="py-3 px-4 text-slate-800 dark:text-slate-200 font-semibold">
                        {sup.kontakPerson || '—'}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        <div className="flex items-center gap-1.5">
                          <span>{sup.telepon}</span>
                          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:text-emerald-500">
                            <MessageSquare className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          sup.status === 'aktif'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}>
                          {sup.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(sup)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Detail"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenRestockForSupplier(sup.namaSupplier)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 transition-colors cursor-pointer"
                            title="Restock"
                          >
                            <Truck className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleOpenEditForm(sup)}
                            className="p-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteConfirm(sup.id, sup.namaSupplier)}
                            disabled={deletingSupplierId === sup.id}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-400 transition-colors cursor-pointer"
                            title="Hapus"
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
      )}

      {/* Supplier Add/Edit Modal */}
      <SupplierFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setEditingSupplier(null);
        }}
        onSubmit={handleFormSubmit}
        initialData={editingSupplier}
        isSubmitting={isSubmitting}
      />

      {/* Supplier Detail Modal */}
      <SupplierDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setViewingSupplier(null);
        }}
        supplier={viewingSupplier}
        products={products}
        stockMovements={stockMovements}
        onOpenRestockModal={handleOpenRestockForSupplier}
        onEditSupplier={handleOpenEditForm}
      />

      {/* Restock Stock Movement Modal */}
      <StockMovementModal
        isOpen={isRestockModalOpen}
        onClose={() => setIsRestockModalOpen(false)}
        products={products}
        onSubmit={handleRestockSubmit}
        isSubmitting={isSubmitting}
      />

    </div>
  );
};
