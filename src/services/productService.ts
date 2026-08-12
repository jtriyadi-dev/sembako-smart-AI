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

// Fast direct REST API fetch for instant (<100ms) product loading from Server + Firestore
async function fetchProductsDirectRest(): Promise<ProdukItem[]> {
  try {
    // 1. Try local Express API endpoint first
    try {
      const serverRes = await fetch('/api/products');
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data.products && Array.isArray(data.products) && data.products.length > 0) {
          return data.products;
        }
      }
    } catch (e) {
      // ignore if local API unavailable
    }

    // 2. Fallback to Firestore REST API
    const FIREBASE_PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
    const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';
    const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/products?pageSize=300&key=${FIREBASE_API_KEY}`;
    
    const res = await fetch(url);
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

  // 1. Instant Direct Fetch (<200ms)
  fetchProductsDirectRest().then((restProducts) => {
    if (!isUnsubscribed && restProducts.length > 0) {
      onData(restProducts);
    }
  });

  // 2. High-speed 3s Polling (Ensures stock changes via WhatsApp Webhook show immediately)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    const items = await fetchProductsDirectRest();
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  }, 3000);

  // 3. Firestore JS SDK Realtime Listener
  const productsRef = collection(db, COLLECTIONS.PRODUCTS);
  const q = query(productsRef);

  const unsubscribeSnap = onSnapshot(
    q,
    async (snapshot) => {
      if (isUnsubscribed) return;
      const isDemo = Boolean(localStorage.getItem('sembako_demo_session'));
      if (snapshot.empty) {
        if (isDemo) {
          const demoProducts: ProdukItem[] = INITIAL_PRODUCTS.map((item, idx) => ({
            ...item,
            id: `demo-prod-${idx + 1}`,
          }));
          onData(demoProducts);
          return;
        }
        // If snapshot is empty but REST had items, keep REST items
        return;
      }

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

      onData(products);
    },
    (err) => {
      console.error('Product snapshot subscription error:', err);
      if (onError) onError(err);
    }
  );

  return () => {
    isUnsubscribed = true;
    clearInterval(pollInterval);
    unsubscribeSnap();
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

// Add new product to Firestore
export async function addProduct(product: Omit<ProdukItem, 'id'>): Promise<string> {
  const path = COLLECTIONS.PRODUCTS;
  try {
    const productsRef = collection(db, path);
    const now = new Date().toISOString();
    const cleanProduct = {
      kode: product.kode || '',
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
    const docRef = await addDoc(productsRef, cleanProduct);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Update existing product in Firestore
export async function updateProduct(id: string, product: Partial<ProdukItem>): Promise<void> {
  const path = `${COLLECTIONS.PRODUCTS}/${id}`;
  try {
    const productRef = doc(db, COLLECTIONS.PRODUCTS, id);
    const updateData = {
      ...product,
      updatedAt: new Date().toISOString(),
    };
    // Clean undefined fields
    Object.keys(updateData).forEach(
      (key) => (updateData as any)[key] === undefined && delete (updateData as any)[key]
    );
    await setDoc(productRef, updateData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// Delete product from Firestore
export async function deleteProduct(id: string): Promise<void> {
  const path = `${COLLECTIONS.PRODUCTS}/${id}`;
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

