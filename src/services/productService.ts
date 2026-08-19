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
import { getSupabaseClient } from './supabaseClient';

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
function sanitizeProduct(p: any, idx: number = 0): ProdukItem {
  const id = String(p?.id || `prod-${Date.now()}-${idx}`);
  const kodeStr = p?.kode ? String(p.kode) : `SKU-${id.substring(0, 5).toUpperCase()}`;
  return {
    id,
    kode: kodeStr,
    barcode: p?.barcode ? String(p.barcode) : '',
    nama: p?.nama ? String(p.nama) : 'Produk Sembako',
    kategori: p?.kategori ? String(p.kategori) : 'Sembako Utama',
    hargaBeli: Number(p?.hargaBeli) || 0,
    hargaJual: Number(p?.hargaJual) || 0,
    stok: Number(p?.stok) || 0,
    minStok: Number(p?.minStok) || 5,
    satuan: p?.satuan ? String(p.satuan) : 'Pcs',
    gambarUrl: p?.gambarUrl ? String(p.gambarUrl) : '',
    deskripsi: p?.deskripsi ? String(p.deskripsi) : '',
    expiredDate: p?.expiredDate ? String(p.expiredDate) : '',
    batchNo: p?.batchNo ? String(p.batchNo) : '',
    terjual: Number(p?.terjual) || 0,
    createdAt: p?.createdAt ? String(p.createdAt) : new Date().toISOString(),
    updatedAt: p?.updatedAt ? String(p.updatedAt) : new Date().toISOString(),
  };
}

// Fast direct REST API fetch for instant (<100ms) product loading from Express Server + Cloud Store
const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff3f0ddfd2c42';

async function fetchProductsDirectRest(): Promise<ProdukItem[]> {
  try {
    // 1. Try Supabase Client directly first
    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (!error && Array.isArray(data) && data.length > 0) {
          const mapped: ProdukItem[] = data.map((r: any) => sanitizeProduct({
            id: String(r.id),
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
            terjual: Number(r.terjual) || 0,
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.updated_at || new Date().toISOString(),
          }));
          try {
            localStorage.setItem('sembako_cached_products', JSON.stringify(mapped));
          } catch (e) {}
          return mapped;
        }
      } catch (e) {
        console.warn('[ProductService Supabase Fetch Error]:', e);
      }
    }

    // 2. Try local Express API endpoint (which also proxies Supabase)
    try {
      const serverRes = await fetch('/api/products');
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
    } catch (e) {
      // ignore if local API unavailable
    }

    // 3. Try Cloud Store Sync Object
    try {
      const cloudRes = await fetch(CLOUD_STORE_URL, { signal: AbortSignal.timeout(3000) });
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
    } catch (e) {
      // ignore cloud store fetch error
    }

    // 4. Fallback to localStorage cache
    try {
      const cached = localStorage.getItem('sembako_cached_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(sanitizeProduct);
        }
      }
    } catch (e) {}

    // 5. Fallback to Firestore REST API
    const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
    const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300&key=${FIREBASE_API_KEY}`;
    
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return [];
    
    const data = await res.json();
    const docs = data.documents || [];

    const products: ProdukItem[] = docs.map((doc: any) => {
      const id = doc.name ? doc.name.split('/').pop() : `prod-${Math.random()}`;
      const f = doc.fields || {};

      const parseVal = (field: any, defaultVal: any) => {
        if (!field) return defaultVal;
        if ('stringValue' in field) return field.stringValue;
        if ('integerValue' in field) return parseInt(field.integerValue, 10);
        if ('doubleValue' in field) return parseFloat(field.doubleValue);
        if ('booleanValue' in field) return field.booleanValue;
        return defaultVal;
      };

      return {
        id,
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

    return products;
  } catch (err) {
    console.warn('Fast REST fetch error:', err);
    return [];
  }
}

// Subscribe to real-time products list with instant REST loading & fast polling
export function subscribeProducts(
  onData: (products: ProdukItem[]) => void,
  onError?: (error: Error) => void
) {
  let isUnsubscribed = false;
  let hasRestData = false;

  // 1. Instant Synchronous Cache Call (<10ms)
  try {
    const cached = localStorage.getItem('sembako_cached_products');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        hasRestData = true;
        onData(parsed.map(sanitizeProduct));
      }
    }
  } catch (e) {}

  // 2. Instant Supabase / REST Direct Fetch (<100ms)
  fetchProductsDirectRest().then((restProducts) => {
    if (!isUnsubscribed && restProducts.length > 0) {
      hasRestData = true;
      onData(restProducts);
    }
  });

  // 3. High-speed 1.5s Polling (Ensures new products/stock from WhatsApp Webhook appear instantly)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    try {
      const items = await fetchProductsDirectRest();
      if (!isUnsubscribed && items.length > 0) {
        hasRestData = true;
        onData(items);
      }
    } catch (e) {}
  }, 1500);

  // 4. Firestore JS SDK Realtime Listener (non-blocking fallback)
  let unsubscribeSnap = () => {};
  try {
    const productsRef = collection(db, COLLECTIONS.PRODUCTS);
    const q = query(productsRef);

    unsubscribeSnap = onSnapshot(
      q,
      async (snapshot) => {
        if (isUnsubscribed) return;
        if (snapshot.empty) {
          if (hasRestData) return;
          const isDemo = Boolean(localStorage.getItem('sembako_demo_session'));
          if (isDemo) {
            const demoProducts: ProdukItem[] = INITIAL_PRODUCTS.map((item, idx) => ({
              ...item,
              id: `demo-prod-${idx + 1}`,
            }));
            onData(demoProducts);
          }
          return;
        }

        // Only use Firestore if we don't already have newer REST/Supabase data
        const cachedRaw = localStorage.getItem('sembako_cached_products');
        let currentCachedCount = 0;
        if (cachedRaw) {
          try { currentCachedCount = JSON.parse(cachedRaw).length; } catch (_) {}
        }

        if (snapshot.docs.length >= currentCachedCount) {
          const products: ProdukItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              kode: data.kode || `SKU-${docSnap.id.substring(0, 5).toUpperCase()}`,
              barcode: data.barcode || '',
              nama: data.nama || 'Produk Sembako',
              kategori: data.kategori || 'Lainnya',
              hargaBeli: Number(data.hargaBeli) || 0,
              hargaJual: Number(data.hargaJual) || 0,
              stok: Number(data.stok) || 0,
              minStok: Number(data.minStok) || 5,
              satuan: data.satuan || 'Pcs',
              gambarUrl: data.gambarUrl || '',
              deskripsi: data.deskripsi || '',
              expiredDate: data.expiredDate || '',
              batchNo: data.batchNo || '',
              terjual: Number(data.terjual) || 0,
              createdAt: data.createdAt || new Date().toISOString(),
              updatedAt: data.updatedAt || new Date().toISOString(),
            };
          });

          hasRestData = true;
          onData(products);
        }
      },
      (err) => {
        console.warn('Firestore optional product subscription error:', err);
      }
    );
  } catch (e) {}

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    try {
      unsubscribeSnap();
    } catch (e) {}
  };
}

// Seed sample products on demand
export async function seedSampleProducts(): Promise<void> {
  const path = COLLECTIONS.PRODUCTS;
  try {
    const productsRef = collection(db, path);
    for (const item of INITIAL_PRODUCTS) {
      await addDoc(productsRef, item);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Add new product to Supabase + Express + Firestore
export async function addProduct(product: Omit<ProdukItem, 'id'>): Promise<string> {
  const path = COLLECTIONS.PRODUCTS;
  const now = new Date().toISOString();
  const id = `prod-${Date.now()}`;
  const cleanProduct: ProdukItem = {
    id,
    kode: product.kode || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    barcode: product.barcode || '',
    nama: product.nama || 'Produk Sembako',
    kategori: product.kategori || 'Lainnya',
    hargaBeli: Number(product.hargaBeli) || 0,
    hargaJual: Number(product.hargaJual) || 0,
    stok: Number(product.stok) || 0,
    minStok: Number(product.minStok) || 5,
    satuan: product.satuan || 'Pcs',
    gambarUrl: product.gambarUrl || '',
    deskripsi: product.deskripsi || '',
    expiredDate: product.expiredDate || '',
    batchNo: product.batchNo || '',
    terjual: Number(product.terjual) || 0,
    createdAt: now,
    updatedAt: now,
  };

  // 1. Insert directly into Supabase (PostgreSQL) if connected
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('products').insert([{
        id: cleanProduct.id,
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
        terjual: cleanProduct.terjual || 0,
        created_at: now,
        updated_at: now,
      }]);
    } catch (sbErr) {
      console.warn('[Supabase Direct Add Product Error]:', sbErr);
    }
  }

  // 2. Send POST to Express server (which also syncs backend stores)
  try {
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cleanProduct)
    });
  } catch (e) {
    // ignore
  }

  // 3. Add to Firestore if available
  try {
    const productsRef = collection(db, path);
    const docRef = await addDoc(productsRef, cleanProduct);
    return docRef.id;
  } catch (error) {
    console.warn('Firestore optional addProduct skipped:', error);
    return id;
  }
}

// Update existing product in Supabase + Express + Firestore
export async function updateProduct(id: string, product: Partial<ProdukItem>): Promise<void> {
  const path = `${COLLECTIONS.PRODUCTS}/${id}`;
  const now = new Date().toISOString();

  // 1. Update directly in Supabase (PostgreSQL) if connected
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
      if (product.terjual !== undefined) sbUpdate.terjual = product.terjual;
      await supabase.from('products').update(sbUpdate).eq('id', id);
    } catch (sbErr) {
      console.warn('[Supabase Direct Update Product Error]:', sbErr);
    }
  }

  // 2. Fetch current items and update via Express
  try {
    const currentList = await fetchProductsDirectRest();
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
        body: JSON.stringify(updated)
      });
    }
  } catch (e) {
    // ignore
  }

  // 3. Update Firestore if available
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
  } catch (error) {
    console.warn('Firestore optional updateProduct skipped:', error);
  }
}

// Delete product from Supabase & Firestore
export async function deleteProduct(id: string): Promise<void> {
  const path = `${COLLECTIONS.PRODUCTS}/${id}`;

  // 1. Delete from Supabase if connected
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('products').delete().eq('id', id);
    } catch (sbErr) {
      console.warn('[Supabase Direct Delete Product Error]:', sbErr);
    }
  }

  // 2. Delete from Firestore
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
    await deleteDoc(productRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Reset all database collections & local state back to initial clean state
 * (Used for 6-hour demo expiration reset or manual reset)
 */
/**
 * Wipe all database collections to completely clean state for fresh store input
 */
export async function clearAllDatabaseData(): Promise<void> {
  try {
    // 1. Delete all transactions
    const txRef = collection(db, COLLECTIONS.TRANSACTIONS);
    const txSnap = await getDocs(txRef);
    for (const d of txSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 2. Delete all daily reports
    const repRef = collection(db, COLLECTIONS.DAILY_REPORTS);
    const repSnap = await getDocs(repRef);
    for (const d of repSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 3. Delete all stock movements
    const moveRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    const moveSnap = await getDocs(moveRef);
    for (const d of moveSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 4. Delete all stock opnames
    const opnRef = collection(db, COLLECTIONS.STOCK_OPNAMES);
    const opnSnap = await getDocs(opnRef);
    for (const d of opnSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 5. Delete all suppliers
    const supRef = collection(db, COLLECTIONS.SUPPLIERS);
    const supSnap = await getDocs(supRef);
    for (const d of supSnap.docs) {
      await deleteDoc(d.ref);
    }

    // 6. Delete all products (leaving database 100% empty)
    const prodRef = collection(db, COLLECTIONS.PRODUCTS);
    const prodSnap = await getDocs(prodRef);
    for (const d of prodSnap.docs) {
      await deleteDoc(d.ref);
    }
  } catch (err) {
    console.warn('Clear database skipped or failed (offline/auth):', err);
  }
}

export async function resetDatabaseToInitialState(): Promise<void> {
  return clearAllDatabaseData();
}

