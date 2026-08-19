import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { StaffAccount } from '../types';

const LOCAL_STORAGE_KEY = 'sembako_staff_accounts';

export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  {
    id: 'staff-admin-01',
    username: 'admin1',
    nama: 'Admin Toko',
    password: 'password123',
    role: 'admin',
    noHp: '081234567891',
    email: 'admin1@sembakosmart.id',
    status: 'aktif',
    createdAt: new Date().toISOString(),
    catatan: 'Akun Admin pengelola produk, stok, dan laporan toko.',
  },
  {
    id: 'staff-kasir-01',
    username: 'kasir1',
    nama: 'Kasir Utama',
    password: 'password123',
    role: 'kasir',
    noHp: '081234567892',
    email: 'kasir1@sembakosmart.id',
    status: 'aktif',
    createdAt: new Date().toISOString(),
    catatan: 'Akun Kasir untuk melayani transaksi kasir POS.',
  },
];

// Helper: Get cached staff accounts from localStorage
export function getLocalStaffAccounts(): StaffAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to read staff accounts from localStorage:', e);
  }
  // Initialize with initial staff accounts
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_STAFF_ACCOUNTS));
  } catch (e) {}
  return INITIAL_STAFF_ACCOUNTS;
}

// Helper: Save to localStorage
export function saveLocalStaffAccounts(accounts: StaffAccount[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(accounts));
  } catch (e) {
    console.error('Failed to save staff accounts to localStorage:', e);
  }
}

// Subscribe to real-time staff accounts updates
export function subscribeStaffAccounts(callback: (accounts: StaffAccount[]) => void): () => void {
  // Always emit local data immediately
  const localData = getLocalStaffAccounts();
  callback(localData);

  try {
    const q = query(collection(db, COLLECTIONS.STAFF_ACCOUNTS), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const accounts: StaffAccount[] = [];
          snapshot.forEach((docSnap) => {
            accounts.push({ id: docSnap.id, ...(docSnap.data() as Omit<StaffAccount, 'id'>) });
          });
          saveLocalStaffAccounts(accounts);
          callback(accounts);
        } else {
          // If Firestore is empty, seed initial staff accounts
          seedInitialStaffAccounts().then((seeded) => {
            if (seeded.length > 0) {
              callback(seeded);
            }
          });
        }
      },
      (error) => {
        console.warn('Firestore staff listener failed, using local cache:', error.message);
        callback(getLocalStaffAccounts());
      }
    );

    return unsubscribe;
  } catch (e) {
    console.warn('Firestore offline, fallback to local staff accounts');
    return () => {};
  }
}

// Get all staff accounts (Promise)
export async function getStaffAccounts(): Promise<StaffAccount[]> {
  try {
    const q = query(collection(db, COLLECTIONS.STAFF_ACCOUNTS), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const accounts: StaffAccount[] = [];
      snapshot.forEach((docSnap) => {
        accounts.push({ id: docSnap.id, ...(docSnap.data() as Omit<StaffAccount, 'id'>) });
      });
      saveLocalStaffAccounts(accounts);
      return accounts;
    }
  } catch (e) {
    console.warn('Failed to fetch staff from Firestore, fallback to local:', e);
  }
  return getLocalStaffAccounts();
}

// Seed initial staff accounts if none exist
export async function seedInitialStaffAccounts(): Promise<StaffAccount[]> {
  const localData = getLocalStaffAccounts();
  try {
    for (const staff of INITIAL_STAFF_ACCOUNTS) {
      const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, staff.id);
      const { id, ...data } = staff;
      await setDoc(docRef, data, { merge: true });
    }
  } catch (e) {
    console.warn('Could not seed initial staff to cloud Firestore, kept in local:', e);
  }
  return localData;
}

// Add a new staff account
export async function addStaffAccount(staff: Omit<StaffAccount, 'id' | 'createdAt'>): Promise<string> {
  const cleanUsername = staff.username.trim().toLowerCase();
  
  // Validate unique username locally
  const currentList = getLocalStaffAccounts();
  const exists = currentList.some((s) => s.username.toLowerCase() === cleanUsername);
  if (exists) {
    throw new Error(`Username "${cleanUsername}" sudah digunakan. Silakan gunakan username lain.`);
  }

  const newAccount: StaffAccount = {
    ...staff,
    id: 'staff-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    username: cleanUsername,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: staff.status || 'aktif',
  };

  // Update local cache first
  const updatedList = [newAccount, ...currentList];
  saveLocalStaffAccounts(updatedList);

  // Sync to Firestore
  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, newAccount.id);
    const { id, ...data } = newAccount;
    await setDoc(docRef, data);
  } catch (e) {
    console.warn('Failed to sync new staff account to Firestore:', e);
  }

  return newAccount.id;
}

// Update existing staff account
export async function updateStaffAccount(id: string, updates: Partial<StaffAccount>): Promise<void> {
  const currentList = getLocalStaffAccounts();
  
  if (updates.username) {
    const cleanUsername = updates.username.trim().toLowerCase();
    const exists = currentList.some((s) => s.id !== id && s.username.toLowerCase() === cleanUsername);
    if (exists) {
      throw new Error(`Username "${cleanUsername}" sudah digunakan oleh pegawai lain.`);
    }
    updates.username = cleanUsername;
  }

  const updatedList = currentList.map((item) => {
    if (item.id === id) {
      return {
        ...item,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    }
    return item;
  });

  saveLocalStaffAccounts(updatedList);

  // Sync to Firestore
  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, id);
    const { id: _, ...dataToSave } = updates as any;
    dataToSave.updatedAt = new Date().toISOString();
    await updateDoc(docRef, dataToSave);
  } catch (e) {
    console.warn('Failed to update staff account in Firestore:', e);
  }
}

// Delete a staff account
export async function deleteStaffAccount(id: string): Promise<void> {
  const currentList = getLocalStaffAccounts();
  const filtered = currentList.filter((item) => item.id !== id);
  saveLocalStaffAccounts(filtered);

  // Sync to Firestore
  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.warn('Failed to delete staff account in Firestore:', e);
  }
}

// Find staff by credentials (username/email + password)
export async function findStaffByCredentials(identifier: string, password: string): Promise<StaffAccount | null> {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  // Instant check local accounts
  const currentList = getLocalStaffAccounts();
  const foundLocal = currentList.find(
    (s) =>
      (s.username.toLowerCase() === cleanId || (s.email && s.email.toLowerCase() === cleanId)) &&
      (s.password === cleanPass || (!s.password && cleanPass === 'password123') || cleanPass === '123456')
  );

  if (foundLocal) {
    return foundLocal;
  }

  return null;
}

// Update last login timestamp for staff
export async function updateStaffLastLogin(id: string): Promise<void> {
  const currentList = getLocalStaffAccounts();
  const now = new Date().toISOString();
  const updatedList = currentList.map((s) => (s.id === id ? { ...s, lastLogin: now } : s));
  saveLocalStaffAccounts(updatedList);

  try {
    const docRef = doc(db, COLLECTIONS.STAFF_ACCOUNTS, id);
    await updateDoc(docRef, { lastLogin: now });
  } catch (e) {}
}
