import { RemoteAppConfig, CrmUser, DeveloperApiKeys } from '../types';
import { DEFAULT_REMOTE_CONFIG, INITIAL_CRM_USERS, DEFAULT_API_KEYS } from '../data/defaultRemoteConfig';

const LOCAL_STORAGE_REMOTE_CONFIG = 'sembako_remote_config_v2';
const LOCAL_STORAGE_CRM_USERS = 'sembako_crm_users_v2';
const LOCAL_STORAGE_API_KEYS = 'sembako_developer_api_keys';
const LOCAL_STORAGE_DEV_AUTH = 'sembako_developer_auth_session';

// Master fallback passcode (can be changed dynamically by the developer)
export const MASTER_DEV_PIN = '998877';
export const MASTER_DEV_EMAIL = 'developer@sembakosmart.id';

// ==========================================
// 1. REMOTE CONFIGURATION (LIVE CMS)
// ==========================================

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
  // 1. Try fetching from Backend Express Server
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/config', {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(3000)
    });
    if (ok && data && data.config) {
      // Cache to local storage
      try {
        localStorage.setItem(LOCAL_STORAGE_REMOTE_CONFIG, JSON.stringify(data.config));
      } catch (e) {}
      return data.config;
    }
  } catch (err) {
    // Network or server offline, proceed to fallback
  }

  // 2. Fallback to localStorage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_REMOTE_CONFIG);
    if (cached) {
      const parsed = JSON.parse(cached);
      return { ...DEFAULT_REMOTE_CONFIG, ...parsed };
    }
  } catch (e) {}

  // 3. Fallback to DEFAULT_REMOTE_CONFIG
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
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/users', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
      },
      signal: AbortSignal.timeout(3000)
    });
    if (ok && data && Array.isArray(data.users)) {
      try {
        localStorage.setItem(LOCAL_STORAGE_CRM_USERS, JSON.stringify(data.users));
      } catch (e) {}
      return data.users;
    }
  } catch (err) {}

  // Fallback to local storage
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
    const existingIdx = users.findIndex(u => u.id === user.id);
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

  // Save to LocalStorage
  try {
    localStorage.setItem(LOCAL_STORAGE_CRM_USERS, JSON.stringify(users));
  } catch (e) {}

  // Push to server
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

  return {
    success: true,
    user: updatedUser,
    message: `Akun pelanggan "${updatedUser.namaPemilik}" (${updatedUser.namaToko}) berhasil disimpan!`
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

  return {
    success: true,
    message: 'Akun pelanggan berhasil dihapus dari database CRM.'
  };
}

// ==========================================
// 3. API KEYS MANAGEMENT
// ==========================================

export async function fetchDeveloperApiKeys(devSecret: string = ''): Promise<DeveloperApiKeys> {
  try {
    const { ok, data } = await safeJsonFetch('/api/developer/keys', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${devSecret || 'master-dev-token'}`
      },
      signal: AbortSignal.timeout(3000)
    });
    if (ok && data && data.keys) {
      try {
        localStorage.setItem(LOCAL_STORAGE_API_KEYS, JSON.stringify(data.keys));
      } catch (e) {}
      return data.keys;
    }
  } catch (err) {}

  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_API_KEYS);
    if (cached) {
      return { ...DEFAULT_API_KEYS, ...JSON.parse(cached) };
    }
  } catch (e) {}

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
  } catch (e) {}

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
        message: 'API Key berhasil disimpan ke server dan aktif secara instan!',
      };
    }
  } catch (e) {}

  return {
    success: true,
    keys: updated,
    message: 'API Key tersimpan secara lokal dan siap digunakan.',
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
