import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { ProdukItem } from '../types';
import { 
  ClipboardCheck, 
  Boxes, 
  Package, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Minus, 
  Plus, 
  FileText 
} from 'lucide-react';

interface StockOpnameModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProdukItem[];
  preselectedProduct?: ProdukItem | null;
  onSubmit: (params: {
    product: ProdukItem;
    stokFisik: number;
    alasan: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const StockOpnameModal: React.FC<StockOpnameModalProps> = ({
  isOpen,
  onClose,
  products,
  preselectedProduct,
  onSubmit,
  isSubmitting = false,
}) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [stokFisikInput, setStokFisikInput] = useState('');
  const [alasan, setAlasan] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (preselectedProduct) {
      setSelectedProductId(preselectedProduct.id);
      setStokFisikInput(String(preselectedProduct.stok));
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
      setStokFisikInput(String(products[0].stok));
    }
  }, [preselectedProduct, products, isOpen]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || preselectedProduct || null;

  const stokSistem = selectedProduct ? selectedProduct.stok : 0;
  const stokFisikVal = stokFisikInput !== '' ? Number(stokFisikInput) : 0;
  const selisih = stokFisikVal - stokSistem;

  const validate = (): boolean => {
    const newErr: Record<string, string> = {};

    if (!selectedProduct) {
      newErr.product = 'Pilih produk yang akan di-opname';
    }

    if (stokFisikInput === '' || Number(stokFisikInput) < 0) {
      newErr.stokFisik = 'Jumlah stok fisik tidak boleh kosong atau negatif';
    }

    if (selisih !== 0 && !alasan.trim()) {
      newErr.alasan = 'Terdapat selisih fisik. Wajib mengisi alasan penyesuaian opname';
    }

    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedProduct) return;

    await onSubmit({
      product: selectedProduct,
      stokFisik: Number(stokFisikInput),
      alasan: alasan.trim() || 'Pemeriksaan fisik berkala (Stock Opname)',
    });

    setAlasan('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Audit Stock Opname Fisik"
      subtitle="Bandingkan stok tercatat di komputer dengan jumlah fisik di rak / gudang"
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Product Selector */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Pilih Barang Sembako <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <select
              value={selectedProductId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedProductId(pid);
                const p = products.find((x) => x.id === pid);
                if (p) setStokFisikInput(String(p.stok));
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} (SKU: {p.kode}) — Sistem: {p.stok} {p.satuan}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Stock Audit Comparison Card */}
        {selectedProduct && (
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
            
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">Stok di Sistem</span>
                <span className="text-lg font-black text-slate-800 dark:text-slate-200">
                  {stokSistem} {selectedProduct.satuan}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 block mb-1">
                  Stok Fisik Audit
                </span>
                <div className="flex items-center justify-center gap-1">
                  <input
                    type="number"
                    min="0"
                    value={stokFisikInput}
                    onChange={(e) => {
                      setStokFisikInput(e.target.value);
                      if (errors.stokFisik) setErrors({ ...errors, stokFisik: '' });
                    }}
                    className="w-20 text-center font-black text-lg text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg border border-emerald-500/40 focus:outline-none"
                  />
                  <span className="text-xs font-bold text-slate-500">{selectedProduct.satuan}</span>
                </div>
              </div>
            </div>

            {/* Variance Badge */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
              selisih === 0
                ? 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                : selisih < 0
                ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20'
            }`}>
              <span>Status Selisih Opname:</span>
              <span className="flex items-center gap-1 font-mono text-sm">
                {selisih === 0 ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>Sesuai (0)</span>
                  </>
                ) : selisih < 0 ? (
                  <>
                    <Minus className="w-4 h-4 text-rose-500" />
                    <span>Defisit {selisih} {selectedProduct.satuan}</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-emerald-500" />
                    <span>Surplus +{selisih} {selectedProduct.satuan}</span>
                  </>
                )}
              </span>
            </div>

          </div>
        )}

        {errors.stokFisik && <p className="text-[11px] text-rose-500">{errors.stokFisik}</p>}

        {/* Alasan Opname */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Alasan Penyesuaian Audit {selisih !== 0 && <span className="text-rose-500">*</span>}
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={alasan}
              onChange={(e) => {
                setAlasan(e.target.value);
                if (errors.alasan) setErrors({ ...errors, alasan: '' });
              }}
              placeholder={
                selisih < 0 ? 'Contoh: Kemasan bocor / dimakan hama / salah hitung' :
                selisih > 0 ? 'Contoh: Temuan pasokan belum tercatat' :
                'Audit rutin bulanan'
              }
              className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-none transition-all ${
                errors.alasan ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
              }`}
            />
          </div>
          {errors.alasan && <p className="text-[11px] text-rose-500 font-medium">{errors.alasan}</p>}
        </div>

        {/* Actions */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Audit...</span>
              </>
            ) : (
              <>
                <ClipboardCheck className="w-4 h-4" />
                <span>Simpan Hasil Opname</span>
              </>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
};
