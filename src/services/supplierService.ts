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
  orderBy 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { SupplierItem } from '../types';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers';
import { handleFirestoreError, OperationType } from './productService';

// Subscribe to real-time suppliers list
export function subscribeSuppliers(
  onData: (suppliers: SupplierItem[]) => void,
  onError?: (error: Error) => void
) {
  const suppliersRef = collection(db, COLLECTIONS.SUPPLIERS);
  const q = query(suppliersRef);

  const unsubscribe = onSnapshot(
    q,
    async (snapshot) => {
      const isDemo = Boolean(localStorage.getItem('sembako_demo_session'));
      if (snapshot.empty) {
        if (isDemo) {
          onData(INITIAL_SUPPLIERS);
          return;
        }
        onData([]);
        return;
      }

      const suppliers: SupplierItem[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          kodeSupplier: data.kodeSupplier || `SUP-${docSnap.id.substring(0, 4).toUpperCase()}`,
          namaSupplier: data.namaSupplier || 'Supplier Sembako',
          kontakPerson: data.kontakPerson || '',
          telepon: data.telepon || '',
          email: data.email || '',
          alamat: data.alamat || '',
          kategoriProduk: data.kategoriProduk || 'Umum',
          catatan: data.catatan || '',
          status: (data.status as 'aktif' | 'nonaktif') || 'aktif',
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        };
      });

      // Sort client side by kodeSupplier ascending
      suppliers.sort((a, b) => a.kodeSupplier.localeCompare(b.kodeSupplier));
      onData(suppliers);
    },
    (err) => {
      console.error('Supplier snapshot subscription error:', err);
      if (onError) onError(err);
      onData([]);
    }
  );

  return unsubscribe;
}

// Seed sample suppliers on demand
export async function seedSampleSuppliers() {
  const path = COLLECTIONS.SUPPLIERS;
  try {
    for (const item of INITIAL_SUPPLIERS) {
      const { id, ...dataWithoutId } = item;
      await setDoc(doc(db, COLLECTIONS.SUPPLIERS, id), dataWithoutId, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// Add new supplier to Firestore
export async function addSupplier(supplier: Omit<SupplierItem, 'id'>): Promise<string> {
  const path = COLLECTIONS.SUPPLIERS;
  try {
    const suppliersRef = collection(db, path);
    const now = new Date().toISOString();
    const cleanSupplier = {
      kodeSupplier: supplier.kodeSupplier || 'SUP-001',
      namaSupplier: supplier.namaSupplier || 'Supplier Baru',
      kontakPerson: supplier.kontakPerson || '',
      telepon: supplier.telepon || '',
      email: supplier.email || '',
      alamat: supplier.alamat || '',
      kategoriProduk: supplier.kategoriProduk || 'Umum',
      catatan: supplier.catatan || '',
      status: supplier.status || 'aktif',
      createdAt: now,
      updatedAt: now,
    };
    const docRef = await addDoc(suppliersRef, cleanSupplier);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
}

// Update existing supplier in Firestore
export async function updateSupplier(id: string, supplier: Partial<SupplierItem>): Promise<void> {
  const path = `${COLLECTIONS.SUPPLIERS}/${id}`;
  try {
    const supplierRef = doc(db, COLLECTIONS.SUPPLIERS, id);
    const updateData = {
      ...supplier,
      updatedAt: new Date().toISOString(),
    };
    Object.keys(updateData).forEach(
      (key) => (updateData as any)[key] === undefined && delete (updateData as any)[key]
    );
    await setDoc(supplierRef, updateData, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
}

// Delete supplier from Firestore
export async function deleteSupplier(id: string): Promise<void> {
  const path = `${COLLECTIONS.SUPPLIERS}/${id}`;
  try {
    const supplierRef = doc(db, COLLECTIONS.SUPPLIERS, id);
    await deleteDoc(supplierRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}
