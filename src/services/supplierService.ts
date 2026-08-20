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
import { 
  getSupabaseClient, 
  getCurrentStoreId, 
  subscribeRealtimeTable, 
  logSupabase 
} from './supabaseClient';

const CACHE_KEY = 'sembako_cached_suppliers';

export async function fetchSuppliersDirect(overrideStoreId?: string): Promise<SupplierItem[]> {
  const storeId = overrideStoreId || getCurrentStoreId();

  // 1. PRIMARY SOURCE OF TRUTH: Supabase Database
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      logSupabase('query', `Mengambil data supplier untuk Store ID: "${storeId}"...`);
      let queryBuilder = supabase.from('suppliers').select('*');

      if (storeId && storeId !== 'all') {
        queryBuilder = queryBuilder.or(`store_id.eq.${storeId},store_id.eq.default_store,store_id.is.null`);
      }

      const { data, error } = await queryBuilder.order('created_at', { ascending: false });

      if (error) {
        logSupabase('error', `Gagal fetch supplier dari Supabase: ${error.message}`, error);
      } else if (Array.isArray(data) && data.length > 0) {
        const suppliers: SupplierItem[] = data.map((r: any) => ({
          id: String(r.id),
          storeId: r.store_id || storeId,
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
      logSupabase('error', 'Exception fetch supplier Supabase:', sbErr);
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

  return INITIAL_SUPPLIERS;
}

/**
 * Subscribe to real-time suppliers list with instant loading & Supabase Realtime support
 */
export function subscribeSuppliers(
  onData: (suppliers: SupplierItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  let isUnsubscribed = false;
  const storeId = getCurrentStoreId();

  // 1. Instant Cache Call (<20ms)
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
  fetchSuppliersDirect(storeId).then((items) => {
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  });

  // 3. Supabase Realtime Channel
  const unsubscribeRealtime = subscribeRealtimeTable('suppliers', storeId, async () => {
    if (isUnsubscribed) return;
    logSupabase('realtime', 'Pemasok baru/update terdeteksi via Realtime, memuat ulang...');
    const refreshed = await fetchSuppliersDirect(storeId);
    if (!isUnsubscribed) {
      onData(refreshed);
    }
  });

  // 4. Polling fallback (3.5s)
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    const items = await fetchSuppliersDirect(storeId);
    if (!isUnsubscribed && items.length > 0) {
      onData(items);
    }
  }, 3500);

  // 5. Firestore fallback listener
  let unsubscribeFirestore = () => {};
  try {
    const suppliersRef = collection(db, COLLECTIONS.SUPPLIERS);
    const q = query(suppliersRef);
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        if (!getSupabaseClient()) {
          const suppliers: SupplierItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              storeId,
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

export async function addSupplier(supplier: Omit<SupplierItem, 'id'>): Promise<string> {
  const now = new Date().toISOString();
  const id = `sup-${Date.now()}`;
  const storeId = supplier.storeId || getCurrentStoreId();

  const cleanData: SupplierItem = {
    ...supplier,
    id,
    storeId,
    kodeSupplier: supplier.kodeSupplier || `SUP-${Math.floor(100 + Math.random() * 900)}`,
    status: supplier.status || 'aktif',
    createdAt: now,
    updatedAt: now,
  };

  // 1. Supabase insert
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('suppliers').upsert([{
        id,
        store_id: storeId,
        kode_supplier: cleanData.kodeSupplier,
        nama_supplier: cleanData.namaSupplier,
        kontak_person: cleanData.kontakPerson || null,
        telepon: cleanData.telepon || null,
        email: cleanData.email || null,
        alamat: cleanData.alamat || null,
        kategori_produk: cleanData.kategoriProduk || 'Umum',
        catatan: cleanData.catatan || null,
        status: cleanData.status,
        created_at: now,
        updated_at: now,
      }], { onConflict: 'id' });

      logSupabase('sync', `Supplier "${cleanData.namaSupplier}" tersimpan di Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception addSupplier Supabase:', e);
    }
  }

  // 2. Firestore insert
  try {
    const suppliersRef = collection(db, COLLECTIONS.SUPPLIERS);
    await addDoc(suppliersRef, cleanData);
  } catch (error) {}

  // 3. Cache update
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const list = cached ? JSON.parse(cached) : [];
    list.unshift(cleanData);
    localStorage.setItem(CACHE_KEY, JSON.stringify(list));
  } catch (e) {}

  return id;
}

export async function updateSupplier(id: string, supplier: Partial<SupplierItem>): Promise<void> {
  const now = new Date().toISOString();
  const storeId = supplier.storeId || getCurrentStoreId();

  // 1. Supabase update
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const updatePayload: any = { updated_at: now };
      if (supplier.namaSupplier !== undefined) updatePayload.nama_supplier = supplier.namaSupplier;
      if (supplier.kodeSupplier !== undefined) updatePayload.kode_supplier = supplier.kodeSupplier;
      if (supplier.kontakPerson !== undefined) updatePayload.kontak_person = supplier.kontakPerson;
      if (supplier.telepon !== undefined) updatePayload.telepon = supplier.telepon;
      if (supplier.email !== undefined) updatePayload.email = supplier.email;
      if (supplier.alamat !== undefined) updatePayload.alamat = supplier.alamat;
      if (supplier.kategoriProduk !== undefined) updatePayload.kategori_produk = supplier.kategoriProduk;
      if (supplier.catatan !== undefined) updatePayload.catatan = supplier.catatan;
      if (supplier.status !== undefined) updatePayload.status = supplier.status;
      if (storeId) updatePayload.store_id = storeId;

      await supabase.from('suppliers').update(updatePayload).eq('id', id);
      logSupabase('sync', `Supplier ${id} berhasil diperbarui di Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception updateSupplier Supabase:', e);
    }
  }

  // 2. Firestore update
  try {
    const supplierRef = doc(db, COLLECTIONS.SUPPLIERS, id);
    await setDoc(supplierRef, { ...supplier, updatedAt: now }, { merge: true });
  } catch (error) {}

  // 3. Cache update
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const list = JSON.parse(cached);
      const idx = list.findIndex((s: any) => s.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], ...supplier, updatedAt: now };
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
      }
    }
  } catch (e) {}
}

export async function deleteSupplier(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('suppliers').delete().eq('id', id);
      logSupabase('sync', `Supplier ${id} berhasil dihapus dari Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception deleteSupplier Supabase:', e);
    }
  }

  try {
    const supplierRef = doc(db, COLLECTIONS.SUPPLIERS, id);
    await deleteDoc(supplierRef);
  } catch (error) {}

  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const list = JSON.parse(cached).filter((s: any) => s.id !== id);
      localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    }
  } catch (e) {}
}

export async function seedSampleSuppliers(): Promise<void> {
  const storeId = getCurrentStoreId();
  for (const sup of INITIAL_SUPPLIERS) {
    await addSupplier({
      storeId,
      kodeSupplier: sup.kodeSupplier,
      namaSupplier: sup.namaSupplier,
      kontakPerson: sup.kontakPerson,
      telepon: sup.telepon,
      email: sup.email,
      alamat: sup.alamat,
      kategoriProduk: sup.kategoriProduk,
      catatan: sup.catatan,
      status: sup.status,
    });
  }
}

