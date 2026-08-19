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
  query 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { SupplierItem } from '../types';
import { INITIAL_SUPPLIERS } from '../data/initialSuppliers';
import { handleFirestoreError, OperationType } from './productService';
import { getSupabaseClient } from './supabaseClient';

const CACHE_KEY = 'sembako_cached_suppliers';

export async function fetchSuppliersDirect(): Promise<SupplierItem[]> {
  // 1. Try direct Supabase fetch
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        const suppliers: SupplierItem[] = data.map((r: any) => ({
          id: String(r.id),
          kodeSupplier: r.kode_supplier || `SUP-${String(r.id).substring(0, 4).toUpperCase()}`,
          namaSupplier: r.nama_supplier || 'Supplier Sembako',
          kontakPerson: r.kontak_person || '',
          telepon: r.telepon || '',
          email: r.email || '',
          alamat: r.alamat || '',
          kategoriProduk: r.kategori_produk || 'Umum',
          catatan: r.catatan || '',
          status: (r.status as 'aktif' | 'nonaktif') || 'aktif',
          createdAt: r.created_at || new Date().toISOString(),
          updatedAt: r.updated_at || new Date().toISOString(),
        }));
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(suppliers));
        } catch (e) {}
        return suppliers;
      }
    } catch (sbErr) {
      console.warn('[Supabase Suppliers Fetch Error]:', sbErr);
    }
  }

  // 2. Fallback to localStorage cache
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  // 3. Fallback to INITIAL_SUPPLIERS if demo or empty
  return INITIAL_SUPPLIERS;
}

// Subscribe to real-time suppliers list with instant loading & Supabase support
export function subscribeSuppliers(
  onData: (suppliers: SupplierItem[]) => void,
  onError?: (error: Error) => void
) {
  let isUnsubscribed = false;

  // 1. Instant Synchronous/Cache Call (<20ms)
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        onData(parsed);
      } else {
        onData(INITIAL_SUPPLIERS);
      }
    } else {
      onData(INITIAL_SUPPLIERS);
    }
  } catch (e) {
    onData(INITIAL_SUPPLIERS);
  }

  // 2. Fast Async Supabase Fetch
  fetchSuppliersDirect().then((items) => {
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  });

  // 3. 3s Polling against Supabase
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    const items = await fetchSuppliersDirect();
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  }, 3000);

  // 4. Background Firestore listener (non-blocking)
  let unsubscribeFirestore = () => {};
  try {
    const suppliersRef = collection(db, COLLECTIONS.SUPPLIERS);
    const q = query(suppliersRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
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
        suppliers.sort((a, b) => a.kodeSupplier.localeCompare(b.kodeSupplier));
        onData(suppliers);
      },
      (err) => {
        // Silently catch firestore error since Supabase is primary
        console.warn('Firestore optional supplier listener:', err);
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

// Seed sample suppliers on demand
export async function seedSampleSuppliers() {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      for (const item of INITIAL_SUPPLIERS) {
        await supabase.from('suppliers').upsert({
          id: item.id,
          kode_supplier: item.kodeSupplier,
          nama_supplier: item.namaSupplier,
          kontak_person: item.kontakPerson,
          telepon: item.telepon,
          email: item.email,
          alamat: item.alamat,
          kategori_produk: item.kategoriProduk,
          catatan: item.catatan,
          status: item.status,
          created_at: item.createdAt,
          updated_at: item.updatedAt,
        });
      }
    } catch (e) {
      console.warn('[Supabase Seed Suppliers Error]:', e);
    }
  }

  const path = COLLECTIONS.SUPPLIERS;
  try {
    for (const item of INITIAL_SUPPLIERS) {
      const { id, ...dataWithoutId } = item;
      await setDoc(doc(db, COLLECTIONS.SUPPLIERS, id), dataWithoutId, { merge: true });
    }
  } catch (error) {
    console.warn('Firestore seed skipped:', error);
  }
}

// Add new supplier to Supabase & Firestore
export async function addSupplier(supplier: Omit<SupplierItem, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const id = `sup-${Date.now()}`;
  const cleanSupplier: SupplierItem = {
    id,
    kodeSupplier: supplier.kodeSupplier || `SUP-${Math.floor(100 + Math.random() * 900)}`,
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

  // 1. Supabase insert
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('suppliers').insert([{
        id: cleanSupplier.id,
        kode_supplier: cleanSupplier.kodeSupplier,
        nama_supplier: cleanSupplier.namaSupplier,
        kontak_person: cleanSupplier.kontakPerson,
        telepon: cleanSupplier.telepon,
        email: cleanSupplier.email,
        alamat: cleanSupplier.alamat,
        kategori_produk: cleanSupplier.kategoriProduk,
        catatan: cleanSupplier.catatan,
        status: cleanSupplier.status,
        created_at: now,
        updated_at: now,
      }]);
    } catch (sbErr) {
      console.warn('[Supabase Add Supplier Error]:', sbErr);
    }
  }

  // 2. Cache update
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const list = cached ? JSON.parse(cached) : [];
    list.unshift(cleanSupplier);
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch (e) {}

  // 3. Firestore optional
  try {
    const suppliersRef = collection(db, COLLECTIONS.SUPPLIERS);
    await addDoc(suppliersRef, cleanSupplier);
  } catch (error) {
    console.warn('Firestore optional addSupplier skipped:', error);
  }

  return id;
}

// Update existing supplier in Supabase & Firestore
export async function updateSupplier(id: string, supplier: Partial<SupplierItem>): Promise<void> {
  const now = new Date().toISOString();

  // 1. Supabase update
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const sbUpdate: any = { updated_at: now };
      if (supplier.kodeSupplier !== undefined) sbUpdate.kode_supplier = supplier.kodeSupplier;
      if (supplier.namaSupplier !== undefined) sbUpdate.nama_supplier = supplier.namaSupplier;
      if (supplier.kontakPerson !== undefined) sbUpdate.kontak_person = supplier.kontakPerson;
      if (supplier.telepon !== undefined) sbUpdate.telepon = supplier.telepon;
      if (supplier.email !== undefined) sbUpdate.email = supplier.email;
      if (supplier.alamat !== undefined) sbUpdate.alamat = supplier.alamat;
      if (supplier.kategoriProduk !== undefined) sbUpdate.kategori_produk = supplier.kategoriProduk;
      if (supplier.catatan !== undefined) sbUpdate.catatan = supplier.catatan;
      if (supplier.status !== undefined) sbUpdate.status = supplier.status;
      await supabase.from('suppliers').update(sbUpdate).eq('id', id);
    } catch (sbErr) {
      console.warn('[Supabase Update Supplier Error]:', sbErr);
    }
  }

  // 2. Cache update
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const list: SupplierItem[] = JSON.parse(cached);
      const idx = list.findIndex(s => s.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...supplier, updatedAt: now };
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}

  // 3. Firestore optional
  try {
    const supplierRef = doc(db, COLLECTIONS.SUPPLIERS, id);
    const updateData = {
      ...supplier,
      updatedAt: now,
    };
    Object.keys(updateData).forEach(
      (key) => (updateData as any)[key] === undefined && delete (updateData as any)[key]
    );
    await setDoc(supplierRef, updateData, { merge: true });
  } catch (error) {
    console.warn('Firestore optional updateSupplier skipped:', error);
  }
}

// Delete supplier from Supabase & Firestore
export async function deleteSupplier(id: string): Promise<void> {
  // 1. Supabase delete
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('suppliers').delete().eq('id', id);
    } catch (sbErr) {
      console.warn('[Supabase Delete Supplier Error]:', sbErr);
    }
  }

  // 2. Cache delete
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const list: SupplierItem[] = JSON.parse(cached);
      const filtered = list.filter(s => s.id !== id);
      localStorage.setItem(CACHE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  // 3. Firestore optional
  try {
    const supplierRef = doc(db, COLLECTIONS.SUPPLIERS, id);
    await deleteDoc(supplierRef);
  } catch (error) {
    console.warn('Firestore optional deleteSupplier skipped:', error);
  }
}
