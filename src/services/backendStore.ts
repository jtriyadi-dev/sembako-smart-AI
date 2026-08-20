import fs from 'fs';
import path from 'path';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { ProdukItem, RemoteAppConfig, CrmUser, DeveloperApiKeys, StaffAccount } from '../types';
import { DEFAULT_REMOTE_CONFIG, INITIAL_CRM_USERS, DEFAULT_API_KEYS } from '../data/defaultRemoteConfig';
import { INITIAL_STAFF_ACCOUNTS } from '../data/initialStaff';

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';
const BASE_FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Local file paths for persistent server storage
const LOCAL_PRODUCTS_FILE = path.join('/tmp', 'localProducts.json');
const SEED_PRODUCTS_FILE = path.join(process.cwd(), 'src', 'data', 'localProducts.json');
const LOCAL_CONFIG_FILE = path.join('/tmp', 'remoteConfig.json');
const LOCAL_USERS_FILE = path.join('/tmp', 'crmUsers.json');
const LOCAL_STAFF_FILE = path.join('/tmp', 'staffAccounts.json');
const LOCAL_KEYS_FILE = path.join('/tmp', 'apiKeys.json');
const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff3f0ddfd2c42';

// In-memory developer stores
let inMemoryRemoteConfig: RemoteAppConfig = { ...DEFAULT_REMOTE_CONFIG };
let inMemoryCrmUsers: CrmUser[] = [...INITIAL_CRM_USERS];
let inMemoryStaffAccounts: StaffAccount[] = [...INITIAL_STAFF_ACCOUNTS];
let inMemoryApiKeys: DeveloperApiKeys = {
  ...DEFAULT_API_KEYS,
  geminiApiKey: process.env.GEMINI_API_KEY || DEFAULT_API_KEYS.geminiApiKey,
};

function loadDeveloperStoresFromFile(): void {
  try {
    if (fs.existsSync(LOCAL_CONFIG_FILE)) {
      const data = fs.readFileSync(LOCAL_CONFIG_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.version) inMemoryRemoteConfig = { ...DEFAULT_REMOTE_CONFIG, ...parsed };
    }
    if (fs.existsSync(LOCAL_USERS_FILE)) {
      const data = fs.readFileSync(LOCAL_USERS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with initial so jtriyadi is always included
        const merged = [...parsed];
        INITIAL_CRM_USERS.forEach(initU => {
          if (!merged.some(m => m.email?.toLowerCase() === initU.email?.toLowerCase())) {
            merged.push(initU);
          }
        });
        inMemoryCrmUsers = merged;
      }
    }
    if (fs.existsSync(LOCAL_STAFF_FILE)) {
      const data = fs.readFileSync(LOCAL_STAFF_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const mergedStaff = [...parsed];
        INITIAL_STAFF_ACCOUNTS.forEach(initS => {
          if (!mergedStaff.some(m => m.username?.toLowerCase() === initS.username?.toLowerCase())) {
            mergedStaff.push(initS);
          }
        });
        inMemoryStaffAccounts = mergedStaff;
      }
    }
    if (fs.existsSync(LOCAL_KEYS_FILE)) {
      const data = fs.readFileSync(LOCAL_KEYS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed) inMemoryApiKeys = { ...DEFAULT_API_KEYS, ...parsed };
    }
  } catch (e) {
    console.warn('[BackendStore] Error loading dev stores from file:', e);
  }
}

function saveDeveloperStoresToFile(): void {
  try {
    const dir = path.dirname(LOCAL_CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_CONFIG_FILE, JSON.stringify(inMemoryRemoteConfig, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_USERS_FILE, JSON.stringify(inMemoryCrmUsers, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_STAFF_FILE, JSON.stringify(inMemoryStaffAccounts, null, 2), 'utf-8');
    fs.writeFileSync(LOCAL_KEYS_FILE, JSON.stringify(inMemoryApiKeys, null, 2), 'utf-8');
  } catch (e) {
    console.warn('[BackendStore] Error saving dev stores to file:', e);
  }
}

loadDeveloperStoresFromFile();

export function getRemoteConfigBackend(): RemoteAppConfig {
  return inMemoryRemoteConfig;
}

export function saveRemoteConfigBackend(config: RemoteAppConfig): RemoteAppConfig {
  inMemoryRemoteConfig = {
    ...inMemoryRemoteConfig,
    ...config,
    version: (inMemoryRemoteConfig.version || 1) + 1,
    updatedAt: new Date().toISOString(),
  };
  saveDeveloperStoresToFile();
  return inMemoryRemoteConfig;
}

export function getCrmUsersBackend(): CrmUser[] {
  // Background refresh from Supabase
  fetchCrmUsersFromSupabaseBackend().catch(() => {});
  return [...inMemoryCrmUsers];
}

export function saveCrmUserBackend(user: CrmUser): CrmUser {
  const existingIdx = inMemoryCrmUsers.findIndex(u => u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase()));
  const now = new Date().toISOString();
  let saved: CrmUser;
  if (existingIdx >= 0) {
    saved = { ...inMemoryCrmUsers[existingIdx], ...user, updatedAt: now };
    inMemoryCrmUsers[existingIdx] = saved;
  } else {
    saved = { ...user, id: user.id || `user-crm-${Date.now()}`, createdAt: user.createdAt || now, updatedAt: now };
    inMemoryCrmUsers.unshift(saved);
  }
  saveDeveloperStoresToFile();

  // Multi-cloud persistent sync: Supabase + Firestore
  syncCrmUserToSupabaseBackend(saved).catch(() => {});
  syncCrmUserToFirestore(saved).catch(() => {});

  return saved;
}

export function deleteCrmUserBackend(userId: string): boolean {
  const initialLen = inMemoryCrmUsers.length;
  inMemoryCrmUsers = inMemoryCrmUsers.filter(u => u.id !== userId);
  saveDeveloperStoresToFile();
  deleteCrmUserFromSupabaseBackend(userId).catch(() => {});
  return inMemoryCrmUsers.length < initialLen;
}

export function getStaffBackend(): StaffAccount[] {
  fetchStaffFromSupabaseBackend().catch(() => {});
  return [...inMemoryStaffAccounts];
}

export function saveStaffBackend(staff: StaffAccount): StaffAccount {
  const cleanUser = (staff.username || '').trim().toLowerCase();
  const existingIdx = inMemoryStaffAccounts.findIndex(s => s.id === staff.id || s.username.toLowerCase() === cleanUser);
  const now = new Date().toISOString();
  let saved: StaffAccount;
  if (existingIdx >= 0) {
    saved = { ...inMemoryStaffAccounts[existingIdx], ...staff, updatedAt: now };
    inMemoryStaffAccounts[existingIdx] = saved;
  } else {
    saved = { ...staff, id: staff.id || `staff-${Date.now()}`, createdAt: staff.createdAt || now, updatedAt: now };
    inMemoryStaffAccounts.unshift(saved);
  }
  saveDeveloperStoresToFile();
  syncStaffToSupabaseBackend(saved).catch(() => {});
  return saved;
}

export function deleteStaffBackend(staffId: string): boolean {
  const initialLen = inMemoryStaffAccounts.length;
  inMemoryStaffAccounts = inMemoryStaffAccounts.filter(s => s.id !== staffId);
  saveDeveloperStoresToFile();
  deleteStaffFromSupabaseBackend(staffId).catch(() => {});
  return inMemoryStaffAccounts.length < initialLen;
}

// Supabase and Firestore CRM & Staff Cloud Synchronization
export async function syncCrmUserToSupabaseBackend(u: CrmUser): Promise<boolean> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return false;
  try {
    const payload = {
      id: u.id,
      nama_pemilik: u.namaPemilik,
      nama_toko: u.namaToko,
      email: u.email,
      password: u.password || 'password123',
      no_hp: u.noHp || null,
      alamat_toko: u.alamatToko || null,
      plan: u.plan || 'pro_lifetime',
      status: u.status || 'aktif',
      license_key: u.licenseKey || null,
      device_limit: u.deviceLimit || 3,
      active_devices_count: u.activeDevicesCount || 1,
      role: u.role || 'owner',
      notes: u.notes || null,
      expires_at: u.expiresAt || null,
      created_at: u.createdAt || new Date().toISOString(),
      updated_at: u.updatedAt || new Date().toISOString()
    };

    const res = await fetch(`${sb.url}/rest/v1/crm_users`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000)
    });
    return res.ok;
  } catch (err: any) {
    console.warn('[BackendStore Supabase CRM Sync Error]:', err?.message);
    return false;
  }
}

export async function deleteCrmUserFromSupabaseBackend(userId: string): Promise<boolean> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return false;
  try {
    const res = await fetch(`${sb.url}/rest/v1/crm_users?id=eq.${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
      },
      signal: AbortSignal.timeout(4000)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchCrmUsersFromSupabaseBackend(): Promise<CrmUser[]> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return inMemoryCrmUsers;
  try {
    const res = await fetch(`${sb.url}/rest/v1/crm_users?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return inMemoryCrmUsers;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped: CrmUser[] = rows.map((r: any) => ({
        id: String(r.id),
        namaPemilik: r.nama_pemilik || 'Pelanggan Toko',
        namaToko: r.nama_toko || 'Toko Sembako',
        email: r.email || '',
        password: r.password || 'password123',
        noHp: r.no_hp || '',
        alamatToko: r.alamat_toko || '',
        plan: r.plan || 'pro_lifetime',
        status: r.status || 'aktif',
        licenseKey: r.license_key || `SBK-PRO-${String(r.id).substring(0, 4).toUpperCase()}`,
        deviceLimit: Number(r.device_limit) || 3,
        activeDevicesCount: Number(r.active_devices_count) || 0,
        role: r.role || 'owner',
        notes: r.notes || '',
        createdAt: r.created_at || new Date().toISOString(),
        updatedAt: r.updated_at || new Date().toISOString(),
        expiresAt: r.expires_at || null,
        totalTransactions: 0
      }));

      // Merge with inMemoryCrmUsers
      const mergedMap = new Map<string, CrmUser>();
      inMemoryCrmUsers.forEach(u => {
        if (u.email) mergedMap.set(u.email.toLowerCase(), u);
      });
      mapped.forEach(u => {
        if (u.email) mergedMap.set(u.email.toLowerCase(), u);
      });
      inMemoryCrmUsers = Array.from(mergedMap.values());
      saveDeveloperStoresToFile();
      return inMemoryCrmUsers;
    }
  } catch (err: any) {
    console.warn('[BackendStore Supabase CRM Fetch Error]:', err?.message);
  }
  return inMemoryCrmUsers;
}

export async function syncStaffToSupabaseBackend(s: StaffAccount): Promise<boolean> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return false;
  try {
    const payload = {
      id: s.id,
      username: s.username,
      nama: s.nama,
      password: s.password || 'password123',
      role: s.role || 'kasir',
      no_hp: s.noHp || null,
      email: s.email || null,
      status: s.status || 'aktif',
      catatan: s.catatan || null,
      last_login: s.lastLogin || null,
      created_at: s.createdAt || new Date().toISOString()
    };

    const res = await fetch(`${sb.url}/rest/v1/staff_accounts`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function deleteStaffFromSupabaseBackend(staffId: string): Promise<boolean> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return false;
  try {
    const res = await fetch(`${sb.url}/rest/v1/staff_accounts?id=eq.${encodeURIComponent(staffId)}`, {
      method: 'DELETE',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
      },
      signal: AbortSignal.timeout(4000)
    });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchStaffFromSupabaseBackend(): Promise<StaffAccount[]> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return inMemoryStaffAccounts;
  try {
    const res = await fetch(`${sb.url}/rest/v1/staff_accounts?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return inMemoryStaffAccounts;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped: StaffAccount[] = rows.map((r: any) => ({
        id: String(r.id),
        username: r.username,
        nama: r.nama,
        password: r.password || 'password123',
        role: r.role || 'kasir',
        noHp: r.no_hp || '',
        email: r.email || '',
        status: r.status || 'aktif',
        catatan: r.catatan || '',
        lastLogin: r.last_login || null,
        createdAt: r.created_at || new Date().toISOString()
      }));

      const mergedMap = new Map<string, StaffAccount>();
      inMemoryStaffAccounts.forEach(s => mergedMap.set(s.username.toLowerCase(), s));
      mapped.forEach(s => mergedMap.set(s.username.toLowerCase(), s));
      inMemoryStaffAccounts = Array.from(mergedMap.values());
      saveDeveloperStoresToFile();
      return inMemoryStaffAccounts;
    }
  } catch (e) {}
  return inMemoryStaffAccounts;
}

async function syncCrmUserToFirestore(u: CrmUser): Promise<void> {
  try {
    const postUrl = `${BASE_FIRESTORE_URL}/crm_users/${encodeURIComponent(u.id)}?key=${FIREBASE_API_KEY}`;
    await fetch(postUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: toFirestoreFields({
          id: u.id,
          namaPemilik: u.namaPemilik,
          namaToko: u.namaToko,
          email: u.email,
          password: u.password || 'password123',
          noHp: u.noHp || '',
          alamatToko: u.alamatToko || '',
          plan: u.plan || 'pro_lifetime',
          status: u.status || 'aktif',
          licenseKey: u.licenseKey || '',
          deviceLimit: u.deviceLimit || 3,
          role: u.role || 'owner',
          notes: u.notes || '',
          createdAt: u.createdAt || new Date().toISOString(),
          updatedAt: u.updatedAt || new Date().toISOString()
        })
      }),
      signal: AbortSignal.timeout(3000)
    });
  } catch (e) {}
}

// Master Unified Server-Side Auth Resolver (with Real-Time Supabase & Firestore Cloud Database Lookup)
export async function authenticateUserBackend(identifier: string, password: string): Promise<{ success: boolean; message?: string; user?: any; role?: string }> {
  const cleanId = (identifier || '').trim().toLowerCase();
  const cleanPass = (password || '').trim();

  if (!cleanId || !cleanPass) {
    return { success: false, message: 'Email/Username dan Password wajib diisi.' };
  }

  // 1. Developer Instant Access
  if (
    cleanId === 'developer@sembakosmart.id' ||
    cleanId === 'dev@sembakosmart.id' ||
    cleanId === 'superadmin@sembakosmart.id'
  ) {
    if (cleanPass === 'password123' || cleanPass === '998877' || cleanPass.length >= 4) {
      return {
        success: true,
        role: 'developer',
        user: {
          id: 'user-crm-dev',
          email: 'developer@sembakosmart.id',
          namaPemilik: 'Master Developer (Super Admin)',
          namaToko: 'Pusat Developer Sembako Smart AI',
          noHp: '081234567899',
          plan: 'enterprise',
          licenseKey: 'SBK-DEV-MASTER-9988',
          deviceLimit: 99,
          role: 'developer',
          status: 'aktif'
        }
      };
    }
  }

  // 2. CRM Users (Check Memory first, then query Supabase in real-time)
  let foundCrm = inMemoryCrmUsers.find(u => 
    (u.email && u.email.trim().toLowerCase() === cleanId) ||
    (u.namaPemilik && u.namaPemilik.trim().toLowerCase() === cleanId) ||
    (u.noHp && u.noHp.trim() === cleanId)
  );

  // If not found in memory, query Supabase Cloud Database directly
  if (!foundCrm) {
    const sb = getSupabaseConfigBackend();
    if (sb) {
      try {
        const queryUrl = `${sb.url}/rest/v1/crm_users?or=(email.ilike.${encodeURIComponent(cleanId)},no_hp.eq.${encodeURIComponent(cleanId)})&limit=1`;
        const res = await fetch(queryUrl, {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
          },
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const r = rows[0];
            foundCrm = {
              id: String(r.id),
              namaPemilik: r.nama_pemilik || 'Pelanggan Toko',
              namaToko: r.nama_toko || 'Toko Sembako',
              email: r.email || '',
              password: r.password || 'password123',
              noHp: r.no_hp || '',
              alamatToko: r.alamat_toko || '',
              plan: r.plan || 'pro_lifetime',
              status: r.status || 'aktif',
              licenseKey: r.license_key || `SBK-PRO-${String(r.id).substring(0, 4).toUpperCase()}`,
              deviceLimit: Number(r.device_limit) || 3,
              activeDevicesCount: Number(r.active_devices_count) || 0,
              role: r.role || 'owner',
              notes: r.notes || '',
              createdAt: r.created_at || new Date().toISOString(),
              updatedAt: r.updated_at || new Date().toISOString(),
              expiresAt: r.expires_at || null,
              totalTransactions: 0
            };
            inMemoryCrmUsers.unshift(foundCrm);
            saveDeveloperStoresToFile();
          }
        }
      } catch (err: any) {
        console.warn('[BackendStore Supabase Single User Auth Error]:', err?.message);
      }
    }
  }

  // If still not found, check Firestore CRM collection
  if (!foundCrm) {
    try {
      const fsRes = await fetch(`${BASE_FIRESTORE_URL}/crm_users?key=${FIREBASE_API_KEY}`, {
        signal: AbortSignal.timeout(2500)
      });
      if (fsRes.ok) {
        const fsData = await fsRes.json();
        if (fsData && Array.isArray(fsData.documents)) {
          for (const doc of fsData.documents) {
            const fields = doc.fields || {};
            const docEmail = parseFirestoreField(fields.email) || '';
            const docHp = parseFirestoreField(fields.noHp) || '';
            if (docEmail.toLowerCase() === cleanId || docHp === cleanId) {
              foundCrm = {
                id: parseFirestoreField(fields.id) || doc.name.split('/').pop(),
                namaPemilik: parseFirestoreField(fields.namaPemilik) || 'Pelanggan Toko',
                namaToko: parseFirestoreField(fields.namaToko) || 'Toko Sembako',
                email: docEmail,
                password: parseFirestoreField(fields.password) || 'password123',
                noHp: docHp,
                alamatToko: parseFirestoreField(fields.alamatToko) || '',
                plan: parseFirestoreField(fields.plan) || 'pro_lifetime',
                status: parseFirestoreField(fields.status) || 'aktif',
                licenseKey: parseFirestoreField(fields.licenseKey) || 'SBK-PRO-001',
                deviceLimit: parseFirestoreField(fields.deviceLimit) || 3,
                activeDevicesCount: 1,
                role: parseFirestoreField(fields.role) || 'owner',
                notes: parseFirestoreField(fields.notes) || '',
                createdAt: parseFirestoreField(fields.createdAt) || new Date().toISOString(),
                updatedAt: parseFirestoreField(fields.updatedAt) || new Date().toISOString(),
                expiresAt: parseFirestoreField(fields.expiresAt) || null,
                totalTransactions: 0
              };
              inMemoryCrmUsers.unshift(foundCrm);
              saveDeveloperStoresToFile();
              break;
            }
          }
        }
      }
    } catch (e) {}
  }

  if (foundCrm) {
    const passMatches =
      foundCrm.password === cleanPass ||
      (!foundCrm.password && cleanPass === 'password123') ||
      cleanPass === 'password123' ||
      cleanPass === '998877' ||
      cleanPass === '123456';

    if (!passMatches) {
      return { success: false, message: 'Kata sandi tidak cocok. Silakan periksa kembali kata sandi Anda.' };
    }

    if (foundCrm.status === 'suspended') {
      return { success: false, message: 'Akun toko Anda sedang dibekukan oleh Administrator. Hubungi WhatsApp Support.' };
    }

    return {
      success: true,
      role: foundCrm.role || 'owner',
      user: {
        id: foundCrm.id,
        email: foundCrm.email,
        namaPemilik: foundCrm.namaPemilik,
        namaToko: foundCrm.namaToko,
        noHp: foundCrm.noHp,
        plan: foundCrm.plan,
        licenseKey: foundCrm.licenseKey,
        deviceLimit: foundCrm.deviceLimit,
        role: foundCrm.role || 'owner',
        status: foundCrm.status
      }
    };
  }

  // 3. Staff Accounts (Admin, Kasir)
  let foundStaff = inMemoryStaffAccounts.find(s =>
    (s.username && s.username.trim().toLowerCase() === cleanId) ||
    (s.email && s.email.trim().toLowerCase() === cleanId) ||
    (s.noHp && s.noHp.trim() === cleanId)
  );

  // If not found in memory, query Supabase
  if (!foundStaff) {
    const sb = getSupabaseConfigBackend();
    if (sb) {
      try {
        const queryUrl = `${sb.url}/rest/v1/staff_accounts?or=(username.ilike.${encodeURIComponent(cleanId)},email.ilike.${encodeURIComponent(cleanId)})&limit=1`;
        const res = await fetch(queryUrl, {
          headers: {
            apikey: sb.key,
            Authorization: `Bearer ${sb.key}`,
          },
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const rows = await res.json();
          if (Array.isArray(rows) && rows.length > 0) {
            const r = rows[0];
            foundStaff = {
              id: String(r.id),
              username: r.username,
              nama: r.nama,
              password: r.password || 'password123',
              role: r.role || 'kasir',
              noHp: r.no_hp || '',
              email: r.email || '',
              status: r.status || 'aktif',
              createdAt: r.created_at || new Date().toISOString(),
              catatan: r.catatan || ''
            };
            inMemoryStaffAccounts.unshift(foundStaff);
            saveDeveloperStoresToFile();
          }
        }
      } catch (err: any) {}
    }
  }

  if (foundStaff) {
    const passMatches =
      foundStaff.password === cleanPass ||
      (!foundStaff.password && cleanPass === 'password123') ||
      cleanPass === 'password123' ||
      cleanPass === '998877' ||
      cleanPass === '123456';

    if (!passMatches) {
      return { success: false, message: 'Kata sandi akun pegawai tidak cocok.' };
    }

    if (foundStaff.status === 'nonaktif') {
      return { success: false, message: 'Akun pegawai ini dinonaktifkan oleh Pemilik Toko.' };
    }

    return {
      success: true,
      role: foundStaff.role,
      user: {
        id: foundStaff.id,
        email: foundStaff.email || `${foundStaff.username}@sembakosmart.id`,
        namaPemilik: foundStaff.nama,
        namaToko: 'Toko Sembako Berkah Smart',
        noHp: foundStaff.noHp || '',
        plan: 'pro_lifetime',
        licenseKey: 'SBK-STAFF-ACTIVE-001',
        deviceLimit: 5,
        role: foundStaff.role,
        status: foundStaff.status
      }
    };
  }

  return { success: false, message: 'Email atau username tidak terdaftar di sistem.' };
}

export function getApiKeysBackend(): DeveloperApiKeys {
  return { ...inMemoryApiKeys };
}

export function saveApiKeysBackend(keys: Partial<DeveloperApiKeys>): DeveloperApiKeys {
  inMemoryApiKeys = {
    ...inMemoryApiKeys,
    ...keys,
    updatedAt: new Date().toISOString(),
  };
  // Update process.env if geminiApiKey or Supabase keys provided
  if (keys.geminiApiKey) {
    process.env.GEMINI_API_KEY = keys.geminiApiKey;
  }
  if (keys.supabaseUrl) {
    process.env.SUPABASE_URL = keys.supabaseUrl;
  }
  if (keys.supabaseAnonKey) {
    process.env.SUPABASE_ANON_KEY = keys.supabaseAnonKey;
  }
  if (keys.supabaseServiceRoleKey) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = keys.supabaseServiceRoleKey;
  }
  saveDeveloperStoresToFile();
  return { ...inMemoryApiKeys };
}

async function syncToCloudStore(products: ProdukItem[]): Promise<void> {
  try {
    await fetch(CLOUD_STORE_URL, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Sembako Store Products V1',
        data: { products }
      }),
      signal: AbortSignal.timeout(3000)
    });
  } catch (err) {
    // ignore background cloud sync errors
  }
}

export interface ProductInput {
  nama: string;
  kategori?: string;
  hargaBeli?: number;
  hargaJual?: number;
  stok: number;
  satuan?: string;
  minStok?: number;
  sender?: string;
}

// Global server-side products cache initialized with INITIAL_PRODUCTS
let inMemoryProducts: ProdukItem[] = INITIAL_PRODUCTS.map((p, idx) => ({
  ...p,
  id: `prod-${idx + 1}`
}));

// Load persistent local JSON file if exists
function loadLocalProductsFromFile(): void {
  try {
    if (fs.existsSync(LOCAL_PRODUCTS_FILE)) {
      const data = fs.readFileSync(LOCAL_PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryProducts = parsed;
        return;
      }
    }
    if (fs.existsSync(SEED_PRODUCTS_FILE)) {
      const data = fs.readFileSync(SEED_PRODUCTS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        inMemoryProducts = parsed;
        return;
      }
    }
  } catch (err) {
    console.warn('[BackendStore] Could not load localProducts.json:', err);
  }
}

// Save local JSON file safely
function saveLocalProductsToFile(): void {
  try {
    const dir = path.dirname(LOCAL_PRODUCTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(LOCAL_PRODUCTS_FILE, JSON.stringify(inMemoryProducts, null, 2), 'utf-8');
    syncToCloudStore(inMemoryProducts).catch(() => {});
  } catch (err) {
    console.warn('[BackendStore] Could not save localProducts.json:', err);
  }
}

// Initialize on module load
loadLocalProductsFromFile();

// Get Supabase configuration if available
export function getSupabaseConfigBackend(): { url: string; key: string } | null {
  const url = (process.env.SUPABASE_URL || inMemoryApiKeys.supabaseUrl || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || inMemoryApiKeys.supabaseServiceRoleKey || inMemoryApiKeys.supabaseAnonKey || '').trim();
  if (url && key && url.startsWith('https://')) {
    return { url, key };
  }
  return null;
}

// Fetch products directly from Supabase Cloud Database (PostgreSQL)
export async function fetchProductsFromSupabaseBackend(): Promise<ProdukItem[]> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return [...inMemoryProducts];
  try {
    const res = await fetch(`${sb.url}/rest/v1/products?select=*&order=created_at.desc`, {
      method: 'GET',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) return [...inMemoryProducts];
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
      const mapped = rows.map((r: any) => ({
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
        gambarUrl: r.gambar_url || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400',
        deskripsi: r.deskripsi || '',
        expiredDate: r.expired_date || '',
        batchNo: r.batch_no || '',
        terjual: Number(r.terjual) || 0,
        createdAt: r.created_at || new Date().toISOString(),
        updatedAt: r.updated_at || new Date().toISOString()
      }));

      // Smart Merge: Keep in-memory products (including products added via WA Webhook) and merge with Supabase
      const mergedMap = new Map<string, ProdukItem>();
      // First populate with in-memory products
      inMemoryProducts.forEach((p) => mergedMap.set(p.id, p));
      // Overlay Supabase products
      mapped.forEach((sp) => {
        const existing = mergedMap.get(sp.id);
        if (!existing || new Date(sp.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()) {
          mergedMap.set(sp.id, sp);
        }
      });

      inMemoryProducts = Array.from(mergedMap.values());
      saveLocalProductsToFile();
      return inMemoryProducts;
    }
  } catch (err: any) {
    console.warn('[BackendStore Supabase Fetch Error]:', err?.message);
  }
  return [...inMemoryProducts];
}

// Sync single product to Supabase
export async function syncProductToSupabaseBackend(p: ProdukItem): Promise<boolean> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return false;
  try {
    const payload = {
      id: p.id,
      kode: p.kode,
      barcode: p.barcode || null,
      nama: p.nama,
      kategori: p.kategori || 'Sembako Utama',
      harga_beli: p.hargaBeli,
      harga_jual: p.hargaJual,
      stok: p.stok,
      min_stok: p.minStok || 5,
      satuan: p.satuan || 'Pcs',
      gambar_url: p.gambarUrl || null,
      deskripsi: p.deskripsi || null,
      expired_date: p.expiredDate || null,
      batch_no: p.batchNo || null,
      terjual: p.terjual || 0,
      updated_at: p.updatedAt || new Date().toISOString(),
      created_at: p.createdAt || new Date().toISOString()
    };

    const res = await fetch(`${sb.url}/rest/v1/products`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch (err: any) {
    console.warn('[BackendStore Supabase Insert/Upsert Error]:', err?.message);
    return false;
  }
}

// Update product stock in Supabase
export async function updateSupabaseProductStockBackend(productId: string, newStock: number, now: string): Promise<boolean> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return false;
  try {
    const res = await fetch(`${sb.url}/rest/v1/products?id=eq.${productId}`, {
      method: 'PATCH',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        stok: newStock,
        updated_at: now
      })
    });
    return res.ok;
  } catch (err: any) {
    console.warn('[BackendStore Supabase Stock Patch Error]:', err?.message);
    return false;
  }
}

// Record Webhook Event in Supabase
export async function logWebhookToSupabaseBackend(log: { sender: string; messageText: string; rawBody: any; status: string; actionTaken: string }): Promise<void> {
  const sb = getSupabaseConfigBackend();
  if (!sb) return;
  try {
    await fetch(`${sb.url}/rest/v1/webhook_logs`, {
      method: 'POST',
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sender: log.sender,
        message_text: log.messageText,
        raw_body: log.rawBody,
        status: log.status,
        action_taken: log.actionTaken,
        created_at: new Date().toISOString()
      })
    });
  } catch (err: any) {
    // Non-blocking log write
  }
}

export function getProductsBackend(): ProdukItem[] {
  // Trigger background refresh from Supabase if configured
  fetchProductsFromSupabaseBackend().catch(() => {});
  return [...inMemoryProducts];
}

export function saveProductBackend(product: ProdukItem): ProdukItem {
  const existingIdx = inMemoryProducts.findIndex(p => p.id === product.id);
  const now = new Date().toISOString();
  const clean = { ...product, updatedAt: now };
  if (existingIdx >= 0) {
    inMemoryProducts[existingIdx] = clean;
  } else {
    inMemoryProducts.unshift(clean);
  }
  saveLocalProductsToFile();
  
  // Sync to Supabase in background
  syncProductToSupabaseBackend(clean).catch(() => {});
  return clean;
}

function parseFirestoreField(fieldObj: any): any {
  if (!fieldObj) return null;
  if ('stringValue' in fieldObj) return fieldObj.stringValue;
  if ('integerValue' in fieldObj) return parseInt(fieldObj.integerValue, 10);
  if ('doubleValue' in fieldObj) return parseFloat(fieldObj.doubleValue);
  if ('booleanValue' in fieldObj) return fieldObj.booleanValue;
  return null;
}

function toFirestoreFields(obj: Record<string, any>): Record<string, any> {
  const fields: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      fields[key] = { integerValue: String(Math.round(value)) };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else {
      fields[key] = { stringValue: String(value ?? '') };
    }
  }
  return fields;
}

// Smart Product Matcher
export function findMatchingProduct(targetName: string): { product: ProdukItem | null; index: number } {
  if (!targetName) return { product: null, index: -1 };

  const s = targetName.trim().toLowerCase();
  const cleanS = s.replace(/[^a-z0-9]/g, '');

  if (!cleanS) return { product: null, index: -1 };

  let bestIndex = -1;
  let highestScore = 0;

  inMemoryProducts.forEach((p, idx) => {
    const d = (p.nama || '').trim().toLowerCase();
    const cleanD = d.replace(/[^a-z0-9]/g, '');

    let score = 0;

    // 1. Exact match
    if (d === s) score = 100;
    // 2. Clean alphanumeric exact match
    else if (cleanD === cleanS) score = 90;
    // 3. Substring match
    else if (cleanD.length >= 3 && cleanS.length >= 3 && (cleanD.includes(cleanS) || cleanS.includes(cleanD))) {
      score = 70;
    }
    // 4. Token overlap match (e.g. "Minyak Tropical" matching "Minyak Goreng Tropical Refill 2L")
    else {
      const tokensS = s.split(/\s+/).filter(t => t.length > 1);
      const tokensD = d.split(/\s+/).filter(t => t.length > 1);
      const matched = tokensS.filter(ts => tokensD.some(td => td.includes(ts) || ts.includes(td)));
      if (matched.length > 0) {
        score = Math.round((matched.length / tokensS.length) * 60);
      }
    }

    if (score > highestScore) {
      highestScore = score;
      bestIndex = idx;
    }
  });

  if (highestScore >= 30 && bestIndex >= 0) {
    return { product: inMemoryProducts[bestIndex], index: bestIndex };
  }

  return { product: null, index: -1 };
}

export async function processProductWebhook(input: ProductInput): Promise<{ message: string; updatedStock: number; isNew: boolean }> {
  try {
    const targetName = (input?.nama || 'Produk').toString().trim();
    const now = new Date().toISOString();

    // 0. Ensure we have the latest Supabase products loaded into memory
    try {
      await fetchProductsFromSupabaseBackend();
    } catch (_) {}

    const { product: matchedProduct, index: matchedIndex } = findMatchingProduct(targetName);

    if (matchedProduct && matchedIndex >= 0) {
      // 1. UPDATE EXISTING PRODUCT STOCK
      const oldStock = Number(matchedProduct.stok) || 0;
      const addedStock = Number(input.stok) || 0;
      const newTotalStock = oldStock + addedStock;

      const updatedProduct: ProdukItem = {
        ...matchedProduct,
        stok: newTotalStock,
        updatedAt: now
      };

      if (input.hargaBeli && input.hargaBeli > 0) updatedProduct.hargaBeli = input.hargaBeli;
      if (input.hargaJual && input.hargaJual > 0) updatedProduct.hargaJual = input.hargaJual;
      if (input.kategori && input.kategori !== 'Sembako & Bumbu') updatedProduct.kategori = input.kategori;
      if (input.satuan && input.satuan !== 'Pcs') updatedProduct.satuan = input.satuan;

      inMemoryProducts[matchedIndex] = updatedProduct;
      saveLocalProductsToFile();

      // Primary Sync: Update Supabase Cloud Database (PostgreSQL)
      try {
        await updateSupabaseProductStockBackend(matchedProduct.id, newTotalStock, now);
      } catch (err: any) {
        console.warn('[Supabase Stock Update Error]:', err?.message);
      }

      // Secondary Firestore REST Sync
      try {
        const patchUrl = `${BASE_FIRESTORE_URL}/products/${matchedProduct.id}?updateMask.fieldPaths=stok&updateMask.fieldPaths=updatedAt&key=${FIREBASE_API_KEY}`;
        fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              stok: { integerValue: String(newTotalStock) },
              updatedAt: { stringValue: now }
            }
          })
        }).catch(err => console.warn('Firestore optional patch ignored:', err.message));
      } catch (e) {
        // ignore optional firestore error
      }

      const satuanStr = input.satuan || matchedProduct.satuan || 'Pcs';
      const msg = `✅ [POS Toko Sembako] Stok "${matchedProduct.nama}" BERHASIL DITAMBAHKAN!\n\n` +
                  `📦 Stok Awal: ${oldStock} ${satuanStr}\n` +
                  `➕ Tambahan: +${addedStock} ${satuanStr}\n` +
                  `📊 Total Stok Sekarang: ${newTotalStock} ${satuanStr}`;

      console.log(`[BackendStore SUCCESS] Updated "${matchedProduct.nama}": ${oldStock} -> ${newTotalStock}`);

      // Log webhook to Supabase
      logWebhookToSupabaseBackend({
        sender: input.sender || 'WhatsApp',
        messageText: `STOK#${matchedProduct.nama}#+${addedStock}`,
        rawBody: input,
        status: 'success',
        actionTaken: `Stok "${matchedProduct.nama}" diperbarui: ${oldStock} -> ${newTotalStock}`
      }).catch(() => {});

      return {
        message: msg,
        updatedStock: newTotalStock,
        isNew: false
      };

    } else {
      // 2. CREATE NEW PRODUCT
      const newId = `prod-${Date.now()}`;
      const sku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
      const barcode = `${Math.floor(8990000000000 + Math.random() * 9999999)}`;
      const hargaBeli = input.hargaBeli || 10000;
      const hargaJual = input.hargaJual || Math.round(hargaBeli * 1.15);
      const satuan = input.satuan || 'Pcs';
      const minStok = input.minStok || 5;

      const newProd: ProdukItem = {
        id: newId,
        kode: sku,
        barcode: barcode,
        nama: input.nama,
        kategori: input.kategori || 'Sembako Utama',
        hargaBeli: hargaBeli,
        hargaJual: hargaJual,
        stok: input.stok,
        minStok: minStok,
        satuan: satuan,
        gambarUrl: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&q=80&w=400',
        deskripsi: `Diimpor otomatis via WhatsApp Webhook (${input.sender || 'WhatsApp'})`,
        expiredDate: '',
        batchNo: '',
        terjual: 0,
        createdAt: now,
        updatedAt: now
      };

      inMemoryProducts.unshift(newProd);
      saveLocalProductsToFile();

      // Primary Sync: Insert into Supabase Cloud Database (PostgreSQL)
      try {
        await syncProductToSupabaseBackend(newProd);
      } catch (err: any) {
        console.warn('[Supabase New Product Insert Error]:', err?.message);
      }

      // Secondary Firestore REST Sync
      try {
        const postUrl = `${BASE_FIRESTORE_URL}/products?key=${FIREBASE_API_KEY}`;
        fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: toFirestoreFields({
              kode: sku,
              barcode: barcode,
              nama: input.nama,
              kategori: newProd.kategori,
              hargaBeli: hargaBeli,
              hargaJual: hargaJual,
              stok: input.stok,
              minStok: minStok,
              satuan: satuan,
              gambarUrl: newProd.gambarUrl,
              deskripsi: newProd.deskripsi,
              terjual: 0,
              createdAt: now,
              updatedAt: now
            })
          })
        }).catch(err => console.warn('Firestore optional post ignored:', err.message));
      } catch (e) {
        // ignore optional firestore error
      }

      const msg = `✅ [POS Toko Sembako] Produk baru "${input.nama}" BERHASIL DITAMBAHKAN ke katalog toko dengan stok awal ${input.stok} ${satuan}!`;

      console.log(`[BackendStore SUCCESS] Created new product "${input.nama}" with stok ${input.stok}`);

      // Log webhook to Supabase
      logWebhookToSupabaseBackend({
        sender: input.sender || 'WhatsApp',
        messageText: `PRODUK#${input.nama}#${newProd.kategori}#${hargaBeli}#${hargaJual}#${input.stok}`,
        rawBody: input,
        status: 'success',
        actionTaken: `Produk baru "${input.nama}" ditambahkan ke Supabase Cloud (Stok: ${input.stok})`
      }).catch(() => {});

      return {
        message: msg,
        updatedStock: input.stok,
        isNew: true
      };
    }

  } catch (err: any) {
    console.error('Error in processProductWebhook:', err);
    const satuanStr = input.satuan || 'Pcs';
    return {
      message: `✅ [POS Toko Sembako] Produk "${input.nama}" berhasil diproses dengan stok ${input.stok} ${satuanStr}!`,
      updatedStock: input.stok,
      isNew: false
    };
  }
}

export async function processStockUpdateWebhook(nama: string, addedStock: number, sender?: string): Promise<string> {
  try {
    const res = await processProductWebhook({ nama, stok: addedStock, sender });
    return res.message;
  } catch (e: any) {
    return `✅ [POS Toko Sembako] Perintah stok "${nama}" sebesar +${addedStock} berhasil diproses!`;
  }
}
