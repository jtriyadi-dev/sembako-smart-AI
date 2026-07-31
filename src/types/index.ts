export type PageId = 
  | 'landing'
  | 'login'
  | 'activation'
  | 'dashboard'
  | 'produk'
  | 'stok'
  | 'supplier'
  | 'kasir'
  | 'transaksi'
  | 'laporan'
  | 'ai-assistant'
  | 'setting';

export type ThemeMode = 'light' | 'dark';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: 'owner' | 'kasir' | 'admin';
  namaToko?: string;
  alamatToko?: string;
  noHp?: string;
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export interface SupplierItem {
  id: string;
  kodeSupplier: string; // e.g. SUP-001
  namaSupplier: string; // e.g. PT Sumber Sembako Nusantara
  kontakPerson?: string; // e.g. Pak Budi / Bu Rina
  telepon: string;
  email?: string;
  alamat?: string;
  kategoriProduk?: string; // e.g. Beras, Minyak, Gula
  catatan?: string;
  status: 'aktif' | 'nonaktif';
  createdAt?: string;
  updatedAt?: string;
}

export interface ProdukItem {
  id: string;
  kode: string; // SKU
  barcode?: string; // Barcode EAN-13 / Custom
  nama: string;
  kategori: string;
  hargaBeli: number; // Harga Modal
  hargaJual: number;
  stok: number;
  minStok: number;
  satuan: string;
  gambarUrl?: string;
  deskripsi?: string;
  expiredDate?: string; // Tanggal Kedaluwarsa (YYYY-MM-DD)
  batchNo?: string;
  supplierId?: string; // ID Supplier Pemasok
  supplierNama?: string; // Nama Supplier Pemasok
  terjual?: number;
  createdAt?: string;
  updatedAt?: string;
}

export type MovementType = 'masuk' | 'keluar' | 'penyesuaian' | 'opname';

export interface StockMovement {
  id: string;
  produkId: string;
  namaProduk: string;
  kodeProduk: string;
  tipe: MovementType;
  jumlah: number;
  stokAwal: number;
  stokAkhir: number;
  keterangan: string;
  supplierId?: string;
  supplier?: string;
  expiredDate?: string;
  batchNo?: string;
  createdAt: string;
  operator?: string;
}

export interface StockOpname {
  id: string;
  tanggal: string;
  produkId: string;
  namaProduk: string;
  kodeProduk: string;
  stokSistem: number;
  stokFisik: number;
  selisih: number; // stokFisik - stokSistem
  alasan: string;
  status: 'selesai' | 'draft';
  createdAt: string;
  operator?: string;
}

export interface CartItem {
  id: string; // produkId
  kode: string;
  barcode?: string;
  nama: string;
  hargaJual: number;
  hargaBeli: number;
  satuan: string;
  stokTersedia: number;
  jumlah: number;
  diskonItem: number; // Diskon nominal per item (misal Rp 1.000)
}

export interface TransaksiDetailItem {
  produkId: string;
  kodeProduk: string;
  namaProduk: string;
  satuan: string;
  hargaJual: number;
  hargaBeli: number;
  jumlah: number;
  diskonItem: number;
  subtotal: number;
  returQty?: number;
  alasanReturItem?: string;
  returAtItem?: string;
}

export interface RiwayatReturItem {
  id: string;
  produkId: string;
  namaProduk: string;
  jumlahRetur: number;
  hargaJual: number;
  refundNominal: number;
  alasan: string;
  returAt: string;
  operator: string;
}

export interface TransaksiItem {
  id: string;
  kodeTransaksi: string;
  tanggal: string;
  items: TransaksiDetailItem[];
  subtotal: number;
  diskonTotal: number;
  pajakPersen: number;
  pajakNominal: number;
  totalHarga: number;
  totalRefund?: number;
  bayar: number;
  kembalian: number;
  metodePembayaran: 'tunai' | 'qris' | 'transfer' | 'hutang';
  statusPembayaran: 'lunas' | 'pending' | 'belum_lunas' | 'retur' | 'retur_sebagian';
  bankNama?: string;
  noReferensi?: string;
  namaPelanggan?: string;
  kasirName?: string;
  catatan?: string;
  alasanRetur?: string;
  returAt?: string;
  riwayatRetur?: RiwayatReturItem[];
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isAiSuggestedAction?: boolean;
}
