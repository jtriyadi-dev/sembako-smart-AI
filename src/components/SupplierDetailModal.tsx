import React from 'react';
import { Modal } from './Modal';
import { SupplierItem, ProdukItem, StockMovement } from '../types';
import { useStore } from '../context/StoreContext';
import { getAccentTheme } from '../utils/themeUtils';
import { formatRupiah } from '../utils/formatters';
import { 
  Building2, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Tag, 
  FileText, 
  Package, 
  Boxes, 
  ArrowDownRight,
  ExternalLink,
  MessageSquare,
  Plus
} from 'lucide-react';

interface SupplierDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplier: SupplierItem | null;
  products: ProdukItem[];
  stockMovements: StockMovement[];
  onOpenRestockModal?: (supplierName: string) => void;
  onEditSupplier?: (supplier: SupplierItem) => void;
}

export const SupplierDetailModal: React.FC<SupplierDetailModalProps> = ({
  isOpen,
  onClose,
  supplier,
  products,
  stockMovements,
  onOpenRestockModal,
  onEditSupplier,
}) => {
  const { storeConfig } = useStore();
  const accent = getAccentTheme(storeConfig.accentColor);

  if (!supplier) return null;

  // Filter products linked to this supplier
  const linkedProducts = products.filter(
    (p) =>
      p.supplierId === supplier.id ||
      (p.supplierNama && p.supplierNama.toLowerCase() === supplier.namaSupplier.toLowerCase())
  );

  // Filter stock entry movements from this supplier
  const supplierMovements = stockMovements.filter(
    (m) =>
      m.tipe === 'masuk' &&
      (m.supplierId === supplier.id ||
        (m.supplier && m.supplier.toLowerCase().includes(supplier.namaSupplier.toLowerCase())))
  );

  // Calculate total units stocked in from this supplier
  const totalUnitsIn = supplierMovements.reduce((acc, curr) => acc + curr.jumlah, 0);

  // Format WhatsApp Link
  const cleanPhone = supplier.telepon.replace(/[^0-9]/g, '');
  const formattedPhoneForWa = cleanPhone.startsWith('0') ? `62${cleanPhone.substring(1)}` : cleanPhone;
  const waUrl = `https://wa.me/${formattedPhoneForWa}?text=Halo%20${encodeURIComponent(supplier.kontakPerson || supplier.namaSupplier)},%20saya%20dari%20toko%20${encodeURIComponent(storeConfig.namaToko || 'Sembako')}%20ingin%20menanyakan%20stok%20dan%20pemesanan%20barang.`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={supplier.namaSupplier}
      subtitle={`Kode Supplier: ${supplier.kodeSupplier} • Status: ${supplier.status === 'aktif' ? 'Aktif' : 'Non-Aktif'}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-5">
        
        {/* Header Profile & Quick Actions */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl ${accent.bgLight} ${accent.border} border flex items-center justify-center shrink-0`}>
              <Building2 className={`w-6 h-6 ${accent.text} ${accent.textDark}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {supplier.namaSupplier}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  supplier.status === 'aktif'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                }`}>
                  {supplier.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Kategori Utama: <span className="font-semibold text-slate-700 dark:text-slate-300">{supplier.kategoriProduk || 'Grosir Umum'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
            >
              <MessageSquare className="w-4 h-4 text-amber-300" />
              <span>Chat WhatsApp</span>
            </a>

            {onOpenRestockModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenRestockModal(supplier.namaSupplier);
                }}
                className={`px-3.5 py-2 rounded-xl bg-gradient-to-r ${accent.gradient} text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:opacity-90 transition-all cursor-pointer`}
              >
                <Plus className="w-4 h-4" />
                <span>Restock Stok Masuk</span>
              </button>
            )}
          </div>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Kontak Person / Sales</span>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>{supplier.kontakPerson || 'Tidak ada data PIC'}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nomor Telepon</span>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
              <Phone className="w-3.5 h-3.5 text-emerald-500" />
              <span>{supplier.telepon}</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Distributor</span>
            <div className="flex items-center gap-2 text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{supplier.email || '—'}</span>
            </div>
          </div>
        </div>

        {/* Alamat & Catatan */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2">
          {supplier.alamat && (
            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Alamat Gudang:</span>
                <span>{supplier.alamat}</span>
              </div>
            </div>
          )}

          {supplier.catatan && (
            <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
              <FileText className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Catatan Ketentuan Supplier:</span>
                <span>{supplier.catatan}</span>
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold block">Produk Terhubung</span>
              <span className="text-lg font-black text-emerald-900 dark:text-emerald-100">{linkedProducts.length} Jenis Produk</span>
            </div>
            <Package className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold block">Total Unit Restock Masuk</span>
              <span className="text-lg font-black text-amber-900 dark:text-amber-100">{totalUnitsIn.toLocaleString('id-ID')} Unit</span>
            </div>
            <Boxes className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
        </div>

        {/* Linked Products List */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-emerald-600" />
            Daftar Produk Dari Supplier Ini ({linkedProducts.length})
          </h4>

          {linkedProducts.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500">
              Belum ada produk yang secara khusus terhubung dengan supplier ini. Anda dapat memilih supplier ini saat menambah atau mengedit produk di katalog.
            </div>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {linkedProducts.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {p.gambarUrl ? (
                      <img src={p.gambarUrl} alt={p.nama} className="w-8 h-8 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <Package className="w-4 h-4 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white truncate">{p.nama}</p>
                      <p className="text-[10px] text-slate-500 font-mono">SKU: {p.kode} • Kategori: {p.kategori}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">
                      Stok: {p.stok} {p.satuan}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Harga Modal: {formatRupiah(p.hargaBeli)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Restock Movements */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
            Riwayat Riwayat Penerimaan Stok Terakhir ({supplierMovements.length})
          </h4>

          {supplierMovements.length === 0 ? (
            <p className="text-xs text-slate-500 italic">Belum ada riwayat transaksi stok masuk tercatat dari supplier ini.</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
              {supplierMovements.slice(0, 5).map((m) => (
                <div key={m.id} className="p-2 rounded-xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200 block">{m.namaProduk}</span>
                    <span className="text-[10px] text-slate-500">{new Date(m.createdAt).toLocaleString('id-ID')} • {m.keterangan || 'Stok Masuk'}</span>
                  </div>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    +{m.jumlah} Unit
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
          {onEditSupplier ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditSupplier(supplier);
              }}
              className="text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 underline cursor-pointer"
            >
              Edit Informasi Supplier
            </button>
          ) : <div />}

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-300 cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </Modal>
  );
};
