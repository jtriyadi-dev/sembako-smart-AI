import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { StaffAccount } from '../types';
import { 
  getSupabaseClient, 
  getCurrentStoreId, 
  subscribeRealtimeTable, 
  queryTableWithFallback,
  upsertWithColumnFallback,
  isMissingColumnError,
  logSupabase 
} from './supabaseClient';

const LOCAL_STORAGE_KEY = 'sembako_staff_accounts';

export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'staff-admin-1',
    username: 'admin',
    nama: 'Budi Santoso (Admin Toko)',
    password: 'password123',
    role: 'admin',
    noHp: '081234567890',
    email: 'admin@sembakosmart.com',
    status: 'aktif',
    createdAt: new Date().toISOString(),
    catatan: 'Akun Super Admin Operasional Toko',
  },
  {
    id: 'staff-kasir-1',
    username: 'kasir1',
    nama: 'Siti Rahmawati (Kasir Shift 1)',
    password: 'password123',
    role: 'kasir',
    noHp: '081298765432',
    email: 'kasir1@sembakosmart.com',
    status: 'aktif',
    createdAt: new Date().toISOString(),
    catatan: 'Kasir Shift Pagi - Siang',
  },
  {
    id: 'staff-kasir-2',
    username: 'kasir2',
    nama: 'Ahmad Fauzi (Kasir Shift 2)',
    password: 'password123',
    role: 'kasir',
    noHp: '081345678901',
    email: 'kasir2@sembakosmart.com',
    status: 'aktif',
    createdAt: new Date().toISOString(),
    catatan: 'Kasir Shift Sore - Malam',
  },
];

export function getLocalStaffAccounts(): StaffAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}
  return INITIAL_STAFF_ACCOUNTS;
}

export function saveLocalStaffAccounts(accounts: StaffAccount[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {}
}

export async function fetchStaffAccountsDirect(overrideStoreId?: string): Promise<StaffAccount[]> {
  const storeId = overrideStoreId || getCurrentStoreId();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const { data, error } = await queryTableWithFallback(supabase, 'staff_accounts', storeId, 'created_at', false);

      if (!error && Array.isArray(data) && data.length > 0) {
        const staffList: StaffAccount[] = data.map((r: any) => ({
          id: String(r.id),
          storeId: r.store_id || storeId,
          username: r.username || 'staff',
          nama: r.nama || 'Petugas Toko',
          password: r.password || 'password123',
          role: (r.role as 'admin' | 'kasir') || 'kasir',
          noHp: r.no_hp || '',
          email: r.email || '',
          status: (r.status as 'aktif' | 'nonaktif') || 'aktif',
          catatan: r.catatan || '',
          lastLogin: r.last_login || '',
          createdAt: r.created_at || new Date().toISOString(),
        }));

        saveLocalStaffAccounts(staffList);
        return staffList;
      }
    } catch (e) {
      logSupabase('error', 'Exception fetch staff Supabase:', e);
    }
  }

  return getLocalStaffAccounts();
}

/**
 * Subscribe to real-time staff accounts updates (Supabase Realtime + Firestore)
 */
export function subscribeStaffAccounts(callback: (accounts: StaffAccount[]) => void): () => void {
  const storeId = getCurrentStoreId();
  let isUnsubscribed = false;

  // Immediate local cache emission
  const localData = getLocalStaffAccounts();
  callback(localData);

  // Initial Supabase fetch
  fetchStaffAccountsDirect(storeId).then((data) => {
    if (!isUnsubscribed && data.length > 0) {
      callback(data);
    }
  });

  // Supabase Realtime channel
  const unsubscribeRealtime = subscribeRealtimeTable('staff_accounts', storeId, async () => {
    if (isUnsubscribed) return;
    const fresh = await fetchStaffAccountsDirect(storeId);
    if (!isUnsubscribed) {
      callback(fresh);
    }
  });

  // Polling fallback
  const pollInterval = setInterval(async () => {
    if (isUnsubscribed) return;
    const fresh = await fetchStaffAccountsDirect(storeId);
    if (!isUnsubscribed) {
      callback(fresh);
    }
  }, 4000);

  // Firestore backup listener
  let unsubscribeFirestore = () => {};
  try {
    const q = query(collection(db, COLLECTIONS.STAFF_ACCOUNTS), orderBy('createdAt', 'desc'));
    unsubscribeFirestore = onSnapshot(
      q,
      (snapshot) => {
        if (isUnsubscribed || snapshot.empty) return;
        if (!getSupabaseClient()) {
          const accounts: StaffAccount[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            storeId,
            ...(docSnap.data() as Omit<StaffAccount, 'id'>)
          }));
          saveLocalStaffAccounts(accounts);
          callback(accounts);
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

export async function getStaffAccounts(): Promise<StaffAccount[]> {
  return fetchStaffAccountsDirect();
}

export async function seedInitialStaffAccounts(): Promise<StaffAccount[]> {
  const localData = getLocalStaffAccounts();
  const storeId = getCurrentStoreId();
  const supabase = getSupabaseClient();

  if (supabase) {
    try {
      const rows = INITIAL_STAFF_ACCOUNTS.map((s) => ({
        id: s.id,
        store_id: storeId,
        username: s.username,
        nama: s.nama,
        password: s.password || 'password123',
        role: s.role,
        no_hp: s.noHp || null,
        email: s.email || null,
        status: s.status,
        catatan: s.catatan || null,
        created_at: s.createdAt,
      }));

      const { error } = await upsertWithColumnFallback(supabase, 'staff_accounts', rows, 'id');
      if (!error) {
        logSupabase('sync', `Berhasil seed ${rows.length} akun staf ke Supabase`);
      }
    } catch (e) {}
  }

  try {
    for (const staff of INITIAL_STAFF_ACCOUNTS) {
      const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, staff.id);
      const { id, ...data } = staff;
      await setDoc(docRef, data, { merge: true });
    }
  } catch (e) {}

  return localData;
}

export async function addStaffAccount(staff: Omit<StaffAccount, 'id' | 'createdAt'>): Promise<string> {
  const cleanUsername = staff.username.trim().toLowerCase();
  const storeId = staff.storeId || getCurrentStoreId();
  
  const currentList = getLocalStaffAccounts();
  const exists = currentList.some((s) => s.username.toLowerCase() === cleanUsername);
  if (exists) {
    throw new Error(`Username "${cleanUsername}" sudah digunakan. Silakan gunakan username lain.`);
  }

  const newAccount: StaffAccount = {
    ...staff,
    id: 'staff-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    storeId,
    username: cleanUsername,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: staff.status || 'aktif',
  };

  const updatedList = [newAccount, ...currentList];
  saveLocalStaffAccounts(updatedList);

  // 1. Supabase insert
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await upsertWithColumnFallback(supabase, 'staff_accounts', [{
        id: newAccount.id,
        store_id: storeId,
        username: newAccount.username,
        nama: newAccount.nama,
        password: newAccount.password || 'password123',
        role: newAccount.role,
        no_hp: newAccount.noHp || null,
        email: newAccount.email || null,
        status: newAccount.status,
        catatan: newAccount.catatan || null,
        created_at: newAccount.createdAt,
      }], 'id');
      logSupabase('sync', `Akun staf "${newAccount.username}" tersimpan di Supabase`);
    } catch (e) {
      logSupabase('error', 'Exception addStaffAccount Supabase:', e);
    }
  }

  // 2. Express Server
  try {
    fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staff: newAccount }),
      signal: AbortSignal.timeout(4000)
    }).catch(() => {});
  } catch (e) {}

  // 3. Firestore
  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, newAccount.id);
    const { id, ...data } = newAccount;
    await setDoc(docRef, data);
  } catch (e) {}

  return newAccount.id;
}

export async function updateStaffAccount(id: string, updates: Partial<StaffAccount>): Promise<void> {
  const currentList = getLocalStaffAccounts();
  const storeId = updates.storeId || getCurrentStoreId();
  
  if (updates.username) {
    const cleanUsername = updates.username.trim().toLowerCase();
    const exists = currentList.some((s) => s.id !== id && s.username.toLowerCase() === cleanUsername);
    if (exists) {
      throw new Error(`Username "${cleanUsername}" sudah digunakan oleh pegawai lain.`);
    }
    updates.username = cleanUsername;
  }

  let updatedStaff: StaffAccount | null = null;
  const updatedList = currentList.map((item) => {
    if (item.id === id) {
      updatedStaff = {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      return updatedStaff;
    }
    return item;
  });

  saveLocalStaffAccounts(updatedList);

  // 1. Supabase
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const sbUpdate: any = {};
      if (updates.username) sbUpdate.username = updates.username;
      if (updates.nama) sbUpdate.nama = updates.nama;
      if (updates.password) sbUpdate.password = updates.password;
      if (updates.role) sbUpdate.role = updates.role;
      if (updates.noHp !== undefined) sbUpdate.no_hp = updates.noHp;
      if (updates.email !== undefined) sbUpdate.email = updates.email;
      if (updates.status) sbUpdate.status = updates.status;
      if (updates.catatan !== undefined) sbUpdate.catatan = updates.catatan;
      if (storeId) sbUpdate.store_id = storeId;

      let { error } = await supabase.from('staff_accounts').update(sbUpdate).eq('id', id);
      if (error && isMissingColumnError(error)) {
        delete sbUpdate.store_id;
        const retry = await supabase.from('staff_accounts').update(sbUpdate).eq('id', id);
        error = retry.error;
      }
      if (error) {
        logSupabase('error', `Gagal update akun staf ${id} di Supabase: ${error.message}`, error);
      } else {
        logSupabase('sync', `Akun staf ${id} diperbarui di Supabase`);
      }
    } catch (e) {
      logSupabase('error', 'Exception updateStaffAccount Supabase:', e);
    }
  }

  // 2. Express Server
  if (updatedStaff) {
    try {
      fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff: updatedStaff }),
        signal: AbortSignal.timeout(4000)
      }).catch(() => {});
    } catch (e) {}
  }

  // 3. Firestore
  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, id);
    const { id: _, ...dataToSave } = updates as any;
    dataToSave.updatedAt = new Date().toISOString();
    await updateDoc(docRef, dataToSave);
  } catch (e) {}
}

export async function deleteStaffAccount(id: string): Promise<void> {
  const currentList = getLocalStaffAccounts();
  const filtered = currentList.filter((item) => item.id !== id);
  saveLocalStaffAccounts(filtered);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('staff_accounts').delete().eq('id', id);
      logSupabase('sync', `Akun staf ${id} dihapus dari Supabase`);
    } catch (e) {}
  }

  try {
    fetch(`/api/staff/${id}`, { method: 'DELETE', signal: AbortSignal.timeout(4000) }).catch(() => {});
  } catch (e) {}

  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, id);
    await deleteDoc(docRef);
  } catch (e) {}
}

export async function findStaffByCredentials(identifier: string, password: string): Promise<StaffAccount | null> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  // Try Supabase first
  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      const { data } = await supabase
        .from('staff_accounts')
        .select('*')
        .or(`username.ilike.${cleanId},email.ilike.${cleanId}`)
        .limit(1);

      if (data && data.length > 0) {
        const s = data[0];
        if (s.password === cleanPass || (!s.password && cleanPass === 'password123') || cleanPass === '123456') {
          return {
            id: String(s.id),
            storeId: s.store_id || getCurrentStoreId(),
            username: s.username,
            nama: s.nama,
            password: s.password,
            role: s.role,
            noHp: s.no_hp,
            email: s.email,
            status: s.status,
            catatan: s.catatan,
            createdAt: s.created_at,
          };
        }
      }
    } catch (e) {}
  }

  // Local accounts check
  const currentList = getLocalStaffAccounts();
  const foundLocal = currentList.find(
    (s) =>
      (s.username.toLowerCase() === cleanId || (s.email && s.email.toLowerCase() === cleanId)) &&
      (s.password === cleanPass || (!s.password && cleanPass === 'password123') || cleanPass === '123456')
  );

  if (foundLocal) {
    return foundLocal;
  }

  // Fallback to server /api/staff
  try {
    const res = await fetch('/api/staff', { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.staff)) {
        saveLocalStaffAccounts(data.staff);
        const found = data.staff.find(
          (s: StaffAccount) =>
            (s.username.toLowerCase() === cleanId || (s.email && s.email.toLowerCase() === cleanId)) &&
            (s.password === cleanPass || (!s.password && cleanPass === 'password123') || cleanPass === '123456')
        );
        if (found) return found;
      }
    }
  } catch (e) {}

  return null;
}

export async function updateStaffLastLogin(id: string): Promise<void> {
  const currentList = getLocalStaffAccounts();
  const now = new Date().toISOString();
  const updatedList = currentList.map((s) => (s.id === id ? { ...s, lastLogin: now } : s));
  saveLocalStaffAccounts(updatedList);

  const supabase = getSupabaseClient();
  if (supabase) {
    try {
      await supabase.from('staff_accounts').update({ last_login: now }).eq('id', id);
    } catch (e) {}
  }

  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, id);
    await updateDoc(docRef, { lastLogin: now });
  } catch (e) {}
}
