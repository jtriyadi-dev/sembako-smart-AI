import React, { useState } from 'react';
import { Modal } from './Modal';
import { Barcode, Search, CheckCircle2, AlertCircle } from 'lucide-react';
import { ProdukItem } from '../types';
import { useStore } from '../context/StoreContext';
import { playScannerBeep } from '../utils/audioUtils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProdukItem[];
  onSelectProduct: (product: ProdukItem) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const { storeConfig } = useStore();
  const [scannedCode, setScannedCode] = useState('');
  const [scannedResult, setScannedResult] = useState<ProdukItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedCode.trim()) return;

    const term = scannedCode.trim().toLowerCase();
    const found = products.find(
      (p) => p.barcode?.toLowerCase() === term || p.kode.toLowerCase() === term
    );

    if (found) {
      setScannedResult(found);
      setNotFound(false);
      if (storeConfig.scannerBeepSound) playScannerBeep('success');
    } else {
      setScannedResult(null);
      setNotFound(true);
      if (storeConfig.scannerBeepSound) playScannerBeep('error');
    }
  };

  const handleSelect = () => {
    if (scannedResult) {
      onSelectProduct(scannedResult);
      onClose();
      setScannedCode('');
      setScannedResult(null);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Simulator Barcode Scanner"
      subtitle="Ketik atau scan barcode / SKU barang untuk cari cepat"
      maxWidth="max-w-md"
    >
      <div className="space-y-4">
        <form onSubmit={handleScan} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Input Barcode / Kode SKU
            </label>
            <div className="relative">
              <Barcode className="w-4 h-4 text-emerald-600 absolute left-3.5 top-3" />
              <input
                type="text"
                autoFocus
                value={scannedCode}
                onChange={(e) => {
                  setScannedCode(e.target.value);
                  setNotFound(false);
                }}
                placeholder="Scan barcode / ketik misal: 8991001100012"
                className="w-full pl-10 pr-20 py-2.5 rounded-xl border border-emerald-500/30 bg-slate-50 dark:bg-slate-950 font-mono text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-bold text-xs flex items-center gap-1 hover:bg-emerald-500 cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Cari</span>
              </button>
            </div>
          </div>
        </form>

        {/* Scan Result */}
        {scannedResult && (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Produk Ditemukan!</span>
            </div>

            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-950 overflow-hidden shrink-0">
                {scannedResult.gambarUrl ? (
                  <img src={scannedResult.gambarUrl} alt={scannedResult.nama} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-bold text-xs text-slate-400">
                    {scannedResult.kode.substring(0, 3)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{scannedResult.nama}</p>
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                  Rp {scannedResult.hargaJual.toLocaleString('id-ID')}
                </p>
                <p className="text-[10px] text-slate-500 font-mono">
                  {scannedResult.kode} | Barcode: {scannedResult.barcode || '-'}
                </p>
              </div>
            </div>

            <button
              onClick={handleSelect}
              className="w-full py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 cursor-pointer shadow-md"
            >
              Buka Detail / Edit Produk Ini
            </button>
          </div>
        )}

        {notFound && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-1">
            <AlertCircle className="w-6 h-6 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-rose-700 dark:text-rose-300">
              Produk dengan Barcode/SKU "{scannedCode}" tidak ditemukan!
            </p>
            <p className="text-[11px] text-slate-500">
              Pastikan nomor barcode sesuai atau daftarkan sebagai produk baru.
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
};
