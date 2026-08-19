import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  getDoc,
  query, 
  auth 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { TransaksiItem, TransaksiDetailItem, RiwayatReturItem } from '../types';
import { handleFirestoreError, OperationType } from './productService';
import { getSupabaseClient } from './supabaseClient';

const CACHE_TX_KEY = 'sembako_cached_transactions';

export async function fetchTransactionsDirect(): Promise<TransaksiItem[]> {
  // 1. Try direct Supabase fetch
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('tanggal', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const txs: TransaksiItem[] = data.map((r: any) => ({
          id: String(r.id),
          kodeTransaksi: r.kode_transaksi || `TRX-${String(r.id).substring(0, 6).toUpperCase()}`,
          tanggal: r.tanggal || r.created_at || new Date().toISOString(),
          items: Array.isArray(r.items)
            ? r.items.map((i: any) => ({
                ...i,
                returQty: Number(i.returQty) || 0,
                alasanReturItem: i.alasanReturItem || '',
                returAtItem: i.returAtItem || '',
              }))
            : [],
          subtotal: Number(r.subtotal) || 0,
          diskonTotal: Number(r.diskon_total) || 0,
          pajakPersen: Number(r.pajak_persen) || 0,
          pajakNominal: Number(r.pajak_nominal) || 0,
          totalHarga: Number(r.total_harga) || 0,
          totalRefund: Number(r.total_refund) || 0,
          bayar: Number(r.bayar) || 0,
          kembalian: Number(r.kembalian) || 0,
          metodePembayaran: r.metode_pembayaran || 'tunai',
          statusPembayaran: r.status_pembayaran || 'lunas',
          bankNama: r.bank_nama || '',
          noReferensi: r.no_referensi || '',
          namaPelanggan: r.nama_pelanggan || 'Pelanggan Umum',
          kasirName: r.kasir_nama || 'Kasir Toko',
          catatan: r.catatan || '',
          alasanRetur: r.alasan_retur || '',
          returAt: r.retur_at || '',
          riwayatRetur: Array.isArray(r.riwayat_retur) ? r.riwayat_retur : [],
          createdAt: r.created_at || new Date().toISOString(),
        }));
        try {
          localStorage.setItem(CACHE_TX_KEY, JSON.stringify(txs));
        } catch (e) {}
        return txs;
      }
    } catch (sbErr) {
      console.warn('[Supabase Transactions Fetch Error]:', sbErr);
    }
  }

  // 2. Fallback to localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_TX_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  return [];
}

// Subscribe to Realtime Transactions with instant Supabase loading
export function subscribeTransactions(
  onData: (transactions: TransaksiItem[]) => void,
  onError?: (error: Error) => void
) {
  let isUnsubscribed = false;
  let hasEmitted = false;

  // 1. Instant Cache Call (<10ms)
  try {
    const cached = localStorage.getItem(CACHE_TX_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        hasEmitted = true;
        onData(parsed);
      }
    }
  } catch (e) {}

  // 2. Fast Async Supabase Fetch (<100ms)
  fetchTransactionsDirect().then((items) => {
    if (!isUnsubscribed) {
      hasEmitted = true;
      onData(items);
    }
  }).catch(() => {
    if (!isUnsubscribed && !hasEmitted) {
      onData([]);
    }
  });

  // 3. 3s Polling against Supabase
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchTransactionsDirect();
      if (!isUnsubscribed) {
        onData(items);
      }
    } catch (e) {}
  }, 3000);

  // 4. Background Firestore listener (non-blocking)
  let unsubscribeFirestore = () => {};
  try {
    const txRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(txRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed) return;
        if (snapshot.empty) {
          if (!hasEmitted) onData([]);
          return;
        }
        const txs: TransaksiItem[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            kodeTransaksi: data.kodeTransaksi || `TRX-${docSnap.id.substring(0, 6).toUpperCase()}`,
            tanggal: data.tanggal || new Date().toISOString(),
            items: Array.isArray(data.items)
              ? data.items.map((i: any) => ({
                  ...i,
                  returQty: Number(i.returQty) || 0,
                  alasanReturItem: i.alasanReturItem || '',
                  returAtItem: i.returAtItem || '',
                }))
              : [],
            subtotal: Number(data.subtotal) || 0,
            diskonTotal: Number(data.diskonTotal) || 0,
            pajakPersen: Number(data.pajakPersen) || 0,
            pajakNominal: Number(data.pajakNominal) || 0,
            totalHarga: Number(data.totalHarga) || 0,
            totalRefund: Number(data.totalRefund) || 0,
            bayar: Number(data.bayar) || 0,
            kembalian: Number(data.kembalian) || 0,
            metodePembayaran: data.metodePembayaran || 'tunai',
            statusPembayaran: data.statusPembayaran || 'lunas',
            bankNama: data.bankNama || '',
            noReferensi: data.noReferensi || '',
            namaPelanggan: data.namaPelanggan || 'Pelanggan Umum',
            kasirName: data.kasirName || 'Kasir Toko',
            catatan: data.catatan || '',
            alasanRetur: data.alasanRetur || '',
            returAt: data.returAt || '',
            riwayatRetur: Array.isArray(data.riwayatRetur) ? data.riwayatRetur : [],
            createdAt: data.createdAt || new Date().toISOString(),
          };
        });

        txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(txs);
      },
      (err) => {
        console.warn('Firestore optional transaction listener:', err);
      }
    );
  } catch (e) {}

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    try {
      unsubscribeFirestore();
    } catch (e) {}
  };
}

// Generate unique transaction code: TRX-YYYYMMDD-XXXX
export function generateKodeTransaksi(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${dateStr}-${randomNum}`;
}

// Retur / Cancel FULL Transaction & Restore Product Stock
export async function returTransaction(
  transaction: TransaksiItem,
  alasan: string,
  operatorName: string = 'Admin Toko'
): Promise<void> {
  const path = `${COLLECTIONS.TRANSACTIONS}/${transaction.id}`;
  try {
    const now = new Date().toISOString();

    // Mark all items as fully returned
    const updatedItems = transaction.items.map((item) => ({
      ...item,
      returQty: item.jumlah,
      alasanReturItem: alasan,
      returAtItem: now,
    }));

    const riwayatList: RiwayatReturItem[] = transaction.items.map((item) => {
      const unitPrice = Math.max(0, item.hargaJual - (item.diskonItem || 0));
      return {
        id: `RET-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        produkId: item.produkId,
        namaProduk: item.namaProduk,
        jumlahRetur: item.jumlah - (item.returQty || 0),
        hargaJual: item.hargaJual,
        refundNominal: (item.jumlah - (item.returQty || 0)) * unitPrice,
        alasan,
        returAt: now,
        operator: operatorName,
      };
    }).filter(r => r.jumlahRetur > 0);

    const existingRiwayat = Array.isArray(transaction.riwayatRetur) ? transaction.riwayatRetur : [];
    const updatedRiwayat = [...existingRiwayat, ...riwayatList];

    // 1. Mark transaction as retur in Firestore
    const txRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
    await setDoc(
      txRef,
      {
        items: updatedItems,
        statusPembayaran: 'retur',
        alasanRetur: alasan,
        returAt: now,
        totalRefund: transaction.totalHarga,
        riwayatRetur: updatedRiwayat,
        updatedAt: now,
      },
      { merge: true }
    );

    // 2. Restore stock for each item in the transaction
    for (const item of transaction.items) {
      if (!item.produkId) continue;
      const unreturnedQty = item.jumlah - (item.returQty || 0);
      if (unreturnedQty <= 0) continue;

      try {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, item.produkId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const currentData = productSnap.data();
          const currentStok = Number(currentData.stok) || 0;
          const currentTerjual = Number(currentData.terjual) || 0;

          const restoredStok = currentStok + unreturnedQty;
          const restoredTerjual = Math.max(0, currentTerjual - unreturnedQty);

          // Update product stock and sold count
          await setDoc(
            productRef,
            {
              stok: restoredStok,
              terjual: restoredTerjual,
              updatedAt: now,
            },
            { merge: true }
          );

          // Record stock movement log for return
          const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
          await addDoc(movementsRef, {
            produkId: item.produkId,
            namaProduk: item.namaProduk,
            kodeProduk: item.kodeProduk || '',
            tipe: 'masuk',
            jumlah: unreturnedQty,
            stokAwal: currentStok,
            stokAkhir: restoredStok,
            keterangan: `Retur Seluruh Transaksi #${transaction.kodeTransaksi} (${alasan})`,
            createdAt: now,
            operator: operatorName,
          });
        }
      } catch (itemErr) {
        console.warn(`Error restoring stock for product ${item.produkId}:`, itemErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

export interface ItemReturRequest {
  produkId: string;
  jumlahRetur: number;
}

// Retur Multiple Specific Items (Partial or Batch Return) in a Transaction
export async function returItemsTransaction(
  transaction: TransaksiItem,
  itemsToReturn: ItemReturRequest[],
  alasan: string,
  operatorName: string = 'Admin Toko'
): Promise<void> {
  const path = `${COLLECTIONS.TRANSACTIONS}/${transaction.id}`;
  try {
    const now = new Date().toISOString();
    const cleanReason = alasan.trim() || 'Retur produk oleh pelanggan';

    if (!itemsToReturn || itemsToReturn.length === 0) {
      throw new Error('Pilih minimal satu produk untuk diretur.');
    }

    // Map through items and validate quantities
    let totalBatchRefund = 0;
    const newReturLogs: RiwayatReturItem[] = [];

    // Create a copy of current items
    const updatedItems = transaction.items.map((it) => ({ ...it }));

    for (const req of itemsToReturn) {
      const itemIndex = updatedItems.findIndex(
        (i) => i.produkId === req.produkId || i.kodeProduk === req.produkId
      );
      if (itemIndex === -1) continue;

      const item = updatedItems[itemIndex];
      const currentReturQty = Number(item.returQty) || 0;
      const sisaQty = item.jumlah - currentReturQty;

      if (req.jumlahRetur <= 0 || req.jumlahRetur > sisaQty) {
        throw new Error(
          `Jumlah retur untuk "${item.namaProduk}" tidak valid (maksimal ${sisaQty} ${item.satuan}).`
        );
      }

      const newReturQty = currentReturQty + req.jumlahRetur;
      const unitPrice = Math.max(0, item.hargaJual - (item.diskonItem || 0));
      const refundNominal = req.jumlahRetur * unitPrice;

      totalBatchRefund += refundNominal;

      // Update item in updatedItems
      updatedItems[itemIndex] = {
        ...item,
        returQty: newReturQty,
        alasanReturItem: cleanReason,
        returAtItem: now,
      };

      // Add to logs
      newReturLogs.push({
        id: `RET-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        produkId: item.produkId,
        namaProduk: item.namaProduk,
        jumlahRetur: req.jumlahRetur,
        hargaJual: item.hargaJual,
        refundNominal,
        alasan: cleanReason,
        returAt: now,
        operator: operatorName,
      });
    }

    if (newReturLogs.length === 0) {
      throw new Error('Tidak ada item valid yang dapat diretur.');
    }

    const isAllFullyReturned = updatedItems.every(
      (it) => (Number(it.returQty) || 0) >= it.jumlah
    );
    const newStatus = isAllFullyReturned ? 'retur' : 'retur_sebagian';

    const currentTotalRefund = Number(transaction.totalRefund) || 0;
    const newTotalRefund = currentTotalRefund + totalBatchRefund;

    const existingRiwayat = Array.isArray(transaction.riwayatRetur) ? transaction.riwayatRetur : [];
    const updatedRiwayat = [...existingRiwayat, ...newReturLogs];

    // 1. Update Transaction in Firestore
    const txRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
    await setDoc(
      txRef,
      {
        items: updatedItems,
        statusPembayaran: newStatus,
        totalRefund: newTotalRefund,
        alasanRetur: cleanReason,
        returAt: now,
        riwayatRetur: updatedRiwayat,
        updatedAt: now,
      },
      { merge: true }
    );

    // 2. Restore Stock in Firestore for each returned item
    for (const req of itemsToReturn) {
      const targetItem = transaction.items.find(
        (i) => i.produkId === req.produkId || i.kodeProduk === req.produkId
      );
      if (!targetItem || !targetItem.produkId) continue;

      try {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, targetItem.produkId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const currentData = productSnap.data();
          const currentStok = Number(currentData.stok) || 0;
          const currentTerjual = Number(currentData.terjual) || 0;

          const restoredStok = currentStok + req.jumlahRetur;
          const restoredTerjual = Math.max(0, currentTerjual - req.jumlahRetur);

          await setDoc(
            productRef,
            {
              stok: restoredStok,
              terjual: restoredTerjual,
              updatedAt: now,
            },
            { merge: true }
          );

          // Stock Movement Log
          const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
          await addDoc(movementsRef, {
            produkId: targetItem.produkId,
            namaProduk: targetItem.namaProduk,
            kodeProduk: targetItem.kodeProduk || '',
            tipe: 'masuk',
            jumlah: req.jumlahRetur,
            stokAwal: currentStok,
            stokAkhir: restoredStok,
            keterangan: `Retur Item ${targetItem.namaProduk} (${req.jumlahRetur} ${targetItem.satuan}) dari TRX #${transaction.kodeTransaksi} (${cleanReason})`,
            createdAt: now,
            operator: operatorName,
          });
        }
      } catch (itemErr) {
        console.warn(`Error restoring stock for product ${targetItem.produkId}:`, itemErr);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Single item retur wrapper for backward compatibility
export async function returItemTransaction(
  transaction: TransaksiItem,
  produkId: string,
  jumlahRetur: number,
  alasan: string,
  operatorName: string = 'Admin Toko'
): Promise<void> {
  return returItemsTransaction(
    transaction,
    [{ produkId, jumlahRetur }],
    alasan,
    operatorName
  );
}

// Save Transaction and Update Stock Automatically in Firestore
export async function createTransaction(txData: Omit<TransaksiItem, 'id'>): Promise<string> {
  const path = COLLECTIONS.TRANSACTIONS;
  try {
    const now = new Date().toISOString();
    const finalData = {
      kodeTransaksi: txData.kodeTransaksi || generateKodeTransaksi(),
      tanggal: txData.tanggal || now,
      items: (txData.items || []).map((i) => ({
        produkId: i.produkId || '',
        kodeProduk: i.kodeProduk || '',
        namaProduk: i.namaProduk || '',
        satuan: i.satuan || 'Pcs',
        hargaJual: Number(i.hargaJual) || 0,
        hargaBeli: Number(i.hargaBeli) || 0,
        jumlah: Number(i.jumlah) || 0,
        diskonItem: Number(i.diskonItem) || 0,
        subtotal: Number(i.subtotal) || 0,
      })),
      subtotal: Number(txData.subtotal) || 0,
      diskonTotal: Number(txData.diskonTotal) || 0,
      pajakPersen: Number(txData.pajakPersen) || 0,
      pajakNominal: Number(txData.pajakNominal) || 0,
      totalHarga: Number(txData.totalHarga) || 0,
      bayar: Number(txData.bayar) || 0,
      kembalian: Number(txData.kembalian) || 0,
      metodePembayaran: txData.metodePembayaran || 'tunai',
      statusPembayaran: txData.statusPembayaran || 'lunas',
      bankNama: txData.bankNama || '',
      noReferensi: txData.noReferensi || '',
      namaPelanggan: txData.namaPelanggan || 'Pelanggan Umum',
      kasirName: txData.kasirName || 'Kasir Toko',
      catatan: txData.catatan || '',
      alasanRetur: txData.alasanRetur || '',
      returAt: txData.returAt || '',
      createdAt: now,
    };

    // 0. Primary Sync: Supabase PostgreSQL
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.from('transactions').insert([{
          kode_transaksi: finalData.kodeTransaksi,
          tanggal: finalData.tanggal,
          subtotal: finalData.subtotal,
          diskon_total: finalData.diskonTotal,
          pajak_persen: finalData.pajakPersen,
          pajak_nominal: finalData.pajakNominal,
          total_harga: finalData.totalHarga,
          bayar: finalData.bayar,
          kembalian: finalData.kembalian,
          metode_pembayaran: finalData.metodePembayaran,
          status_pembayaran: finalData.statusPembayaran,
          kasir_nama: finalData.kasirName,
          catatan: finalData.catatan || null,
          items: finalData.items,
          created_at: now
        }]);

        // Decrement stock in Supabase products
        for (const item of txData.items) {
          if (!item.produkId) continue;
          try {
            const { data: prodData } = await supabase.from('products').select('stok, terjual').eq('id', item.produkId).single();
            if (prodData) {
              const currentStok = Number(prodData.stok) || 0;
              const currentTerjual = Number(prodData.terjual) || 0;
              const newStok = Math.max(0, currentStok - item.jumlah);
              const newTerjual = currentTerjual + item.jumlah;
              await supabase.from('products').update({
                stok: newStok,
                terjual: newTerjual,
                updated_at: now
              }).eq('id', item.produkId);
            }
          } catch (e) {
            console.warn('[Supabase Stock Decrement Error]:', e);
          }
        }
      } catch (sbErr) {
        console.warn('[Supabase Transaction Insert Error]:', sbErr);
      }
    }

    // 1. Add Transaction Document to Firestore
    const txRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const docRef = await addDoc(txRef, finalData);

    // 2. Process each item: update product stock & record stock movement
    for (const item of txData.items) {
      if (!item.produkId) continue;

      try {
        const productRef = doc(db, COLLECTIONS.PRODUCTS, item.produkId);
        const productSnap = await getDoc(productRef);

        if (productSnap.exists()) {
          const currentData = productSnap.data();
          const currentStok = Number(currentData.stok) || 0;
          const currentTerjual = Number(currentData.terjual) || 0;

          const newStok = Math.max(0, currentStok - item.jumlah);
          const newTerjual = currentTerjual + item.jumlah;

          // Update product stock and sold count
          await setDoc(productRef, {
            stok: newStok,
            terjual: newTerjual,
            updatedAt: now,
          }, { merge: true });

          // Record stock movement log
          const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
          await addDoc(movementsRef, {
            produkId: item.produkId,
            namaProduk: item.namaProduk,
            kodeProduk: item.kodeProduk || '',
            tipe: 'keluar',
            jumlah: item.jumlah,
            stokAwal: currentStok,
            stokAkhir: newStok,
            keterangan: `Penjualan Kasir POS #${txData.kodeTransaksi}`,
            createdAt: now,
            operator: txData.kasirName || 'Kasir Toko',
          });
        }
      } catch (itemErr) {
        console.warn(`Error updating stock for product ${item.produkId}:`, itemErr);
      }
    }

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}
