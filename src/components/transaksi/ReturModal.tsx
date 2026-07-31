import React, { useState, useEffect } from 'react';
import { Modal } from '../Modal';
import { TransaksiItem, TransaksiDetailItem } from '../../types';
import { ItemReturRequest } from '../../services/transaksiService';
import { formatRupiah } from '../../utils/formatters';
import { RotateCcw, AlertTriangle, Loader2, Package, Check, History, Layers, CheckSquare, Square, Info } from 'lucide-react';

interface ReturModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransaksiItem | null;
  onConfirmRetur: (tx: TransaksiItem, alasan: string) => Promise<void>;
  onConfirmReturItem?: (
    tx: TransaksiItem,
    produkId: string,
    jumlahRetur: number,
    alasan: string
  ) => Promise<void>;
  onConfirmReturItems?: (
    tx: TransaksiItem,
    itemsToReturn: ItemReturRequest[],
    alasan: string
  ) => Promise<void>;
}

export const ReturModal: React.FC<ReturModalProps> = ({
  isOpen,
  onClose,
  transaction,
  onConfirmRetur,
  onConfirmReturItem,
  onConfirmReturItems,
}) => {
  const [returMode, setReturMode] = useState<'item' | 'full'>('item');
  // Map of itemKey -> return quantity
  const [selectedItemsMap, setSelectedItemsMap] = useState<Record<string, number>>({});
  const [alasan, setAlasan] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (transaction && transaction.items.length > 0) {
      setErrorMessage('');
      setAlasan('');
      // Default: select the first available returnable item with qty 1
      const initialMap: Record<string, number> = {};
      const firstAvailable = transaction.items.find((i) => i.jumlah - (i.returQty || 0) > 0);
      
      if (firstAvailable) {
        const itemKey = firstAvailable.produkId || firstAvailable.kodeProduk;
        initialMap[itemKey] = 1;
        setSelectedItemsMap(initialMap);
        setReturMode('item');
      } else {
        setSelectedItemsMap({});
        setReturMode('full');
      }
    }
  }, [transaction, isOpen]);

  if (!transaction) return null;

  // Items that still have returnable quantity
  const returnableItems = transaction.items.filter((i) => i.jumlah - (i.returQty || 0) > 0);

  // Toggle selection of an item
  const handleToggleItem = (itemKey: string, maxSisa: number) => {
    if (maxSisa <= 0) return;
    setErrorMessage('');

    setSelectedItemsMap((prev) => {
      const copy = { ...prev };
      if (copy[itemKey] !== undefined) {
        delete copy[itemKey];
      } else {
        copy[itemKey] = 1;
      }
      return copy;
    });
  };

  // Change quantity for a selected item
  const handleQtyChange = (itemKey: string, newQty: number, maxSisa: number) => {
    const validQty = Math.min(maxSisa, Math.max(1, newQty));
    setSelectedItemsMap((prev) => ({
      ...prev,
      [itemKey]: validQty,
    }));
  };

  // Select all returnable items
  const handleSelectAll = () => {
    setErrorMessage('');
    const newMap: Record<string, number> = {};
    returnableItems.forEach((i) => {
      const itemKey = i.produkId || i.kodeProduk;
      const sisa = i.jumlah - (i.returQty || 0);
      if (sisa > 0) {
        newMap[itemKey] = Math.min(sisa, selectedItemsMap[itemKey] || 1);
      }
    });
    setSelectedItemsMap(newMap);
  };

  // Clear all selections
  const handleDeselectAll = () => {
    setSelectedItemsMap({});
  };

  // Calculate live total items chosen and total refund amount
  const selectedEntries = Object.entries(selectedItemsMap);
  let totalItemsCount = 0;
  let totalRefundCalculated = 0;

  selectedEntries.forEach(([key, qty]) => {
    const item = transaction.items.find((i) => (i.produkId || i.kodeProduk) === key);
    if (item && qty > 0) {
      const unitPrice = Math.max(0, item.hargaJual - (item.diskonItem || 0));
      totalItemsCount += qty;
      totalRefundCalculated += qty * unitPrice;
    }
  });

  const isAllSelected = returnableItems.length > 0 && selectedEntries.length === returnableItems.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const finalReason = alasan.trim() || 'Retur produk oleh pelanggan';

    try {
      setIsSubmitting(true);

      if (returMode === 'item') {
        const itemsToReturnReq: ItemReturRequest[] = [];

        Object.entries(selectedItemsMap).forEach(([itemKey, qty]) => {
          const item = transaction.items.find((i) => (i.produkId || i.kodeProduk) === itemKey);
          if (item && qty > 0) {
            itemsToReturnReq.push({
              produkId: item.produkId || item.kodeProduk,
              jumlahRetur: qty,
            });
          }
        });

        if (itemsToReturnReq.length === 0) {
          setErrorMessage('Silakan pilih minimal 1 produk yang ingin diretur.');
          setIsSubmitting(false);
          return;
        }

        if (onConfirmReturItems) {
          await onConfirmReturItems(transaction, itemsToReturnReq, finalReason);
        } else if (onConfirmReturItem && itemsToReturnReq.length === 1) {
          await onConfirmReturItem(
            transaction,
            itemsToReturnReq[0].produkId,
            itemsToReturnReq[0].jumlahRetur,
            finalReason
          );
        } else if (onConfirmRetur) {
          await onConfirmRetur(transaction, finalReason);
        }
      } else {
        // Retur Seluruh Transaksi
        await onConfirmRetur(transaction, finalReason);
      }

      setAlasan('');
      setSelectedItemsMap({});
      onClose();
    } catch (err: any) {
      console.error('Error submitting retur:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses retur.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Retur Transaksi / Barang"
      subtitle={`No. Faktur: ${transaction.kodeTransaksi}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-4">
        
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Retur Mode Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setReturMode('item');
              setErrorMessage('');
            }}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              returMode === 'item'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Retur Per Item Produk</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReturMode('full');
              setErrorMessage('');
            }}
            className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              returMode === 'full'
                ? 'bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Retur Seluruh Transaksi</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {returMode === 'item' ? (
            /* Mode 1: Retur Per Item (Supports Multi-Select & Custom Qty per item) */
            <div className="space-y-3">
              
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Pilih Produk yang Ingin Diretur (Bisa lebih dari 1 produk):
                </label>

                {returnableItems.length > 1 && (
                  <button
                    type="button"
                    onClick={isAllSelected ? handleDeselectAll : handleSelectAll}
                    className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {isAllSelected ? (
                      <>
                        <Square className="w-3.5 h-3.5" /> Batalkan Semua
                      </>
                    ) : (
                      <>
                        <CheckSquare className="w-3.5 h-3.5" /> Pilih Semua Produk
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {transaction.items.map((item) => {
                  const returQtyDone = item.returQty || 0;
                  const sisa = item.jumlah - returQtyDone;
                  const itemKey = item.produkId || item.kodeProduk;
                  const isSelected = selectedItemsMap[itemKey] !== undefined;
                  const currentReturQtyInput = selectedItemsMap[itemKey] || 1;
                  const isFullyReturned = sisa <= 0;
                  const unitPrice = Math.max(0, item.hargaJual - (item.diskonItem || 0));
                  const itemRefundSubtotal = currentReturQtyInput * unitPrice;

                  return (
                    <div
                      key={itemKey}
                      className={`p-3 rounded-2xl border transition-all text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isFullyReturned
                          ? 'opacity-50 bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                          : isSelected
                          ? 'border-rose-500 bg-rose-500/10 shadow-sm'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      {/* Checkbox & Item Info */}
                      <div
                        onClick={() => handleToggleItem(itemKey, sisa)}
                        className={`flex items-start gap-2.5 flex-1 ${
                          isFullyReturned ? 'cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected
                              ? 'border-rose-500 bg-rose-500 text-white'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">
                            {item.namaProduk}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono">
                            {formatRupiah(item.hargaJual)} / {item.satuan} | Total Beli: {item.jumlah}
                          </p>
                          {isFullyReturned ? (
                            <span className="text-[10px] font-bold text-rose-500 uppercase">
                              Sudah Habis Diretur
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                              Sisa dapat diretur: {sisa} {item.satuan}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper (Shown if item selected) */}
                      {!isFullyReturned && isSelected && (
                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200 dark:border-slate-800">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQtyChange(itemKey, currentReturQtyInput - 1, sisa);
                              }}
                              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-800 dark:text-slate-200 flex items-center justify-center"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={sisa}
                              value={currentReturQtyInput}
                              onChange={(e) => {
                                e.stopPropagation();
                                const val = parseInt(e.target.value) || 1;
                                handleQtyChange(itemKey, val, sisa);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-12 text-center py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-bold font-mono text-xs text-slate-900 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleQtyChange(itemKey, currentReturQtyInput + 1, sisa);
                              }}
                              className="w-7 h-7 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer text-slate-800 dark:text-slate-200 flex items-center justify-center"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right font-mono">
                            <span className="text-[10px] text-slate-400 block uppercase">
                              Refund:
                            </span>
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                              {formatRupiah(itemRefundSubtotal)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Summary Calculation Box */}
              {selectedEntries.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">
                      Produk Dipilih:
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedEntries.length} Jenis ({totalItemsCount} Qty Total)
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold">
                      Total Refund Item:
                    </span>
                    <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
                      {formatRupiah(totalRefundCalculated)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Mode 2: Retur Seluruh Transaksi */
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-800 dark:text-rose-300 text-xs">
              <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold">Konfirmasi Retur Total Faktur</p>
                <p>
                  Seluruh sisa item dalam faktur ini akan dibatalkan/diretur dan stoknya dikembalikan ke inventoris toko di Firestore.
                </p>
                <p className="font-mono font-bold text-rose-600 dark:text-rose-400 pt-1 text-sm">
                  Total Nilai Faktur: {formatRupiah(transaction.totalHarga)}
                </p>
              </div>
            </div>
          )}

          {/* Reason Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Alasan Retur / Pembatalan <span className="text-slate-400 font-normal">(Opsional)</span>
            </label>
            <textarea
              rows={2}
              value={alasan}
              onChange={(e) => {
                setAlasan(e.target.value);
                setErrorMessage('');
              }}
              placeholder="Misal: Kemasan bocor / Salah varian / Kedaluwarsa / Pelanggan Batal beli..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-rose-500"
            />
          </div>

          {/* Previous Return Logs if exists */}
          {transaction.riwayatRetur && transaction.riwayatRetur.length > 0 && (
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-2">
                <History className="w-3.5 h-3.5 text-amber-500" />
                <span>Riwayat Retur Sebelumnya ({transaction.riwayatRetur.length}):</span>
              </div>
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {transaction.riwayatRetur.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-[11px] flex justify-between items-center"
                  >
                    <div>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {log.namaProduk}
                      </span>{' '}
                      <span className="text-rose-500 font-mono font-bold">x{log.jumlahRetur}</span>
                      <p className="text-[10px] text-slate-400 italic">"{log.alasan}"</p>
                    </div>
                    <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                      -{formatRupiah(log.refundNominal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                (returMode === 'item' && selectedEntries.length === 0)
              }
              className={`px-4 py-2.5 rounded-xl text-xs font-bold text-white flex items-center gap-2 cursor-pointer transition-all shadow-md ${
                isSubmitting || (returMode === 'item' && selectedEntries.length === 0)
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-900/20'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses Retur...</span>
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  <span>
                    {returMode === 'item'
                      ? selectedEntries.length > 0
                        ? `Proses Retur ${selectedEntries.length} Item (${formatRupiah(totalRefundCalculated)})`
                        : 'Pilih Produk Yang Ingin Diretur'
                      : `Proses Retur Seluruh TRX (${formatRupiah(transaction.totalHarga)})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </Modal>
  );
};
