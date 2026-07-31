import React from 'react';
import { ProdukItem } from '../types';
import { Edit3, Trash2, Tag, Barcode, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface ProductCardProps {
  product: ProdukItem;
  onEdit: (product: ProdukItem) => void;
  onDelete: (product: ProdukItem) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, onDelete }) => {
  const isLowStock = product.stok <= product.minStok && product.stok > 0;
  const isOutStock = product.stok === 0;

  const margin = product.hargaJual - product.hargaBeli;
  const marginPercent = product.hargaJual > 0 
    ? ((margin / product.hargaJual) * 100).toFixed(1) 
    : '0';

  return (
    <div className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
      
      {/* Card Header Image & Badges */}
      <div className="relative h-40 bg-slate-100 dark:bg-slate-950 overflow-hidden">
        {product.gambarUrl ? (
          <img
            src={product.gambarUrl}
            alt={product.nama}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4">
            <Tag className="w-8 h-8 mb-1 opacity-50" />
            <span className="text-[10px] font-mono font-bold">{product.kode}</span>
          </div>
        )}

        {/* Category Pill */}
        <div className="absolute top-2.5 left-2.5">
          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-900/80 backdrop-blur-md text-amber-300 border border-amber-400/30">
            {product.kategori}
          </span>
        </div>

        {/* Stock Status Badge */}
        <div className="absolute top-2.5 right-2.5">
          {isOutStock ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-600/90 text-white shadow-md flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Habis
            </span>
          ) : isLowStock ? (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/90 text-slate-950 shadow-md flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Menipis
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-600/90 text-white shadow-md flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Aman
            </span>
          )}
        </div>

        {/* Quick Actions Hover Overlay */}
        <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
          <button
            onClick={() => onEdit(product)}
            className="p-2.5 rounded-xl bg-white text-slate-900 hover:bg-emerald-50 hover:text-emerald-700 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            onClick={() => onDelete(product)}
            className="p-2.5 rounded-xl bg-rose-600 text-white hover:bg-rose-700 font-semibold text-xs flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>
        </div>
      </div>

      {/* Card Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-mono text-slate-500 dark:text-slate-400 mb-1">
            <span>{product.kode}</span>
            {product.barcode && (
              <>
                <span>•</span>
                <span className="truncate flex items-center gap-0.5">
                  <Barcode className="w-3 h-3" /> {product.barcode}
                </span>
              </>
            )}
          </div>

          <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 leading-snug">
            {product.nama}
          </h3>
        </div>

        {/* Prices & Stock */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-2">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Harga Jual</p>
              <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                Rp {product.hargaJual.toLocaleString('id-ID')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-medium">Harga Modal</p>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Rp {product.hargaBeli.toLocaleString('id-ID')}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="text-[11px] text-slate-500">
              Stok: <strong className={isOutStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-900 dark:text-white'}>
                {product.stok} {product.satuan}
              </strong>
            </span>

            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Margin {marginPercent}%
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
