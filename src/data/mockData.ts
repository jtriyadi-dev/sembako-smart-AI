export interface DashboardSummary {
  omzetHariIni: number;
  omzetKemarin: number;
  persenOmzetGrowth: number;
  totalTransaksiHariIni: number;
  transaksiKemarin: number;
  persenTransaksiGrowth: number;
  rataRataNota: number;
  marginKeuntungan: number;
  totalProdukSku: number;
  totalStokAmanSku: number;
  totalKategori: number;
  totalMember: number;
  memberBaruMingguIni: number;
  memberAktifHariIni: number;
  targetOmzetBulanIni: number;
  realisasiOmzetBulanIni: number;
}

export interface HourlySales {
  jam: string;
  penjualan: number;
  transaksi: number;
}

export interface DailySales {
  hari: string;
  omzet: number;
  target: number;
  transaksi: number;
}

export interface TopProduct {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  terjual: number;
  satuan: string;
  totalOmzet: number;
  gambarUrl?: string;
  trend: 'up' | 'down' | 'stable';
}

export interface LowStockProduct {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
  stokCurrent: number;
  minStok: number;
  satuan: string;
  hargaBeli: number;
  hargaJual: number;
  supplier: string;
}

export interface TopMember {
  id: string;
  kodeMember: string;
  nama: string;
  noHp: string;
  tier: 'Platinum' | 'Gold' | 'Silver' | 'Bronze';
  totalPoin: number;
  totalBelanjaBulanIni: number;
  transaksiTerakhir: string;
}

export interface ActivityLog {
  id: string;
  waktu: string;
  tipe: 'transaksi' | 'stok' | 'member' | 'system' | 'ai';
  judul: string;
  deskripsi: string;
  nilai?: string;
  status: 'sukses' | 'warning' | 'info';
}

export const initialDashboardSummary: DashboardSummary = {
  omzetHariIni: 0,
  omzetKemarin: 0,
  persenOmzetGrowth: 0,
  totalTransaksiHariIni: 0,
  transaksiKemarin: 0,
  persenTransaksiGrowth: 0,
  rataRataNota: 0,
  marginKeuntungan: 0,
  totalProdukSku: 0,
  totalStokAmanSku: 0,
  totalKategori: 0,
  totalMember: 0,
  memberBaruMingguIni: 0,
  memberAktifHariIni: 0,
  targetOmzetBulanIni: 0,
  realisasiOmzetBulanIni: 0,
};

export const demoDashboardSummary: DashboardSummary = {
  omzetHariIni: 4850000,
  omzetKemarin: 4240000,
  persenOmzetGrowth: 14.38,
  totalTransaksiHariIni: 86,
  transaksiKemarin: 72,
  persenTransaksiGrowth: 19.44,
  rataRataNota: 56395,
  marginKeuntungan: 873000,
  totalProdukSku: 124,
  totalStokAmanSku: 119,
  totalKategori: 8,
  totalMember: 328,
  memberBaruMingguIni: 14,
  memberAktifHariIni: 28,
  targetOmzetBulanIni: 120000000,
  realisasiOmzetBulanIni: 94500000,
};

export const hourlySalesData: HourlySales[] = [
  { jam: '08:00', penjualan: 320000, transaksi: 6 },
  { jam: '10:00', penjualan: 850000, transaksi: 14 },
  { jam: '12:00', penjualan: 1240000, transaksi: 22 },
  { jam: '14:00', penjualan: 690000, transaksi: 12 },
  { jam: '16:00', penjualan: 980000, transaksi: 18 },
  { jam: '18:00', penjualan: 540000, transaksi: 10 },
  { jam: '20:00', penjualan: 230000, transaksi: 4 },
];

export const weeklySalesData: DailySales[] = [
  { hari: 'Senin', omzet: 3800000, target: 4000000, transaksi: 68 },
  { hari: 'Selasa', omzet: 4100000, target: 4000000, transaksi: 74 },
  { hari: 'Rabu', omzet: 3950000, target: 4000000, transaksi: 70 },
  { hari: 'Kamis', omzet: 4500000, target: 4000000, transaksi: 81 },
  { hari: 'Jumat', omzet: 5200000, target: 4500000, transaksi: 95 },
  { hari: 'Sabtu', omzet: 6100000, target: 5000000, transaksi: 112 },
  { hari: 'Minggu', omzet: 4850000, target: 4500000, transaksi: 86 },
];

export const monthlySalesData = [
  { minggu: 'Minggu 1', omzet: 26500000, target: 25000000, transaksi: 480 },
  { minggu: 'Minggu 2', omzet: 29800000, target: 28000000, transaksi: 530 },
  { minggu: 'Minggu 3', omzet: 31200000, target: 30000000, transaksi: 560 },
  { minggu: 'Minggu 4', omzet: 27000000, target: 27000000, transaksi: 490 },
];

export const topProductsData: TopProduct[] = [];

export const demoTopProductsData: TopProduct[] = [
  {
    id: 'P-001',
    kode: 'BRS-001',
    nama: 'Beras Setra Ramos Super 5kg',
    kategori: 'Sembako Utama',
    terjual: 142,
    satuan: 'Sak',
    totalOmzet: 9940000,
    trend: 'up',
  },
  {
    id: 'P-002',
    kode: 'MNY-002',
    nama: 'Minyak Goreng Tropical Refill 2L',
    kategori: 'Minyak & Lemak',
    terjual: 98,
    satuan: 'Pouch',
    totalOmzet: 3724000,
    trend: 'up',
  },
  {
    id: 'P-003',
    kode: 'GLA-003',
    nama: 'Gula Pasir Premium Gulaku 1kg',
    kategori: 'Sembako Utama',
    terjual: 85,
    satuan: 'Kg',
    totalOmzet: 1445000,
    trend: 'stable',
  },
  {
    id: 'P-004',
    kode: 'TLR-004',
    nama: 'Telur Ayam Negeri Fresh 1kg',
    kategori: 'Sembako Utama',
    terjual: 76,
    satuan: 'Kg',
    totalOmzet: 2128000,
    trend: 'up',
  },
  {
    id: 'P-005',
    kode: 'MIE-005',
    nama: 'Indomie Goreng Spesial (Karton/40pcs)',
    kategori: 'Makanan Instant',
    terjual: 42,
    satuan: 'Dus',
    totalOmzet: 5040000,
    trend: 'stable',
  },
];

export const lowStockProductsData: LowStockProduct[] = [];

export const demoLowStockProductsData: LowStockProduct[] = [
  {
    id: 'P-006',
    kode: 'MNY-006',
    nama: 'MinyakKita Subsidi 1L',
    kategori: 'Minyak & Lemak',
    stokCurrent: 4,
    minStok: 20,
    satuan: 'Pouch',
    hargaBeli: 13500,
    hargaJual: 15000,
    supplier: 'PT Distribusi Sembako Nusantara',
  },
  {
    id: 'P-007',
    kode: 'TRG-007',
    nama: 'Tepung Terigu Cakra Kembar 1kg',
    kategori: 'Bumbu & Tepung',
    stokCurrent: 5,
    minStok: 15,
    satuan: 'Kg',
    hargaBeli: 11000,
    hargaJual: 13000,
    supplier: 'Bogasari Distributor Utama',
  },
  {
    id: 'P-008',
    kode: 'GMR-008',
    nama: 'Garam Beryodium Cap Kapal 250g',
    kategori: 'Bumbu & Tepung',
    stokCurrent: 3,
    minStok: 25,
    satuan: 'Bks',
    hargaBeli: 2500,
    hargaJual: 3500,
    supplier: 'CV Bumbu Jaya',
  },
  {
    id: 'P-009',
    kode: 'SPS-009',
    nama: 'Susu Kental Manis Frisian Flag 370g',
    kategori: 'Susu & Olahan',
    stokCurrent: 6,
    minStok: 18,
    satuan: 'Kaleng',
    hargaBeli: 10500,
    hargaJual: 12500,
    supplier: 'PT Frisian Flag Indonesia',
  },
  {
    id: 'P-010',
    kode: 'KCP-010',
    nama: 'Kecap Manis Bango Refill 520ml',
    kategori: 'Bumbu & Tepung',
    stokCurrent: 2,
    minStok: 12,
    satuan: 'Pouch',
    hargaBeli: 21000,
    hargaJual: 24500,
    supplier: 'Unilever Distro',
  },
];

export const topMembersData: TopMember[] = [];

export const initialActivityLogs: ActivityLog[] = [];

export const demoActivityLogs: ActivityLog[] = [
  {
    id: 'ACT-001',
    waktu: '2 Menit lalu',
    tipe: 'transaksi',
    judul: 'Transaksi Berhasil #TRX-20260728-086',
    deskripsi: 'Ibu Hj. Mariam membeli Beras Ramos 5kg & Minyak Tropical 2L',
    nilai: 'Rp 145.000',
    status: 'sukses',
  },
  {
    id: 'ACT-002',
    waktu: '15 Menit lalu',
    tipe: 'stok',
    judul: 'Restock Beras Setra Ramos',
    deskripsi: 'Kasir Budi menambahkan stok +20 Sak dari Supplier Utama',
    nilai: '+20 Sak',
    status: 'sukses',
  },
  {
    id: 'ACT-003',
    waktu: '35 Menit lalu',
    tipe: 'member',
    judul: 'Member Baru Terdaftar',
    deskripsi: 'Bpk. H. Ahmad Dahlan berhasil didaftarkan ke Tier Gold',
    nilai: 'Bonus +50 Poin',
    status: 'info',
  },
  {
    id: 'ACT-004',
    waktu: '1 Jam lalu',
    tipe: 'ai',
    judul: 'Smart AI Inventory Alert',
    deskripsi: 'Stok MinyakKita Subsidi tersisa 4 pouch. Direkomendasikan segera reorder.',
    nilai: 'Peringatan Stok',
    status: 'warning',
  },
  {
    id: 'ACT-005',
    waktu: '1.5 Jam lalu',
    tipe: 'transaksi',
    judul: 'Transaksi Non-Tunai QRIS #TRX-20260728-085',
    deskripsi: 'Pembayaran QRIS BCA diterima secara instan',
    nilai: 'Rp 82.500',
    status: 'sukses',
  },
];
