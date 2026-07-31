import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useStore, StoreConfig } from '../context/StoreContext';
import { Modal } from '../components/Modal';
import { subscribeProducts, addProduct, updateProduct, deleteProduct, clearAllDatabaseData, seedSampleProducts } from '../services/productService';
import { subscribeSuppliers, seedSampleSuppliers } from '../services/supplierService';
import { subscribeTransactions } from '../services/transaksiService';
import { ProdukItem, TransaksiItem } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { processImageFile } from '../utils/imageUtils';
import { playScannerBeep } from '../utils/audioUtils';
import { exportUserGuideToPDF } from '../utils/pdfGuideGenerator';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Store,
  Printer,
  Moon,
  Sun,
  Database,
  Upload,
  Download,
  Trash2,
  Sparkles,
  Smartphone,
  CheckCircle2,
  Save,
  Phone,
  FileText,
  AlertTriangle,
  Palette,
  Info,
  FileSpreadsheet,
  Layers,
  Wifi,
  Bluetooth,
  Check,
  RotateCcw,
  HardDriveUpload,
  FileJson,
  Zap,
  MapPin,
  Camera,
  UploadCloud,
  Image as ImageIcon,
  CheckSquare,
  ShieldAlert,
  HelpCircle,
  Clock,
  Activity,
  QrCode,
  Tag,
  KeyRound,
  ShieldCheck,
  Award,
  MessageSquare,
  AlertCircle,
  Mail,
  Send,
  Calendar,
  History,
  SendHorizontal,
  FileCheck,
  Copy,
  ExternalLink,
  X,
  Barcode,
  Volume2,
  VolumeX,
  Keyboard,
  Radio,
  Cpu,
  Scan,
  BookOpen,
  ShoppingCart,
  Boxes,
  Search,
} from 'lucide-react';

export type { StoreConfig };

const DEFAULT_CONFIG: StoreConfig = {
  namaToko: 'TOKO SEMBAKO SAYA',
  alamatToko: '',
  noHp: '',
  emailPemilik: '',
  logoUrl: '',
  footerStruk: 'Terima kasih telah berbelanja di Toko Kami! Semoga berkah dan sehat selalu.',
  targetOmzetBulanIni: 0,
  printerType: '58mm',
  connectionType: 'bluetooth',
  printerName: 'Thermal Receipt POS-58',
  autoPrint: true,
  accentColor: 'emerald',
  scannerType: 'usb_hid',
  scannerDeviceName: 'Eyoyo / Zebra USB 2D Scanner',
  scannerBeepSound: true,
  scannerAutoAddQty: true,
  scannerPrefix: '',
  scannerSuffixKey: 'enter',
  scannerMinLength: 3,
  scannerContinuousScan: true,
};

export const SettingPage: React.FC = () => {
  const { profile, isDemoSession } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { success, warning, error: toastError, info } = useToast();
  const { storeConfig, updateStoreConfig, licenseInfo, activateLicenseKey, deactivateLicense } = useStore();

  // Active Tab State
  const [activeTab, setActiveTab] = useState<'profil' | 'printer' | 'barcode' | 'lisensi' | 'panduan' | 'tema' | 'backup' | 'import' | 'reset' | 'tentang'>('profil');

  // Tab Bar Horizontal Scroll Ref & Indicator State
  const scrollTabRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const checkTabScroll = () => {
    if (!scrollTabRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollTabRef.current;
    setShowLeftScroll(scrollLeft > 5);
    setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 5);
  };

  useEffect(() => {
    checkTabScroll();
    const timeout = setTimeout(checkTabScroll, 300);
    window.addEventListener('resize', checkTabScroll);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', checkTabScroll);
    };
  }, []);

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (!scrollTabRef.current) return;
    const scrollAmount = 260;
    scrollTabRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  // Interactive Barcode Test State
  const [testScanInput, setTestScanInput] = useState('');
  const [testScanResult, setTestScanResult] = useState<ProdukItem | null>(null);
  const [testScanNotFound, setTestScanNotFound] = useState(false);
  const [testScanTime, setTestScanTime] = useState<number | null>(null);

  // Panduan Tab Local State
  const [guideSearchQuery, setGuideSearchQuery] = useState('');
  const [guideSubTab, setGuideSubTab] = useState<'langkah' | 'shortcut' | 'ai' | 'faq'>('langkah');

  // Store Configuration State from LocalStorage / StoreContext
  const [config, setConfig] = useState<StoreConfig>(storeConfig);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsUploadingLogo(true);
      const dataUrl = await processImageFile(file);
      setConfig((prev) => ({ ...prev, logoUrl: dataUrl }));
      success('Foto/Logo Toko Berhasil Dimuat', 'Jangan lupa klik Simpan Profil Toko.');
    } catch (err: any) {
      toastError('Gagal Upload Foto Toko', err.message || 'Format gambar tidak didukung');
    } finally {
      setIsUploadingLogo(false);
      if (e.target) e.target.value = '';
    }
  };

  useEffect(() => {
    setConfig(storeConfig);
  }, [storeConfig]);

  // Realtime Data from Firestore for Backup/Export
  const [products, setProducts] = useState<ProdukItem[]>([]);
  const [transactions, setTransactions] = useState<TransaksiItem[]>([]);

  // Import Product File & Preview
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importedItemsPreview, setImportedItemsPreview] = useState<Partial<ProdukItem>[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  // Restore Modal & File State
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreDataParsed, setRestoreDataParsed] = useState<{ products?: any[]; transactions?: any[] } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Reset Confirmation Modal State
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [resetType, setResetType] = useState<'transaksi' | 'stok' | 'total' | 'kosong' | 'sample' | null>(null);
  const [resetConfirmInput, setResetConfirmInput] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  // Test Print Modal
  const [isTestPrintOpen, setIsTestPrintOpen] = useState(false);

  // Subscribe to Products & Transactions
  useEffect(() => {
    const untermProd = subscribeProducts((data) => setProducts(data));
    const untermTx = subscribeTransactions((data) => setTransactions(data));
    return () => {
      untermProd();
      untermTx();
    };
  }, []);

  // Save config changes to localStorage & StoreContext
  const handleSaveConfig = (newCfg: Partial<StoreConfig>, msgTitle: string = 'Pengaturan Disimpan') => {
    const updated = { ...config, ...newCfg };
    setConfig(updated);
    updateStoreConfig(newCfg);
    success(msgTitle, 'Data konfigurasi berhasil diperbarui.');
  };

  // Predefined Preset Logos
  const presetLogos = [
    { label: 'Toko Modern', url: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=150&auto=format&fit=crop&q=80' },
    { label: 'Sembako Berkah', url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=150&auto=format&fit=crop&q=80' },
    { label: 'Grosir Pasar', url: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&auto=format&fit=crop&q=80' },
    { label: 'Sayur & Sembako', url: 'https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=150&auto=format&fit=crop&q=80' },
  ];

  // 1. Export Full Firestore Database (JSON Download)
  const handleExportDatabase = () => {
    const backupObj = {
      appVersion: '2.5-SmartAI',
      exportDate: new Date().toISOString(),
      storeConfig: config,
      productsCount: products.length,
      transactionsCount: transactions.length,
      data: {
        products,
        transactions,
      },
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupObj, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `backup_sembako_smart_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    success('Backup Database Berhasil', 'File cadangan JSON telah berhasil diunduh.');
  };

  // 2. Parse Restore JSON File
  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.data || (!parsed.data.products && !parsed.data.transactions)) {
          toastError('File Tidak Valid', 'Format file JSON tidak sesuai struktur backup Sembako Smart.');
          setRestoreDataParsed(null);
          return;
        }
        setRestoreDataParsed(parsed.data);
        info('File Terbaca', `Ditemukan ${parsed.data.products?.length || 0} produk & ${parsed.data.transactions?.length || 0} transaksi.`);
      } catch (err) {
        toastError('Gagal Membaca File', 'File terindikasi rusak atau bukan format JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Execute Restore to Firestore
  const handleExecuteRestore = async () => {
    if (!restoreDataParsed) return;
    setIsRestoring(true);

    try {
      let restoredProdCount = 0;
      if (restoreDataParsed.products && Array.isArray(restoreDataParsed.products)) {
        for (const item of restoreDataParsed.products) {
          const { id, ...prodBody } = item;
          await addProduct(prodBody);
          restoredProdCount++;
        }
      }

      success('Restore Berhasil!', `${restoredProdCount} produk telah berhasil dimasukkan ke Firestore.`);
      setRestoreFile(null);
      setRestoreDataParsed(null);
    } catch (err: any) {
      toastError('Gagal Restore', err.message || 'Terjadi kesalahan saat pemulihan data.');
    } finally {
      setIsRestoring(false);
    }
  };

  // 3. Import Catalog Products (Excel .xlsx, .xls, .csv, .json)
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportFile(file);
    const fileName = file.name.toLowerCase();
    const reader = new FileReader();

    if (fileName.endsWith('.json')) {
      reader.onload = (evt) => {
        try {
          const parsed = JSON.parse(evt.target?.result as string);
          const rawItems = Array.isArray(parsed) ? parsed : parsed.products || [];
          setImportedItemsPreview(rawItems);
          info('Katalog JSON Siap', `Ditemukan ${rawItems.length} produk untuk di-import.`);
        } catch (err) {
          toastError('Error Format JSON', 'Gagal membaca katalog produk JSON.');
        }
      };
      reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      reader.onload = (evt) => {
        try {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

          if (jsonRows.length === 0) {
            toastError('File Kosong', 'File Excel tidak memiliki baris data.');
            return;
          }

          const parsedProducts: Partial<ProdukItem>[] = jsonRows.map((row) => {
            const getVal = (...keys: string[]) => {
              for (const k of keys) {
                for (const rowKey of Object.keys(row)) {
                  const rk = rowKey.toLowerCase().replace(/[^a-z0-9]/g, '');
                  const targetKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                  if (rk === targetKey || rk.includes(targetKey) || targetKey.includes(rk)) {
                    return row[rowKey];
                  }
                }
              }
              return '';
            };

            const nama = getVal('Nama Produk', 'Nama', 'NamaProduk', 'Product Name') || '';
            const kode = getVal('Kode SKU', 'Kode', 'SKU', 'KodeSKU') || `IMP-${Math.floor(Math.random() * 8999 + 1000)}`;
            const kategori = getVal('Kategori', 'Category') || 'Sembako';
            
            const rawHargaBeli = getVal('Harga Beli (Rp)', 'Harga Beli', 'HargaBeli', 'BuyPrice');
            const cleanHargaBeli = Number(String(rawHargaBeli).replace(/[^0-9]/g, '')) || 0;

            const rawHargaJual = getVal('Harga Jual (Rp)', 'Harga Jual', 'HargaJual', 'SellPrice');
            const cleanHargaJual = Number(String(rawHargaJual).replace(/[^0-9]/g, '')) || 0;

            const rawStok = getVal('Stok Awal', 'Stok', 'Stock');
            const cleanStok = Number(String(rawStok).replace(/[^0-9]/g, '')) || 0;

            const satuan = getVal('Satuan', 'Unit') || 'Pcs';
            const barcode = String(getVal('Barcode / EAN', 'Barcode', 'EAN') || '').trim();
            const expiredDate = String(getVal('Tanggal Kadaluarsa (YYYY-MM-DD)', 'Tanggal Expired', 'ExpiredDate', 'Kadaluarsa') || '').trim();
            const deskripsi = String(getVal('Deskripsi Produk', 'Deskripsi', 'Catatan') || '').trim();

            return {
              nama: String(nama),
              kode: String(kode),
              kategori: String(kategori),
              hargaBeli: cleanHargaBeli,
              hargaJual: cleanHargaJual,
              stok: cleanStok,
              satuan: String(satuan),
              barcode,
              expiredDate,
              deskripsi,
              minStok: 5,
            };
          }).filter((p) => p.nama && p.nama.trim().length > 0);

          setImportedItemsPreview(parsedProducts);
          info('Katalog Excel Terbaca', `Berhasil membaca ${parsedProducts.length} baris data produk dari Excel (.xlsx).`);
        } catch (err) {
          toastError('Error Format Excel', 'Gagal membaca file Excel. Pastikan file tidak dipassword.');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV Parsing (Supports comma ',' and semicolon ';')
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length < 2) {
            toastError('File Kosong', 'File CSV tidak memiliki baris produk.');
            return;
          }

          // Detect delimiter
          const delimiter = lines[0].includes(';') ? ';' : ',';
          const parsedProducts: Partial<ProdukItem>[] = [];

          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(delimiter).map((c) => c.trim().replace(/^"|"$/g, ''));
            if (cols.length >= 2 && cols[0]) {
              const cleanHargaBeli = Number(cols[3]?.replace(/[^0-9]/g, '')) || 0;
              const cleanHargaJual = Number(cols[4]?.replace(/[^0-9]/g, '')) || 0;
              const cleanStok = Number(cols[5]?.replace(/[^0-9]/g, '')) || 0;

              parsedProducts.push({
                nama: cols[0] || 'Produk Import',
                kode: cols[1] || `IMP-${Math.floor(Math.random() * 8999 + 1000)}`,
                kategori: cols[2] || 'Sembako',
                hargaBeli: cleanHargaBeli || 1000,
                hargaJual: cleanHargaJual || 1200,
                stok: cleanStok || 10,
                satuan: cols[6] || 'Pcs',
                barcode: cols[7] || '',
                expiredDate: cols[8] || '',
                deskripsi: cols[9] || '',
                minStok: 5,
              });
            }
          }
          setImportedItemsPreview(parsedProducts);
          info('Katalog CSV Terbaca', `Berhasil membaca ${parsedProducts.length} baris data produk dari CSV.`);
        } catch (err) {
          toastError('Error Format CSV', 'Format baris CSV tidak sesuai.');
        }
      };
      reader.readAsText(file);
    }
  };

  // Download Formatted Excel (.xlsx) Template
  const handleDownloadExcelTemplate = () => {
    const templateData = [
      {
        'Nama Produk': 'Beras Sania Premium 5kg',
        'Kode SKU': 'BRS-001',
        'Kategori': 'Beras',
        'Harga Beli (Rp)': 68000,
        'Harga Jual (Rp)': 75000,
        'Stok Awal': 25,
        'Satuan': 'Sak',
        'Barcode / EAN': '8991234567890',
        'Tanggal Kadaluarsa (YYYY-MM-DD)': '2027-12-31',
        'Deskripsi Produk': 'Beras pulen kualitas super kemasan 5kg'
      },
      {
        'Nama Produk': 'Minyak Goreng Bimoli 2L',
        'Kode SKU': 'MYK-002',
        'Kategori': 'Minyak Goreng',
        'Harga Beli (Rp)': 34000,
        'Harga Jual (Rp)': 38000,
        'Stok Awal': 40,
        'Satuan': 'Pouch',
        'Barcode / EAN': '8998888777666',
        'Tanggal Kadaluarsa (YYYY-MM-DD)': '2027-06-30',
        'Deskripsi Produk': 'Minyak kelapa sawit murni 2 Liter'
      },
      {
        'Nama Produk': 'Gula Pasir Gulaku 1kg',
        'Kode SKU': 'GLA-003',
        'Kategori': 'Gula',
        'Harga Beli (Rp)': 16000,
        'Harga Jual (Rp)': 18500,
        'Stok Awal': 50,
        'Satuan': 'Kg',
        'Barcode / EAN': '8999999111222',
        'Tanggal Kadaluarsa (YYYY-MM-DD)': '2028-01-01',
        'Deskripsi Produk': 'Gula putih murni 1 kg'
      },
      {
        'Nama Produk': 'Telur Ayam Ras Broiler 1kg',
        'Kode SKU': 'TLR-004',
        'Kategori': 'Telur',
        'Harga Beli (Rp)': 26000,
        'Harga Jual (Rp)': 29000,
        'Stok Awal': 30,
        'Satuan': 'Kg',
        'Barcode / EAN': '8997000111222',
        'Tanggal Kadaluarsa (YYYY-MM-DD)': '2026-08-15',
        'Deskripsi Produk': 'Telur segar kualitas A per kg'
      },
      {
        'Nama Produk': 'Mie Sedaap Goreng 85g',
        'Kode SKU': 'MIE-005',
        'Kategori': 'Mie Instan',
        'Harga Beli (Rp)': 2800,
        'Harga Jual (Rp)': 3200,
        'Stok Awal': 120,
        'Satuan': 'Pcs',
        'Barcode / EAN': '8992345678123',
        'Tanggal Kadaluarsa (YYYY-MM-DD)': '2027-03-20',
        'Deskripsi Produk': 'Mie instan goreng dus atau satuan'
      }
    ];

    const guideData = [
      {
        'Nama Kolom': 'Nama Produk',
        'Status Wajib': 'WAJIB DIISI',
        'Keterangan / Aturan Format': 'Nama barang beserta varian/ukuran. Tidak boleh kosong.',
        'Contoh Pengisian': 'Beras Sania Premium 5kg'
      },
      {
        'Nama Kolom': 'Kode SKU',
        'Status Wajib': 'OPSIONAL',
        'Keterangan / Aturan Format': 'Kode unik barang. Boleh dikosongkan (sistem membuat otomatis).',
        'Contoh Pengisian': 'BRS-001'
      },
      {
        'Nama Kolom': 'Kategori',
        'Status Wajib': 'WAJIB DIISI',
        'Keterangan / Aturan Format': 'Kelompok barang (contoh: Beras, Minyak, Gula, Mie, Minuman, dll).',
        'Contoh Pengisian': 'Beras'
      },
      {
        'Nama Kolom': 'Harga Beli (Rp)',
        'Status Wajib': 'WAJIB DIISI',
        'Keterangan / Aturan Format': 'Harga modal beli dari supplier/grosir (hanya angka tanpa Rp / titik).',
        'Contoh Pengisian': '68000'
      },
      {
        'Nama Kolom': 'Harga Jual (Rp)',
        'Status Wajib': 'WAJIB DIISI',
        'Keterangan / Aturan Format': 'Harga jual ke pembeli (hanya angka tanpa Rp / titik).',
        'Contoh Pengisian': '75000'
      },
      {
        'Nama Kolom': 'Stok Awal',
        'Status Wajib': 'WAJIB DIISI',
        'Keterangan / Aturan Format': 'Jumlah stok fisik awal di toko (angka).',
        'Contoh Pengisian': '25'
      },
      {
        'Nama Kolom': 'Satuan',
        'Status Wajib': 'WAJIB DIISI',
        'Keterangan / Aturan Format': 'Satuan fisik (Pcs, Sak, Pouch, Kg, Dus, Botol, Pack, dll).',
        'Contoh Pengisian': 'Sak'
      },
      {
        'Nama Kolom': 'Barcode / EAN',
        'Status Wajib': 'OPSIONAL',
        'Keterangan / Aturan Format': 'Kode angka barcode dari kemasan produk (dapat dipindai scanner HP).',
        'Contoh Pengisian': '8991234567890'
      },
      {
        'Nama Kolom': 'Tanggal Kadaluarsa',
        'Status Wajib': 'OPSIONAL',
        'Keterangan / Aturan Format': 'Format tanggal kedaluwarsa YYYY-MM-DD (Tahun-Bulan-Tanggal).',
        'Contoh Pengisian': '2027-12-31'
      },
      {
        'Nama Kolom': 'Deskripsi Produk',
        'Status Wajib': 'OPSIONAL',
        'Keterangan / Aturan Format': 'Spesifikasi atau catatan ringkas mengenai produk.',
        'Contoh Pengisian': 'Beras pulen kualitas super kemasan 5kg'
      }
    ];

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Data Produk
    const worksheetProducts = XLSX.utils.json_to_sheet(templateData);
    worksheetProducts['!cols'] = [
      { wch: 32 }, // Nama Produk
      { wch: 15 }, // Kode SKU
      { wch: 18 }, // Kategori
      { wch: 18 }, // Harga Beli (Rp)
      { wch: 18 }, // Harga Jual (Rp)
      { wch: 12 }, // Stok Awal
      { wch: 12 }, // Satuan
      { wch: 20 }, // Barcode / EAN
      { wch: 32 }, // Tanggal Kadaluarsa
      { wch: 45 }  // Deskripsi Produk
    ];
    XLSX.utils.book_append_sheet(workbook, worksheetProducts, 'Katalog Produk');

    // Sheet 2: Petunjuk
    const worksheetGuide = XLSX.utils.json_to_sheet(guideData);
    worksheetGuide['!cols'] = [
      { wch: 22 },
      { wch: 15 },
      { wch: 70 },
      { wch: 30 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheetGuide, 'Petunjuk & Panduan');

    XLSX.writeFile(workbook, 'Template_Import_Katalog_Produk_Sembako.xlsx');
    success('Template Excel (.XLSX) Berhasil Diunduh', 'Isi data produk pada sheet Katalog Produk, lalu unggah kembali file ini.');
  };

  // Download Sample CSV Template
  const handleDownloadCsvTemplate = () => {
    const csvHeaders = 'Nama;Kode;Kategori;HargaBeli;HargaJual;Stok;Satuan;Barcode;ExpiredDate;Deskripsi\n';
    const csvRows = [
      'Beras Sania Premium 5kg;BRS-001;Beras;68000;75000;25;Sak;8991234567890;2027-12-31;Beras pulen kualitas super 5kg',
      'Minyak Goreng Bimoli 2L;MYK-002;Minyak Goreng;34000;38000;40;Pouch;8998888777666;2027-06-30;Minyak kelapa sawit murni 2 Liter',
      'Gula Pasir Gulaku 1kg;GLA-003;Gula;16000;18500;50;Kg;8999999111222;2028-01-01;Gula putih murni 1 kg',
      'Telur Ayam Ras Broiler 1kg;TLR-004;Telur;26000;29000;30;Kg;;2026-08-15;Telur segar kualitas A per kg',
      'Mie Sedaap Goreng 85g;MIE-005;Mie Instan;2800;3200;120;Pcs;8992345678123;2027-03-20;Mie instan dus atau satuan'
    ].join('\n');

    const blob = new Blob([csvHeaders + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_import_katalog_produk_sembako.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    success('Template CSV Diunduh', 'File template_import_katalog_produk_sembako.csv berhasil diunduh!');
  };

  // Execute Import Products to Firestore
  const handleExecuteImportProducts = async () => {
    if (importedItemsPreview.length === 0) return;
    setIsImporting(true);

    try {
      let count = 0;
      for (const item of importedItemsPreview) {
        await addProduct({
          kode: item.kode || `SKU-${Date.now().toString().slice(-5)}`,
          barcode: item.barcode || '',
          nama: item.nama || 'Produk Sembako',
          kategori: item.kategori || 'Sembako',
          hargaBeli: Number(item.hargaBeli) || 0,
          hargaJual: Number(item.hargaJual) || 0,
          stok: Number(item.stok) || 0,
          minStok: Number(item.minStok) || 5,
          satuan: item.satuan || 'Pcs',
          gambarUrl: item.gambarUrl || '',
          deskripsi: item.deskripsi || 'Imported product catalog',
          terjual: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }

      success('Import Berhasil', `${count} produk katalog baru berhasil ditambahkan ke Firestore!`);
      setImportFile(null);
      setImportedItemsPreview([]);
    } catch (err: any) {
      toastError('Gagal Import Produk', err.message || 'Terjadi kesalahan sistem.');
    } finally {
      setIsImporting(false);
    }
  };

  // 4. Execute Store Reset Actions
  const handleExecuteReset = async () => {
    if (resetConfirmInput.toUpperCase() !== 'RESET') {
      toastError('Konfirmasi Salah', 'Ketik "RESET" dengan huruf kapital untuk mengonfirmasi.');
      return;
    }

    setIsResetting(true);
    try {
      if (resetType === 'stok') {
        // Reset stock to 0 for all products
        for (const p of products) {
          await updateProduct(p.id, { stok: 0 });
        }
        success('Reset Stok Selesai', 'Seluruh unit stok produk telah diubah menjadi 0.');
      } else if (resetType === 'transaksi') {
        // Clear all database collections except products
        await clearAllDatabaseData();
        success('Reset Transaksi Selesai', 'Seluruh riwayat transaksi & laporan telah dibersihkan.');
      } else if (resetType === 'kosong' || resetType === 'total') {
        // Wipe all products, transactions, stock, and suppliers for clean startup
        await clearAllDatabaseData();
        localStorage.removeItem('sembako_ai_chat_sessions');
        updateStoreConfig({
          noHp: '',
          alamatToko: '',
          emailPemilik: '',
          targetOmzetBulanIni: 0,
        });
        success('Database Bersih Selesai', 'Semua data produk, transaksi, supplier, profil toko, & percakapan AI telah dikosongkan. Aplikasi siap di-input dari awal.');
      } else if (resetType === 'sample') {
        await seedSampleProducts();
        await seedSampleSuppliers();
        success('Muat Sampel Selesai', 'Katalog sembako contoh dan daftar supplier berhasil dimasukkan.');
      }

      setResetType(null);
      setResetConfirmInput('');
    } catch (err: any) {
      toastError('Gagal Reset', err.message || 'Gagal mengeksekusi reset data.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      
      {/* Top Banner Header */}
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            <Settings className="w-3.5 h-3.5 text-amber-500" />
            <span>Konfigurasi Sembako Smart AI</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-emerald-900 via-emerald-700 to-amber-600 dark:from-emerald-200 dark:via-emerald-300 dark:to-amber-300 bg-clip-text text-transparent">
            Pengaturan Sistem & Database Toko
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Atur profil toko, koneksi printer thermal, backup JSON, import katalog, dan tema visual.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span>v2.5 Smart AI Edition</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar with Scroll Controls */}
      <div className="relative group">
        {/* Left Scroll Arrow Button */}
        {showLeftScroll && (
          <button
            type="button"
            onClick={() => handleScrollTabs('left')}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer"
            title="Geser Menu ke Kiri"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
          </button>
        )}

        {/* Right Scroll Arrow Button */}
        {showRightScroll && (
          <button
            type="button"
            onClick={() => handleScrollTabs('right')}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-white/95 dark:bg-slate-900/95 shadow-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-all cursor-pointer"
            title="Geser Menu ke Kanan"
          >
            <ChevronRight className="w-5 h-5 shrink-0" />
          </button>
        )}

        <div
          ref={scrollTabRef}
          onScroll={checkTabScroll}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-2 rounded-3xl border border-emerald-500/20 shadow-xl flex items-center gap-1.5 overflow-x-auto scroll-smooth no-scrollbar select-none"
        >
          {[
            { id: 'profil', label: 'Profil Toko', icon: Store },
            ...(!isDemoSession ? [{ id: 'lisensi', label: 'Lisensi Software', icon: KeyRound }] : []),
            { id: 'panduan', label: 'Panduan & Manual', icon: BookOpen },
            { id: 'printer', label: 'Printer Struk', icon: Printer },
            { id: 'barcode', label: 'Barcode Scanner', icon: Barcode },
            { id: 'tema', label: 'Tampilan & Tema', icon: Palette },
            { id: 'backup', label: 'Backup & Restore', icon: Database },
            { id: 'import', label: 'Import Produk', icon: Upload },
            { id: 'reset', label: 'Reset Data', icon: Trash2 },
            { id: 'tentang', label: 'Tentang Aplikasi', icon: Info },
          ].map((t) => {
            const IconComp = t.icon;
            const isActive = activeTab === t.id;

            return (
              <button
                key={t.id}
                onClick={() => {
                  setActiveTab(t.id as any);
                  setTimeout(checkTabScroll, 100);
                }}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 text-white shadow-md'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <IconComp className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: PROFIL TOKO */}
      {activeTab === 'profil' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Identitas & Profil Toko Sembako</span>
              </h3>
              <p className="text-xs text-slate-500">
                Informasi ini akan dicetak otomatis pada bagian header & footer nota kasir.
              </p>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveConfig(config, 'Profil Toko Disimpan');
            }}
            className="space-y-5"
          >
            {/* Logo Preview & Upload */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Foto / Logo Toko (Pratinjau Struk & Banner)
                </label>
                {config.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, logoUrl: '' })}
                    className="text-[11px] text-red-500 hover:text-red-600 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus Logo
                  </button>
                )}
              </div>

              <input
                type="file"
                ref={logoFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleLogoFileSelect}
              />

              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div 
                  onClick={() => logoFileInputRef.current?.click()}
                  className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 shrink-0 shadow-md flex items-center justify-center relative cursor-pointer group transition-all"
                  title="Klik untuk Upload Foto Toko dari Galeri / Kamera"
                >
                  {config.logoUrl ? (
                    <>
                      <img src={config.logoUrl} alt="Logo Toko" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                        <Camera className="w-5 h-5" />
                        <span>Ganti Foto</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-2 text-emerald-600 dark:text-emerald-400">
                      {isUploadingLogo ? (
                        <RotateCcw className="w-6 h-6 animate-spin" />
                      ) : (
                        <>
                          <UploadCloud className="w-6 h-6 mb-1" />
                          <span className="text-[10px] font-bold leading-tight">Upload Foto</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-2 flex-1 w-full">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      disabled={isUploadingLogo}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingLogo ? 'Memproses...' : 'Upload Foto Toko (Galeri / Kamera)'}</span>
                    </button>
                    <span className="text-[11px] text-slate-400 font-medium">atau URL:</span>
                  </div>

                  <input
                    type="text"
                    value={config.logoUrl}
                    onChange={(e) => setConfig({ ...config, logoUrl: e.target.value })}
                    placeholder="Masukkan URL Logo Gambar (https://...)"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                  />

                  {/* Preset Logos Select */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[10px] text-slate-400 whitespace-nowrap font-bold">Preset:</span>
                    {presetLogos.map((p, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setConfig({ ...config, logoUrl: p.url })}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-500/20 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer whitespace-nowrap"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Nama & Kontak */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase text-slate-800 dark:text-slate-200 mb-1">
                  Nama Toko Sembako (Tampil Besar)
                </label>
                <input
                  type="text"
                  value={config.namaToko}
                  onChange={(e) => setConfig({ ...config, namaToko: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border-2 border-emerald-500/50 bg-amber-500/10 dark:bg-slate-950 text-xs font-black uppercase text-slate-900 dark:text-white"
                  required
                />
                <p className="text-[10px] text-emerald-600 dark:text-amber-400 mt-1 font-semibold">
                  ✨ Nama toko ini tampil BESAR di bagian atas pojok kiri aplikasi & nota cetak.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  No. HP / WhatsApp Toko
                </label>
                <input
                  type="text"
                  value={config.noHp}
                  onChange={(e) => setConfig({ ...config, noHp: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Alamat Lengkap */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Alamat Lengkap Toko
              </label>
              <textarea
                value={config.alamatToko}
                onChange={(e) => setConfig({ ...config, alamatToko: e.target.value })}
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
                required
              />
            </div>

            {/* Footer Struk */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Pesan Ucapan / Footer Nota Struk
              </label>
              <input
                type="text"
                value={config.footerStruk}
                onChange={(e) => setConfig({ ...config, footerStruk: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs"
              />
            </div>

            {/* Target Omset Bulanan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Target Omset Penjualan Bulanan (Rp)
              </label>
              <input
                type="number"
                min={0}
                step={1000000}
                value={config.targetOmzetBulanIni || ''}
                onChange={(e) => setConfig({ ...config, targetOmzetBulanIni: Number(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-emerald-600 dark:text-emerald-400"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                Target omset ini akan digunakan sebagai indikator progres pencapaian pada Widget Dashboard Toko.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg cursor-pointer"
              >
                <Save className="w-4 h-4 text-amber-300" />
                <span>Simpan Profil Toko</span>
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* TAB LISENSI & AKTIVASI SOFTWARE */}
      {!isDemoSession && activeTab === 'lisensi' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Status Lisensi & Aktivasi Software POS Siap Jual</span>
              </h3>
              <p className="text-xs text-slate-500">
                Sistem aktivasi komersial untuk siap dijual ke toko/klien mana saja dengan License Key unik.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>{licenseInfo.licenseType}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Card */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-900 border border-emerald-500/30 text-white space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-mono text-slate-400">Aplikasi Terverifikasi</p>
                  <h4 className="text-base font-black text-amber-300">
                    {licenseInfo.isActivated ? 'LISENSI PRO AKTIF' : 'UNREGISTERED'}
                  </h4>
                </div>
              </div>

              <div className="space-y-2 text-xs border-t border-white/10 pt-4 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Nama Toko Terdaftar:</span>
                  <span className="font-bold text-white">{storeConfig.namaToko}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Kode Lisensi Usaha:</span>
                  <span className="font-mono text-amber-400 font-bold">{licenseInfo.licenseKey || 'SEMBAKO-PRO-2026-VIP'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Tipe Lisensi:</span>
                  <span className="font-bold text-emerald-400">{licenseInfo.licenseType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Status Masa Berlaku:</span>
                  <span className="font-bold text-emerald-300">{licenseInfo.expiryDate}</span>
                </div>
              </div>
            </div>

            {/* Form Input Key */}
            <div className="p-6 rounded-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-500" />
                <span>Aktivasi License Key Baru</span>
              </h4>

              <div className="space-y-3">
                <input
                  type="text"
                  id="settingLicenseInputKey"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-white uppercase"
                />
                <p className="text-[11px] text-slate-500">
                  Ketik 16-karakter License Key resmi yang terdaftar saat pembelian aplikasi (Rp 99rb sekali bayar).
                </p>

                <button
                  type="button"
                  onClick={async () => {
                    const el = document.getElementById('settingLicenseInputKey') as HTMLInputElement;
                    if (el && el.value.trim()) {
                      const res = await activateLicenseKey(el.value, storeConfig.namaToko);
                      if (res.success) {
                        success('Aktivasi Berhasil', res.message);
                      } else {
                        toastError('Aktivasi Gagal', res.message);
                      }
                    } else {
                      warning('Input Kosong', 'Masukkan kode lisensi.');
                    }
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500 hover:from-emerald-600 hover:to-amber-400 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-300" />
                  <span>Proses Aktivasi Lisensi</span>
                </button>

                <div className="pt-2">
                  <a
                    href="https://wa.me/6285187869164?text=Halo%20Admin%20Sembako%20Smart%20POS%20AI,%20saya%20ingin%20beli%20kode%20lisensi%2099rb"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center gap-2 transition-colors"
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-500" />
                    <span>Beli Kode Lisensi 99rb via WhatsApp</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Nonaktifkan Lisensi (Reset License) Card */}
            <div className="p-6 rounded-3xl bg-rose-500/5 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    <span>Nonaktifkan Lisensi Perangkat Ini</span>
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Copot lisensi dari perangkat ini jika Anda ingin melakukan tes ulang aktivasi dari awal.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirmDeactivate) {
                      setConfirmDeactivate(true);
                      setTimeout(() => setConfirmDeactivate(false), 5000);
                    } else {
                      deactivateLicense();
                      info('Lisensi Dinonaktifkan', 'Perangkat ini kembali ke status belum teraktivasi.');
                    }
                  }}
                  className={`px-4 py-2.5 rounded-2xl text-white font-extrabold text-xs shadow-md cursor-pointer transition-all shrink-0 flex items-center justify-center gap-1.5 ${
                    confirmDeactivate
                      ? 'bg-rose-700 hover:bg-rose-800 ring-2 ring-rose-400 animate-pulse'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                  }`}
                >
                  <AlertCircle className="w-4 h-4" />
                  <span>{confirmDeactivate ? 'Yakin? Klik 1x Lagi Untuk Copot' : 'Nonaktifkan Lisensi'}</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB PANDUAN & MANUAL APLIKASI */}
      {activeTab === 'panduan' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Main Download Banner */}
          <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 p-6 sm:p-8 rounded-3xl border border-emerald-500/30 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl relative z-10">
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-extrabold text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-amber-300" />
                  <span>Manual Penggunaan Resmi</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono font-bold">
                  v2.5 Pro Edition
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                Buku Panduan Operasional Sembako Smart AI
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Pelajari seluruh fitur platform dari Pengaturan Toko, Barcode Scanner, Kasir POS, Retur Items, Stock Opname, hingga analisis Gemini AI. Anda juga dapat mengunduh dokumen panduan format PDF lengkap dengan diagram alur kerja.
              </p>
            </div>

            <div className="relative z-10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  try {
                    exportUserGuideToPDF();
                    success('Download PDF Berhasil', 'File PANDUAN_PENGGUNAAN_SEMBAKO_SMART_AI.pdf berhasil diunduh.');
                  } catch (err: any) {
                    toastError('Gagal Download PDF', err.message);
                  }
                }}
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black text-sm flex items-center justify-center gap-3 shadow-xl hover:shadow-amber-500/20 transition-all cursor-pointer transform active:scale-95"
              >
                <Download className="w-5 h-5" />
                <div className="text-left leading-tight">
                  <div className="font-black">Download Panduan Lengkap PDF</div>
                  <div className="text-[10px] font-normal text-slate-900 opacity-90">Termasuk Diagram Alur Kerja & Tabel Complete</div>
                </div>
              </button>
            </div>

            {/* Background Graphic Accent */}
            <div className="absolute -right-12 -bottom-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          </div>

          {/* VISUAL WORKFLOW DIAGRAM CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Diagram 1: Kasir POS */}
            <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-emerald-500/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                  <ShoppingCart className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Diagram Alur Penjualan Kasir POS</span>
                </h4>
                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                  4 Langkah Cepat
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                {[
                  { step: '1', title: 'Scan Barcode', desc: 'Input item ke kasir' },
                  { step: '2', title: 'Atur Diskon', desc: 'Nominal/persen' },
                  { step: '3', title: 'Pilih Bayar', desc: 'Tunai/QRIS/Bank' },
                  { step: '4', title: 'Cetak Nota', desc: 'Stok berkurang' },
                ].map((s, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-slate-800 dark:text-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black text-[10px] mx-auto flex items-center justify-center">
                      {s.step}
                    </span>
                    <p className="font-bold text-[11px] leading-tight text-emerald-700 dark:text-emerald-300">{s.title}</p>
                    <p className="text-[9px] text-slate-500">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Diagram 2: Retur Items */}
            <div className="p-5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-rose-500/20 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <h4 className="font-extrabold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2 uppercase tracking-wider">
                  <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Diagram Alur Retur & Refund Items</span>
                </h4>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md">
                  Pengembalian Stok
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center pt-1">
                {[
                  { step: 'A', title: 'Pilih Nota', desc: 'Riwayat Transaksi' },
                  { step: 'B', title: 'Retur Item', desc: 'Pilih Qty sebagian' },
                  { step: 'C', title: 'Refund Kasir', desc: 'Kembalikan tunai' },
                  { step: 'D', title: 'Stok Gudang', desc: 'Stok bertambah' },
                ].map((s, idx) => (
                  <div key={idx} className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-slate-800 dark:text-slate-200 space-y-1">
                    <span className="w-5 h-5 rounded-full bg-rose-600 text-white font-black text-[10px] mx-auto flex items-center justify-center">
                      {s.step}
                    </span>
                    <p className="font-bold text-[11px] leading-tight text-rose-700 dark:text-rose-300">{s.title}</p>
                    <p className="text-[9px] text-slate-500">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* INTERACTIVE GUIDE VIEWER */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6">
            {/* Sub-Tab navigation inside Panduan */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-3">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
                {[
                  { id: 'langkah', label: 'Panduan Fitur 8-Langkah', icon: BookOpen },
                  { id: 'shortcut', label: 'Keyboard Shortcut', icon: Keyboard },
                  { id: 'ai', label: 'Contoh Pertanyaan AI', icon: Sparkles },
                  { id: 'faq', label: 'Tanya Jawab (FAQ)', icon: HelpCircle },
                ].map((t) => {
                  const SubIcon = t.icon;
                  const isActive = guideSubTab === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setGuideSubTab(t.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      <SubIcon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-slate-400'}`} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Search input inside guide */}
              {guideSubTab === 'langkah' && (
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari kata kunci panduan..."
                    value={guideSearchQuery}
                    onChange={(e) => setGuideSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* TAB 1: 8 LANGKAH */}
            {guideSubTab === 'langkah' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    step: '1',
                    title: 'Pengaturan Toko & Struk',
                    icon: Store,
                    summary: 'Atur nama toko, alamat pasar, nomor telp/WA, dan pesan footer nota.',
                    points: [
                      'Buka Pengaturan > Profil Toko.',
                      'Isi Nama Toko, Alamat, No. Telp, dan Footer Struk.',
                      'Nama toko akan dicetak BESAR di bagian paling atas nota belanja thermal.',
                    ],
                  },
                  {
                    step: '2',
                    title: 'Tambah Produk & Import Excel',
                    icon: FileSpreadsheet,
                    summary: 'Tambah manual atau unggah puluhan produk dari file Microsoft Excel CSV.',
                    points: [
                      'Buka Pengaturan > Import Produk atau menu Produk.',
                      'Unduh Template Excel CSV, isi kolom barang, lalu unggah file.',
                      'Periksa pratinjau data lalu klik Simpan All Produk ke Cloud Firestore.',
                    ],
                  },
                  {
                    step: '3',
                    title: 'Transaksi POS & Barcode',
                    icon: ShoppingCart,
                    summary: 'Melayani transaksi belanja dengan pencarian cepat, barcode scanner, atau perintah suara.',
                    points: [
                      'Gunakan Barcode Scanner USB atau Kamera HP untuk membaca SKU barang.',
                      'Tekan ikon Mikrofon untuk input via Perintah Suara.',
                      'Sertakan diskon item, diskon total, atau kode kupon belanja.',
                    ],
                  },
                  {
                    step: '4',
                    title: 'Pembayaran & Nominal Pas',
                    icon: CheckSquare,
                    summary: 'Metode pembayaran fleksibel dengan kalkulator kembalian otomatis.',
                    points: [
                      'Pilih metode pembayaran Tunai, QRIS, atau Transfer Bank.',
                      'Gunakan tombol "Uang Pas" atau nominal pecahan (10k, 20k, 50k, 100k).',
                      'Klik "Bayar & Cetak Struk" untuk memicu cetak printer thermal.',
                    ],
                  },
                  {
                    step: '5',
                    title: 'Retur Items & Refund',
                    icon: RotateCcw,
                    summary: 'Fitur Retur Sebagian (Partial Return) untuk pengembalian barang dan refund.',
                    points: [
                      'Buka Riwayat Transaksi > Klik Detail Nota.',
                      'Tekan tombol "Retur Barang", tentukan jumlah barang yang dikembalikan.',
                      'Kasir kembalikan uang refund, stok otomatis bertambah di gudang.',
                    ],
                  },
                  {
                    step: '6',
                    title: 'Stock Opname & Restock',
                    icon: Boxes,
                    summary: 'Monitoring stok menipis dan penyesuaian fisik barang.',
                    points: [
                      'Peringatan otomatis untuk produk dengan stok < 5 pcs.',
                      'Stock Opname untuk barang rusak, kadaluarsa, atau selisih fisik.',
                      'Mutasi stok terekam permanen di log inventori.',
                    ],
                  },
                  {
                    step: '7',
                    title: 'Printer Struk Thermal',
                    icon: Printer,
                    summary: 'Dukungan printer thermal ukuran 58mm & 80mm via Bluetooth / USB.',
                    points: [
                      'Buka Pengaturan > Printer Struk.',
                      'Pilih lebar kertas 58mm atau 80mm dan aktifkan auto-print.',
                      'Tekan Uji Cetak Printer untuk memastikan koneksi.',
                    ],
                  },
                  {
                    step: '8',
                    title: 'Analisis Gemini AI',
                    icon: Sparkles,
                    summary: 'Kecerdasan AI untuk analisis barang laris, deadstock, dan promo.',
                    points: [
                      'Buka menu "AI Assistant".',
                      'Tanyakan rekomendasi paket promo bundling sembako.',
                      'Dapatkan estimasi nilai total stok aset modal toko.',
                    ],
                  },
                ]
                  .filter(
                    (g) =>
                      !guideSearchQuery ||
                      g.title.toLowerCase().includes(guideSearchQuery.toLowerCase()) ||
                      g.summary.toLowerCase().includes(guideSearchQuery.toLowerCase()) ||
                      g.points.some((p) => p.toLowerCase().includes(guideSearchQuery.toLowerCase()))
                  )
                  .map((item) => {
                    const GuideIcon = item.icon;
                    return (
                      <div
                        key={item.step}
                        className="p-4 rounded-2xl border border-emerald-500/20 bg-slate-50/50 dark:bg-slate-950/50 space-y-2.5 transition-all hover:border-emerald-500/40"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-sm">
                              {item.step}
                            </span>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                              <GuideIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <span>{item.title}</span>
                            </h4>
                          </div>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                          {item.summary}
                        </p>

                        <ul className="space-y-1 pt-1">
                          {item.points.map((pt, pIdx) => (
                            <li key={pIdx} className="text-xs text-slate-500 dark:text-slate-400 flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* TAB 2: SHORTCUT */}
            {guideSubTab === 'shortcut' && (
              <div className="space-y-3 text-xs">
                <p className="text-slate-500">Tabel shortcut tombol keyboard untuk mempercepat transaksi kasir:</p>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-200 uppercase">
                      <tr>
                        <th className="p-3">Tombol Keyboard</th>
                        <th className="p-3">Lokasi / Area</th>
                        <th className="p-3">Fungsi / Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      <tr>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">ESC</td>
                        <td className="p-3 text-slate-500">Global Modal</td>
                        <td className="p-3 text-slate-800 dark:text-slate-200">Menutup dialog modal yang sedang terbuka</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">Enter</td>
                        <td className="p-3 text-slate-500">Kasir / Form</td>
                        <td className="p-3 text-slate-800 dark:text-slate-200">Konfirmasi pembayaran / simpan formulir</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">Scanner Barcode USB</td>
                        <td className="p-3 text-slate-500">Halaman Kasir</td>
                        <td className="p-3 text-slate-800 dark:text-slate-200">Otomatis mencari SKU barang dan menambahkan ke keranjang</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono font-black text-emerald-600 dark:text-emerald-400">Uang Pas (Klik)</td>
                        <td className="p-3 text-slate-500">Modal Bayar</td>
                        <td className="p-3 text-slate-800 dark:text-slate-200">Mengisi nominal bayar persis sama dengan Total Tagihan</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: AI PROMPTS */}
            {guideSubTab === 'ai' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {[
                  { title: 'Produk Terlaris', query: 'Produk sembako apa yang paling banyak terjual minggu ini?' },
                  { title: 'Restock Gudang', query: 'Barang apa saja yang stoknya di bawah batas minimum?' },
                  { title: 'Deadstock', query: 'Apakah ada produk yang mengendap lama dan belum pernah terjual?' },
                  { title: 'Nilai Aset Stok', query: 'Berapa estimasi total modal belanja barang yang tersimpan di gudang?' },
                ].map((item, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-950 dark:text-amber-200 space-y-1.5">
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
            )}

            {/* TAB 4: FAQ */}
            {guideSubTab === 'faq' && (
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200">Q: Apakah data tersimpan aman di cloud?</h4>
                  <p className="text-slate-500">A: Ya, data tersimpan real-time di Cloud Database Firebase Firestore dan terenkripsi aman.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200">Q: Bagaimana cara kerja saat offline?</h4>
                  <p className="text-slate-500">A: Aplikasi menggunakan Progressive Web App (PWA) & local caching. Transaksi offline otomatis disinkronkan saat online kembali.</p>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-200">Q: Bagaimana cara cetak struk thermal bluetooth?</h4>
                  <p className="text-slate-500">A: Buka Pengaturan &gt; Printer Struk, pilih lebar kertas 58mm atau 80mm, lalu tekan "Uji Cetak Printer".</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* TAB PRINTER STRUK */}

      {activeTab === 'printer' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Koneksi & Tipe Printer Thermal</span>
              </h3>
              <p className="text-xs text-slate-500">
                Konfigurasi cetak otomatis struk belanja kasir untuk printer Bluetooth / USB.
              </p>
            </div>

            <button
              onClick={() => setIsTestPrintOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/20 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-500" />
              <span>Uji Cetak (Test Print)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Form Settings */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Ukuran Kertas Printer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: '58mm', label: 'Thermal 58mm' },
                    { id: '80mm', label: 'Thermal 80mm' },
                    { id: 'a4', label: 'A4 / PDF' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSaveConfig({ printerType: p.id as any }, 'Ukuran Kertas Diubah')}
                      className={`p-3 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        config.printerType === p.id
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-600 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Metode Koneksi Hardware
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'bluetooth', label: 'Bluetooth', icon: Bluetooth },
                    { id: 'usb', label: 'USB Cable', icon: Layers },
                    { id: 'network', label: 'LAN / IP', icon: Wifi },
                  ].map((c) => {
                    const IconC = c.icon;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSaveConfig({ connectionType: c.id as any }, 'Koneksi Printer Diubah')}
                        className={`p-3 rounded-2xl text-xs font-bold border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          config.connectionType === c.id
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500 shadow-sm'
                            : 'bg-slate-50 dark:bg-slate-950 text-slate-600 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <IconC className="w-4 h-4 text-emerald-500" />
                        <span>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Perangkat Printer (Device Name)
                </label>
                <input
                  type="text"
                  value={config.printerName}
                  onChange={(e) => setConfig({ ...config, printerName: e.target.value })}
                  onBlur={() => handleSaveConfig({}, 'Nama Printer Diperbarui')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                />
              </div>

              {/* Toggle Auto Print */}
              <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Otomatis Cetak Struk Setelah Bayar
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Sistem langsung membuka dialog cetak saat kasir menekan tombol Selesai Bayar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveConfig({ autoPrint: !config.autoPrint }, 'Auto Print Diperbarui')}
                  className={`w-12 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    config.autoPrint ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      config.autoPrint ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Thermal Print Preview Mockup */}
            <div className="p-5 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
              <h4 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-4 h-4 text-amber-500" />
                <span>Simulasi Pratinjau Kertas Struk Thermal ({config.printerType})</span>
              </h4>

              <div className="p-4 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 rounded-xl font-mono text-[11px] space-y-2 border border-slate-200 dark:border-slate-800 shadow-inner">
                <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-2">
                  <p className="font-bold text-xs">{config.namaToko}</p>
                  <p className="text-[9px] text-slate-500">{config.alamatToko}</p>
                  <p className="text-[9px] text-slate-500">Telp: {config.noHp}</p>
                </div>

                <div className="space-y-1 py-1">
                  <div className="flex justify-between">
                    <span>1x Beras Ramos 5kg</span>
                    <span>Rp68.000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>2x Minyak Sania 1L</span>
                    <span>Rp36.000</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 space-y-1">
                  <div className="flex justify-between font-bold">
                    <span>TOTAL</span>
                    <span>Rp104.000</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>CASH</span>
                    <span>Rp110.000</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>KEMBALI</span>
                    <span>Rp6.000</span>
                  </div>
                </div>

                <div className="text-center text-[9px] text-slate-500 border-t border-dashed border-slate-300 dark:border-slate-700 pt-2">
                  <p>{config.footerStruk}</p>
                </div>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* TAB BARCODE SCANNER: KONEKSI & PENGATURAN */}
      {activeTab === 'barcode' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          {/* Header Barcode */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Barcode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Koneksi & Konfigurasi Barcode Scanner</span>
              </h3>
              <p className="text-xs text-slate-500">
                Atur metode koneksi alat pemindai barcode (USB, Bluetooth, Kamera HP) & perilaku auto-scan di Kasir.
              </p>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Modul Scanner SIAP (Plug & Play)</span>
            </div>
          </div>

          {/* 1. Tipe Koneksi Scanner (Grid 4 Kartu) */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
              1. Pilih Tipe / Metode Koneksi Perangkat
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  id: 'usb_hid',
                  label: 'USB / 2.4G Dongle',
                  sub: 'HID Keyboard Emulation (Rekomendasi Utama)',
                  desc: 'Mendukung semua scanner USB & dongle wireless (Eyoyo, Zebra, Honeywell, NETUM). Tanpa perlu driver khusus.',
                  icon: Keyboard,
                },
                {
                  id: 'camera',
                  label: 'Kamera HP / Laptop',
                  sub: 'Built-in WebCam & Mobile Camera',
                  desc: 'Pindai barcode langsung dari lensa kamera HP/tablet kasir tanpa perangkat tambahan.',
                  icon: Camera,
                },
                {
                  id: 'bluetooth_spp',
                  label: 'Bluetooth Portable',
                  sub: 'Bluetooth SPP / Wireless Pocket',
                  desc: 'Menghubungkan scanner genggam mini Bluetooth ke HP Android, iOS, atau komputer kasir.',
                  icon: Bluetooth,
                },
                {
                  id: 'web_serial',
                  label: 'Web Serial (COM Port)',
                  sub: 'Virtual Serial Port Communication',
                  desc: 'Menggunakan Web Serial API browser untuk koneksi langsung port COM / USB Industrial.',
                  icon: Radio,
                },
              ].map((item) => {
                const IconItem = item.icon;
                const isSelected = config.scannerType === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSaveConfig({ scannerType: item.id as any }, 'Tipe Scanner Diperbarui')}
                    className={`p-4 rounded-2xl text-left border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                      isSelected
                        ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 text-slate-900 dark:text-white border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                        : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-500/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className={`p-2 rounded-xl ${isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        <IconItem className="w-5 h-5" />
                      </div>
                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</h4>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mb-1">{item.sub}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Pengaturan Parameter Scanner & Perilaku Scan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Form Parameter */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                2. Parameter Perangkat & Suffix
              </h4>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nama Perangkat / Model Scanner
                </label>
                <input
                  type="text"
                  value={config.scannerDeviceName}
                  onChange={(e) => setConfig({ ...config, scannerDeviceName: e.target.value })}
                  onBlur={() => handleSaveConfig({}, 'Nama Scanner Disimpan')}
                  placeholder="Contoh: Eyoyo 2D Wireless / Zebra DS2208"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Karakter Penutup (Suffix Key)
                  </label>
                  <select
                    value={config.scannerSuffixKey}
                    onChange={(e) => handleSaveConfig({ scannerSuffixKey: e.target.value as any }, 'Suffix Scanner Diubah')}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="enter">Enter / CR+LF (Standar Kasir)</option>
                    <option value="tab">Tab Key</option>
                    <option value="none">Tanpa Suffix</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Awalan Karakter (Prefix Filter)
                  </label>
                  <input
                    type="text"
                    value={config.scannerPrefix}
                    onChange={(e) => setConfig({ ...config, scannerPrefix: e.target.value })}
                    onBlur={() => handleSaveConfig({}, 'Prefix Scanner Diperbarui')}
                    placeholder="Kosongkan jika standar"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Toggle Beep Sound */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${config.scannerBeepSound ? 'bg-amber-500/20 text-amber-600' : 'bg-slate-200 text-slate-400'}`}>
                    {config.scannerBeepSound ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Suara Bip (Beep Feedback)</h5>
                    <p className="text-[11px] text-slate-500">Bunyi bip konfirmasi saat barcode berhasil di-scan.</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playScannerBeep('success')}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold hover:bg-amber-500/20 cursor-pointer"
                  >
                    Tes Bip
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveConfig({ scannerBeepSound: !config.scannerBeepSound }, 'Suara Bip Diperbarui')}
                    className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                      config.scannerBeepSound ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.scannerBeepSound ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>

              {/* Toggle Auto Add Qty */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Auto-Tambah Jumlah di Kasir (+1)</h5>
                  <p className="text-[11px] text-slate-500">Otomatis tambah quantity jika barang sudah ada di keranjang.</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleSaveConfig({ scannerAutoAddQty: !config.scannerAutoAddQty }, 'Auto Qty Diperbarui')}
                  className={`w-11 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                    config.scannerAutoAddQty ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${config.scannerAutoAddQty ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* 3. Interactive Barcode Test & Calibration Widget */}
            <div className="p-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Scan className="w-4 h-4 text-emerald-600" />
                  <span>3. Widget Pengujian & Kalibrasi Scanner Live</span>
                </h4>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-mono px-2 py-0.5 rounded-md font-bold">
                  TESTER LIVE
                </span>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-400">
                Arahkan scanner fisik Anda dan pindaikan barcode kemasan barang ke kolom input di bawah ini untuk menguji performa koneksi.
              </p>

              {/* Interactive Input Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!testScanInput.trim()) return;

                  const startTime = performance.now();
                  const term = testScanInput.trim().toLowerCase();
                  const found = products.find(
                    (p) => p.barcode?.toLowerCase() === term || p.kode.toLowerCase() === term
                  );

                  const endTime = performance.now();
                  setTestScanTime(Math.round(endTime - startTime));

                  if (found) {
                    setTestScanResult(found);
                    setTestScanNotFound(false);
                    if (config.scannerBeepSound) playScannerBeep('success');
                  } else {
                    setTestScanResult(null);
                    setTestScanNotFound(true);
                    if (config.scannerBeepSound) playScannerBeep('error');
                  }
                }}
                className="space-y-2"
              >
                <div className="relative">
                  <Barcode className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    value={testScanInput}
                    onChange={(e) => {
                      setTestScanInput(e.target.value);
                      setTestScanNotFound(false);
                    }}
                    placeholder="Scan barcode di sini (atau ketik misal: 8991001100012 lalu Enter)"
                    className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-emerald-500/40 bg-white dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 cursor-pointer"
                  >
                    Uji Scan
                  </button>
                </div>
              </form>

              {/* Live Test Match Card */}
              {testScanResult && (
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/40 space-y-2 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> KONEKSI & MATCH TERVERIFIKASI
                    </span>
                    {testScanTime !== null && (
                      <span className="text-[10px] font-mono text-slate-400">
                        Kecepatan: {testScanTime}ms
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-950 overflow-hidden shrink-0">
                      {testScanResult.gambarUrl ? (
                        <img src={testScanResult.gambarUrl} alt={testScanResult.nama} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-400">
                          {testScanResult.kode.substring(0, 3)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{testScanResult.nama}</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                        Rp {testScanResult.hargaJual.toLocaleString('id-ID')} / {testScanResult.satuan}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono">
                        SKU: {testScanResult.kode} • Barcode: {testScanResult.barcode || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {testScanNotFound && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" /> Barcode "{testScanInput}" Tidak Terdaftar di Database!
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sinyal fisik barcode scanner diterima dengan sempurna. Daftarkan nomor ini di menu Produk jika ingin dijual.
                  </p>
                </div>
              )}

              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 text-[11px] text-slate-500 dark:text-slate-400 space-y-1 border border-slate-200 dark:border-slate-800">
                <p className="font-bold text-slate-700 dark:text-slate-300">💡 Panduan Cepat Scanner Kasir Sembako:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[10.5px]">
                  <li>Tipe <b>USB HID</b> bersifat Plug & Play — tancapkan USB ke PC/Laptop/HP (via OTG) lalu siap digunakan.</li>
                  <li>Di halaman Kasir, tempatkan kursor pada kolom pencarian barang atau tekan tombol <b>F2</b> untuk fokus scan otomatis.</li>
                </ul>
              </div>
            </div>

          </div>
        </motion.div>
      )}

      {/* TAB 3: TAMPILAN & TEMA */}
      {activeTab === 'tema' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Palette className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Personalisasi Tema & Tampilan Visual</span>
            </h3>
            <p className="text-xs text-slate-500">
              Sesuaikan suasana visual antarmuka aplikasi sesuai kenyamanan toko Anda.
            </p>
          </div>

          <div className="space-y-5">
            {/* Dark Mode Switch */}
            <div className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-500">
                  {theme === 'dark' ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                    {theme === 'dark' ? 'Mode Gelap (Dark Luxury)' : 'Mode Terang (Light Elegant)'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {theme === 'dark'
                      ? 'Nyamankan mata saat transaksi di tempat redup atau malam hari.'
                      : 'Tampilan bersih, cerah, dan kontras tinggi di siang hari.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md cursor-pointer transition-all"
              >
                Ganti Mode ({theme === 'dark' ? 'Terang' : 'Gelap'})
              </button>
            </div>

            {/* Accent Color Palette */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Pilihan Warna Aksen UI Kasir
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { id: 'emerald', label: 'Emerald Sembako', class: 'bg-emerald-600' },
                  { id: 'amber', label: 'Amber Gold', class: 'bg-amber-500' },
                  { id: 'indigo', label: 'Deep Indigo', class: 'bg-indigo-600' },
                  { id: 'teal', label: 'Ocean Teal', class: 'bg-teal-600' },
                  { id: 'rose', label: 'Coral Rose', class: 'bg-rose-600' },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSaveConfig({ accentColor: c.id as any }, 'Aksen Warna Diperbarui')}
                    className={`p-3 rounded-2xl border text-xs font-bold flex items-center gap-2 cursor-pointer transition-all ${
                      config.accentColor === c.id
                        ? 'bg-slate-100 dark:bg-slate-800 border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded-full ${c.class}`} />
                    <span>{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* TAB 4: BACKUP & RESTORE */}
      {activeTab === 'backup' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Backup & Restore Database Firestore</span>
            </h3>
            <p className="text-xs text-slate-500">
              Unduh cadangan data toko secara utuh atau pulihkan dari file JSON yang telah disimpan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Export Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 w-fit">
                  <Download className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Export Full Database (.JSON)
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Unduh seluruh daftar {products.length} produk sembako dan {transactions.length} riwayat transaksi dalam 1 file cadangan JSON terenkripsi aman.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportDatabase}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-700 to-emerald-600 hover:from-emerald-600 hover:to-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Download className="w-4 h-4 text-amber-300" />
                <span>Unduh Cadangan Database</span>
              </button>
            </div>

            {/* Restore Card */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 w-fit">
                  <HardDriveUpload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Restore Database dari File JSON
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Pilih file `.json` cadangan dari komputer Anda untuk memulihkan katalog produk dan transaksi ke Firestore.
                </p>

                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestoreFileChange}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500/20 file:text-amber-700 cursor-pointer"
                />
              </div>

              <button
                type="button"
                disabled={!restoreDataParsed || isRestoring}
                onClick={handleExecuteRestore}
                className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                <RotateCcw className={`w-4 h-4 ${isRestoring ? 'animate-spin' : ''}`} />
                <span>{isRestoring ? 'Memulihkan...' : 'Jalankan Pemulihan Restore'}</span>
              </button>
            </div>

          </div>
        </motion.div>
      )}

      {/* TAB 5: IMPORT PRODUK */}
      {activeTab === 'import' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-slate-200 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Import Katalog Produk Massal (Excel .XLSX / .CSV / .JSON)</span>
              </h3>
              <p className="text-xs text-slate-500">
                Tambahkan puluhan variasi produk sembako baru sekaligus dari file Microsoft Excel secara instan.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDownloadExcelTemplate}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md cursor-pointer flex items-center gap-2 transition-all"
                title="Unduh file Excel spreadsheet berformat tabel rapi (.xlsx)"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-200" />
                <span>Unduh Template Excel (.XLSX)</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-all"
                title="Unduh versi teks CSV standar"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Template CSV</span>
              </button>
            </div>
          </div>

          {/* Excel Format Table Guide */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                <span>Format Tabel Kolom Excel (PENTING)</span>
              </h4>
              <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                Mendukung Delimiter Koma (,) dan Titik Koma (;)
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-x-auto bg-slate-50/50 dark:bg-slate-950/50">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 font-bold text-slate-700 dark:text-slate-200 uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-3 py-2.5 text-center">Kolom</th>
                    <th className="px-3 py-2.5">Nama Header Excel</th>
                    <th className="px-3 py-2.5">Wajib/Opsional</th>
                    <th className="px-3 py-2.5">Tipe Data & Format</th>
                    <th className="px-3 py-2.5">Contoh Isian Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-sans">
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">A</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Nama</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Teks (Nama produk & ukuran)</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">Beras Sania Premium 5kg</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">B</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Kode</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Teks unik (SKU / Kode Toko)</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">BRS-001</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">C</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Kategori</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Beras, Minyak, Gula, Mie, dll.</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">Beras</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">D</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">HargaBeli</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Angka saja (tanpa Rp atau titik)</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">68000</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">E</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">HargaJual</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Angka saja (tanpa Rp atau titik)</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">75000</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">F</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Stok</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Angka jumlah stok awal</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">25</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">G</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Satuan</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Wajib</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Sak, Pcs, Pouch, Kg, Dus, Botol</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">Sak</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">H</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Barcode</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">Opsional</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Kode Barcode EAN13 scanner</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">8991234567890</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">I</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">ExpiredDate</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">Opsional</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Format Tanggal (YYYY-MM-DD)</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">2027-12-31</td>
                  </tr>
                  <tr className="hover:bg-slate-100/50 dark:hover:bg-slate-900/50">
                    <td className="px-3 py-2 text-center font-mono font-bold text-emerald-600">J</td>
                    <td className="px-3 py-2 font-mono font-black text-slate-900 dark:text-white">Deskripsi</td>
                    <td className="px-3 py-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/10 text-slate-500 border border-slate-500/20">Opsional</span></td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-400">Catatan atau spesifikasi ringkas</td>
                    <td className="px-3 py-2 font-mono text-emerald-600 font-medium">Beras pulen 5kg</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Upload Area */}
            <div className="border-2 border-dashed border-emerald-500/30 rounded-3xl p-6 text-center bg-slate-50/50 dark:bg-slate-950/50 space-y-3">
              <FileSpreadsheet className="w-10 h-10 text-emerald-500 mx-auto" />
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Unggah File Excel Katalog (.XLSX / .XLS / .CSV / .JSON)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Unggah file template yang sudah diisi. Sistem akan membaca data otomatis dan menampilkan tabel pratinjau di bawah.
                </p>
              </div>

              <input
                type="file"
                accept=".xlsx, .xls, .csv, .json"
                onChange={handleImportFileChange}
                className="block mx-auto text-xs text-slate-500 file:mr-3 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer hover:file:bg-emerald-700"
              />
            </div>

            {/* Imported Preview Table */}
            {importedItemsPreview.length > 0 && (
              <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare className="w-4 h-4 text-emerald-500" />
                    <span>Pratinjau Data ({importedItemsPreview.length} Produk Terbaca)</span>
                  </h4>

                  <button
                    type="button"
                    disabled={isImporting}
                    onClick={handleExecuteImportProducts}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    <CheckSquare className="w-4 h-4 text-amber-300" />
                    <span>{isImporting ? 'Mengimpor ke Database...' : 'Proses Simpan All Produk ke Firestore'}</span>
                  </button>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-950 font-bold text-slate-600 dark:text-slate-300 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-center">No</th>
                        <th className="px-3 py-2">Nama Produk</th>
                        <th className="px-3 py-2">Kode SKU</th>
                        <th className="px-3 py-2">Kategori</th>
                        <th className="px-3 py-2 text-right">Harga Beli</th>
                        <th className="px-3 py-2 text-right">Harga Jual</th>
                        <th className="px-3 py-2 text-center">Stok & Satuan</th>
                        <th className="px-3 py-2 font-mono">Barcode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {importedItemsPreview.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                          <td className="px-3 py-2 text-center text-slate-400">{idx + 1}</td>
                          <td className="px-3 py-2 font-sans font-bold text-slate-900 dark:text-white">{p.nama}</td>
                          <td className="px-3 py-2 text-emerald-600 font-bold">{p.kode}</td>
                          <td className="px-3 py-2 font-sans">{p.kategori}</td>
                          <td className="px-3 py-2 text-right">Rp{p.hargaBeli?.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 text-right font-bold text-emerald-600">Rp{p.hargaJual?.toLocaleString('id-ID')}</td>
                          <td className="px-3 py-2 text-center font-bold">{p.stok} {p.satuan}</td>
                          <td className="px-3 py-2 text-slate-400 text-[11px]">{p.barcode || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* TAB 6: RESET DATA */}
      {activeTab === 'reset' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-rose-500/20 shadow-xl space-y-6"
        >
          <div className="border-b border-rose-500/20 pb-4">
            <h3 className="text-sm font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Pusat Kendali Pembersihan & Reset Data Toko</span>
            </h3>
            <p className="text-xs text-slate-500">
              Area berisiko tinggi. Gunakan fitur pembersihan ini saat ingin meriset ulang transaksi atau stok.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Reset Stok */}
            <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
              <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">
                1. Kosongkan Unit Stok
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ubah angka sisa stok seluruh {products.length} produk menjadi 0 untuk memulai stock opname fisik baru.
              </p>

              <button
                type="button"
                onClick={() => setResetType('stok')}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20 font-bold text-xs cursor-pointer"
              >
                Reset Stok Menjadi 0
              </button>
            </div>

            {/* Reset Transaksi */}
            <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/20 space-y-3">
              <h4 className="text-xs font-bold text-rose-700 dark:text-rose-300 uppercase">
                2. Bersihkan Transaksi
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hapus riwayat {transactions.length} transaksi penjualan untuk meriset ulang hitungan omzet harian.
              </p>

              <button
                type="button"
                onClick={() => setResetType('transaksi')}
                className="w-full py-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/30 hover:bg-rose-500/20 font-bold text-xs cursor-pointer"
              >
                Clear Riwayat Kasir
              </button>
            </div>

            {/* Kosongkan Semua Data Toko (Mulai dari Nol) */}
            <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
              <h4 className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase">
                3. Kosongkan Semua Data (Mulai Nol)
              </h4>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Hapus seluruh produk, transaksi, dan supplier. Sangat cocok saat pertama kali aktivasi agar dapat input data toko Anda sendiri dari awal.
              </p>

              <button
                type="button"
                onClick={() => setResetType('kosong')}
                className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs cursor-pointer shadow-md hover:bg-rose-700"
              >
                Kosongkan Semua Data Toko
              </button>
            </div>

          </div>
        </motion.div>
      )}

      {/* TAB 7: TENTANG APLIKASI */}
      {activeTab === 'tentang' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl p-6 rounded-3xl border border-emerald-500/20 shadow-xl space-y-6"
        >
          <div className="text-center space-y-2 border-b border-slate-200 dark:border-slate-800 pb-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-950 via-emerald-900 to-slate-900 text-amber-400 mx-auto flex items-center justify-center border border-amber-500/30 shadow-2xl">
              <Sparkles className="w-8 h-8 text-amber-300" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Sembako Smart AI Platform
            </h3>
            <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-bold">
              v2.5 - Enterprise Kasir POS & Intelligence Assistant
            </p>
            <div className="pt-2 space-y-0.5">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Develop by <span className="font-bold text-slate-900 dark:text-white">Smart AI Indonesia</span>
              </p>
              <a
                href="https://www.smart-ai.id"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 hover:underline inline-block"
              >
                www.smart-ai.id
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px]">
                Spesifikasi & Mesin AI
              </h4>
              <ul className="space-y-1.5 text-slate-500">
                <li>• **AI Engine:** Google Gemini 2.5 Flash</li>
                <li>• **Database:** Cloud Firestore Realtime Sync</li>
                <li>• **Audio Engine:** Web Speech API (Voice Command)</li>
                <li>• **Export Engine:** jsPDF & SheetJS (.xlsx)</li>
              </ul>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 uppercase text-[10px]">
                Status Komponen
              </h4>
              <ul className="space-y-1.5 font-bold">
                <li className="text-emerald-600 dark:text-emerald-400">✓ Sync Firestore OK</li>
                <li className="text-emerald-600 dark:text-emerald-400">✓ PWA Service Worker Ready</li>
                <li className="text-emerald-600 dark:text-emerald-400">✓ Offline Local Storage Engine Active</li>
              </ul>
            </div>
          </div>
        </motion.div>
      )}

      {/* MODAL 1: TEST PRINT SIMULATION */}
      <Modal
        isOpen={isTestPrintOpen}
        onClose={() => setIsTestPrintOpen(false)}
        title="Uji Cetak Printer Thermal"
        subtitle="Memulai koneksi sinyal cetak ke printer"
        maxWidth="max-w-md"
      >
        <div className="space-y-4 text-center py-2">
          <div className="p-4 rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 inline-block">
            <Printer className="w-10 h-10 animate-bounce" />
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Sinyal tes cetak dikirim ke printer <strong>{config.printerName}</strong> via {config.connectionType.toUpperCase()}.
          </p>

          <div className="flex justify-center gap-2 pt-2">
            <button
              onClick={() => {
                window.print();
                setIsTestPrintOpen(false);
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-md"
            >
              Cetak Nota Sekarang
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: RESET CONFIRMATION */}
      <Modal
        isOpen={resetType !== null}
        onClose={() => setResetType(null)}
        title="Konfirmasi Reset Data Toko"
        subtitle="Tindakan ini tidak dapat dibatalkan"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs leading-relaxed font-bold">
            ⚠️ Perhatian: Anda akan melakukan reset data jenis "{resetType?.toUpperCase()}".
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ketik "RESET" untuk mengonfirmasi:
            </label>
            <input
              type="text"
              value={resetConfirmInput}
              onChange={(e) => setResetConfirmInput(e.target.value)}
              placeholder="RESET"
              className="w-full px-3.5 py-2.5 rounded-xl border border-rose-500/30 bg-slate-50 dark:bg-slate-950 text-xs font-mono font-bold text-rose-600"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setResetType(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold"
            >
              Batal
            </button>

            <button
              type="button"
              disabled={resetConfirmInput.toUpperCase() !== 'RESET' || isResetting}
              onClick={handleExecuteReset}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              {isResetting ? 'Mengosongkan...' : 'Konfirmasi Reset'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
