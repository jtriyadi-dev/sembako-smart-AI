import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  auth
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { ProdukItem } from '../types';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { 
  getSupabaseClient, 
  getCurrentStoreId, 
  subscribeRealtimeTable, 
  queryTableWithFallback,
  upsertWithColumnFallback,
  isMissingColumnError,
  logSupabase 
} from './supabaseClient';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Helper to ensure every product object has non-null/non-undefined required properties
export function sanitizeProduct(p: any, idx: number = 0): ProdukItem {
  const id = String(p?.id || `prod-${Date.now()}-${idx}`);
  const kodeStr = p?.kode ? String(p.kode) : `SKU-${id.substring(0, 5).toUpperCase()}`;
  return {
    id,
    storeId: p?.storeId || p?.store_id || getCurrentStoreId(),
    kode: kodeStr,
    barcode: p?.barcode ? String(p.barcode) : '',
    nama: p?.nama ? String(p.nama) : 'Produk Sembako',
    kategori: p?.kategori ? String(p.kategori) : 'Sembako Utama',
    hargaBeli: Number(p?.hargaBeli ?? p?.harga_beli) || 0,
    hargaJual: Number(p?.hargaJual ?? p?.harga_jual) || 0,
    stok: Number(p?.stok) || 0,
    minStok: Number(p?.minStok ?? p?.min_stok) || 5,
    satuan: p?.satuan ? String(p.satuan) : 'Pcs',
    gambarUrl: p?.gambarUrl ?? p?.gambar_url ?? '',
    deskripsi: p?.deskripsi ? String(p.deskripsi) : '',
    expiredDate: p?.expiredDate ?? p?.expired_date ?? '',
    batchNo: p?.batchNo ?? p?.batch_no ?? '',
    supplierNama: p?.supplierNama ?? p?.supplier ?? '',
    terjual: Number(p?.terjual) || 0,
    createdAt: p?.createdAt ?? p?.created_at ?? new Date().toISOString(),
    updatedAt: p?.updatedAt ?? p?.updated_at ?? new Date().toISOString(),
  };
}

const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff3f0ddfd2c42';

/**
 * Fetch products from Supabase (Source of Truth) with fallback hierarchy
 */
export const fetchProductsDirect = fetchProductsDirectRest;

export async function fetchProductsDirectRest(overrideStoreId?: string): Promise<ProdukItem[]> {
  const storeId = overrideStoreId || getCurrentStoreId();

  // 1. PRIMARY SOURCE OF TRUTH: Supabase Database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      logSupabase('query', `Mengambil data produk untuk Store ID: "${storeId}"...`);
      
      const { data, error } = await queryTableWithFallback(supabase, 'products', storeId, 'created_at', false);

      if (error) {
        logSupabase('error', `Gagal fetch produk dari Supabase: ${error.message} (Code: ${error.code})`, error);
      } else if (Array.isArray(data)) {
        logSupabase('query', `Produk berhasil dimuat dari Supabase: ${data.length} item ditemukan (Store: ${storeId})`);
        
        const mapped: ProdukItem[] = data.map((r: any) => sanitizeProduct({
          id: String(r.id),
          storeId: r.store_id || storeId,
          kode: r.kode || `SKU-${String(r.id).substring(0, 5).toUpperCase()}`,
          barcode: r.barcode || '',
          nama: r.nama || 'Produk Sembako',
          kategori: r.kategori || 'Sembako Utama',
          hargaBeli: Number(r.harga_beli) || 0,
          hargaJual: Number(r.harga_jual) || 0,
          stok: Number(r.stok) || 0,
          minStok: Number(r.min_stok) || 5,
          satuan: r.satuan || 'Pcs',
          gambarUrl: r.gambar_url || '',
          deskripsi: r.deskripsi || '',
          expiredDate: r.expired_date || '',
          batchNo: r.batch_no || '',
          supplierNama: r.supplier || '',
          terjual: Number(r.terjual) || 0,
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        }));

        // Always update cache with fresh Supabase data
        try {
          localStorage.setItem('sembako_cached_products', JSON.stringify(mapped));
        } catch (e) {}

        return mapped;
      }
    } catch (e: any) {
      logSupabase('error', 'Exception fetch produk Supabase', e);
    }
  }

  // 2. Express Server API (Proxies backend database)
  try {
    const serverRes = await fetch('/api/products', { signal: AbortSignal.timeout(3000) });
    if (serverRes.ok) {
      const data = await serverRes.json();
      if (data.products && Array.isArray(data.products) && data.products.length > 0) {
        const cleanProds = data.products.map(sanitizeProduct);
        try {
          localStorage.setItem('sembako_cached_products', JSON.stringify(cleanProds));
        } catch (e) {}
        return cleanProds;
      }
    }
  } catch (e) {}

  // 3. Cloud Store Sync Object (Cross-instance backup)
  try {
    const cloudRes = await fetch(CLOUD_STORE_URL, { signal: AbortSignal.timeout(2500) });
    if (cloudRes.ok) {
      const cloudJson = await cloudRes.json();
      const prods = cloudJson?.data?.products;
      if (Array.isArray(prods) && prods.length > 0) {
        const cleanProds = prods.map(sanitizeProduct);
        try {
          localStorage.setItem('sembako_cached_products', JSON.stringify(cleanProds));
        } catch (e) {}
        return cleanProds;
      }
    }
  } catch (e) {}

  // 4. LocalStorage Cache (Offline fallback only)
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeProduct);
      }
    }
  } catch (e) {}

  // 5. Firestore REST API (Final fallback)
  try {
    const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
    const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300&key=${FIREBASE_API_KEY}`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const data = await res.json();
      const docs = data.documents || [];
      if (docs.length > 0) {
        const parseVal = (field: any, defaultVal: any) => {
          if (!field) return defaultVal;
          if ('stringValue' in field) return field.stringValue;
          if ('integerValue' in field) return parseInt(field.integerValue, 10);
          if ('doubleValue' in field) return parseFloat(field.doubleValue);
          if ('booleanValue' in field) return field.booleanValue;
          return defaultVal;
        };

        return docs.map((doc: any) => {
          const id = doc.name ? doc.name.split('/').pop() : `prod-${Math.random()}`;
          const f = doc.fields || {};
          return {
            id,
            storeId,
            kode: parseVal(f.kode, `SKU-${id.substring(0, 5).toUpperCase()}`),
            barcode: parseVal(f.barcode, ''),
            nama: parseVal(f.nama, 'Produk Sembako'),
            kategori: parseVal(f.kategori, 'Lainnya'),
            hargaBeli: Number(parseVal(f.hargaBeli, 0)) || 0,
            hargaJual: Number(parseVal(f.hargaJual, 0)) || 0,
            stok: Number(parseVal(f.stok, 0)) || 0,
            minStok: Number(parseVal(f.minStok, 5)) || 5,
            satuan: parseVal(f.satuan, 'Pcs'),
            gambarUrl: parseVal(f.gambarUrl, ''),
            deskripsi: parseVal(f.deskripsi, ''),
            expiredDate: parseVal(f.expiredDate, ''),
            batchNo: parseVal(f.batchNo, ''),
            terjual: Number(parseVal(f.terjual, 0)) || 0,
            createdAt: parseVal(f.createdAt, new Date().toISOString()),
            updatedAt: parseVal(f.updatedAt, new Date().toISOString()),
          };
        });
      }
    }
  } catch (err) {}

  return [];
}

/**
 * Real-time Product Subscription
 * 1. Emits cache immediately for fast render
 * 2. Fetches fresh data from Supabase
 * 3. Subscribes to Supabase Realtime channel for instant cross-device updates
 * 4. Background safety poll
 */
export function subscribeProducts(
  onData: (products: ProdukItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  let isUnsubscribed = false;
  const storeId = getCurrentStoreId();

  // 1. Instant Cache Call (<10ms)
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onData(parsed.map(sanitizeProduct));
      }
    }
  } catch (e) {}

  // 2. Initial Fetch from Supabase (Source of Truth)
  fetchProductsDirectRest(storeId).then((prods) => {
    if (!isUnsubscribed && prods.length > 0) {
      onData(prods);
    }
  });

  // 3. Supabase Realtime Subscription (Instant Multi-Device Sync)
  const unsubscribeRealtime = subscribeRealtimeTable('products', storeId, async () => {
    if (isUnsubscribed) return;
    logSupabase('realtime', 'Pembaruan produk terdeteksi via Realtime, memuat ulang data...');
    const refreshed = await fetchProductsDirectRest(storeId);
    if (!isUnsubscribed) {
      onData(refreshed);
    }
  });

  // 4. Background Safety Polling (Every 3.5s to catch webhooks or network reconnects)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchProductsDirectRest(storeId);
      if (!isUnsubscribed && items.length > 0) {
        onData(items);
      }
    } catch (e) {}
  }, 3500);

  // 5. Firestore Fallback Listener
  let unsubscribeFirestore = () => {};
  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const q = query(productsRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        // Only if not connected to Supabase
        if (!getSupabaseClient()) {
          const prods = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          })) as ProdukItem[];
          onData(prods.map(sanitizeProduct));
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
 * Seed sample products on demand
 */
export async function seedSampleProducts(): Promise<void> {
  const storeId = getCurrentStoreId();
  const supabase = getSupabaseClient();
  const now = new Date().toISOString();

  if (supabase) {
    try {
      const rows = INITIAL_PRODUCTS.map((p, idx) => ({
        id: `prod-seed-${Date.now()}-${idx}`,
        store_id: storeId,
        kode: p.kode,
        barcode: p.barcode || null,
        nama: p.nama,
        kategori: p.kategori,
        harga_beli: p.hargaBeli,
        harga_jual: p.hargaJual,
        stok: p.stok,
        min_stok: p.minStok,
        satuan: p.satuan,
        gambar_url: p.gambarUrl || null,
        deskripsi: p.deskripsi || null,
        expired_date: p.expiredDate || null,
        batch_no: p.batchNo || null,
        supplier: p.supplierNama || null,
        terjual: p.terjual || 0,
        created_at: now,
        updated_at: now,
      }));

      const { error } = await upsertWithColumnFallback(supabase, 'products', rows, 'id');
      if (error) {
        logSupabase('error', 'Gagal seed produk ke Supabase:', error);
      } else {
        logSupabase('sync', `Berhasil seed ${rows.length} produk contoh ke Supabase (Store: ${storeId})`);
      }
    } catch (e) {
      logSupabase('error', 'Exception seed produk Supabase:', e);
    }
  }

  // Also seed to Firestore
  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    for (const item of INITIAL_PRODUCTS) {
      await addDoc(productsRef, item);
    }
  } catch (error) {}
}

/**
 * Add new product to Supabase (Source of Truth) + Express + Firestore
 */
export async function addProduct(product: Omit<ProdukItem, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const id = `prod-${Date.now()}`;
  const storeId = product.storeId || getCurrentStoreId();

  const cleanProduct: ProdukItem = {
    id,
    storeId,
    kode: product.kode || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    barcode: product.barcode || '',
    nama: product.nama || 'Produk Sembako',
    kategori: product.kategori || 'Sembako Utama',
    hargaBeli: Number(product.hargaBeli) || 0,
    hargaJual: Number(product.hargaJual) || 0,
    stok: Number(product.stok) || 0,
    minStok: Number(product.minStok) || 5,
    satuan: product.satuan || 'Pcs',
    gambarUrl: product.gambarUrl || '',
    deskripsi: product.deskripsi || '',
    expiredDate: product.expiredDate || '',
    batchNo: product.batchNo || '',
    supplierNama: product.supplierNama || '',
    terjual: Number(product.terjual) || 0,
    createdAt: now,
    updatedAt: now,
  };

  // 1. PRIMARY INSERT: Supabase PostgreSQL
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await upsertWithColumnFallback(supabase, 'products', [{
        id: cleanProduct.id,
        store_id: storeId,
        kode: cleanProduct.kode,
        barcode: cleanProduct.barcode || null,
        nama: cleanProduct.nama,
        kategori: cleanProduct.kategori,
        harga_beli: cleanProduct.hargaBeli,
        harga_jual: cleanProduct.hargaJual,
        stok: cleanProduct.stok,
        min_stok: cleanProduct.minStok,
        satuan: cleanProduct.satuan,
        gambar_url: cleanProduct.gambarUrl || null,
        deskripsi: cleanProduct.deskripsi || null,
        expired_date: cleanProduct.expiredDate || null,
        batch_no: cleanProduct.batchNo || null,
        supplier: cleanProduct.supplierNama || null,
        terjual: cleanProduct.terjual || 0,
        created_at: now,
        updated_at: now,
      }], 'id');

      if (error) {
        logSupabase('error', `Gagal menambahkan produk ke Supabase: ${error.message}`, error);
      } else {
        logSupabase('sync', `Produk baru "${cleanProduct.nama}" (${cleanProduct.kode}) tersimpan di Supabase (Store: ${storeId})`);
      }
    } catch (sbErr: any) {
      logSupabase('error', 'Exception addProduct Supabase:', sbErr);
    }
  }

  // 2. Express Server Broadcast (which also syncs backend stores)
  try {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanProduct),
      signal: AbortSignal.timeout(3000)
    });
  } catch (e) {}

  // 3. Firestore (optional secondary backup)
  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    await addDoc(productsRef, cleanProduct);
  } catch (error) {}

  // Update local cache optimistically
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    const list = cached ? JSON.parse(cached) : [];
    list.unshift(cleanProduct);
    localStorage.setItem('sembako_cached_products', JSON.stringify(list));
  } catch (_) {}

  return id;
}

/**
 * Update existing product in Supabase + Express + Firestore
 */
export async function updateProduct(id: string, product: Partial<ProdukItem>): Promise<void> {
  const now = new Date().toISOString();
  const storeId = product.storeId || getCurrentStoreId();

  // 1. PRIMARY UPDATE: Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const sbUpdate: any = { updated_at: now };
      if (product.nama !== undefined) sbUpdate.nama = product.nama;
      if (product.kode !== undefined) sbUpdate.kode = product.kode;
      if (product.barcode !== undefined) sbUpdate.barcode = product.barcode;
      if (product.kategori !== undefined) sbUpdate.kategori = product.kategori;
      if (product.hargaBeli !== undefined) sbUpdate.harga_beli = product.hargaBeli;
      if (product.hargaJual !== undefined) sbUpdate.harga_jual = product.hargaJual;
      if (product.stok !== undefined) sbUpdate.stok = product.stok;
      if (product.minStok !== undefined) sbUpdate.min_stok = product.minStok;
      if (product.satuan !== undefined) sbUpdate.satuan = product.satuan;
      if (product.gambarUrl !== undefined) sbUpdate.gambar_url = product.gambarUrl;
      if (product.deskripsi !== undefined) sbUpdate.deskripsi = product.deskripsi;
      if (product.expiredDate !== undefined) sbUpdate.expired_date = product.expiredDate;
      if (product.batchNo !== undefined) sbUpdate.batch_no = product.batchNo;
      if (product.supplierNama !== undefined) sbUpdate.supplier = product.supplierNama;
      if (product.terjual !== undefined) sbUpdate.terjual = product.terjual;
      if (storeId) sbUpdate.store_id = storeId;

      let { error } = await supabase.from('products').update(sbUpdate).eq('id', id);
      if (error && isMissingColumnError(error)) {
        delete sbUpdate.store_id;
        const retry = await supabase.from('products').update(sbUpdate).eq('id', id);
        error = retry.error;
      }

      if (error) {
        logSupabase('error', `Gagal update produk ${id} di Supabase: ${error.message}`, error);
      } else {
        logSupabase('sync', `Produk ${id} berhasil diperbarui di Supabase (Stok: ${product.stok})`);
      }
    } catch (sbErr: any) {
      logSupabase('error', 'Exception updateProduct Supabase:', sbErr);
    }
  }

  // 2. Express API Update
  try {
    const currentList = await fetchProductsDirectRest(storeId);
    const existing = currentList.find(p => p.id === id);
    if (existing) {
      const updated: ProdukItem = {
        ...existing,
        ...product,
        updatedAt: now,
      };
      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
        signal: AbortSignal.timeout(3000)
      });
    }
  } catch (e) {}

  // 3. Firestore Update
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
    const updateData = {
      ...product,
      updatedAt: now,
    };
    Object.keys(updateData).forEach(
      (key) => (updateData as any)[key] === undefined && delete (updateData as any)[key]
    );
    await setDoc(productRef, updateData, { merge: true });
  } catch (error) {}

  // Update local cache
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const list = JSON.parse(cached);
      const idx = list.findIndex((p: any) => p.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...product, updatedAt: now };
        localStorage.setItem('sembako_cached_products', JSON.stringify(list));
      }
    }
  } catch (_) {}
}

/**
 * Delete product from Supabase & Firestore
 */
export async function deleteProduct(id: string): Promise<void> {
  const storeId = getCurrentStoreId();

  // 1. PRIMARY DELETE: Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) {
        logSupabase('error', `Gagal menghapus produk ${id} dari Supabase: ${error.message}`, error);
      } else {
        logSupabase('sync', `Produk ${id} berhasil dihapus dari Supabase`);
      }
    } catch (sbErr: any) {
      logSupabase('error', 'Exception deleteProduct Supabase:', sbErr);
    }
  }

  // 2. Express Server Delete
  try {
    await fetch(`/api/products/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(3000) });
  } catch (e) {}

  // 3. Firestore Delete
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
    await deleteDoc(productRef);
  } catch (error) {}

  // Update local cache
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const list = JSON.parse(cached).filter((p: any) => p.id !== id);
      localStorage.setItem('sembako_cached_products', JSON.stringify(list));
    }
  } catch (_) {}
}

/**
 * Wipe all database collections to clean state
 */
export async function clearAllDatabaseData(): Promise<void> {
  const storeId = getCurrentStoreId();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      if (storeId && storeId !== 'all') {
        await Promise.allSettled([
          supabase.from('transactions').delete().eq('store_id', storeId),
          supabase.from('products').delete().eq('store_id', storeId),
          supabase.from('stock_movements').delete().eq('store_id', storeId),
          supabase.from('stock_opnames').delete().eq('store_id', storeId),
          supabase.from('suppliers').delete().eq('store_id', storeId),
        ]);
      }
      logSupabase('sync', `Database data untuk store "${storeId}" berhasil di-reset.`);
    } catch (e) {}
  }

  try {
    const txRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const txSnap = await getDocs(txRef);
    for (const d of txSnap.docs) {
      await deleteDoc(d.ref);
    }

    const prodRef = collection(db, COLLECTIONS.PRODUCTS);
    const prodSnap = await getDocs(prodRef);
    for (const d of prodSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (e) {}

  try {
    localStorage.removeItem('sembako_cached_products');
    localStorage.removeItem('sembako_cached_transactions');
    localStorage.removeItem('sembako_cached_stock_movements');
    localStorage.removeItem('sembako_cached_stock_opnames');
    localStorage.removeItem('sembako_cached_suppliers');
  } catch (e) {}
}

export async function resetDatabaseToInitialState(): Promise<void> {
  await clearAllDatabaseData();
  await seedSampleProducts();
}
