import React from 'react';
import { Modal } from '../Modal';
import { TransaksiItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import {
  Printer,
  RotateCcw,
  User,
  Clock,
  CreditCard,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Tag,
  Receipt,
  Building2,
} from 'lucide-react';

interface TransactionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransaksiItem | null;
  onPrintReceipt: (tx: TransaksiItem) => void;
  onOpenReturModal: (tx: TransaksiItem) => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onPrintReceipt,
  onOpenReturModal,
}) => {
  if (!transaction) return null;

  const isReturFull = transaction.statusPembayaran === 'retur';
  const isReturPartial = transaction.statusPembayaran === 'retur_sebagian';
  const isReturAny = isReturFull || isReturPartial;
  const totalRefund = Number(transaction.totalRefund) || 0;
  const netTotalHarga = isReturFull ? 0 : Math.max(0, transaction.totalHarga - totalRefund);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Transaksi Penjualan"
      subtitle={`No. Faktur: ${transaction.kodeTransaksi}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        
        {/* Status Banner */}
        <div
          className={`p-4 rounded-2xl border flex items-center justify-between ${
            isReturFull
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
              : isReturPartial
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
              : transaction.statusPembayaran === 'lunas'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
          }`}
        >
          <div className="flex items-center gap-3">
            {isReturFull ? (
              <XCircle className="w-5 h-5 text-rose-500 flex-shrink-0" />
            ) : isReturPartial ? (
              <RotateCcw className="w-5 h-5 text-amber-500 flex-shrink-0" />
            ) : transaction.statusPembayaran === 'lunas' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            )}

            <div>
              <p className="text-xs font-bold uppercase tracking-wider">
                Status: {isReturPartial ? 'Retur Sebagian Item' : transaction.statusPembayaran.replace('_', ' ')}
              </p>
              <p className="text-[11px] opacity-80">
                {isReturAny
                  ? `Ada barang diretur pada ${new Date(transaction.returAt || transaction.createdAt).toLocaleString('id-ID')}`
                  : `Metode Pembayaran: ${transaction.metodePembayaran.toUpperCase()}`}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-lg font-mono font-black block text-amber-600 dark:text-amber-400">
              {formatRupiah(netTotalHarga)}
            </span>
            {totalRefund > 0 ? (
              <span className="text-[10px] text-rose-500 font-mono font-bold block">
                Refund: -{formatRupiah(totalRefund)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Retur Notice if applicable */}
        {isReturAny && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-700 dark:text-rose-300 space-y-1">
            <p className="font-bold">Catatan / Alasan Retur Terakhir:</p>
            <p className="italic">"{transaction.alasanRetur || 'Tidak ada alasan khusus.'}"</p>
            <p className="text-[10px] text-slate-500">
              *Stok barang yang diretur telah dikembalikan secara otomatis ke database Firestore.
            </p>
          </div>
        )}

        {/* Transaction Meta Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Tanggal & Waktu</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {new Date(transaction.createdAt).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Pelanggan</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {transaction.namaPelanggan || 'Pelanggan Umum'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Kasir Operator</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {transaction.kasirName || 'Kasir Toko'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <div>
              <span className="text-slate-400 block text-[10px]">Bank / No Ref</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {transaction.bankNama ? `${transaction.bankNama}` : '-'}
                {transaction.noReferensi ? ` (${transaction.noReferensi})` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Item Table */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
            Daftar Barang Dibeli ({transaction.items.reduce((a, b) => a + b.jumlah, 0)} Item)
          </h4>

          <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-900 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-3 py-2.5">Produk</th>
                  <th className="px-3 py-2.5 text-center">Qty</th>
                  <th className="px-3 py-2.5 text-right">Harga</th>
                  <th className="px-3 py-2.5 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {transaction.items.map((item, idx) => {
                  const returQty = item.returQty || 0;
                  const isItemFullyReturned = returQty >= item.jumlah;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="px-3 py-2.5 font-mono">
                        <div className="font-sans font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 flex-wrap">
                          <span>{item.namaProduk}</span>
                          {returQty > 0 && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                isItemFullyReturned
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              Retur {returQty}/{item.jumlah}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">{item.kodeProduk}</span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={isItemFullyReturned ? 'line-through text-slate-400' : ''}>
                          {item.jumlah} {item.satuan}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatRupiah(item.hargaJual)}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {formatRupiah(item.subtotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Subtotal & Calculations */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600 dark:text-slate-400">
            <span>Subtotal Transaksi:</span>
            <span>{formatRupiah(transaction.subtotal)}</span>
          </div>

          {transaction.diskonTotal > 0 && (
            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold">
              <span>Total Diskon Potongan:</span>
              <span>-{formatRupiah(transaction.diskonTotal)}</span>
            </div>
          )}

          {transaction.pajakNominal > 0 && (
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Pajak (PPN {transaction.pajakPersen}%):</span>
              <span>+{formatRupiah(transaction.pajakNominal)}</span>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between text-slate-600 dark:text-slate-400 font-bold">
            <span>TOTAL STRUK AWAL:</span>
            <span className="font-mono">{formatRupiah(transaction.totalHarga)}</span>
          </div>

          {totalRefund > 0 && (
            <div className="flex justify-between text-xs text-rose-600 dark:text-rose-400 font-bold border-t border-slate-200 dark:border-slate-800 pt-1.5">
              <span>TOTAL DIBAYARKAN KEMBALI (REFUND):</span>
              <span className="font-mono">-{formatRupiah(totalRefund)}</span>
            </div>
          )}

          <div className="border-t border-slate-200 dark:border-slate-800 pt-2 flex justify-between font-black text-sm text-slate-900 dark:text-white">
            <span>TOTAL NET TAGIHAN:</span>
            <span className="text-amber-600 dark:text-amber-400 font-mono text-base">
              {formatRupiah(netTotalHarga)}
            </span>
          </div>

          {transaction.metodePembayaran === 'tunai' && (
            <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-dashed border-slate-200 dark:border-slate-800">
              <span>Uang Diterima: {formatRupiah(transaction.bayar)}</span>
              <span>Kembalian: {formatRupiah(transaction.kembalian)}</span>
            </div>
          )}
        </div>

        {/* Riwayat Retur Items detail list */}
        {transaction.riwayatRetur && transaction.riwayatRetur.length > 0 && (
          <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-2xl space-y-2">
            <h5 className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Riwayat Item Diretur ({transaction.riwayatRetur.length})</span>
            </h5>
            <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs pr-1">
              {transaction.riwayatRetur.map((log) => (
                <div
                  key={log.id}
                  className="p-2 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px]"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {log.namaProduk}
                    </span>{' '}
                    <span className="text-rose-500 font-bold font-mono">x{log.jumlahRetur}</span>
                    <p className="text-[10px] text-slate-500 italic">"{log.alasan}"</p>
                  </div>
                  <div className="text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                    -{formatRupiah(log.refundNominal)}
                    <span className="block text-[9px] text-slate-400 font-normal">
                      {new Date(log.returAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Catatan Nota */}
        {transaction.catatan && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300">
            <span className="font-bold block">Catatan:</span>
            <span>{transaction.catatan}</span>
          </div>
        )}

        {/* Modal Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          {!isReturFull && (
            <button
              type="button"
              onClick={() => onOpenReturModal(transaction)}
              className="px-4 py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retur / Batalkan Transaksi</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onPrintReceipt(transaction)}
            className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Cetak Ulang Struk</span>
          </button>
        </div>

      </div>
    </Modal>
  );
};
