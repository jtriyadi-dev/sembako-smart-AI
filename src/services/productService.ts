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

// Subscribe to real-time products list
export function subscribeProducts(
  onData: (products: ProdukItem[]) => void,
  onError?: (error: Error) => void
) {
  const productsRef = collection(db, COLLECTIONS.PRODUCTS);
  const q = query(productsRef);

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
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
        onData([]);
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
      onData([]);
    }
  );

  return unsubscribe;
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

