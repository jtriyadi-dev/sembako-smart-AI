import React, { useState, useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { ProdukItem, SupplierItem } from '../types';
import { processImageFile } from '../utils/imageUtils';
import { 
  Package, 
  Tag, 
  Barcode, 
  DollarSign, 
  Boxes, 
  Image as ImageIcon, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  FileText,
  Upload,
  Camera,
  Trash2,
  UploadCloud,
  Building2
} from 'lucide-react';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (productData: Omit<ProdukItem, 'id'>) => Promise<void>;
  initialData?: ProdukItem | null;
  suppliers?: SupplierItem[];
  isSubmitting?: boolean;
}

export const KATEGORI_LIST = [
  'Sembako Utama',
  'Minyak & Lemak',
  'Bumbu & Tepung',
  'Makanan Instant',
  'Minuman & Sirup',
  'Susu & Olahan',
  'Telur & Hasil Tani',
  'Sabun & Kebersihan',
  'Perawatan Diri',
  'Roti, Biskuit & Snack',
  'Perlengkapan Bayi',
  'Rokok & Tembakau',
  'Obat & Kesehatan',
  'Perlengkapan Rumah',
  'Lainnya',
];

export const SATUAN_LIST = [
  'Sak',
  'Kg',
  'Gram',
  'Liter',
  'Pouch',
  'Pcs',
  'Bks',
  'Dus',
  'Kaleng',
  'Botol',
  'Renceng',
];

// High quality preset image choices for common Sembako items
const PRESET_IMAGES = [
  { name: 'Beras', url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&q=80&w=400' },
  { name: 'Minyak Goreng', url: 'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&q=80&w=400' },
  { name: 'Gula', url: 'https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&q=80&w=400' },
  { name: 'Telur', url: 'https://images.unsplash.com/photo-1506976785307-8732e854ad03?auto=format&fit=crop&q=80&w=400' },
  { name: 'Mie Instant', url: 'https://images.unsplash.com/photo-1612927601601-6638404737ce?auto=format&fit=crop&q=80&w=400' },
  { name: 'Tepung', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&q=80&w=400' },
  { name: 'Susu', url: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&q=80&w=400' },
  { name: 'Kopi', url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=400' },
  { name: 'Sabun Cuci', url: 'https://images.unsplash.com/photo-1585842378054-ee2e52f94ba2?auto=format&fit=crop&q=80&w=400' },
];

export const ProductFormModal: React.FC<ProductFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  suppliers = [],
  isSubmitting = false,
}) => {
  const [nama, setNama] = useState('');
  const [kategori, setKategori] = useState('Sembako Utama');
  const [isCustomKategori, setIsCustomKategori] = useState(false);
  const [customKategori, setCustomKategori] = useState('');
  const [kode, setKode] = useState('');
  const [barcode, setBarcode] = useState('');
  const [hargaBeli, setHargaBeli] = useState('');
  const [hargaJual, setHargaJual] = useState('');
  const [stok, setStok] = useState('');
  const [minStok, setMinStok] = useState('10');
  const [satuan, setSatuan] = useState('Kg');
  const [gambarUrl, setGambarUrl] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [expiredDate, setExpiredDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      setIsUploadingImage(true);
      const dataUrl = await processImageFile(file);
      setGambarUrl(dataUrl);
    } catch (err: any) {
      alert(err.message || 'Gagal mengupload foto produk');
    } finally {
      setIsUploadingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Errors state
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setNama(initialData.nama || '');
      const initialCat = initialData.kategori || 'Sembako Utama';
      if (KATEGORI_LIST.includes(initialCat)) {
        setKategori(initialCat);
        setIsCustomKategori(false);
        setCustomKategori('');
      } else {
        setKategori('__CUSTOM__');
        setIsCustomKategori(true);
        setCustomKategori(initialCat);
      }
      setKode(initialData.kode || '');
      setBarcode(initialData.barcode || '');
      setHargaBeli(initialData.hargaBeli ? String(initialData.hargaBeli) : '');
      setHargaJual(initialData.hargaJual ? String(initialData.hargaJual) : '');
      setStok(initialData.stok !== undefined ? String(initialData.stok) : '');
      setMinStok(initialData.minStok !== undefined ? String(initialData.minStok) : '10');
      setSatuan(initialData.satuan || 'Kg');
      setGambarUrl(initialData.gambarUrl || '');
      setDeskripsi(initialData.deskripsi || '');
      setExpiredDate(initialData.expiredDate || '');
      setBatchNo(initialData.batchNo || '');
      setSupplierId(initialData.supplierId || '');
    } else {
      resetForm();
    }
    setErrors({});
  }, [initialData, isOpen]);

  const resetForm = () => {
    setNama('');
    setKategori('Sembako Utama');
    setIsCustomKategori(false);
    setCustomKategori('');
    generateAutoKode('Sembako Utama');
    generateAutoBarcode();
    setHargaBeli('');
    setHargaJual('');
    setStok('');
    setMinStok('10');
    setSatuan('Kg');
    setGambarUrl('');
    setDeskripsi('');
    setExpiredDate('');
    setBatchNo('');
    setSupplierId('');
  };

  const generateAutoKode = (katName: string) => {
    const prefixMap: Record<string, string> = {
      'Sembako Utama': 'BRS',
      'Minyak & Lemak': 'MNY',
      'Bumbu & Tepung': 'TRG',
      'Makanan Instant': 'MIE',
      'Minuman & Sirup': 'MNM',
      'Susu & Olahan': 'SSU',
      'Telur & Hasil Tani': 'TLR',
      'Sabun & Kebersihan': 'SBN',
      'Perawatan Diri': 'SBN',
      'Roti, Biskuit & Snack': 'SNK',
      'Perlengkapan Bayi': 'BAYI',
      'Rokok & Tembakau': 'RKK',
      'Obat & Kesehatan': 'OBT',
      'Perlengkapan Rumah': 'PRM',
      'Lainnya': 'PRD',
    };
    const cleanKat = katName === '__CUSTOM__' ? customKategori.trim() : katName;
    const prefix = prefixMap[cleanKat] || (cleanKat ? cleanKat.substring(0, 3).toUpperCase() : 'PRD');
    const randomNum = Math.floor(100 + Math.random() * 900);
    setKode(`${prefix}-${randomNum}`);
  };

  const generateAutoBarcode = () => {
    // Generate 13 digit EAN-13 format barcode prefix 899 (Indonesia)
    const randomDigits = Math.floor(100000000 + Math.random() * 900000000);
    setBarcode(`899${randomDigits}`);
  };

  // Calculate profit and margin
  const hb = Number(hargaBeli) || 0;
  const hj = Number(hargaJual) || 0;
  const keuntungan = hj - hb;
  const marginPercent = hj > 0 ? ((keuntungan / hj) * 100).toFixed(1) : '0';

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!nama.trim()) {
      newErrors.nama = 'Nama produk wajib diisi';
    } else if (nama.trim().length < 3) {
      newErrors.nama = 'Nama produk minimal 3 karakter';
    }

    if (isCustomKategori && !customKategori.trim()) {
      newErrors.kategori = 'Nama kategori baru wajib diisi';
    }

    if (!kode.trim()) {
      newErrors.kode = 'Kode SKU wajib diisi';
    }

    if (!hargaBeli || Number(hargaBeli) < 0) {
      newErrors.hargaBeli = 'Harga modal (beli) tidak boleh negatif';
    }

    if (!hargaJual || Number(hargaJual) < 0) {
      newErrors.hargaJual = 'Harga jual wajib diisi';
    } else if (Number(hargaJual) < Number(hargaBeli)) {
      newErrors.hargaJual = 'Harga jual lebih rendah dari harga modal (Rugi)';
    }

    if (stok === '' || Number(stok) < 0) {
      newErrors.stok = 'Stok tidak boleh negatif';
    }

    if (minStok === '' || Number(minStok) < 0) {
      newErrors.minStok = 'Batas minimal stok wajib diisi';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const selectedSup = (suppliers || []).find((s) => s.id === supplierId);
    const activeCategory = isCustomKategori ? customKategori.trim() : kategori;

    const productPayload: Omit<ProdukItem, 'id'> = {
      nama: nama.trim(),
      kategori: activeCategory,
      kode: kode.trim(),
      barcode: barcode.trim(),
      hargaBeli: Number(hargaBeli),
      hargaJual: Number(hargaJual),
      stok: Number(stok),
      minStok: Number(minStok),
      satuan,
      gambarUrl: gambarUrl.trim(),
      deskripsi: deskripsi.trim(),
      expiredDate: expiredDate ? expiredDate : undefined,
      batchNo: batchNo.trim() ? batchNo.trim() : undefined,
      supplierId: supplierId ? supplierId : undefined,
      supplierNama: selectedSup ? selectedSup.namaSupplier : undefined,
      terjual: initialData?.terjual || 0,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSubmit(productPayload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Produk Sembako' : 'Tambah Produk Baru'}
      subtitle={initialData ? `ID: ${initialData.id}` : 'Lengkapi formulir barang inventaris toko'}
      maxWidth="max-w-3xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Row 1: Nama Produk & Kategori */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Produk Sembako <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={nama}
                onChange={(e) => {
                  setNama(e.target.value);
                  if (errors.nama) setErrors({ ...errors, nama: '' });
                }}
                placeholder="Contoh: Beras Setra Ramos Super 5kg"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none transition-all ${
                  errors.nama 
                    ? 'border-rose-500 focus:border-rose-500' 
                    : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.nama && <p className="text-[11px] text-rose-500 font-medium">{errors.nama}</p>}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Kategori <span className="text-rose-500">*</span>
              </label>
              {!isCustomKategori ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomKategori(true);
                    setKategori('__CUSTOM__');
                  }}
                  className="text-[11px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                >
                  + Tambah Kategori
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomKategori(false);
                    setKategori('Sembako Utama');
                  }}
                  className="text-[11px] text-slate-500 font-medium hover:underline cursor-pointer"
                >
                  ← Pilih dari daftar
                </button>
              )}
            </div>

            {!isCustomKategori ? (
              <select
                value={kategori}
                onChange={(e) => {
                  const newKat = e.target.value;
                  if (newKat === '__CUSTOM__') {
                    setIsCustomKategori(true);
                    setKategori('__CUSTOM__');
                  } else {
                    setKategori(newKat);
                    if (!initialData) generateAutoKode(newKat);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
              >
                {KATEGORI_LIST.map((kat) => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
                <option value="__CUSTOM__">➕ + Tambah Kategori Baru Custom...</option>
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  value={customKategori}
                  onChange={(e) => {
                    setCustomKategori(e.target.value);
                    if (errors.kategori) setErrors({ ...errors, kategori: '' });
                  }}
                  placeholder="Ketik nama kategori baru (contoh: Frozen Food)"
                  className={`w-full px-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none transition-all font-semibold ${
                    errors.kategori 
                      ? 'border-rose-500 focus:border-rose-500' 
                      : 'border-amber-500 focus:border-amber-500'
                  }`}
                />
                {errors.kategori && (
                  <p className="text-[11px] text-rose-500 font-medium">{errors.kategori}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: SKU & Barcode Code */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Kode SKU <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => generateAutoKode(kategori)}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Auto
              </button>
            </div>
            <div className="relative">
              <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="BRS-001"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 uppercase font-mono font-bold focus:outline-none transition-all ${
                  errors.kode ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.kode && <p className="text-[11px] text-rose-500">{errors.kode}</p>}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Barcode EAN-13 / Scanner ID
              </label>
              <button
                type="button"
                onClick={generateAutoBarcode}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" /> Auto Barcode
              </button>
            </div>
            <div className="relative">
              <Barcode className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="8991001100012"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Pricing & Margin Calculation */}
        <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              Simulasi Harga & Margin Keuntungan
            </span>
            {hj > 0 && (
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                keuntungan > 0
                  ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  : keuntungan < 0
                  ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30'
                  : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
              }`}>
                {keuntungan > 0 ? '+' : ''}
                {keuntungan.toLocaleString('id-ID')} ({marginPercent}%)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Harga Modal (Beli) (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                <input
                  type="number"
                  value={hargaBeli}
                  onChange={(e) => {
                    setHargaBeli(e.target.value);
                    if (errors.hargaBeli) setErrors({ ...errors, hargaBeli: '' });
                  }}
                  placeholder="65000"
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-950 font-semibold focus:outline-none transition-all ${
                    errors.hargaBeli ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {errors.hargaBeli && <p className="text-[11px] text-rose-500">{errors.hargaBeli}</p>}
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Harga Jual (Rp) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">Rp</span>
                <input
                  type="number"
                  value={hargaJual}
                  onChange={(e) => {
                    setHargaJual(e.target.value);
                    if (errors.hargaJual) setErrors({ ...errors, hargaJual: '' });
                  }}
                  placeholder="72000"
                  className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-white dark:bg-slate-950 font-bold focus:outline-none transition-all ${
                    errors.hargaJual ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500 text-emerald-700 dark:text-emerald-300'
                  }`}
                />
              </div>
              {errors.hargaJual && <p className="text-[11px] text-rose-500 font-medium">{errors.hargaJual}</p>}
            </div>
          </div>
        </div>

        {/* Row 4: Stock & Unit */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Stok Saat Ini <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Boxes className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="number"
                value={stok}
                onChange={(e) => {
                  setStok(e.target.value);
                  if (errors.stok) setErrors({ ...errors, stok: '' });
                }}
                placeholder="20"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:outline-none transition-all ${
                  errors.stok ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.stok && <p className="text-[11px] text-rose-500">{errors.stok}</p>}
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Batas Min Stok Alert <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              value={minStok}
              onChange={(e) => setMinStok(e.target.value)}
              placeholder="10"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Satuan Barang <span className="text-rose-500">*</span>
            </label>
            <select
              value={satuan}
              onChange={(e) => setSatuan(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
            >
              {SATUAN_LIST.map((sat) => (
                <option key={sat} value={sat}>{sat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 4.5: Expired Date & Batch Number */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tanggal Kedaluwarsa (Expired Date) (Opsional)
            </label>
            <input
              type="date"
              value={expiredDate}
              onChange={(e) => setExpiredDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nomor Batch / Lot Supplier (Opsional)
            </label>
            <input
              type="text"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              placeholder="Contoh: BATCH-2025-08"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>
        </div>

        {/* Row: Supplier Pemasok */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Pemasok / Supplier Utama Barang Ini (Opsional)
          </label>
          <div className="relative">
            <Building2 className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3" />
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="">-- Tanpa Supplier / Belum Dihubungkan --</option>
              {(suppliers || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.namaSupplier} ({s.kodeSupplier}) — {s.kategoriProduk}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 5: Foto Produk & Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Foto Produk (Upload Galeri / Kamera / URL / Preset)
            </label>
            {gambarUrl && (
              <button
                type="button"
                onClick={() => setGambarUrl('')}
                className="text-[11px] text-red-500 hover:text-red-600 font-medium flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Foto
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            className="hidden"
            onChange={handleImageFileSelect}
          />

          <div className="flex flex-col sm:flex-row gap-3 items-start">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-2xl border-2 border-dashed border-emerald-500/40 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 flex flex-col items-center justify-center overflow-hidden shrink-0 shadow-inner cursor-pointer transition-all relative group"
              title="Klik untuk Upload Foto dari Galeri atau Kamera HP/Laptop"
            >
              {gambarUrl ? (
                <>
                  <img 
                    src={gambarUrl} 
                    alt="Preview Produk" 
                    className="w-full h-full object-cover" 
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                    <Camera className="w-5 h-5" />
                    <span>Ganti Foto</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-2 text-emerald-600 dark:text-emerald-400">
                  {isUploadingImage ? (
                    <RefreshCw className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <UploadCloud className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-bold leading-tight">Upload Foto</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-2 w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isUploadingImage ? 'Memproses...' : 'Upload dari Galeri / Kamera'}</span>
                </button>
                <span className="text-[11px] text-slate-400 font-medium">atau tempel link:</span>
              </div>

              <input
                type="url"
                value={gambarUrl}
                onChange={(e) => setGambarUrl(e.target.value)}
                placeholder="https://... (URL Gambar)"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 font-mono"
              />

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-slate-500">Pilih Preset Gambar Sembako:</span>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                  {PRESET_IMAGES.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setGambarUrl(preset.url)}
                      className={`px-2 py-1 rounded-lg text-[11px] whitespace-nowrap transition-all border cursor-pointer ${
                        gambarUrl === preset.url
                          ? 'bg-emerald-600 text-white font-bold border-emerald-500'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 6: Deskripsi */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Deskripsi / Catatan Tambahan (Opsional)
          </label>
          <textarea
            rows={2}
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            placeholder="Catatan merek, rasa, atau spesifikasi barang..."
            className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-emerald-800 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>{initialData ? 'Update Produk' : 'Simpan Produk Baru'}</span>
              </>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
};
