import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  getDoc, 
  query 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { StockMovement, StockOpname, MovementType, ProdukItem } from '../types';
import { handleFirestoreError, OperationType } from './productService';
import { getSupabaseClient } from './supabaseClient';

const CACHE_MOVEMENTS_KEY = 'sembako_cached_stock_movements';
const CACHE_OPNAMES_KEY = 'sembako_cached_stock_opnames';

export async function fetchStockMovementsDirect(): Promise<StockMovement[]> {
  // 1. Try direct Supabase fetch
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_movements')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const movements: StockMovement[] = data.map((r: any) => ({
          id: String(r.id),
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
      console.warn('[Supabase Stock Movements Fetch Error]:', sbErr);
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

export async function fetchStockOpnamesDirect(): Promise<StockOpname[]> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('stock_opnames')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const opnames: StockOpname[] = data.map((r: any) => ({
          id: String(r.id),
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
      console.warn('[Supabase Stock Opnames Fetch Error]:', sbErr);
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

// Subscribe to Realtime Stock Movements Log with instant Supabase loading
export function subscribeStockMovements(
  onData: (movements: StockMovement[]) => void,
  onError?: (error: Error) => void
) {
  let isUnsubscribed = false;

  // 1. Instant cache
  try {
    const cached = localStorage.getItem(CACHE_MOVEMENTS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) onData(parsed);
    }
  } catch (e) {}

  // 2. Fast Supabase fetch
  fetchStockMovementsDirect().then((items) => {
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  });

  // 3. 3s Polling against Supabase
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    const items = await fetchStockMovementsDirect();
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  }, 3000);

  // 4. Background Firestore listener (non-blocking)
  let unsubscribeFirestore = () => {};
  try {
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    const q = query(movementsRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        const movements: StockMovement[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
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
      },
      (err) => {
        console.warn('Firestore optional stock movements listener:', err);
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

// Record Stock Movement (Stok Masuk, Stok Keluar, Penyesuaian)
export async function recordStockMovement(params: {
  product: ProdukItem;
  tipe: MovementType;
  jumlah: number; // For penyesuaian, this is the target total stock
  keterangan: string;
  supplier?: string;
  expiredDate?: string;
  batchNo?: string;
  operator?: string;
}): Promise<string> {
  const { product, tipe, jumlah, keterangan, supplier, expiredDate, batchNo, operator } = params;
  const path = COLLECTIONS.STOCK_MOVEMENTS;

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
      // Insert stock movement
      await supabase.from('stock_movements').insert([{
        id,
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

      // Update product stock in Supabase
      const prodUpdate: any = {
        stok: stokAkhir,
        updated_at: now,
      };
      if (expiredDate?.trim()) prodUpdate.expired_date = expiredDate.trim();
      if (batchNo?.trim()) prodUpdate.batch_no = batchNo.trim();
      await supabase.from('products').update(prodUpdate).eq('id', product.id);
    } catch (sbErr) {
      console.warn('[Supabase Record Stock Movement Error]:', sbErr);
    }
  }

  // 2. Cache update
  try {
    const cached = localStorage.getItem(CACHE_MOVEMENTS_KEY);
    const list = cached ? JSON.parse(cached) : [];
    list.unshift({
      id,
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

  // 3. Firestore optional sync
  try {
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    await addDoc(movementsRef, {
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
    const updatePayload: Record<string, any> = {
      stok: stokAkhir,
      updatedAt: now,
    };
    if (expiredDate?.trim()) updatePayload.expiredDate = expiredDate.trim();
    if (batchNo?.trim()) updatePayload.batchNo = batchNo.trim();
    await setDoc(productRef, updatePayload, { merge: true });
  } catch (error) {
    console.warn('Firestore optional stock update skipped:', error);
  }

  return id;
}

// Subscribe to Realtime Stock Opnames with instant Supabase loading
export function subscribeStockOpnames(
  onData: (opnames: StockOpname[]) => void,
  onError?: (error: Error) => void
) {
  let isUnsubscribed = false;

  // 1. Instant cache
  try {
    const cached = localStorage.getItem(CACHE_OPNAMES_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) onData(parsed);
    }
  } catch (e) {}

  // 2. Fast Supabase fetch
  fetchStockOpnamesDirect().then((items) => {
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  });

  // 3. 3s Polling against Supabase
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    const items = await fetchStockOpnamesDirect();
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  }, 3000);

  // 4. Background Firestore listener (non-blocking)
  let unsubscribeFirestore = () => {};
  try {
    const opnamesRef = collection(db, COLLECTIONS.STOCK_OPNAMES);
    const q = query(opnamesRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        const opnames: StockOpname[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            tanggal: data.tanggal || new Date().toISOString().split('T')[0],
            produkId: data.produkId || '',
            namaProduk: data.namaProduk || '',
            kodeProduk: data.kodeProduk || '',
            stokSistem: Number(data.stokSistem) || 0,
            stokFisik: Number(data.stokFisik) || 0,
            selisih: Number(data.selisih) || 0,
            alasan: data.alasan || '',
            status: data.status || 'selesai',
            createdAt: data.createdAt || new Date().toISOString(),
            operator: data.operator || 'Admin',
          };
        });
        opnames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        onData(opnames);
      },
      (err) => {
        console.warn('Firestore optional stock opnames listener:', err);
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

// Record Stock Opname Audit
export async function recordStockOpname(params: {
  product: ProdukItem;
  stokFisik: number;
  alasan: string;
  operator?: string;
}): Promise<string> {
  const { product, stokFisik, alasan, operator } = params;
  const stokSistem = product.stok;
  const selisih = stokFisik - stokSistem;
  const now = new Date().toISOString();
  const todayStr = now.split('T')[0];
  const id = `so-${Date.now()}`;

  // 1. Supabase insert
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('stock_opnames').insert([{
        id,
        tanggal: todayStr,
        produk_id: product.id,
        nama_produk: product.nama,
        kode_produk: product.kode,
        stok_sistem: stokSistem,
        stok_fisik: stokFisik,
        selisih,
        alasan: alasan.trim() || 'Stock Opname Fisik Toko',
        status: 'selesai',
        operator: operator || 'Admin Toko',
        created_at: now,
      }]);

      await supabase.from('stock_movements').insert([{
        id: `sm-so-${Date.now()}`,
        produk_id: product.id,
        nama_produk: product.nama,
        kode_produk: product.kode,
        tipe: 'opname',
        jumlah: Math.abs(selisih),
        stok_awal: stokSistem,
        stok_akhir: stokFisik,
        keterangan: `Stock Opname Audit: ${alasan} (Selisih: ${selisih > 0 ? '+' : ''}${selisih})`,
        operator: operator || 'Admin Toko',
        created_at: now,
      }]);

      await supabase.from('products').update({
        stok: stokFisik,
        updated_at: now,
      }).eq('id', product.id);
    } catch (sbErr) {
      console.warn('[Supabase Record Stock Opname Error]:', sbErr);
    }
  }

  // 2. Firestore optional
  try {
    const opnamesRef = collection(db, COLLECTIONS.STOCK_OPNAMES);
    await addDoc(opnamesRef, {
      tanggal: todayStr,
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      stokSistem,
      stokFisik,
      selisih,
      alasan: alasan.trim() || 'Stock Opname Fisik Toko',
      status: 'selesai',
      createdAt: now,
      operator: operator || 'Admin Toko',
    });

    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    await addDoc(movementsRef, {
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      tipe: 'opname',
      jumlah: Math.abs(selisih),
      stokAwal: stokSistem,
      stokAkhir: stokFisik,
      keterangan: `Stock Opname Audit: ${alasan} (Selisih: ${selisih > 0 ? '+' : ''}${selisih})`,
      createdAt: now,
      operator: operator || 'Admin Toko',
    });

    const productRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
    await setDoc(productRef, {
      stok: stokFisik,
      updatedAt: now,
    }, { merge: true });
  } catch (error) {
    console.warn('Firestore optional stock opname skipped:', error);
  }

  return id;
}
