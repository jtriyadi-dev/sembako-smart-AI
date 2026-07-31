import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../context/ToastContext';
import { formatRupiah } from '../utils/formatters';
import { TransaksiItem } from '../types';
import { 
  subscribeTransactions, 
  returTransaction, 
  returItemTransaction,
  returItemsTransaction,
  ItemReturRequest 
} from '../services/transaksiService';
import { exportTransactionsToPDF, exportTransactionsToExcel } from '../utils/exportUtils';
import { TransactionDetailModal } from '../components/transaksi/TransactionDetailModal';
import { ReturModal } from '../components/transaksi/ReturModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import { TableSkeleton } from '../components/SkeletonLoader';
import {
  Receipt,
  Search,
  Calendar,
  Download,
  Filter,
  Eye,
  Printer,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  QrCode,
  DollarSign,
  FileSpreadsheet,
  FileText,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  X,
} from 'lucide-react';

export const TransaksiPage: React.FC = () => {
  const { success, warning, error: toastError, info } = useToast();

  // Firestore Realtime State
  const [transactions, setTransactions] = useState<TransaksiItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters State
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState<'semua' | 'hari_ini' | '7_hari' | 'bulan_ini' | 'custom'>('semua');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<'semua' | 'lunas' | 'belum_lunas' | 'retur' | 'retur_sebagian'>('semua');
  const [methodFilter, setMethodFilter] = useState<string>('semua');

  // Modals State
  const [selectedTxDetail, setSelectedTxDetail] = useState<TransaksiItem | null>(null);
  const [selectedTxReceipt, setSelectedTxReceipt] = useState<TransaksiItem | null>(null);
  const [selectedTxRetur, setSelectedTxRetur] = useState<TransaksiItem | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Subscribe to Firestore Realtime
  useEffect(() => {
    const unsubscribe = subscribeTransactions(
      (data) => {
        setTransactions(data);
        setIsLoading(false);
      },
      (err) => {
        console.error('Transactions fetch error:', err);
        setIsLoading(false);
        toastError('Koneksi Firestore', 'Gagal memuat daftar transaksi.');
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filteredTransactions = transactions.filter((tx) => {
    // 1. Search Query Match
    const q = search.toLowerCase().trim();
    const matchCode = tx.kodeTransaksi.toLowerCase().includes(q);
    const matchCustomer = (tx.namaPelanggan || '').toLowerCase().includes(q);
    const matchItems = tx.items.some((item) => item.namaProduk.toLowerCase().includes(q));
    const matchSearch = !q || matchCode || matchCustomer || matchItems;

    // 2. Status Match
    const matchStatus = statusFilter === 'semua' || tx.statusPembayaran === statusFilter;

    // 3. Payment Method Match
    const matchMethod = methodFilter === 'semua' || tx.metodePembayaran === methodFilter;

    // 4. Date Range Match
    const txDate = new Date(tx.createdAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let matchDate = true;

    if (datePreset === 'hari_ini') {
      matchDate = txDate >= today;
    } else if (datePreset === '7_hari') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      matchDate = txDate >= sevenDaysAgo;
    } else if (datePreset === 'bulan_ini') {
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      matchDate = txDate >= firstDayOfMonth;
    } else if (datePreset === 'custom') {
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

    return matchSearch && matchStatus && matchMethod && matchDate;
  });

  // Calculate Metrics Summary
  const validTxs = filteredTransactions.filter((t) => t.statusPembayaran !== 'retur');
  const totalOmsetRaw = validTxs.reduce((acc, t) => acc + t.totalHarga, 0);
  const totalRefunds = filteredTransactions.reduce((acc, t) => acc + (t.totalRefund || 0), 0);
  const totalOmset = Math.max(0, totalOmsetRaw - totalRefunds);
  const totalDiskon = validTxs.reduce((acc, t) => acc + t.diskonTotal, 0);
  const totalReturCount = filteredTransactions.filter(
    (t) => t.statusPembayaran === 'retur' || t.statusPembayaran === 'retur_sebagian'
  ).length;

  // Pagination Helper
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedData = filteredTransactions.slice(startIdx, startIdx + itemsPerPage);

  // Actions
  const handleConfirmRetur = async (tx: TransaksiItem, alasan: string) => {
    try {
      await returTransaction(tx, alasan, 'Admin Toko');
      success(
        'Retur Transaksi Berhasil',
        `No. #${tx.kodeTransaksi} telah diretur penuh dan seluruh stok produk dikembalikan.`
      );
    } catch (err) {
      console.error('Error retur:', err);
      toastError('Gagal Retur', 'Terjadi kesalahan sistem saat memproses retur.');
    }
  };

  const handleConfirmReturItem = async (
    tx: TransaksiItem,
    produkId: string,
    jumlahRetur: number,
    alasan: string
  ) => {
    try {
      await returItemTransaction(tx, produkId, jumlahRetur, alasan, 'Admin Toko');
      success(
        'Retur Item Berhasil',
        `Retur x${jumlahRetur} item dari TRX #${tx.kodeTransaksi} berhasil diproses dan stok telah diperbarui.`
      );
    } catch (err: any) {
      console.error('Error retur item:', err);
      toastError('Gagal Retur Item', err.message || 'Terjadi kesalahan sistem.');
    }
  };

  const handleConfirmReturItems = async (
    tx: TransaksiItem,
    itemsToReturn: ItemReturRequest[],
    alasan: string
  ) => {
    try {
      await returItemsTransaction(tx, itemsToReturn, alasan, 'Admin Toko');
      const totalCount = itemsToReturn.reduce((sum, i) => sum + i.jumlahRetur, 0);
      success(
        'Retur Item Berhasil',
        `Retur ${itemsToReturn.length} jenis produk (Total ${totalCount} item) dari TRX #${tx.kodeTransaksi} berhasil diproses.`
      );
    } catch (err: any) {
      console.error('Error retur items batch:', err);
      toastError('Gagal Retur Item', err.message || 'Terjadi kesalahan sistem.');
      throw err;
    }
  };

  const handleExportPDF = () => {
    if (filteredTransactions.length === 0) {
      warning('Data Kosong', 'Tidak ada data transaksi untuk diekspor ke PDF.');
      return;
    }
    exportTransactionsToPDF(filteredTransactions, 'Laporan_Transaksi_Sembako');
    success('Ekspor Berhasil', 'Laporan PDF telah diunduh.');
  };

  const handleExportExcel = () => {
    if (filteredTransactions.length === 0) {
      warning('Data Kosong', 'Tidak ada data transaksi untuk diekspor ke Excel.');
      return;
    }
    exportTransactionsToExcel(filteredTransactions, 'Laporan_Transaksi_Sembako');
    success('Ekspor Berhasil', 'Laporan Excel (.xlsx) telah diunduh.');
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            <Receipt className="w-3.5 h-3.5" />
            <span>Audit & Riwayat Transaksi Firestore</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
            Riwayat Penjualan Toko
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Lacak seluruh transaksi kasir, detail item, retur barang, cetak ulang nota, dan ekspor laporan PDF/Excel.
          </p>
        </div>

        {/* Action Export Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
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

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transaksi */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/20 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Transaksi</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-slate-900 dark:text-white font-mono">
            {filteredTransactions.length} <span className="text-xs font-normal text-slate-400">faktur</span>
          </h3>
        </div>

        {/* Total Omset Netto */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/20 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Omset</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
            {formatRupiah(totalOmset)}
          </h3>
        </div>

        {/* Diskon Terberikan */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/20 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Diskon</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
            {formatRupiah(totalDiskon)}
          </h3>
        </div>

        {/* Total Retur */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/20 shadow-lg space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Retur / Void</span>
            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-black text-rose-600 dark:text-rose-400 font-mono">
            {totalReturCount} <span className="text-xs font-normal text-slate-400">retur</span>
          </h3>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-emerald-500/20 shadow-xl space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          
          {/* Search Box */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Kode TRX, Pelanggan, Nama Barang..."
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium focus:outline-none focus:border-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Date Preset Selector */}
          <div className="md:col-span-3 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {[
              { id: 'semua', label: 'Semua' },
              { id: 'hari_ini', label: 'Hari Ini' },
              { id: '7_hari', label: '7 Hari' },
              { id: 'bulan_ini', label: 'Bulan Ini' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-emerald-700 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="semua">Semua Status</option>
              <option value="lunas">Lunas</option>
              <option value="belum_lunas">Belum Lunas / Bon</option>
              <option value="retur_sebagian">Retur Sebagian Item</option>
              <option value="retur">Retur / Void Total</option>
            </select>
          </div>

          {/* Method Filter */}
          <div className="md:col-span-3">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="semua">Semua Metode Pembayaran</option>
              <option value="tunai">Tunai / Cash</option>
              <option value="qris">QRIS Scan</option>
              <option value="transfer">Transfer Bank</option>
              <option value="hutang">Bon / Hutang Tempo</option>
            </select>
          </div>

        </div>

        {/* Custom Date Range Panel */}
        {datePreset === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-3 text-xs"
          >
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-slate-500 font-bold">Dari:</span>
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

      {/* Main Transactions Table Card */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl border border-emerald-500/20 shadow-xl overflow-hidden">
        
        {isLoading ? (
          <div className="p-6">
            <TableSkeleton rows={6} />
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Tidak Ada Transaksi Ditemukan
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Coba sesuaikan kata kunci pencarian, preset tanggal, atau filter status pembayaran.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/80 dark:bg-slate-950/80 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">No. Faktur</th>
                  <th className="px-4 py-3.5">Tanggal & Waktu</th>
                  <th className="px-4 py-3.5">Pelanggan</th>
                  <th className="px-4 py-3.5">Metode Bayar</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Items</th>
                  <th className="px-4 py-3.5 text-right">Total Tagihan</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {paginatedData.map((tx) => {
                  const isFullRetur = tx.statusPembayaran === 'retur';
                  const isPartialRetur = tx.statusPembayaran === 'retur_sebagian';
                  const totalRefund = Number(tx.totalRefund) || 0;
                  const netTotalHarga = isFullRetur ? 0 : Math.max(0, tx.totalHarga - totalRefund);
                  const totalQty = tx.items.reduce((acc, i) => acc + i.jumlah, 0);
                  const activeQty = tx.items.reduce(
                    (acc, i) => acc + (i.jumlah - (Number(i.returQty) || 0)),
                    0
                  );

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                    >
                      {/* Kode TRX */}
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">
                        {tx.kodeTransaksi}
                      </td>

                      {/* Tanggal */}
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {new Date(tx.createdAt).toLocaleString('id-ID', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>

                      {/* Pelanggan */}
                      <td className="px-4 py-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                        {tx.namaPelanggan || 'Pelanggan Umum'}
                      </td>

                      {/* Metode */}
                      <td className="px-4 py-3 font-sans">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 uppercase">
                          {tx.metodePembayaran === 'qris' && <QrCode className="w-3 h-3 text-amber-500" />}
                          {tx.metodePembayaran === 'tunai' && <DollarSign className="w-3 h-3 text-emerald-500" />}
                          {tx.metodePembayaran === 'transfer' && <CreditCard className="w-3 h-3 text-blue-500" />}
                          {tx.metodePembayaran}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 text-center font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                            isFullRetur
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : isPartialRetur
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : tx.statusPembayaran === 'lunas'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {isFullRetur ? 'Retur Void' : isPartialRetur ? 'Retur Sebagian' : tx.statusPembayaran.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Total Item Count */}
                      <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400 font-mono">
                        {isPartialRetur || totalRefund > 0 ? (
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {activeQty} item
                            </span>
                            <span className="text-[10px] text-rose-500 block">
                              (-{totalQty - activeQty} retur)
                            </span>
                          </div>
                        ) : (
                          <span>{totalQty} item</span>
                        )}
                      </td>

                      {/* Total Harga / Tagihan */}
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="font-black text-amber-600 dark:text-amber-400 block">
                          {formatRupiah(netTotalHarga)}
                        </span>
                        {totalRefund > 0 && !isFullRetur && (
                          <span className="text-[10px] text-rose-500 block font-normal">
                            (Semula {formatRupiah(tx.totalHarga)})
                          </span>
                        )}
                        {isFullRetur && (
                          <span className="text-[10px] text-rose-500 block font-normal">
                            (Void Rp 0)
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-center font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Detail Button */}
                          <button
                            onClick={() => setSelectedTxDetail(tx)}
                            className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                            title="Lihat Detail Transaksi"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Print Struk Button */}
                          <button
                            onClick={() => setSelectedTxReceipt(tx)}
                            className="p-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 transition-colors cursor-pointer"
                            title="Cetak Ulang Struk"
                          >
                            <Printer className="w-4 h-4" />
                          </button>

                          {/* Retur Button (If not full retur) */}
                          {!isFullRetur && (
                            <button
                              onClick={() => setSelectedTxRetur(tx)}
                              className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                              title="Retur Item / Transaksi"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && filteredTransactions.length > 0 && (
          <div className="p-4 bg-slate-50/80 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="text-slate-500">
              Menampilkan <span className="font-bold text-slate-800 dark:text-slate-200">{startIdx + 1}</span> -{' '}
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {Math.min(startIdx + itemsPerPage, filteredTransactions.length)}
              </span>{' '}
              dari <span className="font-bold text-slate-800 dark:text-slate-200">{filteredTransactions.length}</span> data
            </div>

            <div className="flex items-center gap-3">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold cursor-pointer"
              >
                <option value={10}>10 per halaman</option>
                <option value={25}>25 per halaman</option>
                <option value={50}>50 per halaman</option>
              </select>

              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="px-3 font-bold text-slate-700 dark:text-slate-300">
                  {currentPage} / {totalPages}
                </span>

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Transaction Detail Modal */}
      <TransactionDetailModal
        isOpen={!!selectedTxDetail}
        onClose={() => setSelectedTxDetail(null)}
        transaction={selectedTxDetail}
        onPrintReceipt={(tx) => {
          setSelectedTxDetail(null);
          setSelectedTxReceipt(tx);
        }}
        onOpenReturModal={(tx) => {
          setSelectedTxDetail(null);
          setSelectedTxRetur(tx);
        }}
      />

      {/* Thermal Receipt Print Modal */}
      <ReceiptModal
        isOpen={!!selectedTxReceipt}
        onClose={() => setSelectedTxReceipt(null)}
        transaction={selectedTxReceipt}
        onDone={() => setSelectedTxReceipt(null)}
      />

      {/* Retur / Void Modal */}
      <ReturModal
        isOpen={!!selectedTxRetur}
        onClose={() => setSelectedTxRetur(null)}
        transaction={selectedTxRetur}
        onConfirmRetur={handleConfirmRetur}
        onConfirmReturItem={handleConfirmReturItem}
        onConfirmReturItems={handleConfirmReturItems}
      />

    </div>
  );
};
