import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  query 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { StockMovement, StockOpname, MovementType, ProdukItem } from '../types';
import { handleFirestoreError, OperationType } from './productService';
import { 
  getSupabaseClient, 
  getCurrentStoreId, 
  subscribeRealtimeTable, 
  logSupabase 
} from './supabaseClient';

const CACHE_MOVEMENTS_KEY = 'sembako_cached_stock_movements';
const CACHE_OPNAMES_KEY = 'sembako_cached_stock_opnames';

export async function fetchStockMovementsDirect(overrideStoreId?: string): Promise<StockMovement[]> {
  const storeId = overrideStoreId || getCurrentStoreId();

  // 1. PRIMARY SOURCE OF TRUTH: Supabase Database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      logSupabase('query', `Mengambil mutasi stok untuk Store ID: "${storeId}"...`);
      let queryBuilder = supabase.from('stock_movements').select('*');

      if (storeId && storeId !== 'all') {
        queryBuilder = queryBuilder.or(`store_id.eq.${storeId},store_id.eq.default_store,store_id.is.null`);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false });

      if (error) {
        logSupabase('error', `Gagal fetch mutasi stok dari Supabase: ${error.message}`, error);
      } else if (Array.isArray(data)) {
        const movements: StockMovement[] = data.map((r: any) => ({
          id: String(r.id),
          storeId: r.store_id || storeId,
          produkId: r.produk_id || '',
          namaProduk: r.nama_produk || 'Produk Sembako',
          kodeProduk: r.kode_produk || '',
          tipe: (r.tipe as MovementType) || 'masuk',
          jumlah: Number(r.jumlah) || 0,
          stokAwal: Number(r.stok_awal) || 0,
          stokAkhir: Number(r.stok_akhir) || 0,
          keterangan: r.keterangan || '',
          supplier: r.supplier || '',
          expiredDate: r.expired_date || '',
          batchNo: r.batch_no || '',
          createdAt: r.created_at || new Date().toISOString(),
          operator: r.operator || 'Admin',
        }));

        try {
          localStorage.setItem(CACHE_MOVEMENTS_KEY, JSON.stringify(movements));
        } catch (e) {}

        return movements;
      }
    } catch (sbErr) {
      logSupabase('error', 'Exception fetch mutasi stok Supabase:', sbErr);
    }
  }

  // 2. Fallback to localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_MOVEMENTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  return [];
}

export async function fetchStockOpnamesDirect(overrideStoreId?: string): Promise<StockOpname[]> {
  const storeId = overrideStoreId || getCurrentStoreId();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      let queryBuilder = supabase.from('stock_opnames').select('*');
      if (storeId && storeId !== 'all') {
        queryBuilder = queryBuilder.or(`store_id.eq.${storeId},store_id.eq.default_store,store_id.is.null`);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const opnames: StockOpname[] = data.map((r: any) => ({
          id: String(r.id),
          storeId: r.store_id || storeId,
          tanggal: r.tanggal || new Date().toISOString().split('T')[0],
          produkId: r.produk_id || '',
          namaProduk: r.nama_produk || '',
          kodeProduk: r.kode_produk || '',
          stokSistem: Number(r.stok_sistem) || 0,
          stokFisik: Number(r.stok_fisik) || 0,
          selisih: Number(r.selisih) || 0,
          alasan: r.alasan || '',
          status: (r.status as any) || 'selesai',
          createdAt: r.created_at || new Date().toISOString(),
          operator: r.operator || 'Admin',
        }));

        try {
          localStorage.setItem(CACHE_OPNAMES_KEY, JSON.stringify(opnames));
        } catch (e) {}

        return opnames;
      }
    } catch (sbErr) {
      logSupabase('error', 'Exception fetch stock opname Supabase:', sbErr);
    }
  }

  try {
    const cached = localStorage.getItem(CACHE_OPNAMES_KEY);
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
 * Subscribe to Realtime Stock Movements Log with instant Supabase loading & real-time replication
 */
export function subscribeStockMovements(
  onData: (movements: StockMovement[]) => void,
  onError?: (error: Error) => void
): () => void {
  let isUnsubscribed = false;
  const storeId = getCurrentStoreId();

  // 1. Instant cache
  try {
    const cached = localStorage.getItem(CACHE_MOVEMENTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) {
        onData(parsed);
      }
    }
  } catch (e) {}

  // 2. Fetch from Supabase
  fetchStockMovementsDirect(storeId).then((items) => {
    if (!isUnsubscribed) {
      onData(items);
    }
  });

  // 3. Supabase Realtime Subscription
  const unsubscribeRealtime = subscribeRealtimeTable('stock_movements', storeId, async () => {
    if (isUnsubscribed) return;
    logSupabase('realtime', 'Mutasi stok baru terdeteksi via Realtime, memuat ulang...');
    const refreshed = await fetchStockMovementsDirect(storeId);
    if (!isUnsubscribed) {
      onData(refreshed);
    }
  });

  // 4. Polling fallback
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchStockMovementsDirect(storeId);
      if (!isUnsubscribed) {
        onData(items);
      }
    } catch (e) {}
  }, 3500);

  // 5. Firestore listener
  let unsubscribeFirestore = () => {};
  try {
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    const q = query(movementsRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        if (!getSupabaseClient()) {
          const movements: StockMovement[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              storeId,
              produkId: data.produkId || '',
              namaProduk: data.namaProduk || 'Produk Sembako',
              kodeProduk: data.kodeProduk || '',
              tipe: (data.tipe as MovementType) || 'masuk',
              jumlah: Number(data.jumlah) || 0,
              stokAwal: Number(data.stokAwal) || 0,
              stokAkhir: Number(data.stokAkhir) || 0,
              keterangan: data.keterangan || '',
              supplier: data.supplier || '',
              expiredDate: data.expiredDate || '',
              batchNo: data.batchNo || '',
              createdAt: data.createdAt || new Date().toISOString(),
              operator: data.operator || 'Admin',
            };
          });
          movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          onData(movements);
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

/**
 * Record Stock Movement (Stok Masuk, Stok Keluar, Penyesuaian) in Supabase + Firestore
 */
export async function recordStockMovement(params: {
  product: ProdukItem;
  tipe: MovementType;
  jumlah: number;
  keterangan: string;
  supplier?: string;
  expiredDate?: string;
  batchNo?: string;
  operator?: string;
  storeId?: string;
}): Promise<string> {
  const { product, tipe, jumlah, keterangan, supplier, expiredDate, batchNo, operator } = params;
  const storeId = params.storeId || product.storeId || getCurrentStoreId();

  const stokAwal = product.stok;
  let stokAkhir = stokAwal;
  let qtyDelta = jumlah;

  if (tipe === 'masuk') {
    stokAkhir = stokAwal + jumlah;
  } else if (tipe === 'keluar') {
    stokAkhir = Math.max(0, stokAwal - jumlah);
  } else if (tipe === 'penyesuaian') {
    stokAkhir = Math.max(0, jumlah);
    qtyDelta = Math.abs(stokAkhir - stokAwal);
  }

  const now = new Date().toISOString();
  const id = `sm-${Date.now()}`;

  // 1. Save to Supabase (PostgreSQL)
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('stock_movements').insert([{
        id,
        store_id: storeId,
        produk_id: product.id,
        nama_produk: product.nama,
        kode_produk: product.kode,
        tipe,
        jumlah: qtyDelta,
        stok_awal: stokAwal,
        stok_akhir: stokAkhir,
        keterangan: keterangan.trim() || `Transaksi stok ${tipe}`,
        supplier: supplier?.trim() || '',
        expired_date: expiredDate?.trim() || '',
        batch_no: batchNo?.trim() || '',
        operator: operator || 'Admin Toko',
        created_at: now,
      }]);

      const prodUpdate: any = {
        stok: stokAkhir,
        updated_at: now,
      };
      if (expiredDate?.trim()) prodUpdate.expired_date = expiredDate.trim();
      if (batchNo?.trim()) prodUpdate.batch_no = batchNo.trim();
      await supabase.from('products').update(prodUpdate).eq('id', product.id);

      logSupabase('sync', `Mutasi stok ${tipe} (${qtyDelta}) untuk "${product.nama}" tersimpan di Supabase`);
    } catch (sbErr) {
      logSupabase('error', 'Exception recordStockMovement Supabase:', sbErr);
    }
  }

  // 2. Cache update
  try {
    const cached = localStorage.getItem(CACHE_MOVEMENTS_KEY);
    const list = cached ? JSON.parse(cached) : [];
    list.unshift({
      id,
      storeId,
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      tipe,
      jumlah: qtyDelta,
      stokAwal,
      stokAkhir,
      keterangan: keterangan.trim() || `Transaksi stok ${tipe}`,
      supplier: supplier?.trim() || '',
      expiredDate: expiredDate?.trim() || '',
      batchNo: batchNo?.trim() || '',
      createdAt: now,
      operator: operator || 'Admin Toko',
    });
    localStorage.setItem(CACHE_MOVEMENTS_KEY, JSON.stringify(list));
  } catch (e) {}

  // 3. Firestore sync
  try {
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    await addDoc(movementsRef, {
      storeId,
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      tipe,
      jumlah: qtyDelta,
      stokAwal,
      stokAkhir,
      keterangan: keterangan.trim() || `Transaksi stok ${tipe}`,
      supplier: supplier?.trim() || '',
      expiredDate: expiredDate?.trim() || '',
      batchNo: batchNo?.trim() || '',
      createdAt: now,
      operator: operator || 'Admin Toko',
    });

    const productRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
    await setDoc(productRef, {
      stok: stokAkhir,
      updatedAt: now,
      ...(expiredDate?.trim() ? { expiredDate: expiredDate.trim() } : {}),
      ...(batchNo?.trim() ? { batchNo: batchNo.trim() } : {}),
    }, { merge: true });
  } catch (err) {}

  return id;
}

/**
 * Subscribe to Stock Opnames list with Supabase Realtime support
 */
export function subscribeStockOpnames(
  onData: (opnames: StockOpname[]) => void,
  onError?: (error: Error) => void
): () => void {
  let isUnsubscribed = false;
  const storeId = getCurrentStoreId();

  try {
    const cached = localStorage.getItem(CACHE_OPNAMES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) onData(parsed);
    }
  } catch (e) {}

  fetchStockOpnamesDirect(storeId).then((items) => {
    if (!isUnsubscribed) onData(items);
  });

  const unsubscribeRealtime = subscribeRealtimeTable('stock_opnames', storeId, async () => {
    if (isUnsubscribed) return;
    const refreshed = await fetchStockOpnamesDirect(storeId);
    if (!isUnsubscribed) onData(refreshed);
  });

  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchStockOpnamesDirect(storeId);
      if (!isUnsubscribed) onData(items);
    } catch (e) {}
  }, 4000);

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    try { unsubscribeRealtime(); } catch (_) {}
  };
}

/**
 * Alias for saveStockOpname
 */
export const recordStockOpname = saveStockOpname;

export async function adjustStockDirect(
  product: ProdukItem,
  newStok: number,
  alasan: string = 'Penyesuaian stok langsung',
  operator: string = 'Admin Toko'
): Promise<void> {
  await recordStockMovement({
    product,
    tipe: 'penyesuaian',
    jumlah: newStok,
    keterangan: alasan,
    operator,
  });
}

/**
 * Save Stock Opname result
 */
export async function saveStockOpname(params: {
  produk?: ProdukItem;
  product?: ProdukItem;
  stokFisik: number;
  alasan: string;
  operator?: string;
  storeId?: string;
}): Promise<string> {
  const targetProduct = (params.produk || params.product)!;
  const { stokFisik, alasan, operator } = params;
  const storeId = params.storeId || targetProduct.storeId || getCurrentStoreId();
  const stokSistem = targetProduct.stok;
  const selisih = stokFisik - stokSistem;
  const now = new Date().toISOString();
  const id = `so-${Date.now()}`;

  // 1. Supabase save
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('stock_opnames').insert([{
        id,
        store_id: storeId,
        tanggal: now.split('T')[0],
        produk_id: targetProduct.id,
        nama_produk: targetProduct.nama,
        kode_produk: targetProduct.kode,
        stok_sistem: stokSistem,
        stok_fisik: stokFisik,
        selisih,
        alasan,
        status: 'selesai',
        operator: operator || 'Admin Toko',
        created_at: now,
      }]);

      logSupabase('sync', `Stock Opname untuk "${targetProduct.nama}" tersimpan di Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception saveStockOpname Supabase:', e);
    }
  }

  // 2. Adjust current stock to physical count
  await recordStockMovement({
    product: targetProduct,
    tipe: 'penyesuaian',
    jumlah: stokFisik,
    keterangan: `Stock Opname: ${alasan} (Selisih: ${selisih > 0 ? '+' : ''}${selisih})`,
    operator: operator || 'Admin Toko',
    storeId,
  });

  return id;
}
