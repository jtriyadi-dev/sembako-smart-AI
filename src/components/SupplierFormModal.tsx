import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { SupplierItem } from '../types';
import { useStore } from '../context/StoreContext';
import { getAccentTheme } from '../utils/themeUtils';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  FileText, 
  CheckCircle2, 
  RefreshCw,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (supplierData: Omit<SupplierItem, 'id'>) => Promise<void>;
  initialData?: SupplierItem | null;
  isSubmitting?: boolean;
}

export const KATEGORI_SUPPLIER_LIST = [
  'Beras & Tepung',
  'Minyak & Lemak',
  'Gula & Pemanis',
  'Bumbu & Instan',
  'Telur & Susu',
  'Minuman & Kopi',
  'Sabun & Kebersihan',
  'Serba Ada / Grosir Umum',
];

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isSubmitting = false,
}) => {
  const { storeConfig } = useStore();
  const accent = getAccentTheme(storeConfig.accentColor);

  const [kodeSupplier, setKodeSupplier] = useState('');
  const [namaSupplier, setNamaSupplier] = useState('');
  const [kontakPerson, setKontakPerson] = useState('');
  const [telepon, setTelepon] = useState('');
  const [email, setEmail] = useState('');
  const [alamat, setAlamat] = useState('');
  const [kategoriProduk, setKategoriProduk] = useState('Beras & Tepung');
  const [catatan, setCatatan] = useState('');
  const [status, setStatus] = useState<'aktif' | 'nonaktif'>('aktif');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialData) {
      setKodeSupplier(initialData.kodeSupplier || '');
      setNamaSupplier(initialData.namaSupplier || '');
      setKontakPerson(initialData.kontakPerson || '');
      setTelepon(initialData.telepon || '');
      setEmail(initialData.email || '');
      setAlamat(initialData.alamat || '');
      setKategoriProduk(initialData.kategoriProduk || 'Beras & Tepung');
      setCatatan(initialData.catatan || '');
      setStatus(initialData.status || 'aktif');
    } else {
      resetForm();
    }
    setErrors({});
  }, [initialData, isOpen]);

  const resetForm = () => {
    generateAutoKode();
    setNamaSupplier('');
    setKontakPerson('');
    setTelepon('');
    setEmail('');
    setAlamat('');
    setKategoriProduk('Beras & Tepung');
    setCatatan('');
    setStatus('aktif');
  };

  const generateAutoKode = () => {
    const randomNum = Math.floor(100 + Math.random() * 900);
    setKodeSupplier(`SUP-${randomNum}`);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!namaSupplier.trim()) {
      newErrors.namaSupplier = 'Nama supplier/distributor wajib diisi';
    } else if (namaSupplier.trim().length < 3) {
      newErrors.namaSupplier = 'Nama supplier minimal 3 karakter';
    }

    if (!kodeSupplier.trim()) {
      newErrors.kodeSupplier = 'Kode supplier wajib diisi';
    }

    if (!telepon.trim()) {
      newErrors.telepon = 'Nomor telepon / WA wajib diisi';
    } else if (telepon.trim().length < 8) {
      newErrors.telepon = 'Nomor telepon minimal 8 digit';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const payload: Omit<SupplierItem, 'id'> = {
      kodeSupplier: kodeSupplier.trim().toUpperCase(),
      namaSupplier: namaSupplier.trim(),
      kontakPerson: kontakPerson.trim(),
      telepon: telepon.trim(),
      email: email.trim(),
      alamat: alamat.trim(),
      kategoriProduk,
      catatan: catatan.trim(),
      status,
      createdAt: initialData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onSubmit(payload);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? 'Edit Data Supplier' : 'Tambah Supplier / Distributor Baru'}
      subtitle={initialData ? `Kode: ${initialData.kodeSupplier}` : 'Mencatat data pemasok barang untuk stok toko sembako'}
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Row 1: Kode Supplier & Nama Supplier */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Kode Supplier <span className="text-rose-500">*</span>
              </label>
              {!initialData && (
                <button
                  type="button"
                  onClick={generateAutoKode}
                  className={`text-[11px] ${accent.text} hover:underline inline-flex items-center gap-1 cursor-pointer font-semibold`}
                >
                  <RefreshCw className="w-3 h-3" /> Auto
                </button>
              )}
            </div>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={kodeSupplier}
                onChange={(e) => setKodeSupplier(e.target.value.toUpperCase())}
                placeholder="SUP-001"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 uppercase font-mono font-bold focus:outline-none transition-all ${
                  errors.kodeSupplier ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.kodeSupplier && <p className="text-[11px] text-rose-500">{errors.kodeSupplier}</p>}
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nama Supplier / Distributor <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={namaSupplier}
                onChange={(e) => {
                  setNamaSupplier(e.target.value);
                  if (errors.namaSupplier) setErrors({ ...errors, namaSupplier: '' });
                }}
                placeholder="Contoh: PT Sumber Sembako Nusantara"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:outline-none transition-all ${
                  errors.namaSupplier ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.namaSupplier && <p className="text-[11px] text-rose-500 font-medium">{errors.namaSupplier}</p>}
          </div>
        </div>

        {/* Row 2: Kontak Person & Telepon (WhatsApp) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Penanggung Jawab / Sales Person (PIC)
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={kontakPerson}
                onChange={(e) => setKontakPerson(e.target.value)}
                placeholder="Contoh: Pak Hendra / Bu Rina"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              No. Telepon / WhatsApp <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3" />
              <input
                type="tel"
                value={telepon}
                onChange={(e) => {
                  setTelepon(e.target.value);
                  if (errors.telepon) setErrors({ ...errors, telepon: '' });
                }}
                placeholder="Contoh: 081234567890"
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none transition-all ${
                  errors.telepon ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.telepon && <p className="text-[11px] text-rose-500">{errors.telepon}</p>}
          </div>
        </div>

        {/* Row 3: Email & Kategori Utama */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Email Supplier (Opsional)
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="order@sumbersembako.com"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Kategori Produk Utama Supplier <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <select
                value={kategoriProduk}
                onChange={(e) => setKategoriProduk(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer font-medium"
              >
                {KATEGORI_SUPPLIER_LIST.map((kat) => (
                  <option key={kat} value={kat}>{kat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Row 4: Alamat Gudang / Kantor */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Alamat Gudang / Kantor Supplier (Opsional)
          </label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={alamat}
              onChange={(e) => setAlamat(e.target.value)}
              placeholder="Jl. Industri Sembako No. 12, Kelapa Gading, Jakarta Utara"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Row 5: Status & Catatan */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Status Supplier
            </label>
            <button
              type="button"
              onClick={() => setStatus(status === 'aktif' ? 'nonaktif' : 'aktif')}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                status === 'aktif'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{status === 'aktif' ? 'Status: Aktif' : 'Status: Non-Aktif'}</span>
              {status === 'aktif' ? (
                <ToggleRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-400" />
              )}
            </button>
          </div>

          <div className="sm:col-span-2 space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Catatan / Syarat Ketentuan (TOP, Minimal Order)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                placeholder="Contoh: Minimal order 10 karung, Pembayaran Tempo H+14"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
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
            className={`px-6 py-2.5 rounded-xl bg-gradient-to-r ${accent.gradient} hover:opacity-90 text-white font-bold text-xs shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Supplier...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>{initialData ? 'Update Supplier' : 'Simpan Supplier Baru'}</span>
              </>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
};
