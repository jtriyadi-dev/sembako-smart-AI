import React, { useRef } from 'react';
import { Modal } from '../Modal';
import { useStore } from '../../context/StoreContext';
import { TransaksiItem } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { Printer, CheckCircle2, Download, Share2, Sparkles } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransaksiItem | null;
  onDone: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onDone,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { storeConfig } = useStore();

  if (!transaction) return null;

  const isFullRetur = transaction.statusPembayaran === 'retur';
  const isPartialRetur = transaction.statusPembayaran === 'retur_sebagian';
  const totalRefund = Number(transaction.totalRefund) || 0;
  const netTotalHarga = isFullRetur ? 0 : Math.max(0, transaction.totalHarga - totalRefund);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=400,height=600');
    if (!printWindow) {
      alert('Gagal membuka jendela cetak. Periksa browser popup blocker.');
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>Struk_${transaction.kodeTransaksi}</title>
          <style>
            body {
              font-family: 'Courier New', Courier, monospace;
              width: 280px;
              margin: 0 auto;
              padding: 10px;
              font-size: 11px;
              color: #000;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .border-dash { border-top: 1px dashed #000; margin: 8px 0; }
            .flex-between { display: flex; justify-content: space-between; }
            .item-row { margin-bottom: 4px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Struk Penjualan Sembako"
      subtitle={`No. Transaksi: ${transaction.kodeTransaksi}`}
      maxWidth="max-w-md"
    >
      <div className="space-y-5">
        {/* Success Alert Banner */}
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="text-xs">
            <p className="font-bold">Transaksi Berhasil Disimpan!</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Struk tercatat di Firestore & stok barang otomatis berkurang.
            </p>
          </div>
        </div>

        {/* Thermal Receipt Paper Card */}
        <div
          ref={receiptRef}
          className="p-5 bg-amber-50/50 dark:bg-slate-950 rounded-2xl border border-amber-200/60 dark:border-slate-800 text-slate-900 dark:text-slate-100 font-mono text-xs space-y-3 shadow-inner"
        >
          {/* Header */}
          <div className="text-center space-y-1">
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-900 dark:text-white">
              {storeConfig.namaToko || 'TOKO SEMBAKO BERKAH SMART'}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              {storeConfig.alamatToko || 'Jl. Raya Pasar Utama No. 88, Jakarta'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              Telp / WA: {storeConfig.noHp || '0812-3456-7890'}
            </p>
          </div>

          <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />

          {/* Metadata */}
          <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
            <div className="flex justify-between">
              <span>No. Nota:</span>
              <span className="font-bold">{transaction.kodeTransaksi}</span>
            </div>
            <div className="flex justify-between">
              <span>Tanggal:</span>
              <span>
                {new Date(transaction.tanggal).toLocaleString('id-ID', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Kasir:</span>
              <span>{transaction.kasirName || 'Kasir 01'}</span>
            </div>
            <div className="flex justify-between">
              <span>Pelanggan:</span>
              <span>{transaction.namaPelanggan || 'Pelanggan Umum'}</span>
            </div>
          </div>

          <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />

          {/* Items Breakdown */}
          <div className="space-y-2">
            {transaction.items.map((item, idx) => {
              const returQty = Number(item.returQty) || 0;
              const activeQty = Math.max(0, item.jumlah - returQty);
              const unitPrice = Math.max(0, item.hargaJual - (item.diskonItem || 0));
              const itemNetSubtotal = activeQty * unitPrice;
              const isItemFullyReturned = returQty >= item.jumlah;

              return (
                <div key={idx} className="space-y-0.5">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex justify-between items-center">
                    <span className={isItemFullyReturned ? 'line-through text-slate-400' : ''}>
                      {item.namaProduk}
                    </span>
                    {returQty > 0 && (
                      <span className="text-[10px] font-bold text-rose-500 uppercase">
                        [Retur: x{returQty}]
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>
                      {activeQty} {item.satuan || 'Pcs'} x {formatRupiah(item.hargaJual)}
                      {returQty > 0 && ` (Awal: ${item.jumlah})`}
                      {item.diskonItem > 0 && ` (Disc -${formatRupiah(item.diskonItem)})`}
                    </span>
                    <span className={`font-bold ${isItemFullyReturned ? 'line-through text-slate-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {formatRupiah(itemNetSubtotal)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />

          {/* Subtotal, Tax, Discount, Total */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Subtotal:</span>
              <span>{formatRupiah(transaction.subtotal)}</span>
            </div>

            {transaction.diskonTotal > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Diskon Toko:</span>
                <span>-{formatRupiah(transaction.diskonTotal)}</span>
              </div>
            )}

            {transaction.pajakNominal > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Pajak (PPN {transaction.pajakPersen}%):</span>
                <span>+{formatRupiah(transaction.pajakNominal)}</span>
              </div>
            )}

            {totalRefund > 0 && (
              <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400">
                <span>Retur / Refund Item:</span>
                <span>-{formatRupiah(totalRefund)}</span>
              </div>
            )}

            <div className="flex justify-between font-black text-sm pt-1 border-t border-slate-200 dark:border-slate-800">
              <span>TOTAL TAGIHAN:</span>
              <span className="text-amber-600 dark:text-amber-400">
                {formatRupiah(netTotalHarga)}
              </span>
            </div>

            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <span>Metode Bayar:</span>
              <span className="uppercase font-bold">{transaction.metodePembayaran}</span>
            </div>

            {transaction.metodePembayaran === 'tunai' && (
              <>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Uang Diterima:</span>
                  <span>{formatRupiah(transaction.bayar)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-600 dark:text-emerald-400">
                  <span>Kembalian Kasir:</span>
                  <span>{formatRupiah(transaction.kembalian)}</span>
                </div>
                {totalRefund > 0 && (
                  <div className="flex justify-between font-bold text-rose-600 dark:text-rose-400">
                    <span>Pengembalian Refund:</span>
                    <span>{formatRupiah(totalRefund)}</span>
                  </div>
                )}
              </>
            )}

            {transaction.noReferensi && (
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>No. Ref:</span>
                <span>{transaction.noReferensi}</span>
              </div>
            )}
          </div>

          {/* Return History Details if exists */}
          {transaction.riwayatRetur && transaction.riwayatRetur.length > 0 && (
            <>
              <div className="border-b border-dashed border-slate-300 dark:border-slate-700" />
              <div className="space-y-1 text-[10px]">
                <p className="font-bold text-rose-600 dark:text-rose-400 text-center uppercase">
                  *** CATATAN RETUR / REFUND ***
                </p>
                {transaction.riwayatRetur.map((retLog) => (
                  <div key={retLog.id} className="flex justify-between text-slate-600 dark:text-slate-400">
                    <span>
                      {retLog.namaProduk} (x{retLog.jumlahRetur})
                    </span>
                    <span className="font-bold text-rose-500 font-mono">
                      -{formatRupiah(retLog.refundNominal)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="border-b border-dashed border-slate-300 dark:border-slate-700 my-3" />

          {/* Footer Note */}
          <div className="text-center space-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            <p className="font-bold uppercase">*** TERIMA KASIH ***</p>
            <p>Barang yang sudah dibeli tidak dapat ditukar/dikembalikan.</p>
            <p className="italic">Simpan struk ini sebagai bukti pembayaran sah.</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Cetak Thermal Struk</span>
          </button>

          <button
            type="button"
            onClick={onDone}
            className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-900/20"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Selesai & Transaksi Baru</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
