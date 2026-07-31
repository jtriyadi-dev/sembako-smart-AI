import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../context/AuthContext';
import { exportUserGuideToPDF } from '../utils/pdfGuideGenerator';
import {
  BookOpen,
  Keyboard,
  Sparkles,
  HelpCircle,
  Printer,
  Boxes,
  ShoppingCart,
  Database,
  Search,
  Store,
  FileSpreadsheet,
  Wifi,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  ArrowRight,
  Mic,
  Tag,
  KeyRound,
  Download,
  BarChart3,
  Receipt,
  ScanLine,
  FileText,
} from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DocumentationModal: React.FC<DocumentationModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { isDemoSession } = useAuth();
  const [activeTab, setActiveTab] = useState<'langkah' | 'shortcut' | 'ai' | 'faq'>('langkah');
  const [searchQuery, setSearchQuery] = useState('');

  const guides = [
    {
      id: 'toko',
      step: '1',
      title: 'Pengaturan Toko & Identitas Struk',
      icon: Store,
      badge: 'Langkah Awal',
      color: 'border-emerald-500/30 bg-emerald-500/5',
      summary: 'Atur nama toko, alamat, nomor telp/WA, dan ucapan terima kasih pada nota cetak.',
      points: [
        'Klik nama toko di pojok kiri atas (Header) atau buka menu Pengaturan > Profil Toko.',
        'Isi Nama Toko, Alamat Pasar/Jalan, Nomor Telp / WhatsApp, serta Footer Nota (cth: "Barang yang sudah dibeli tidak dapat ditukar").',
        'Nama toko yang disimpan akan langsung tampil BESAR di bagian atas layar aplikasi dan pada struk belanja thermal.',
      ],
    },
    {
      id: 'produk',
      step: '2',
      title: 'Menambah Produk & Import Massal Excel',
      icon: FileSpreadsheet,
      badge: 'Manajemen Barang',
      color: 'border-blue-500/30 bg-blue-500/5',
      summary: 'Kelola stok awal barang sembako atau unggah puluhan produk dari file Microsoft Excel.',
      points: [
        'Tambah Manual: Buka menu Produk > Klik "+ Tambah Produk". Isi Nama, SKU, Kategori, Harga Beli, Harga Jual, Stok, dan Barcode.',
        'Import Excel CSV: Buka menu Pengaturan > Import Produk. Klik tombol "Unduh Template Excel (.CSV)".',
        'Buka template di Excel, isi data produk (Beras, Minyak, Gula, dll.), simpan sebagai CSV (Comma Delimited), lalu unggah ke aplikasi.',
        'Periksa pratinjau data produk lalu klik "Proses Simpan All Produk ke Firestore".',
      ],
    },
    {
      id: 'kasir',
      step: '3',
      title: 'Transaksi Kasir POS & Barcode Scanner',
      icon: ShoppingCart,
      badge: 'Penjualan Kilat',
      color: 'border-amber-500/30 bg-amber-500/5',
      summary: 'Proses transaksi belanja pembeli dengan cepat, hitung kembalian, dan cetak nota.',
      points: [
        'Pencarian Barang: Klik kartu produk atau gunakan kolom pencarian / scan barcode menggunakan kamera HP/Laptop atau Scanner USB.',
        'Atur Kuantitas & Promo: Sesuaikan jumlah beli (+/-), diskon nominal/persen, atau sertakan kode kupon.',
        'Pembayaran: Pilih metode Tunai, QRIS, atau Transfer Bank.',
        'Nominal Kembalian: Manfaatkan tombol "Uang Pas" atau pecahan uang rupiah (Rp10k, Rp20k, Rp50k, Rp100k) untuk menghitung kembalian secara tepat.',
        'Cetak Struk: Klik "Bayar & Cetak Struk" untuk memunculkan nota transaksi.',
      ],
    },
    {
      id: 'stok',
      step: '4',
      title: 'Kelola Stok, Opname & Alert Stok Menipis',
      icon: Boxes,
      badge: 'Inventori',
      color: 'border-purple-500/30 bg-purple-500/5',
      summary: 'Pantau mutasi barang dan sesuaikan fisik stok jika ada selisih atau barang rusak.',
      points: [
        'Peringatan Minimum Stok: Barang yang stoknya di bawah 5 pcs akan otomatis ditandai dengan badge merah/kuning.',
        'Stock Opname: Buka menu Stok > Klik "Stock Opname". Masukkan jumlah fisik riil di gudang dan pilih alasan (Barang Rusak, Kadaluarsa, atau Selisih Fisik).',
        'Kartu Mutasi: Riwayat penambahan dan pengurangan stok terekam otomatis di log inventori.',
      ],
    },
    {
      id: 'printer',
      step: '5',
      title: 'Pencetakan Struk Thermal (Bluetooth / USB)',
      icon: Printer,
      badge: 'Hardware',
      color: 'border-rose-500/30 bg-rose-500/5',
      summary: 'Hubungkan printer thermal ukuran 58mm atau 80mm untuk mencetak nota kasir.',
      points: [
        'Buka menu Pengaturan > Printer Struk.',
        'Pilih Lebar Kertas (58mm atau 80mm) dan jenis printer (Thermal Bluetooth / USB / Network).',
        'Aktifkan toggle "Otomatis Cetak Struk Setelah Pembayaran" agar dialog cetak langsung terbuka.',
        'Gunakan tombol "Uji Cetak Printer" untuk memastikan koneksi printer terhubung dengan baik.',
      ],
    },
    {
      id: 'ai',
      step: '6',
      title: 'Kecerdasan Gemini AI & Perintah Suara (Voice Command)',
      icon: Sparkles,
      badge: 'AI Assistant',
      color: 'border-emerald-500/30 bg-emerald-500/5',
      summary: 'Manfaatkan kecerdasan AI untuk analisis toko dan kontrol aplikasi lewat suara.',
      points: [
        'Perintah Suara: Tekan ikon Mikrofon di pencarian kasir dan katakan misalnya "Beras Sania 5kg" untuk memasukkan ke keranjang secara bebas genggam.',
        'Gemini AI Assistant: Buka menu "AI Assistant". Tanyakan analisis barang terlaris, barang mati (deadstock), atau saran paket bundling promo.',
      ],
    },
    {
      id: 'offline',
      step: '7',
      title: 'Akses Offline & Sinkronisasi Otomatis',
      icon: Wifi,
      badge: 'Offline-First',
      color: 'border-cyan-500/30 bg-cyan-500/5',
      summary: 'Aplikasi dapat diakses tanpa koneksi internet dan otomatis tersinkron saat online kembali.',
      points: [
        'Aplikasi dilengkapi teknologi Progressive Web App (PWA) & IndexedDB local caching.',
        'Jika koneksi internet mati, indikator di header akan berubah menjadi "Mode Offline" warna kuning.',
        'Anda tetap bisa melakukan kasir dan mengecek stok. Ketika internet terhubung kembali, data otomatis disinkronkan ke Cloud Database Firestore.',
      ],
    },
    {
      id: 'lisensi',
      step: '8',
      title: 'Aktivasi Lisensi Software Commercial Pro',
      icon: KeyRound,
      badge: 'Lisensi Commercial',
      color: 'border-amber-500/30 bg-amber-500/5',
      summary: 'Sistem lisensi siap pakai untuk dijual ke pemilik toko / klien.',
      points: [
        'Buka menu Pengaturan > Lisensi Software (atau klik badge Lisensi di Header).',
        'Masukkan 16-karakter License Key Resmi Anda.',
        'Klik "Proses Aktivasi Lisensi". Status lisensi akan berubah menjadi AKTIF TERVERIFIKASI seumur hidup.',
      ],
    },
  ];

  const filteredGuides = guides
    .filter((g) => !isDemoSession || g.id !== 'lisensi')
    .filter(
      (g) =>
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.points.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()))
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Panduan Lengkap Cara Menggunakan Aplikasi"
      subtitle="Manual Penggunaan Sembako Smart AI Platform Kasir & Gudang"
      maxWidth="max-w-4xl"
    >
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2">
            {[
              { id: 'langkah', label: 'Panduan Fitur 8-Langkah', icon: BookOpen },
              { id: 'shortcut', label: 'Keyboard Shortcut', icon: Keyboard },
              { id: 'ai', label: 'Contoh Pertanyaan AI', icon: Sparkles },
              { id: 'faq', label: 'Tanya Jawab (FAQ)', icon: HelpCircle },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => exportUserGuideToPDF()}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
              title="Download Panduan Lengkap PDF (Termasuk Diagram & Gambar)"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Panduan</span>
            </button>

            <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold hidden md:inline-block">
              Sembako Smart v2.5 Pro
            </span>
          </div>
        </div>

        {/* TAB 1: PANDUAN LANGKAH DENGAN SEARCH BAR */}
        {activeTab === 'langkah' && (
          <div className="space-y-4">
            {/* Search Bar in Docs */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Cari topik panduan (misal: kasir, excel, barcode, printer, offline, opname)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Steps Container */}
            <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1 custom-scrollbar">
              {filteredGuides.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 dark:bg-slate-950 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  Tidak ditemukan materi panduan dengan kata kunci "{searchQuery}".
                </div>
              ) : (
                filteredGuides.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`p-4 rounded-2xl border ${item.color} space-y-2.5 transition-all hover:shadow-sm`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                            {item.step}
                          </span>
                          <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                            <Icon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>{item.title}</span>
                          </h4>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {item.badge}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                        {item.summary}
                      </p>

                      <ul className="space-y-1.5 pt-1">
                        {item.points.map((pt, pIdx) => (
                          <li
                            key={pIdx}
                            className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 leading-relaxed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: KEYBOARD SHORTCUT */}
        {activeTab === 'shortcut' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Manfaatkan tombol shortcut keyboard berikut untuk transaksi kasir yang lebih cepat:
            </p>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-200 uppercase">
                  <tr>
                    <th className="p-3">Tombol Keyboard</th>
                    <th className="p-3">Halaman / Area</th>
                    <th className="p-3">Fungsi / Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">ESC</td>
                    <td className="p-3 text-slate-500">Global / Modal</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">Menutup jendela modal dialog yang aktif</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">Enter</td>
                    <td className="p-3 text-slate-500">Kasir POS / Form</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">Konfirmasi pembayaran / simpan formulir</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">Uang Pas (Click)</td>
                    <td className="p-3 text-slate-500">Pembayaran Kasir</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">Mengisi nominal bayar sama persis dengan Total Belanja</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">Barcode Scanner USB</td>
                    <td className="p-3 text-slate-500">Kasir / Produk</td>
                    <td className="p-3 text-slate-800 dark:text-slate-200">Otomatis mencari SKU barang dan menambahkan ke keranjang</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: GEMINI AI PROMPTS */}
        {activeTab === 'ai' && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-500">
              Contoh pertanyaan cerdas untuk dianalisis oleh **Gemini AI Assistant**:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                {
                  title: 'Analisis Penjualan & Produk Laris',
                  query: 'Produk sembako apa yang paling laris minggu ini dan menghasilkan omzet terbesar?',
                },
                {
                  title: 'Peringatan Restock Gudang',
                  query: 'Barang apa saja yang stoknya di bawah batas minimum dan harus segera dibeli ke supplier?',
                },
                {
                  title: 'Analisis Stok Mati (Deadstock)',
                  query: 'Apakah ada produk yang sudah disimpan lama tapi tidak pernah terjual?',
                },
                {
                  title: 'Estimasi Modal & Aset',
                  query: 'Berapa total estimasi nilai aset modal belanja yang mengendap di gudang toko saya?',
                },
                {
                  title: 'Ide Promo & Bundling',
                  query: 'Berikan saran promosi paket hemat sembako (cth: Beras 5kg + Minyak 2L + Gula 1kg) untuk menarik pembeli.',
                },
                {
                  title: 'Prediksi Keuntungan Harian',
                  query: 'Berapa rata-rata marjin keuntungan toko per hari berdasarkan riwayat transaksi terbaru?',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 space-y-1.5"
                >
                  <h4 className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.title}</span>
                  </h4>
                  <p className="font-mono text-[11px] text-slate-700 dark:text-amber-100/90 italic bg-white/50 dark:bg-black/20 p-2 rounded-xl border border-amber-500/20">
                    "{item.query}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: FAQ (TANYA JAWAB) */}
        {activeTab === 'faq' && (
          <div className="space-y-3 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200">
                Q: Apakah data toko saya aman jika browser ditutup atau laptop dimatikan?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                A: Sangat aman! Semua data produk, transaksi, dan riwayat mutasi stok tersimpan secara permanen dan real-time di Cloud Database Firebase Firestore.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200">
                Q: Bagaimana cara kerja aplikasi saat mati lampu atau internet terputus?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                A: Aplikasi ini mengadopsi teknologi **Offline-First (PWA & IndexedDB)**. Saat offline, kasir tetap bisa melayani pembeli. Begitu internet terhubung kembali, data transaksi offline akan otomatis disinkronkan ke Cloud Firestore tanpa ada data yang hilang.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
              <h4 className="font-extrabold text-slate-800 dark:text-slate-200">
                Q: Bagaimana cara menghubungkan Printer Thermal Struk Bluetooth?
              </h4>
              <p className="text-slate-500 leading-relaxed">
                A: Hubungkan printer Bluetooth ke perangkat HP/Tablet/Laptop terlebih dahulu melalui Bluetooth Settings. Kemudian di aplikasi, buka Pengaturan &gt; Printer Struk, pilih ukuran 58mm/80mm, lalu lakukan Uji Cetak.
              </p>
            </div>

            {!isDemoSession && (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                <h4 className="font-extrabold text-slate-800 dark:text-slate-200">
                  Q: Bagaimana cara memasukkan lisensi agar status software menjadi Pro seumur hidup?
                </h4>
                <p className="text-slate-500 leading-relaxed">
                  A: Buka menu Pengaturan &gt; Lisensi Software. Masukkan 16-karakter Kode Lisensi Resmi Anda lalu tekan "Proses Aktivasi Lisensi". Status lisensi akan berubah menjadi aktif seumur hidup.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
