import React from 'react';
import { Modal } from './Modal';
import { ProdukItem } from '../types';
import { AlertTriangle, Trash2, RefreshCw } from 'lucide-react';

interface ProductDeleteModalProps {
  isOpen: boolean;
  product: ProdukItem | null;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void>;
  isDeleting?: boolean;
}

export const ProductDeleteModal: React.FC<ProductDeleteModalProps> = ({
  isOpen,
  product,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  if (!product) return null;

  const handleConfirm = async () => {
    await onConfirm(product.id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Hapus Produk Sembako"
      subtitle="Tindakan ini tidak dapat dibatalkan"
      maxWidth="max-w-md"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300">
          <div className="p-2.5 rounded-xl bg-rose-500/20 shrink-0">
            <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold">Apakah Anda yakin ingin menghapus?</h4>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
              Data barang akan dihapus secara permanen dari basis data Firestore toko Anda.
            </p>
          </div>
        </div>

        {/* Product Preview Info */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
            {product.gambarUrl ? (
              <img src={product.gambarUrl} alt={product.nama} className="w-full h-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-slate-400">{(product.kode || product.nama || 'SKU').substring(0, 3)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{product.nama}</p>
            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
              <span className="font-mono">{product.kode || '-'}</span>
              <span>•</span>
              <span>{product.kategori}</span>
              <span>•</span>
              <span className="font-bold text-slate-700 dark:text-slate-300">Stok: {product.stok} {product.satuan}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menghapus...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                <span>Ya, Hapus Permanen</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
