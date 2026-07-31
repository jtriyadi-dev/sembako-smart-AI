import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { ProdukItem, MovementType, SupplierItem } from '../types';
import { 
  ArrowDownRight, 
  ArrowUpRight, 
  RefreshCw, 
  Boxes, 
  Truck, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Package, 
  AlertCircle,
  Hash,
  SlidersHorizontal,
  Building2
} from 'lucide-react';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProdukItem[];
  suppliers?: SupplierItem[];
  preselectedProduct?: ProdukItem | null;
  onSubmit: (params: {
    product: ProdukItem;
    tipe: MovementType;
    jumlah: number;
    keterangan: string;
    supplier?: string;
    supplierId?: string;
    expiredDate?: string;
    batchNo?: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  products,
  suppliers = [],
  preselectedProduct,
  onSubmit,
  isSubmitting = false,
}) => {
  const [selectedProductId, setSelectedProductId] = useState('');
  const [tipe, setTipe] = useState<MovementType>('masuk');
  const [jumlah, setJumlah] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [customSupplierName, setCustomSupplierName] = useState('');
  const [expiredDate, setExpiredDate] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [keterangan, setKeterangan] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (preselectedProduct) {
      setSelectedProductId(preselectedProduct.id);
      setExpiredDate(preselectedProduct.expiredDate || '');
      setBatchNo(preselectedProduct.batchNo || '');
      if (preselectedProduct.supplierId) {
        setSelectedSupplierId(preselectedProduct.supplierId);
      } else if (preselectedProduct.supplierNama) {
        setCustomSupplierName(preselectedProduct.supplierNama);
      }
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [preselectedProduct, products, isOpen]);

  const selectedProduct = products.find((p) => p.id === selectedProductId) || preselectedProduct || null;

  // Stock Preview Calculations
  const stokAwal = selectedProduct ? selectedProduct.stok : 0;
  const qtyNum = Number(jumlah) || 0;
  let stokAkhir = stokAwal;

  if (tipe === 'masuk') {
    stokAkhir = stokAwal + qtyNum;
  } else if (tipe === 'keluar') {
    stokAkhir = Math.max(0, stokAwal - qtyNum);
  } else if (tipe === 'penyesuaian') {
    stokAkhir = Math.max(0, qtyNum);
  }

  const validate = (): boolean => {
    const newErr: Record<string, string> = {};

    if (!selectedProduct) {
      newErr.product = 'Pilih produk terlebih dahulu';
    }

    if (!jumlah || qtyNum <= 0) {
      newErr.jumlah = 'Jumlah unit harus lebih dari 0';
    }

    if (tipe === 'keluar' && qtyNum > stokAwal) {
      newErr.jumlah = `Jumlah keluar (${qtyNum}) melebihi stok yang ada (${stokAwal})`;
    }

    setErrors(newErr);
    return Object.keys(newErr).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !selectedProduct) return;

    let finalSupplierName = '';
    let finalSupplierId = '';

    if (selectedSupplierId && selectedSupplierId !== 'custom') {
      const foundSup = suppliers.find((s) => s.id === selectedSupplierId);
      if (foundSup) {
        finalSupplierName = foundSup.namaSupplier;
        finalSupplierId = foundSup.id;
      }
    } else {
      finalSupplierName = customSupplierName.trim();
    }

    await onSubmit({
      product: selectedProduct,
      tipe,
      jumlah: qtyNum,
      keterangan: keterangan.trim() || `Transaksi ${tipe} stok`,
      supplier: finalSupplierName,
      supplierId: finalSupplierId,
      expiredDate: expiredDate.trim(),
      batchNo: batchNo.trim(),
    });

    // Reset Form
    setJumlah('');
    setSelectedSupplierId('');
    setCustomSupplierName('');
    setKeterangan('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Catat Mutasi Stok"
      subtitle="Input stok masuk dari distributor, stok keluar, atau penyesuaian manual"
      maxWidth="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        
        {/* Tipe Mutasi Buttons */}
        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
            Jenis Pergerakan Stok <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTipe('masuk');
                setErrors({});
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipe === 'masuk'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowDownRight className="w-4 h-4 text-amber-300" />
              <span>Stok Masuk</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTipe('keluar');
                setErrors({});
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipe === 'keluar'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-white" />
              <span>Stok Keluar</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setTipe('penyesuaian');
                setErrors({});
              }}
              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                tipe === 'penyesuaian'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Penyesuaian</span>
            </button>
          </div>
        </div>

        {/* Product Selector */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Pilih Barang / Produk <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Package className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <select
              value={selectedProductId}
              onChange={(e) => {
                const pid = e.target.value;
                setSelectedProductId(pid);
                const p = products.find((x) => x.id === pid);
                if (p) {
                  setExpiredDate(p.expiredDate || '');
                  setBatchNo(p.batchNo || '');
                }
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama} (SKU: {p.kode}) — Stok: {p.stok} {p.satuan}
                </option>
              ))}
            </select>
          </div>
          {errors.product && <p className="text-[11px] text-rose-500">{errors.product}</p>}
        </div>

        {/* Live Calculation Preview Banner */}
        {selectedProduct && (
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 block">Stok Saat Ini</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {stokAwal} {selectedProduct.satuan}
              </span>
            </div>

            <div className="text-center font-bold text-slate-400">➔</div>

            <div className="text-right">
              <span className="text-[11px] text-slate-500 block">Estimasi Stok Akhir</span>
              <span className={`text-base font-extrabold ${
                tipe === 'masuk' ? 'text-emerald-600 dark:text-emerald-400' :
                tipe === 'keluar' ? 'text-rose-600 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              }`}>
                {stokAkhir} {selectedProduct.satuan}
              </span>
            </div>
          </div>
        )}

        {/* Quantity & Supplier Input */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {tipe === 'penyesuaian' ? 'Total Stok Baru Target' : 'Jumlah Unit'} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Boxes className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="number"
                min="1"
                value={jumlah}
                onChange={(e) => {
                  setJumlah(e.target.value);
                  if (errors.jumlah) setErrors({ ...errors, jumlah: '' });
                }}
                placeholder={tipe === 'penyesuaian' ? 'Misal: 50' : 'Misal: 25'}
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl border text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-bold focus:outline-none transition-all ${
                  errors.jumlah ? 'border-rose-500' : 'border-slate-200 dark:border-slate-800 focus:border-emerald-500'
                }`}
              />
            </div>
            {errors.jumlah && <p className="text-[11px] text-rose-500 font-medium">{errors.jumlah}</p>}
          </div>

          {tipe === 'masuk' && (
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Distributor / Supplier Pemasok
              </label>
              <div className="space-y-2">
                <div className="relative">
                  <Building2 className="w-4 h-4 text-emerald-500 absolute left-3.5 top-3 z-10" />
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => {
                      setSelectedSupplierId(e.target.value);
                      if (e.target.value !== 'custom') {
                        const found = suppliers.find((s) => s.id === e.target.value);
                        if (found) setCustomSupplierName(found.namaSupplier);
                      }
                    }}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Pilih Dari Master Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.namaSupplier} ({s.kodeSupplier})
                      </option>
                    ))}
                    <option value="custom">+ Isi Nama Supplier Manual / Baru</option>
                  </select>
                </div>

                {(selectedSupplierId === 'custom' || (!selectedSupplierId && suppliers.length === 0)) && (
                  <div className="relative animate-fadeIn">
                    <Truck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      value={customSupplierName}
                      onChange={(e) => setCustomSupplierName(e.target.value)}
                      placeholder="Ketik nama distributor / supplier..."
                      className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Expired Date & Batch Number */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Tanggal Kedaluwarsa (Expired Date)
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-amber-500 absolute left-3.5 top-3" />
              <input
                type="date"
                value={expiredDate}
                onChange={(e) => setExpiredDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nomor Batch / Lot Supplier
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                placeholder="Contoh: BATCH-2026-08"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Keterangan */}
        <div className="space-y-1">
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
            Catatan / Keterangan
          </label>
          <div className="relative">
            <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder={
                tipe === 'masuk' ? 'Misal: Pembelian restock reguler mingguan' :
                tipe === 'keluar' ? 'Misal: Dus kemasan basah / kemasan rusak' :
                'Misal: Koreksi hasil hitung fisik gudang'
              }
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
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
            className={`px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              tipe === 'masuk' ? 'bg-emerald-600 hover:bg-emerald-500' :
              tipe === 'keluar' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan Log...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Simpan Transaksi Stok</span>
              </>
            )}
          </button>
        </div>

      </form>
    </Modal>
  );
};
