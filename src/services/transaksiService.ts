import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  query, 
  auth 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { TransaksiItem, TransaksiDetailItem, RiwayatReturItem } from '../types';
import { handleFirestoreError, OperationType } from './productService';
import { 
  getSupabaseClient, 
  getCurrentStoreId, 
  subscribeRealtimeTable, 
  queryTableWithFallback,
  upsertWithColumnFallback,
  isMissingColumnError,
  logSupabase 
} from './supabaseClient';

const CACHE_TX_KEY = 'sembako_cached_transactions';

export async function fetchTransactionsDirect(overrideStoreId?: string): Promise<TransaksiItem[]> {
  const storeId = overrideStoreId || getCurrentStoreId();

  // 1. PRIMARY SOURCE OF TRUTH: Supabase Database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      logSupabase('query', `Mengambil data transaksi untuk Store ID: "${storeId}"...`);
      
      const { data, error } = await queryTableWithFallback(supabase, 'transactions', storeId, 'tanggal', false);

      if (error) {
        logSupabase('error', `Gagal fetch transaksi Supabase: ${error.message}`, error);
      } else if (Array.isArray(data)) {
        logSupabase('query', `Transaksi dimuat dari Supabase: ${data.length} transaksi (Store: ${storeId})`);
        
        const txs: TransaksiItem[] = data.map((r: any) => ({
          id: String(r.id),
          storeId: r.store_id || storeId,
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
      logSupabase('error', 'Exception fetch transaksi Supabase:', sbErr);
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

/**
 * Subscribe to Realtime Transactions with instant Supabase loading & real-time replication
 */
export function subscribeTransactions(
  onData: (transactions: TransaksiItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  let isUnsubscribed = false;
  const storeId = getCurrentStoreId();

  // 1. Instant Cache Call (<10ms)
  try {
    const cached = localStorage.getItem(CACHE_TX_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        onData(parsed);
      }
    }
  } catch (e) {}

  // 2. Initial Fetch from Supabase (Source of Truth)
  fetchTransactionsDirect(storeId).then((items) => {
    if (!isUnsubscribed) {
      onData(items);
    }
  });

  // 3. Supabase Realtime Subscription (Cross-Device Instant Sync)
  const unsubscribeRealtime = subscribeRealtimeTable('transactions', storeId, async () => {
    if (isUnsubscribed) return;
    logSupabase('realtime', 'Transaksi baru terdeteksi via Realtime, memuat ulang...');
    const refreshed = await fetchTransactionsDirect(storeId);
    if (!isUnsubscribed) {
      onData(refreshed);
    }
  });

  // 4. Background Safety Polling (Every 3.5s)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchTransactionsDirect(storeId);
      if (!isUnsubscribed) {
        onData(items);
      }
    } catch (e) {}
  }, 3500);

  // 5. Firestore fallback listener
  let unsubscribeFirestore = () => {};
  try {
    const txRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const q = query(txRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        if (!getSupabaseClient()) {
          const txs: TransaksiItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              storeId,
              kodeTransaksi: data.kodeTransaksi || `TRX-${docSnap.id.substring(0, 6).toUpperCase()}`,
              tanggal: data.tanggal || new Date().toISOString(),
              items: Array.isArray(data.items) ? data.items : [],
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
          onData(txs);
        }
      },
      () => {}
    );
  } catch (e) {}

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    try { unsubscribeRealtime(); } catch (_) {}
    try { unsubscribeFirestore(); } catch (_) {}
  };
}

export function generateKodeTransaksi(): string {
  const d = new Date();
  const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TRX-${dateStr}-${randomNum}`;
}

/**
 * Retur / Cancel FULL Transaction & Restore Product Stock in Supabase + Firestore
 */
export async function returTransaction(
  transaction: TransaksiItem,
  alasan: string,
  operatorName: string = 'Admin Toko'
): Promise<void> {
  const now = new Date().toISOString();
  const storeId = transaction.storeId || getCurrentStoreId();

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

  // 1. PRIMARY UPDATE: Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('transactions').update({
        status_pembayaran: 'retur',
        alasan_retur: alasan,
        retur_at: now,
        total_refund: transaction.totalHarga,
        riwayat_retur: updatedRiwayat,
        items: updatedItems,
      }).eq('id', transaction.id);

      // Restore product stock and record stock movements
      for (const item of transaction.items) {
        if (!item.produkId) continue;
        const unreturnedQty = item.jumlah - (item.returQty || 0);
        if (unreturnedQty <= 0) continue;

        try {
          const { data: prodData } = await supabase.from('products').select('stok, terjual').eq('id', item.produkId).single();
          if (prodData) {
            const currentStok = Number(prodData.stok) || 0;
            const currentTerjual = Number(prodData.terjual) || 0;
            const restoredStok = currentStok + unreturnedQty;
            const restoredTerjual = Math.max(0, currentTerjual - unreturnedQty);

            await supabase.from('products').update({
              stok: restoredStok,
              terjual: restoredTerjual,
              updated_at: now
            }).eq('id', item.produkId);

            // Log movement to Supabase
            await upsertWithColumnFallback(supabase, 'stock_movements', [{
              id: `mov-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              store_id: storeId,
              produk_id: item.produkId,
              nama_produk: item.namaProduk,
              kode_produk: item.kodeProduk || '',
              tipe: 'masuk',
              jumlah: unreturnedQty,
              stok_awal: currentStok,
              stok_akhir: restoredStok,
              keterangan: `Retur Seluruh Transaksi #${transaction.kodeTransaksi} (${alasan})`,
              operator: operatorName,
              created_at: now
            }], 'id');
          }
        } catch (e) {}
      }
      logSupabase('sync', `Transaksi #${transaction.kodeTransaksi} berhasil di-retur penuh di Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception returTransaction Supabase:', e);
    }
  }

  // 2. Firestore Update
  try {
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
  } catch (error) {}
}

export interface ItemReturRequest {
  produkId: string;
  jumlahRetur: number;
}

/**
 * Retur Specific Items in Transaction
 */
export async function returItemsTransaction(
  transaction: TransaksiItem,
  itemsToReturn: ItemReturRequest[],
  alasan: string,
  operatorName: string = 'Admin Toko'
): Promise<void> {
  const now = new Date().toISOString();
  const storeId = transaction.storeId || getCurrentStoreId();
  const cleanReason = alasan.trim() || 'Retur produk oleh pelanggan';

  if (!itemsToReturn || itemsToReturn.length === 0) {
    throw new Error('Pilih minimal satu produk untuk diretur.');
  }

  let totalBatchRefund = 0;
  const newReturLogs: RiwayatReturItem[] = [];
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
      throw new Error(`Jumlah retur untuk "${item.namaProduk}" tidak valid (maksimal ${sisaQty} ${item.satuan}).`);
    }

    const nextReturQty = currentReturQty + req.jumlahRetur;
    updatedItems[itemIndex] = {
      ...item,
      returQty: nextReturQty,
      alasanReturItem: cleanReason,
      returAtItem: now,
    };

    const unitPrice = Math.max(0, item.hargaJual - (item.diskonItem || 0));
    const refundForThisItem = req.jumlahRetur * unitPrice;
    totalBatchRefund += refundForThisItem;

    newReturLogs.push({
      id: `RET-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      produkId: item.produkId,
      namaProduk: item.namaProduk,
      jumlahRetur: req.jumlahRetur,
      hargaJual: item.hargaJual,
      refundNominal: refundForThisItem,
      alasan: cleanReason,
      returAt: now,
      operator: operatorName,
    });
  }

  const existingRefund = Number(transaction.totalRefund) || 0;
  const grandTotalRefund = Math.min(transaction.totalHarga, existingRefund + totalBatchRefund);

  const allItemsFullyReturned = updatedItems.every(
    (it) => (Number(it.returQty) || 0) >= it.jumlah
  );
  const nextStatus: TransaksiItem['statusPembayaran'] = allItemsFullyReturned ? 'retur' : 'retur_sebagian';

  const existingRiwayat = Array.isArray(transaction.riwayatRetur) ? transaction.riwayatRetur : [];
  const updatedRiwayat = [...existingRiwayat, ...newReturLogs];

  // 1. PRIMARY UPDATE: Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('transactions').update({
        items: updatedItems,
        status_pembayaran: nextStatus,
        total_refund: grandTotalRefund,
        riwayat_retur: updatedRiwayat,
        alasan_retur: cleanReason,
        retur_at: now,
      }).eq('id', transaction.id);

      // Restore product stock in Supabase
      for (const req of itemsToReturn) {
        const targetItem = updatedItems.find(i => i.produkId === req.produkId || i.kodeProduk === req.produkId);
        if (!targetItem || !targetItem.produkId) continue;

        try {
          const { data: prodData } = await supabase.from('products').select('stok, terjual').eq('id', targetItem.produkId).single();
          if (prodData) {
            const currentStok = Number(prodData.stok) || 0;
            const currentTerjual = Number(prodData.terjual) || 0;
            const restoredStok = currentStok + req.jumlahRetur;
            const restoredTerjual = Math.max(0, currentTerjual - req.jumlahRetur);

            await supabase.from('products').update({
              stok: restoredStok,
              terjual: restoredTerjual,
              updated_at: now
            }).eq('id', targetItem.produkId);

            await upsertWithColumnFallback(supabase, 'stock_movements', [{
              id: `mov-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              store_id: storeId,
              produk_id: targetItem.produkId,
              nama_produk: targetItem.namaProduk,
              kode_produk: targetItem.kodeProduk || '',
              tipe: 'masuk',
              jumlah: req.jumlahRetur,
              stok_awal: currentStok,
              stok_akhir: restoredStok,
              keterangan: `Retur Item ${targetItem.namaProduk} (${req.jumlahRetur} ${targetItem.satuan}) dari TRX #${transaction.kodeTransaksi}`,
              operator: operatorName,
              created_at: now
            }], 'id');
          }
        } catch (e) {}
      }
      logSupabase('sync', `Item retur TRX #${transaction.kodeTransaksi} tersimpan di Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception returItems Supabase:', e);
    }
  }

  // 2. Firestore Update
  try {
    const txRef = doc(db, COLLECTIONS.TRANSACTIONS, transaction.id);
    await setDoc(
      txRef,
      {
        items: updatedItems,
        statusPembayaran: nextStatus,
        totalRefund: grandTotalRefund,
        riwayatRetur: updatedRiwayat,
        alasanRetur: cleanReason,
        returAt: now,
        updatedAt: now,
      },
      { merge: true }
    );
  } catch (error) {}
}

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

/**
 * Save Transaction and Update Stock Automatically in Supabase + Firestore
 */
export async function createTransaction(txData: Omit<TransaksiItem, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const id = `trx-${Date.now()}`;
  const storeId = txData.storeId || getCurrentStoreId();

  const finalData: TransaksiItem = {
    id,
    storeId,
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
    totalRefund: 0,
    bayar: Number(txData.bayar) || 0,
    kembalian: Number(txData.kembalian) || 0,
    metodePembayaran: txData.metodePembayaran || 'tunai',
    statusPembayaran: txData.statusPembayaran || 'lunas',
    bankNama: txData.bankNama || '',
    noReferensi: txData.noReferensi || '',
    namaPelanggan: txData.namaPelanggan || 'Pelanggan Umum',
    kasirName: txData.kasirName || 'Kasir Toko',
    catatan: txData.catatan || '',
    alasanRetur: '',
    returAt: '',
    riwayatRetur: [],
    createdAt: now,
  };

  // 1. PRIMARY INSERT: Supabase PostgreSQL
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error: txErr } = await upsertWithColumnFallback(supabase, 'transactions', [{
        id: finalData.id,
        store_id: storeId,
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
        bank_nama: finalData.bankNama || null,
        no_referensi: finalData.noReferensi || null,
        nama_pelanggan: finalData.namaPelanggan || 'Pelanggan Umum',
        kasir_nama: finalData.kasirName || 'Kasir Toko',
        catatan: finalData.catatan || null,
        items: finalData.items,
        created_at: now
      }], 'id');

      if (txErr) {
        logSupabase('error', `Gagal simpan transaksi ke Supabase: ${txErr.message}`, txErr);
      } else {
        logSupabase('sync', `Transaksi #${finalData.kodeTransaksi} tersimpan di Supabase (Store: ${storeId})`);
      }

      // Decrement stock in Supabase products and log stock movement
      for (const item of txData.items) {
        if (!item.produkId) continue;
        try {
          const { data: prodData } = await supabase
            .from('products')
            .select('stok, terjual')
            .eq('id', item.produkId)
            .single();

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

            // Log movement to Supabase
            await upsertWithColumnFallback(supabase, 'stock_movements', [{
              id: `mov-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
              store_id: storeId,
              produk_id: item.produkId,
              nama_produk: item.namaProduk,
              kode_produk: item.kodeProduk || '',
              tipe: 'keluar',
              jumlah: item.jumlah,
              stok_awal: currentStok,
              stok_akhir: newStok,
              keterangan: `Penjualan Kasir POS #${finalData.kodeTransaksi}`,
              operator: finalData.kasirName || 'Kasir Toko',
              created_at: now
            }], 'id');
          }
        } catch (e) {
          logSupabase('error', `Gagal kurangi stok produk ${item.produkId} di Supabase:`, e);
        }
      }
    } catch (sbErr) {
      logSupabase('error', 'Exception insert transaksi Supabase:', sbErr);
    }
  }

  // 2. Firestore Add (Secondary Backup)
  try {
    const txRef = collection(db, COLLECTIONS.TRANSACTIONS);
    await addDoc(txRef, finalData);
  } catch (error) {}

  // 3. Optimistic Cache Update
  try {
    const cached = localStorage.getItem(CACHE_TX_KEY);
    const list = cached ? JSON.parse(cached) : [];
    list.unshift(finalData);
    localStorage.setItem(CACHE_TX_KEY, JSON.stringify(list));
  } catch (_) {}

  return finalData.id;
}
