import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../context/ToastContext';
import { useStore } from '../context/StoreContext';
import { getAccentTheme } from '../utils/themeUtils';
import { formatRupiah } from '../utils/formatters';
import { playScannerBeep } from '../utils/audioUtils';
import { ProdukItem, CartItem, TransaksiItem } from '../types';
import { subscribeProducts } from '../services/productService';
import { KATEGORI_LIST } from '../components/ProductFormModal';
import { createTransaction, generateKodeTransaksi } from '../services/transaksiService';
import { PaymentModal } from '../components/pos/PaymentModal';
import { ReceiptModal } from '../components/pos/ReceiptModal';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Barcode,
  CheckCircle2,
  Sparkles,
  Tag,
  Percent,
  X,
  AlertTriangle,
  RotateCcw,
  Zap,
  PackageCheck,
  PackageX,
  CreditCard,
  Edit2,
  Check,
} from 'lucide-react';

export const KasirPage: React.FC = () => {
  const { success, warning, error: toastError, info } = useToast();
  const { storeConfig } = useStore();
  const accent = getAccentTheme(storeConfig.accentColor);

  // Firestore Products real-time state
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Diskon Cart & Tax state
  const [diskonCartNominal, setDiskonCartNominal] = useState<number>(0);
  const [diskonCartPersen, setDiskonCartPersen] = useState<number>(0);
  const [pajakPersen, setPajakPersen] = useState<number>(0); // e.g. 0% or 11%

  // Modals state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [lastCompletedTx, setLastCompletedTx] = useState<TransaksiItem | null>(null);

  // Edit Item Discount Modal State
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  const [itemDiscInput, setItemDiscInput] = useState<string>('0');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Subscribe to real-time products
  useEffect(() => {
    const unsubscribe = subscribeProducts(
      (data) => {
        setProducts(data);
        setIsLoadingProducts(false);
      },
      (err) => {
        console.error('Error fetching products:', err);
        setIsLoadingProducts(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Categories extraction
  const categories = useMemo(() => {
    const set = new Set<string>(KATEGORI_LIST);
    products.forEach((p) => {
      if (p.kategori) set.add(p.kategori);
    });
    return ['Semua', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCategory === 'Semua' || p.kategori === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchCat;

    const matchName = p.nama.toLowerCase().includes(q);
    const matchCode = p.kode.toLowerCase().includes(q);
    const matchBarcode = p.barcode ? p.barcode.toLowerCase().includes(q) : false;

    return matchCat && (matchName || matchCode || matchBarcode);
  });

  // Handle Barcode Search Enter press (Auto-add exact barcode or first item)
  const handleKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const exactMatch = products.find(
        (p) =>
          p.barcode?.toLowerCase() === searchQuery.trim().toLowerCase() ||
          p.kode.toLowerCase() === searchQuery.trim().toLowerCase()
      ) || filteredProducts[0];

      if (exactMatch) {
        if (storeConfig.scannerBeepSound !== false) playScannerBeep('success');
        handleAddToCart(exactMatch);
        setSearchQuery('');
      } else {
        if (storeConfig.scannerBeepSound !== false) playScannerBeep('error');
        warning('Produk Tidak Ditemukan', `Tidak ada produk dengan kode "${searchQuery}".`);
      }
    }
  };

  // Add product to cart
  const handleAddToCart = (product: ProdukItem) => {
    if (product.stok <= 0) {
      warning('Stok Habis!', `Stok ${product.nama} sedang kosong.`);
      return;
    }

    setCart((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === product.id);

      if (existingIndex > -1) {
        const existing = prev[existingIndex];
        const newQty = existing.jumlah + 1;

        if (newQty > product.stok) {
          warning('Batas Stok', `Maksimal stok tersedia untuk ${product.nama} adalah ${product.stok} ${product.satuan}.`);
          return prev;
        }

        const updated = [...prev];
        updated[existingIndex] = { ...existing, jumlah: newQty };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: product.id,
            kode: product.kode,
            barcode: product.barcode,
            nama: product.nama,
            hargaJual: product.hargaJual,
            hargaBeli: product.hargaBeli,
            satuan: product.satuan || 'Pcs',
            stokTersedia: product.stok,
            jumlah: 1,
            diskonItem: 0,
          },
        ];
      }
    });

    success('Masuk Keranjang', `${product.nama} ditambahkan.`);
  };

  // Update item quantity directly or by delta
  const handleUpdateQty = (id: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(id);
      return;
    }

    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (newQty > item.stokTersedia) {
            warning('Stok Terbatas', `Stok tersedia hanya ${item.stokTersedia} ${item.satuan}.`);
            return { ...item, jumlah: item.stokTersedia };
          }
          return { ...item, jumlah: newQty };
        }
        return item;
      })
    );
  };

  // Update item discount
  const handleSaveItemDiscount = (id: string) => {
    const disc = Math.max(0, Number(itemDiscInput) || 0);
    setCart((prev) =>
      prev.map((item) => (item.id === id ? { ...item, diskonItem: disc } : item))
    );
    setEditingCartItemId(null);
    info('Diskon Item Disimpan', 'Diskon potongan item berhasil diperbarui.');
  };

  // Remove single item from cart
  const handleRemoveItem = (id: string) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  // Clear cart completely
  const handleClearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setDiskonCartNominal(0);
    setDiskonCartPersen(0);
    setPajakPersen(0);
    info('Keranjang Dibersihkan', 'Semua item dikeluarkan dari keranjang.');
  };

  // Calculations
  const subtotalRaw = cart.reduce(
    (acc, item) => acc + (item.hargaJual - item.diskonItem) * item.jumlah,
    0
  );

  const totalDiskonItem = cart.reduce(
    (acc, item) => acc + item.diskonItem * item.jumlah,
    0
  );

  const calculatedCartDiscount = diskonCartPersen > 0
    ? (subtotalRaw * diskonCartPersen) / 100
    : diskonCartNominal;

  const subtotalAfterDiscounts = Math.max(0, subtotalRaw - calculatedCartDiscount);

  const pajakNominal = (subtotalAfterDiscounts * pajakPersen) / 100;
  const totalHargaFinal = Math.round(subtotalAfterDiscounts + pajakNominal);

  // Total items count
  const totalItemCount = cart.reduce((acc, item) => acc + item.jumlah, 0);

  // Process Payment Trigger
  const handleOpenPayment = () => {
    if (cart.length === 0) {
      warning('Keranjang Kosong', 'Pilih minimal 1 produk terlebih dahulu.');
      return;
    }
    setIsPaymentOpen(true);
  };

  // Complete Payment Action (Save to Firestore, update stock & stock movements)
  const handleConfirmPayment = async (paymentDetails: {
    metodePembayaran: 'tunai' | 'qris' | 'transfer' | 'hutang';
    bayar: number;
    kembalian: number;
    bankNama?: string;
    noReferensi?: string;
    namaPelanggan?: string;
    catatan?: string;
  }) => {
    try {
      const kodeTrx = generateKodeTransaksi();
      const now = new Date().toISOString();

      const txPayload: Omit<TransaksiItem, 'id'> = {
        kodeTransaksi: kodeTrx,
        tanggal: now,
        items: cart.map((item) => ({
          produkId: item.id,
          kodeProduk: item.kode,
          namaProduk: item.nama,
          satuan: item.satuan,
          hargaJual: item.hargaJual,
          hargaBeli: item.hargaBeli,
          jumlah: item.jumlah,
          diskonItem: item.diskonItem,
          subtotal: (item.hargaJual - item.diskonItem) * item.jumlah,
        })),
        subtotal: subtotalRaw,
        diskonTotal: totalDiskonItem + calculatedCartDiscount,
        pajakPersen,
        pajakNominal,
        totalHarga: totalHargaFinal,
        bayar: paymentDetails.bayar,
        kembalian: paymentDetails.kembalian,
        metodePembayaran: paymentDetails.metodePembayaran,
        statusPembayaran: paymentDetails.metodePembayaran === 'hutang' ? 'belum_lunas' : 'lunas',
        bankNama: paymentDetails.bankNama,
        noReferensi: paymentDetails.noReferensi,
        namaPelanggan: paymentDetails.namaPelanggan || 'Pelanggan Umum',
        kasirName: 'Kasir Utama',
        catatan: paymentDetails.catatan,
        createdAt: now,
      };

      // Save transaction & update product stock + stock movements log in Firestore
      const newTxId = await createTransaction(txPayload);

      const completedTx: TransaksiItem = {
        id: newTxId,
        ...txPayload,
      };

      setLastCompletedTx(completedTx);
      setIsPaymentOpen(false);
      setIsReceiptOpen(true);

      success(
        'Transaksi Berhasil!',
        `No. ${kodeTrx} tersimpan. Stok barang otomatis diperbarui.`
      );
    } catch (err) {
      console.error('Error completing transaction:', err);
      toastError('Gagal Menyimpan Transaksi', 'Terjadi kesalahan sistem Firestore.');
    }
  };

  // Reset after printing or finishing
  const handleDoneTransaction = () => {
    setIsReceiptOpen(false);
    setLastCompletedTx(null);
    setCart([]);
    setDiskonCartNominal(0);
    setDiskonCartPersen(0);
    setPajakPersen(0);
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Kasir Sembako Realtime (POS)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
            Layar Transaksi Kasir
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Pencarian cepat, kalkulasi otomatis, update stok Firestore, dan cetak struk thermal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              searchInputRef.current?.focus();
              info('Scanner Fokus', 'Siap melakukan scan barcode.');
            }}
            className="px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/20 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <Barcode className="w-4 h-4 text-amber-500" />
            <span>Scan Barcode</span>
          </button>

          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              className="px-3 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Kosongkan Keranjang"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left 7 Columns: Search, Category Filters, and Products Grid */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Search Input Bar */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-4 rounded-2xl border border-emerald-500/20 shadow-lg flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDownSearch}
                placeholder="Scan barcode / ketik nama barang (Beras, Minyak, Telur, SKU)..."
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Chips Horizontal Scroll */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((cat, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                  selectedCategory === cat
                    ? `${accent.activeTab} shadow-md`
                    : 'bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Catalog Grid */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Katalog Produk ({filteredProducts.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Klik produk untuk memasukkan ke keranjang
              </span>
            </div>

            {isLoadingProducts ? (
              <div className="py-16 text-center space-y-3">
                <div className={`w-8 h-8 border-3 ${accent.border} border-t-transparent rounded-full animate-spin mx-auto`} />
                <p className="text-xs text-slate-500">Memuat katalog produk Firestore...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <PackageX className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-semibold">Produk tidak ditemukan</p>
                <p className="text-[11px]">Coba ubah kata kunci pencarian atau kategori.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                {filteredProducts.map((p) => {
                  const isOutOfStock = p.stok <= 0;
                  const isLowStock = p.stok > 0 && p.stok <= p.minStok;
                  const cartItem = cart.find((i) => i.id === p.id);

                  return (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      key={p.id}
                      onClick={() => handleAddToCart(p)}
                      disabled={isOutOfStock}
                      className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between gap-3 relative transition-all cursor-pointer ${
                        isOutOfStock
                          ? 'bg-slate-100/50 dark:bg-slate-900/30 border-slate-200/50 dark:border-slate-800/50 opacity-60 cursor-not-allowed'
                          : cartItem
                          ? `${accent.bgLight} ${accent.border} text-slate-900 dark:text-white shadow-md ring-1 ${accent.ring}`
                          : 'bg-slate-50/50 dark:bg-slate-950/50 border-slate-200/80 dark:border-slate-800 hover:border-slate-300'
                      }`}
                    >
                      {/* Product Image / Placeholder Icon */}
                      <div className="flex items-start justify-between gap-2">
                        {p.gambarUrl ? (
                          <img
                            src={p.gambarUrl}
                            alt={p.nama}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-200/60 dark:border-slate-800"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 font-bold text-xs">
                            {p.nama.charAt(0)}
                          </div>
                        )}

                        {cartItem && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-700 text-white shadow-sm">
                            x{cartItem.jumlah}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight">
                          {p.nama}
                        </h4>
                        <p className="text-[10px] text-slate-400 mt-0.5">SKU: {p.kode}</p>
                      </div>

                      {/* Price & Stock Badge */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                        <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                          {formatRupiah(p.hargaJual)}
                        </span>

                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            isOutOfStock
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : isLowStock
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {isOutOfStock ? 'Habis' : `Stok: ${p.stok}`}
                        </span>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Right 5 Columns: Active Cart & Calculation Summary */}
        <div className="lg:col-span-5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-2xl flex flex-col justify-between space-y-5">
          
          <div className="space-y-4">
            {/* Header Keranjang */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className={`w-5 h-5 ${accent.text} ${accent.textDark}`} />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Keranjang Penjualan
                </h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${accent.badge} border`}>
                {totalItemCount} Item
              </span>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2.5 max-h-[320px] overflow-y-auto custom-scrollbar pr-1">
              {cart.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <ShoppingCart className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-medium">Keranjang kasir masih kosong</p>
                  <p className="text-[10px] text-slate-400">Pilih barang dari katalog di sebelah kiri.</p>
                </div>
              ) : (
                <AnimatePresence>
                  {cart.map((item) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                            {item.nama}
                          </h4>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span>{formatRupiah(item.hargaJual)} / {item.satuan}</span>
                            {item.diskonItem > 0 && (
                              <span className="text-emerald-600 font-bold">
                                (Disc -{formatRupiah(item.diskonItem)})
                              </span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                          title="Hapus Item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Qty & Item Discount Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-800/50">
                        {/* Qty Controller */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.jumlah - 1)}
                            className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Minus className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                          </button>

                          <input
                            type="number"
                            value={item.jumlah}
                            onChange={(e) => handleUpdateQty(item.id, Number(e.target.value))}
                            className="w-10 text-center text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg py-0.5"
                          />

                          <button
                            type="button"
                            onClick={() => handleUpdateQty(item.id, item.jumlah + 1)}
                            className="p-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-slate-700 dark:text-slate-300" />
                          </button>
                        </div>

                        {/* Item Diskon Trigger */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCartItemId(item.id);
                            setItemDiscInput(item.diskonItem.toString());
                          }}
                          className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline flex items-center gap-1"
                        >
                          <Tag className="w-3 h-3" />
                          <span>{item.diskonItem > 0 ? `Disc: ${formatRupiah(item.diskonItem)}` : '+ Diskon'}</span>
                        </button>

                        {/* Subtotal Item */}
                        <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">
                          {formatRupiah((item.hargaJual - item.diskonItem) * item.jumlah)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Item Discount Modal Popover */}
            {editingCartItemId && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                  <span>Potongan Diskon Per Item (Rp)</span>
                  <button onClick={() => setEditingCartItemId(null)}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={itemDiscInput}
                    onChange={(e) => setItemDiscInput(e.target.value)}
                    placeholder="Contoh: 1000"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold focus:outline-none"
                  />
                  <button
                    onClick={() => handleSaveItemDiscount(editingCartItemId)}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Calculations Footer */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800 text-xs">
            
            {/* Global Diskon & Tax Controls */}
            <div className="grid grid-cols-2 gap-2">
              {/* Diskon Cart Input */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Diskon Nota (Rp)
                </label>
                <input
                  type="number"
                  value={diskonCartNominal || ''}
                  onChange={(e) => {
                    setDiskonCartNominal(Number(e.target.value));
                    setDiskonCartPersen(0);
                  }}
                  placeholder="Rp 0"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Pajak PPN % Selector */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Pajak (PPN)
                </label>
                <select
                  value={pajakPersen}
                  onChange={(e) => setPajakPersen(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 font-bold focus:outline-none focus:border-emerald-500 text-xs cursor-pointer"
                >
                  <option value={0}>0% (Tanpa PPN)</option>
                  <option value={11}>11% (PPN Standar)</option>
                  <option value={12}>12% (PPN Terbaru)</option>
                </select>
              </div>
            </div>

            {/* Detailed Calculations Breakdown */}
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Subtotal Barang:</span>
                <span>{formatRupiah(subtotalRaw)}</span>
              </div>

              {calculatedCartDiscount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span>Diskon Tambahan:</span>
                  <span>-{formatRupiah(calculatedCartDiscount)}</span>
                </div>
              )}

              {pajakNominal > 0 && (
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Pajak PPN ({pajakPersen}%):</span>
                  <span>+{formatRupiah(pajakNominal)}</span>
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-1.5 flex justify-between font-extrabold text-sm text-slate-900 dark:text-white">
                <span>TOTAL GRAND:</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono text-base">
                  {formatRupiah(totalHargaFinal)}
                </span>
              </div>
            </div>

            {/* Pay Trigger Button */}
            <button
              onClick={handleOpenPayment}
              disabled={cart.length === 0}
              className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                cart.length === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${accent.gradient} hover:opacity-90 text-white shadow-lg`
              }`}
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>Proses Pembayaran ({formatRupiah(totalHargaFinal)})</span>
            </button>
          </div>

        </div>

      </div>

      {/* Modal Pembayaran */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        subtotal={subtotalRaw}
        diskonTotal={totalDiskonItem + calculatedCartDiscount}
        pajakNominal={pajakNominal}
        totalHarga={totalHargaFinal}
        itemCount={totalItemCount}
        onConfirmPayment={handleConfirmPayment}
      />

      {/* Modal Cetak Struk Thermal */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        transaction={lastCompletedTx}
        onDone={handleDoneTransaction}
      />

    </div>
  );
};
