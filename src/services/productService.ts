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

// Helper to execute promises with a strict maximum timeout to prevent UI freezes
export function promiseWithTimeout<T>(promise: Promise<T>, ms: number, fallbackValue?: any): Promise<T | any> {
  return Promise.race([
    promise,
    new Promise<any>((resolve) => setTimeout(() => resolve(fallbackValue), ms))
  ]);
}

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

  // 2. Express Server API (Proxies backend database if running locally)
  try {
    const serverRes = await fetch('/api/products', { signal: AbortSignal.timeout(2000) });
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

  // 3. LocalStorage Cache (Offline fallback only)
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeProduct);
      }
    }
  } catch (e) {}

  // 4. Firestore REST API (Secondary cloud fallback)
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
 * 1. Emits cache / default items immediately for instant 0ms render
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

  // Helper to emit latest cache or default items
  const emitCache = () => {
    try {
      const cached = localStorage.getItem('sembako_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          onData(parsed.map(sanitizeProduct));
          return true;
        }
      }
    } catch (e) {}
    
    // Provide initial products immediately so page never sits in skeleton loading
    const initialList = INITIAL_PRODUCTS.map((p, idx) => sanitizeProduct({ ...p, id: `prod-${idx + 1}` }));
    onData(initialList);
    return false;
  };

  // 1. Instant Cache / Initial Call (<1ms)
  emitCache();

  // Local event listener for instant UI re-render when product added/edited/deleted
  const handleLocalUpdate = () => {
    if (!isUnsubscribed) {
      emitCache();
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('sembako_products_updated', handleLocalUpdate);
  }

  // 2. Initial Fetch from Supabase (Source of Truth)
  fetchProductsDirectRest(storeId).then((prods) => {
    if (!isUnsubscribed) {
      onData(prods);
    }
  }).catch((err) => {
    if (!isUnsubscribed && onError) {
      onError(err);
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

  // 4. Background Safety Polling (Every 4s to catch network reconnects)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchProductsDirectRest(storeId);
      if (!isUnsubscribed) {
        onData(items);
      }
    } catch (e) {}
  }, 4000);

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
          if (prods.length > 0) {
            onData(prods.map(sanitizeProduct));
          }
        }
      },
      () => {}
    );
  } catch (e) {}

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    if (typeof window !== 'undefined') {
      window.removeEventListener('sembako_products_updated', handleLocalUpdate);
    }
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
 * Add new product to Supabase (Single Source of Truth)
 */
export async function addProduct(product: Omit<ProdukItem, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const currentStoreId = (product.storeId || getCurrentStoreId() || '').trim();

  // 1. Audit and Validate Store ID
  console.log('[PRODUCT INSERT] Current Store ID:', currentStoreId);
  if (!currentStoreId) {
    console.error('[PRODUCT INSERT] Store ID tidak ditemukan.');
    throw new Error('Store ID tidak ditemukan. Produk tidak dapat disimpan.');
  }

  // 2. Validate Supabase Client Connection
  const supabase = getSupabaseClient();
  if (!supabase) {
    console.error('[PRODUCT INSERT] Supabase client tidak terkonfigurasi.');
    throw new Error('Koneksi Supabase belum terkonfigurasi. Periksa API Keys di menu Developer.');
  }

  // 3. Supabase Auth Session Check
  try {
    const { data: authData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.log('[SUPABASE AUTH USER] Session notice:', userError.message);
    } else {
      console.log('[SUPABASE AUTH USER]', authData?.user?.id || 'Anon / Active Tenant Session');
    }
  } catch (authErr) {
    console.warn('[SUPABASE AUTH CHECK]', authErr);
  }

  // 4. Construct Product Payload (Matching database columns exactly)
  const cleanKode = (product.kode || '').trim() || `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanNama = (product.nama || '').trim();
  if (!cleanNama) {
    throw new Error('Nama produk sembako wajib diisi.');
  }

  const productPayload: Record<string, any> = {
    store_id: currentStoreId,
    kode: cleanKode,
    nama: cleanNama,
    kategori: (product.kategori || 'Sembako Utama').trim(),
    harga_beli: Number(product.hargaBeli) || 0,
    harga_jual: Number(product.hargaJual) || 0,
    stok: Number(product.stok) || 0,
    min_stok: Number(product.minStok) || 5,
    satuan: (product.satuan || 'Pcs').trim(),
    terjual: Number(product.terjual) || 0,
    created_at: now,
    updated_at: now,
  };

  if (product.barcode && product.barcode.trim()) productPayload.barcode = product.barcode.trim();
  if (product.gambarUrl && product.gambarUrl.trim()) productPayload.gambar_url = product.gambarUrl.trim();
  if (product.deskripsi && product.deskripsi.trim()) productPayload.deskripsi = product.deskripsi.trim();
  if (product.expiredDate && product.expiredDate.trim()) productPayload.expired_date = product.expiredDate.trim();
  if (product.batchNo && product.batchNo.trim()) productPayload.batch_no = product.batchNo.trim();
  if (product.supplierNama && product.supplierNama.trim()) productPayload.supplier = product.supplierNama.trim();

  console.log('[PRODUCT INSERT] Payload:', productPayload);

  // 5. Execute Strict Supabase INSERT
  let insertRes = await supabase
    .from('products')
    .insert([productPayload])
    .select()
    .single();

  let data = insertRes.data;
  let error = insertRes.error;

  // Fallback for optional column mismatch in older table schemas
  if (error && isMissingColumnError(error)) {
    console.warn('[PRODUCT INSERT] Missing column in database schema, retrying without non-critical columns...', error.message);
    const minimalPayload: Record<string, any> = {
      kode: productPayload.kode,
      nama: productPayload.nama,
      kategori: productPayload.kategori,
      harga_beli: productPayload.harga_beli,
      harga_jual: productPayload.harga_jual,
      stok: productPayload.stok,
      min_stok: productPayload.min_stok,
      satuan: productPayload.satuan,
      created_at: now,
      updated_at: now,
    };
    if (!error.message?.includes('store_id')) {
      minimalPayload.store_id = currentStoreId;
    }
    if (productPayload.barcode && !error.message?.includes('barcode')) {
      minimalPayload.barcode = productPayload.barcode;
    }
    const retryRes = await supabase
      .from('products')
      .insert([minimalPayload])
      .select()
      .single();

    data = retryRes.data;
    error = retryRes.error;
  }

  // 6. Complete Error Handling
  if (error) {
    console.error('[PRODUCT INSERT FAILED]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    });
    throw new Error(`Gagal menyimpan produk ke Supabase: ${error.message || 'Database error'}`);
  }

  console.log('[Supabase INSERT SUCCESS]', data);
  logSupabase('sync', `Produk baru "${cleanNama}" (${cleanKode}) berhasil disimpan ke Supabase! ID: ${data?.id}`);

  const insertedId = String(data?.id || `prod-${Date.now()}`);

  // 7. Update Local Storage Cache with the verified saved record
  const savedItem: ProdukItem = sanitizeProduct({
    id: insertedId,
    storeId: currentStoreId,
    kode: data?.kode || productPayload.kode,
    barcode: data?.barcode || productPayload.barcode || '',
    nama: data?.nama || productPayload.nama,
    kategori: data?.kategori || productPayload.kategori,
    hargaBeli: Number(data?.harga_beli ?? productPayload.harga_beli),
    hargaJual: Number(data?.harga_jual ?? productPayload.harga_jual),
    stok: Number(data?.stok ?? productPayload.stok),
    minStok: Number(data?.min_stok ?? productPayload.min_stok),
    satuan: data?.satuan || productPayload.satuan,
    gambarUrl: data?.gambar_url || productPayload.gambar_url || '',
    deskripsi: data?.deskripsi || productPayload.deskripsi || '',
    expiredDate: data?.expired_date || productPayload.expired_date || '',
    batchNo: data?.batch_no || productPayload.batch_no || '',
    supplierNama: data?.supplier || productPayload.supplier || '',
    terjual: Number(data?.terjual ?? productPayload.terjual ?? 0),
    createdAt: data?.created_at || now,
    updatedAt: data?.updated_at || now,
  });

  try {
    const cached = localStorage.getItem('sembako_cached_products');
    const list = cached ? JSON.parse(cached) : [];
    list.unshift(savedItem);
    localStorage.setItem('sembako_cached_products', JSON.stringify(list));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sembako_products_updated'));
    }
  } catch (_) {}

  // 8. Background secondary replica sync (Firestore & Express if active)
  try {
    const productDocRef = doc(db, COLLECTIONS.PRODUCTS, insertedId);
    setDoc(productDocRef, savedItem, { merge: true }).catch(() => {});
  } catch (_) {}

  return insertedId;
}

/**
 * Update existing product in Supabase (Single Source of Truth)
 */
export async function updateProduct(id: string, product: Partial<ProdukItem>): Promise<void> {
  const now = new Date().toISOString();
  const currentStoreId = product.storeId || getCurrentStoreId();
  const supabase = getSupabaseClient();

  if (!supabase) {
    throw new Error('Koneksi Supabase belum terkonfigurasi.');
  }

  const sbUpdate: any = { updated_at: now };
  if (product.nama !== undefined) sbUpdate.nama = product.nama.trim();
  if (product.kode !== undefined) sbUpdate.kode = product.kode.trim();
  if (product.barcode !== undefined) sbUpdate.barcode = product.barcode.trim();
  if (product.kategori !== undefined) sbUpdate.kategori = product.kategori;
  if (product.hargaBeli !== undefined) sbUpdate.harga_beli = Number(product.hargaBeli);
  if (product.hargaJual !== undefined) sbUpdate.harga_jual = Number(product.hargaJual);
  if (product.stok !== undefined) sbUpdate.stok = Number(product.stok);
  if (product.minStok !== undefined) sbUpdate.min_stok = Number(product.minStok);
  if (product.satuan !== undefined) sbUpdate.satuan = product.satuan;
  if (product.gambarUrl !== undefined) sbUpdate.gambar_url = product.gambarUrl;
  if (product.deskripsi !== undefined) sbUpdate.deskripsi = product.deskripsi;
  if (product.expiredDate !== undefined) sbUpdate.expired_date = product.expiredDate;
  if (product.batchNo !== undefined) sbUpdate.batch_no = product.batchNo;
  if (product.supplierNama !== undefined) sbUpdate.supplier = product.supplierNama;
  if (product.terjual !== undefined) sbUpdate.terjual = Number(product.terjual);
  if (currentStoreId) sbUpdate.store_id = currentStoreId;

  console.log('[PRODUCT UPDATE] Updating product ID:', id, sbUpdate);

  let { data, error } = await supabase
    .from('products')
    .update(sbUpdate)
    .eq('id', id)
    .select();

  if (error && isMissingColumnError(error)) {
    delete sbUpdate.store_id;
    const retry = await supabase.from('products').update(sbUpdate).eq('id', id).select();
    error = retry.error;
    data = retry.data;
  }

  if (error) {
    console.error('[PRODUCT UPDATE FAILED]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    });
    throw new Error(`Gagal update produk di Supabase: ${error.message}`);
  }

  console.log('[Supabase UPDATE SUCCESS]', data);
  logSupabase('sync', `Produk ID "${id}" berhasil diperbarui di Supabase`);

  // Update local cache
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const list = JSON.parse(cached);
      const idx = list.findIndex((p: any) => String(p.id) === String(id));
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...product, updatedAt: now };
        localStorage.setItem('sembako_cached_products', JSON.stringify(list));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('sembako_products_updated'));
        }
      }
    }
  } catch (_) {}

  // Background Firestore replica update
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
    const updateData = { ...product, updatedAt: now };
    setDoc(productRef, updateData, { merge: true }).catch(() => {});
  } catch (_) {}
}

/**
 * Delete product from Supabase (Single Source of Truth)
 */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Koneksi Supabase belum terkonfigurasi.');
  }

  console.log('[PRODUCT DELETE] Deleting product ID:', id);

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[PRODUCT DELETE FAILED]', {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint
    });
    throw new Error(`Gagal menghapus produk dari Supabase: ${error.message}`);
  }

  console.log('[Supabase DELETE SUCCESS] Product ID:', id);
  logSupabase('sync', `Produk ID "${id}" berhasil dihapus dari Supabase`);

  // Update local cache
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const list = JSON.parse(cached).filter((p: any) => String(p.id) !== String(id));
      localStorage.setItem('sembako_cached_products', JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('sembako_products_updated'));
      }
    }
  } catch (_) {}

  // Background Firestore replica delete
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
    deleteDoc(productRef).catch(() => {});
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
