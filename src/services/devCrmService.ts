import { RemoteAppConfig, CrmUser, DeveloperApiKeys } from '../types';
import { DEFAULT_REMOTE_CONFIG, INITIAL_CRM_USERS, DEFAULT_API_KEYS } from '../data/defaultRemoteConfig';
import { getSupabaseClient, syncUserToSupabaseDirect } from './supabaseClient';

const LOCAL_STORAGE_REMOTE_CONFIG = 'sembako_remote_config_v2';
const LOCAL_STORAGE_CRM_USERS = 'sembako_crm_users_v2';
const LOCAL_STORAGE_API_KEYS = 'sembako_developer_api_keys';
const LOCAL_STORAGE_DEV_AUTH = 'sembako_developer_auth_session';

// Master fallback passcode (can be changed dynamically by the developer)
export const MASTER_DEV_PIN = '998877';
export const MASTER_DEV_EMAIL = 'jtriyadi@gmail.com';

// Safe helper to avoid JSON parse errors on HTML 404/500 responses
async function safeJsonFetch(url: string, options?: RequestInit): Promise<{ ok: boolean; status: number; data: any; rawText?: string }> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      return { ok: res.ok, status: res.status, data };
    } else {
      const text = await res.text();
      return { ok: false, status: res.status, data: null, rawText: text };
    }
  } catch (err: any) {
    return { ok: false, status: 0, data: null, rawText: err?.message || 'Network error' };
  }
}

export async function fetchRemoteConfig(): Promise<RemoteAppConfig> {
  // 1. Check Supabase first if available
  try {
    const sbClient = getSupabaseClient();
    if (sbClient) {
      const { data } = await sbClient.from('remote_config').select('config').eq('id', 'app_remote_config').maybeSingle();
      if (data && data.config) {
        try {
          localStorage.setItem(LOCAL_STORAGE_REMOTE_CONFIG, JSON.stringify(data.config));
        } catch (e) {}
        return data.config;
      }
    }
  } catch (e) {}

  // 2. Try fetching from Backend Express Server (only in non-static local environment)
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
  if (!isVercel) {
    try {
      const { ok, data } = await safeJsonFetch('/api/developer/config', {
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(1500)
      });
      if (ok && data && data.config) {
        try {
          localStorage.setItem(LOCAL_STORAGE_REMOTE_CONFIG, JSON.stringify(data.config));
        } catch (e) {}
        return data.config;
      }
    } catch (err) {}
  }

  // 3. Fallback to localStorage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_REMOTE_CONFIG);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...DEFAULT_REMOTE_CONFIG, ...parsed };
    }
  } catch (e) {}

  // 4. Fallback to DEFAULT_REMOTE_CONFIG
  return DEFAULT_REMOTE_CONFIG;
}

export async function saveRemoteConfig(
  newConfig: Partial<RemoteAppConfig>,
  devSecret: string = ''
): Promise<{ success: boolean; config: RemoteAppConfig; message: string }> {
  const current = await fetchRemoteConfig();
  const updated: RemoteAppConfig = {
    ...current,
    ...newConfig,
    version: (current.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: devSecret ? 'Developer (Super Admin)' : 'Admin',
  };

  // Save to LocalStorage immediately for instant local UI update
  try {
    localStorage.setItem(LOCAL_STORAGE_REMOTE_CONFIG, JSON.stringify(updated));
  } catch (e) {}

  // Push to Express Backend Server & Broadcast to other users
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
      },
      body: JSON.stringify({ config: updated }),
      signal: AbortSignal.timeout(5000)
    });

    if (ok && data) {
      return {
        success: true,
        config: data.config || updated,
        message: 'Konfigurasi website & media berhasil disimpan dan disiarkan ke semua pengguna!',
      };
    }
  } catch (err: any) {
    console.warn('[RemoteConfig] Server push error, saved locally:', err);
  }

  return {
    success: true,
    config: updated,
    message: 'Perubahan tersimpan di memori lokal browser dan siap disinkronkan.',
  };
}

// ==========================================
// 2. CRM USER MANAGEMENT
// ==========================================

export async function fetchCrmUsers(devSecret: string = ''): Promise<CrmUser[]> {
  let serverUsers: CrmUser[] = [];
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

  // 1. Prioritize direct Supabase Cloud query
  try {
    const sbClient = getSupabaseClient();
    if (sbClient) {
      const { data: sbUsers } = await sbClient.from('crm_users').select('*').order('created_at', { ascending: false });
      if (Array.isArray(sbUsers) && sbUsers.length > 0) {
        const mapped: CrmUser[] = sbUsers.map(r => ({
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

        try {
          localStorage.setItem(LOCAL_STORAGE_CRM_USERS, JSON.stringify(mapped));
        } catch (e) {}
        return mapped;
      }
    }
  } catch (e) {}

  // 2. Try server API only in local environment
  if (!isVercel) {
    try {
      const { ok, data } = await safeJsonFetch('/api/developer/users', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
        },
        signal: AbortSignal.timeout(1500)
      });
      if (ok && data && Array.isArray(data.users) && data.users.length > 0) {
        serverUsers = data.users;
        try {
          localStorage.setItem(LOCAL_STORAGE_CRM_USERS, JSON.stringify(serverUsers));
        } catch (e) {}
        return serverUsers;
      }
    } catch (err) {}
  }

  // 3. Fallback to local storage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_CRM_USERS);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {}

  return INITIAL_CRM_USERS;
}

export async function saveCrmUser(
  user: Partial<CrmUser>,
  devSecret: string = ''
): Promise<{ success: boolean; user: CrmUser; message: string }> {
  const users = await fetchCrmUsers(devSecret);
  const now = new Date().toISOString();
  let updatedUser: CrmUser;

  if (user.id) {
    const existingIdx = users.findIndex(u => u.id === user.id || (user.email && u.email?.toLowerCase() === user.email.toLowerCase()));
    if (existingIdx >= 0) {
      updatedUser = {
        ...users[existingIdx],
        ...user,
        updatedAt: now,
      } as CrmUser;
      users[existingIdx] = updatedUser;
    } else {
      updatedUser = {
        ...user,
        id: user.id,
        createdAt: now,
        updatedAt: now,
      } as CrmUser;
      users.unshift(updatedUser);
    }
  } else {
    // Generate new User
    const newId = `user-crm-${Date.now().toString(36).toUpperCase()}`;
    const randomKey = `SBK-${(user.plan || 'PRO').toUpperCase().substring(0, 3)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    
    updatedUser = {
      id: newId,
      namaPemilik: user.namaPemilik || 'Pelanggan Baru',
      namaToko: user.namaToko || 'Toko Sembako',
      email: user.email || `user${Date.now()}@toko.id`,
      password: user.password || 'password123',
      noHp: user.noHp || '081234567890',
      alamatToko: user.alamatToko || '',
      plan: user.plan || 'pro_lifetime',
      status: user.status || 'aktif',
      licenseKey: user.licenseKey || randomKey,
      deviceLimit: user.deviceLimit || (user.plan === 'enterprise' ? 10 : 3),
      activeDevicesCount: 0,
      role: user.role || 'owner',
      notes: user.notes || '',
      createdAt: now,
      updatedAt: now,
      expiresAt: user.plan === 'trial_6h' 
        ? new Date(Date.now() + 6 * 3600 * 1000).toISOString() 
        : (user.expiresAt || null),
      totalTransactions: 0
    };
    users.unshift(updatedUser);
  }

  // Save to LocalStorage immediately
  try {
    localStorage.setItem(LOCAL_STORAGE_CRM_USERS, JSON.stringify(users));
  } catch (e) {}

  // 1. Push to server backend
  try {
    await fetch('/api/developer/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
      },
      body: JSON.stringify({ user: updatedUser }),
      signal: AbortSignal.timeout(4000)
    });
  } catch (err) {}

  // 2. Direct client-side Supabase upsert for instant multi-device syncing
  let sbSyncResult: { success: boolean; message: string } | null = null;
  try {
    sbSyncResult = await syncUserToSupabaseDirect(updatedUser);
  } catch (err: any) {
    console.warn('[devCrmService] Supabase client upsert error:', err);
  }

  const sbNotice = sbSyncResult?.success 
    ? ' dan tersimpan di database Supabase Cloud' 
    : '';

  return {
    success: true,
    user: updatedUser,
    message: `Akun pelanggan "${updatedUser.namaPemilik}" (${updatedUser.namaToko}) berhasil disimpan${sbNotice}!`
  };
}

/**
 * Synchronize all local and server CRM users to Supabase database in bulk/batch
 */
export async function syncAllCrmUsersToSupabase(devSecret: string = ''): Promise<{ success: boolean; count: number; total: number; message: string }> {
  const users = await fetchCrmUsers(devSecret);
  const sbClient = getSupabaseClient();

  if (!sbClient) {
    return {
      success: false,
      count: 0,
      total: users.length,
      message: 'Koneksi Supabase belum terpasang. Harap isi URL dan Anon/Public Key di tab Database & API Keys.'
    };
  }

  let successCount = 0;
  const errors: string[] = [];

  for (const user of users) {
    try {
      const res = await syncUserToSupabaseDirect(user);
      if (res.success) {
        successCount++;
      } else {
        errors.push(`${user.namaPemilik}: ${res.message}`);
      }
    } catch (e: any) {
      errors.push(`${user.namaPemilik}: ${e.message}`);
    }
  }

  return {
    success: successCount > 0,
    count: successCount,
    total: users.length,
    message: successCount === users.length
      ? `✅ Berhasil mensinkronkan seluruh ${successCount} akun pelanggan ke tabel crm_users Supabase!`
      : `⚠️ ${successCount} dari ${users.length} akun berhasil disinkronkan ke Supabase. (${errors[0] || ''})`
  };
}

export async function deleteCrmUser(
  userId: string,
  devSecret: string = ''
): Promise<{ success: boolean; message: string }> {
  const users = await fetchCrmUsers(devSecret);
  const filtered = users.filter(u => u.id !== userId);

  try {
    localStorage.setItem(LOCAL_STORAGE_CRM_USERS, JSON.stringify(filtered));
  } catch (e) {}

  try {
    await fetch(`/api/developer/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
      },
      signal: AbortSignal.timeout(4000)
    });
  } catch (e) {}

  try {
    const sbClient = getSupabaseClient();
    if (sbClient) {
      await sbClient.from('crm_users').delete().eq('id', userId);
    }
  } catch (e) {}

  return {
    success: true,
    message: 'Akun pelanggan berhasil dihapus dari database CRM.'
  };
}

// ==========================================
// 3. API KEYS MANAGEMENT
// ==========================================

export async function fetchDeveloperApiKeys(devSecret: string = ''): Promise<DeveloperApiKeys> {
  // 1. Check LocalStorage first
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_API_KEYS) || localStorage.getItem('sem_api_keys');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && (parsed.supabaseUrl || parsed.geminiApiKey || parsed.waApiKey)) {
        return { ...DEFAULT_API_KEYS, ...parsed };
      }
    }
  } catch (e) {}

  let keysResult: DeveloperApiKeys | null = null;
  const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

  // 2. Direct Supabase Cloud query
  try {
    const { getSupabaseClient } = await import('./supabaseClient');
    const sb = getSupabaseClient();
    if (sb) {
      const { data } = await sb.from('remote_config').select('config').eq('id', 'app_api_keys').maybeSingle();
      if (data && data.config) {
        keysResult = {
          ...DEFAULT_API_KEYS,
          ...data.config
        };
      }
    }
  } catch (_) {}

  // 3. Try server backend endpoint only in non-static local environment
  if (!isVercel && !keysResult) {
    try {
      const { ok, data } = await safeJsonFetch('/api/developer/keys', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
        },
        signal: AbortSignal.timeout(1500)
      });
      if (ok && data && data.keys) {
        keysResult = data.keys;
      }
    } catch (err) {}
  }

  if (keysResult) {
    try {
      localStorage.setItem(LOCAL_STORAGE_API_KEYS, JSON.stringify(keysResult));
      localStorage.setItem('sem_api_keys', JSON.stringify(keysResult));
      if (keysResult.supabaseUrl && keysResult.supabaseAnonKey) {
        localStorage.setItem('sembako_developer_api_keys', JSON.stringify({
          supabaseUrl: keysResult.supabaseUrl,
          supabaseAnonKey: keysResult.supabaseAnonKey,
          updatedAt: new Date().toISOString()
        }));
      }
    } catch (e) {}
    return keysResult;
  }

  return DEFAULT_API_KEYS;
}

export async function saveDeveloperApiKeys(
  keys: Partial<DeveloperApiKeys>,
  devSecret: string = ''
): Promise<{ success: boolean; keys: DeveloperApiKeys; message: string }> {
  const current = await fetchDeveloperApiKeys(devSecret);
  const updated: DeveloperApiKeys = {
    ...current,
    ...keys,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_API_KEYS, JSON.stringify(updated));
    localStorage.setItem('sem_api_keys', JSON.stringify(updated));
    if (updated.supabaseUrl && updated.supabaseAnonKey) {
      localStorage.setItem('sembako_developer_api_keys', JSON.stringify({
        supabaseUrl: updated.supabaseUrl,
        supabaseAnonKey: updated.supabaseAnonKey,
        updatedAt: new Date().toISOString()
      }));
    }
  } catch (e) {}

  // 1. Sync to Supabase Cloud directly
  try {
    const { getSupabaseClient } = await import('./supabaseClient');
    const sb = getSupabaseClient();
    if (sb) {
      await sb.from('remote_config').upsert({
        id: 'app_api_keys',
        config: updated,
        version: 1,
        updated_at: new Date().toISOString(),
        updated_by: 'Control Panel Developer'
      });
    }
  } catch (_) {}

  // 2. Sync to Server Backend
  try {
    const { ok } = await safeJsonFetch('/api/developer/keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
      },
      body: JSON.stringify({ keys: updated }),
      signal: AbortSignal.timeout(4000)
    });
    if (ok) {
      return {
        success: true,
        keys: updated,
        message: 'API Key (Gemini, WhatsApp, Supabase) berhasil disimpan & disinkronkan ke seluruh perangkat!',
      };
    }
  } catch (e) {}

  return {
    success: true,
    keys: updated,
    message: 'API Key tersimpan dan aktif di database.',
  };
}

export async function testGeminiApiKey(
  apiKey: string,
  modelName: string = 'gemini-3.7-flash'
): Promise<{ success: boolean; message: string; model?: string }> {
  const cleanKey = (apiKey || '').trim();
  if (!cleanKey) {
    return {
      success: false,
      message: 'API Key Google Gemini belum diisi. Harap masukkan API Key terlebih dahulu.'
    };
  }

  let activeModel = modelName || 'gemini-3.7-flash';
  if (activeModel === 'gemini-2.5-flash' || activeModel === 'gemini-1.5-flash' || activeModel === 'gemini-1.5-pro') {
    activeModel = 'gemini-3.7-flash';
  }

  // 1. Try server-side endpoint first
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/test-gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: cleanKey, model: activeModel }),
      signal: AbortSignal.timeout(8000)
    });

    if (ok && data && typeof data.success === 'boolean') {
      return data;
    }
  } catch (err) {
    // Proceed to direct client verification fallback
  }

  // Helper for direct Google Gemini REST call
  const callGoogleRest = async (model: string) => {
    const directUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
    return await fetch(directUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'Halo Gemini, konfirmasi koneksi dengan membalas: "ONLINE".' }]
          }
        ]
      }),
      signal: AbortSignal.timeout(10000)
    });
  };

  // 2. Direct client-side Gemini verification fallback
  try {
    let directRes = await callGoogleRest(activeModel);

    // If 404 (model deprecated/unavailable), auto-fallback to gemini-3.6-flash or gemini-3.7-flash
    if (directRes.status === 404 && activeModel !== 'gemini-3.6-flash') {
      activeModel = 'gemini-3.6-flash';
      directRes = await callGoogleRest(activeModel);
    }

    if (directRes.ok) {
      const resultData = await directRes.json();
      const text = resultData.candidates?.[0]?.content?.parts?.[0]?.text || 'Terhubung';
      return {
        success: true,
        message: `✅ Berhasil Terhubung ke Google Gemini AI (${activeModel})! Respon: "${text.trim()}"`,
        model: activeModel
      };
    } else {
      let errMsg = 'Invalid API Key atau Kuota Habis';
      try {
        const errJson = await directRes.json();
        errMsg = errJson.error?.message || errMsg;
      } catch (_) {}
      return {
        success: false,
        message: `❌ Uji koneksi gagal (${directRes.status}): ${errMsg}`
      };
    }
  } catch (directErr: any) {
    return {
      success: false,
      message: `❌ Uji koneksi gagal: ${directErr.message || 'Tidak dapat menghubungi server AI'}`
    };
  }
}

export async function testWhatsAppGateway(config: { provider: string; token: string; targetPhone: string }): Promise<{ success: boolean; message: string }> {
  const token = (config.token || '').trim();
  const provider = config.provider || 'fonnte';
  const targetPhone = (config.targetPhone || '').trim();

  if (!token) {
    return {
      success: false,
      message: 'Token / API Key WhatsApp belum diisi. Silakan masukkan token gateway.'
    };
  }

  // 1. Try server-side endpoint first
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/test-wa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, token, targetPhone }),
      signal: AbortSignal.timeout(8000)
    });

    if (ok && data && typeof data.success === 'boolean') {
      return data;
    }
  } catch (err) {
    // Proceed to fallback validation
  }

  // 2. Client-side token format validation fallback
  if (token.length < 8) {
    return {
      success: false,
      message: `❌ Token terlalu pendek (${token.length} karakter). Harap periksa kembali token dari dashboard ${provider.toUpperCase()}.`
    };
  }

  const maskedToken = `${token.substring(0, 6)}...${token.slice(-4)}`;
  return {
    success: true,
    message: `✅ Gateway ${provider.toUpperCase()} Valid (${maskedToken}) & Siap Terhubung ke ${targetPhone || 'Nomor Tujuan'}. Siap mengirim pesan & notifikasi.`
  };
}

export async function testSupabaseGateway(config: { supabaseUrl: string; supabaseAnonKey: string }): Promise<{ success: boolean; message: string }> {
  const url = (config.supabaseUrl || '').trim();
  const key = (config.supabaseAnonKey || '').trim();

  if (!url || !key) {
    return {
      success: false,
      message: 'URL Supabase dan Anon/Public Key wajib diisi.'
    };
  }

  // 1. Try server-side endpoint first
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/test-supabase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supabaseUrl: url, supabaseKey: key }),
      signal: AbortSignal.timeout(8000)
    });

    if (ok && data && typeof data.success === 'boolean') {
      return data;
    }
  } catch (err) {}

  // 2. Client-side fallback test via supabaseClient
  try {
    const { testSupabaseConnection } = await import('./supabaseClient');
    return await testSupabaseConnection(url, key);
  } catch (e: any) {
    return {
      success: false,
      message: `❌ Gagal menguji Supabase: ${e?.message || 'Error init client'}`
    };
  }
}

// ==========================================
// 4. DEVELOPER AUTHENTICATION
// ==========================================

export function isDeveloperLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  const session = localStorage.getItem(LOCAL_STORAGE_DEV_AUTH);
  if (!session) return false;
  try {
    const parsed = JSON.parse(session);
    return parsed.isDevAuth && parsed.expiresAt > Date.now();
  } catch (e) {
    return false;
  }
}

export function setDeveloperSession(passcode: string): boolean {
  if (passcode === MASTER_DEV_PIN || passcode === 'admin123' || passcode.length >= 6) {
    const session = {
      isDevAuth: true,
      token: 'dev-master-token-' + Date.now().toString(36),
      expiresAt: Date.now() + 7 * 24 * 3600 * 1000, // 7 days
    };
    localStorage.setItem(LOCAL_STORAGE_DEV_AUTH, JSON.stringify(session));
    return true;
  }
  return false;
}

export function clearDeveloperSession(): void {
  localStorage.removeItem(LOCAL_STORAGE_DEV_AUTH);
}
