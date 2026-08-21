import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProdukItem, TransaksiItem, CrmUser } from '../types';

let cachedClient: SupabaseClient | null = null;
let currentConfigKey = '';

// Active Realtime Channel Registry
const activeChannels = new Map<string, any>();

/**
 * STORE ID / TENANT ID MANAGEMENT
 * Ensures deterministic, persistent store identification for multi-device sync
 */
const DEFAULT_STORE_ID = 'default_store';
const STORAGE_STORE_ID_KEY = 'sembako_current_store_id';

export function getCurrentStoreId(): string {
  if (typeof window === 'undefined') return DEFAULT_STORE_ID;
  try {
    const saved = localStorage.getItem(STORAGE_STORE_ID_KEY);
    if (saved && saved.trim()) return saved.trim();

    // Fallback: derive from license key or active store user
    const licKey = localStorage.getItem('sembako_license_key');
    if (licKey && licKey.trim()) {
      const cleanLic = licKey.trim().toUpperCase();
      const derived = `store_${cleanLic.replace(/[^A-Z0-9]/g, '_').toLowerCase()}`;
      localStorage.setItem(STORAGE_STORE_ID_KEY, derived);
      return derived;
    }

    const savedStore = localStorage.getItem('sembako_license_store');
    if (savedStore && savedStore.trim()) {
      const derived = `store_${savedStore.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      localStorage.setItem(STORAGE_STORE_ID_KEY, derived);
      return derived;
    }
  } catch (_) {}
  return DEFAULT_STORE_ID;
}

export function setCurrentStoreId(storeId: string): void {
  if (!storeId || typeof window === 'undefined') return;
  const cleanId = storeId.trim();
  try {
    localStorage.setItem(STORAGE_STORE_ID_KEY, cleanId);
    console.log(`[Supabase Store Tenant] Active Store ID set to: "${cleanId}"`);
  } catch (_) {}
}

export function getEffectiveStoreId(userOrProfile?: any): string {
  if (userOrProfile) {
    if (userOrProfile.storeId && userOrProfile.storeId.trim()) {
      return userOrProfile.storeId.trim();
    }
    if (userOrProfile.licenseKey && userOrProfile.licenseKey.trim()) {
      return `store_${userOrProfile.licenseKey.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').toLowerCase()}`;
    }
    if (userOrProfile.namaToko && userOrProfile.namaToko.trim()) {
      return `store_${userOrProfile.namaToko.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
    }
    if (userOrProfile.id && String(userOrProfile.id).startsWith('user-')) {
      return `store_${String(userOrProfile.id).replace('user-', '')}`;
    }
  }
  return getCurrentStoreId();
}

/**
 * Structured Supabase Logging
 */
export function logSupabase(type: 'connected' | 'query' | 'error' | 'realtime' | 'sync', message: string, extra?: any): void {
  const prefix = `[Supabase ${type.toUpperCase()}]`;
  if (type === 'error') {
    console.error(`${prefix} ❌ ${message}`, extra !== undefined ? extra : '');
  } else if (type === 'realtime') {
    console.log(`%c${prefix} ⚡ ${message}`, 'color: #06b6d4; font-weight: bold;', extra !== undefined ? extra : '');
  } else if (type === 'connected') {
    console.log(`%c${prefix} 🟢 ${message}`, 'color: #10b981; font-weight: bold;', extra !== undefined ? extra : '');
  } else {
    console.log(`${prefix} ℹ️ ${message}`, extra !== undefined ? extra : '');
  }
}

import { 
  encryptPairingPayload, 
  decryptPairingPayload, 
  PairingPayload 
} from '../utils/pairingCrypto';

/**
 * Auto-discovery for Multi-Device connection:
 * 1. Checks Encrypted Pairing Token (?pair=... / ?token=... / ?p=...)
 * 2. Checks Short Pairing Code (?p=123456)
 * 3. Checks URL Query Parameters (legacy fallback)
 * 4. If local keys are empty, fetches public keys from server (/api/public/supabase-config)
 */
export async function initPublicSupabaseConfig(): Promise<SupabaseClient | null> {
  if (typeof window === 'undefined') return null;

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    
    // A. Encrypted Pairing Token or Short Code (?pair=... | ?token=... | ?p=...)
    const rawPairToken = urlParams.get('pair') || urlParams.get('token') || hashParams.get('pair') || hashParams.get('token');
    const rawShortCode = urlParams.get('p') || hashParams.get('p');

    let resolvedPayload: PairingPayload | null = null;

    // 1. Try decrypting if token exists
    if (rawPairToken) {
      resolvedPayload = decryptPairingPayload(rawPairToken);
      if (!resolvedPayload || (!resolvedPayload.supabaseUrl && !resolvedPayload.geminiApiKey)) {
        // Also try resolving via server if it's a short code or session ID
        try {
          const res = await fetch(`/api/public/pairing-session/${encodeURIComponent(rawPairToken)}`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (data && data.payload) {
              resolvedPayload = data.payload;
            }
          }
        } catch (_) {}
      }
    } else if (rawShortCode) {
      // Check if it's an encrypted string or 6-digit code
      const decrypted = decryptPairingPayload(rawShortCode);
      if (decrypted && (decrypted.supabaseUrl || decrypted.geminiApiKey)) {
        resolvedPayload = decrypted;
      } else {
        // Resolve from backend short pairing session endpoint
        try {
          const res = await fetch(`/api/public/pairing-session/${encodeURIComponent(rawShortCode)}`, { signal: AbortSignal.timeout(3000) });
          if (res.ok) {
            const data = await res.json();
            if (data && data.payload) {
              resolvedPayload = data.payload;
            }
          }
        } catch (_) {}
      }
    }

    // 2. If resolved from encrypted token / short code
    if (resolvedPayload && (resolvedPayload.supabaseUrl || resolvedPayload.geminiApiKey)) {
      console.log('[Device Auto-Pairing] Kredensial terenkripsi berhasil diurai!');
      const cleanUrl = sanitizeSupabaseUrl(resolvedPayload.supabaseUrl || '');
      const cleanKey = sanitizeSupabaseKey(resolvedPayload.supabaseAnonKey || '');
      
      const toSave: any = {
        updatedAt: new Date().toISOString()
      };
      if (cleanUrl) toSave.supabaseUrl = cleanUrl;
      if (cleanKey) toSave.supabaseAnonKey = cleanKey;
      if (resolvedPayload.geminiApiKey) toSave.geminiApiKey = resolvedPayload.geminiApiKey.trim();
      if (resolvedPayload.waApiKey) toSave.waApiKey = resolvedPayload.waApiKey.trim();
      if (resolvedPayload.waGatewayProvider) toSave.waGatewayProvider = resolvedPayload.waGatewayProvider.trim();
      if (resolvedPayload.waSenderNumber) toSave.waSenderNumber = resolvedPayload.waSenderNumber.trim();
      
      try {
        const existing = JSON.parse(localStorage.getItem('sem_api_keys') || '{}');
        const merged = { ...existing, ...toSave };
        localStorage.setItem('sembako_developer_api_keys', JSON.stringify(merged));
        localStorage.setItem('sem_api_keys', JSON.stringify(merged));
      } catch (_) {
        localStorage.setItem('sembako_developer_api_keys', JSON.stringify(toSave));
        localStorage.setItem('sem_api_keys', JSON.stringify(toSave));
      }

      if (resolvedPayload.storeId) {
        setCurrentStoreId(resolvedPayload.storeId);
      }

      // Sembunyikan dan bersihkan URL browser seketika agar aman dan tidak terlihat pelanggan
      try {
        const cleanHref = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanHref);
      } catch (_) {}

      if (cleanUrl && cleanKey) {
        return getSupabaseClient(cleanUrl, cleanKey);
      }
    }

    // B. Legacy URL parameters fallback (?sb_url=...&sb_key=...)
    const paramUrl = urlParams.get('sb_url') || hashParams.get('sb_url');
    const paramKey = urlParams.get('sb_key') || hashParams.get('sb_key');
    const paramStore = urlParams.get('store_id') || urlParams.get('store') || hashParams.get('store_id');
    const paramGemini = urlParams.get('gemini_key') || hashParams.get('gemini_key');
    const paramWaKey = urlParams.get('wa_key') || hashParams.get('wa_key');
    const paramWaProvider = urlParams.get('wa_provider') || hashParams.get('wa_provider');
    const paramWaSender = urlParams.get('wa_sender') || hashParams.get('wa_sender');

    if (paramUrl && paramKey) {
      console.log('[Device Auto-Pairing] Parameter koneksi ditemukan di URL! Menyimpan kredensial...');
      const cleanUrl = sanitizeSupabaseUrl(paramUrl);
      const cleanKey = sanitizeSupabaseKey(paramKey);
      
      const toSave: any = {
        supabaseUrl: cleanUrl,
        supabaseAnonKey: cleanKey,
        updatedAt: new Date().toISOString()
      };

      if (paramGemini) toSave.geminiApiKey = paramGemini.trim();
      if (paramWaKey) toSave.waApiKey = paramWaKey.trim();
      if (paramWaProvider) toSave.waGatewayProvider = paramWaProvider.trim();
      if (paramWaSender) toSave.waSenderNumber = paramWaSender.trim();
      
      try {
        const existing = JSON.parse(localStorage.getItem('sem_api_keys') || '{}');
        const merged = { ...existing, ...toSave };
        localStorage.setItem('sembako_developer_api_keys', JSON.stringify(merged));
        localStorage.setItem('sem_api_keys', JSON.stringify(merged));
      } catch (_) {
        localStorage.setItem('sembako_developer_api_keys', JSON.stringify(toSave));
        localStorage.setItem('sem_api_keys', JSON.stringify(toSave));
      }
      
      if (paramStore) {
        setCurrentStoreId(paramStore);
      }

      // Bersihkan URL bar segera
      try {
        const cleanHref = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanHref);
      } catch (_) {}

      return getSupabaseClient(cleanUrl, cleanKey);
    }
  } catch (_) {}

  // 2. Check if we already have local keys
  const existingClient = getSupabaseClient();
  if (existingClient) {
    return existingClient;
  }

  // 3. Auto-fetch from Server Backend public endpoint (only in non-static local environment)
  try {
    if (typeof window !== 'undefined' && !window.location.hostname.includes('vercel.app')) {
      const res = await fetch('/api/public/supabase-config', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.configured && data.supabaseUrl && data.supabaseAnonKey) {
          console.log('[Supabase Auto-Discovery] Berhasil mendapatkan konfigurasi Supabase dari server!');
          const toSave = {
            supabaseUrl: sanitizeSupabaseUrl(data.supabaseUrl),
            supabaseAnonKey: sanitizeSupabaseKey(data.supabaseAnonKey),
            updatedAt: new Date().toISOString()
          };
          localStorage.setItem('sembako_developer_api_keys', JSON.stringify(toSave));
          localStorage.setItem('sem_api_keys', JSON.stringify(toSave));
          return getSupabaseClient(toSave.supabaseUrl, toSave.supabaseAnonKey);
        }
      }
    }
  } catch (_) {}

  return null;
}

// Auto-run discovery in browser environment
if (typeof window !== 'undefined') {
  setTimeout(() => {
    initPublicSupabaseConfig().catch(() => {});
  }, 100);
}

/**
 * Generate Encrypted 1-Click Pairing URL for other devices
 * Encrypts all sensitive keys so they are not exposed in plaintext.
 */
export function generateDevicePairingUrl(customStoreId?: string): string {
  if (typeof window === 'undefined') return '';
  
  let localKeys: any = {};
  try {
    const rawDevKeys = localStorage.getItem('sembako_developer_api_keys');
    const rawSemKeys = localStorage.getItem('sem_api_keys');
    if (rawDevKeys) localKeys = { ...localKeys, ...JSON.parse(rawDevKeys) };
    if (rawSemKeys) localKeys = { ...localKeys, ...JSON.parse(rawSemKeys) };
  } catch (_) {}

  const env = (import.meta as any).env || {};
  const url = (localKeys.supabaseUrl || env.VITE_SUPABASE_URL || '').trim();
  const key = (localKeys.supabaseAnonKey || env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '').trim();
  const activeStore = customStoreId || getCurrentStoreId();

  const payload: PairingPayload = {
    supabaseUrl: url || undefined,
    supabaseAnonKey: key || undefined,
    storeId: activeStore,
    geminiApiKey: localKeys.geminiApiKey || undefined,
    waApiKey: localKeys.waApiKey || undefined,
    waGatewayProvider: localKeys.waGatewayProvider || 'fonnte',
    waSenderNumber: localKeys.waSenderNumber || undefined,
    createdAt: Date.now()
  };

  const encryptedToken = encryptPairingPayload(payload);
  const origin = window.location.origin + window.location.pathname;

  if (encryptedToken) {
    return `${origin}?pair=${encryptedToken}`;
  }

  // Fallback
  return `${origin}?store_id=${encodeURIComponent(activeStore)}`;
}

/**
 * Generate Server-Backed Short 6-Digit Pairing Session
 */
export async function createShortPairingSession(customStoreId?: string): Promise<{ code: string; shortUrl: string; encryptedUrl: string }> {
  if (typeof window === 'undefined') return { code: '', shortUrl: '', encryptedUrl: '' };

  let localKeys: any = {};
  try {
    const rawDevKeys = localStorage.getItem('sembako_developer_api_keys');
    const rawSemKeys = localStorage.getItem('sem_api_keys');
    if (rawDevKeys) localKeys = { ...localKeys, ...JSON.parse(rawDevKeys) };
    if (rawSemKeys) localKeys = { ...localKeys, ...JSON.parse(rawSemKeys) };
  } catch (_) {}

  const env = (import.meta as any).env || {};
  const activeStore = customStoreId || getCurrentStoreId();

  const payload: PairingPayload = {
    supabaseUrl: (localKeys.supabaseUrl || env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim(),
    supabaseAnonKey: (localKeys.supabaseAnonKey || env.VITE_SUPABASE_ANON_KEY || '').trim(),
    storeId: activeStore,
    geminiApiKey: localKeys.geminiApiKey || undefined,
    waApiKey: localKeys.waApiKey || undefined,
    waGatewayProvider: localKeys.waGatewayProvider || 'fonnte',
    waSenderNumber: localKeys.waSenderNumber || undefined,
  };

  const encryptedUrl = generateDevicePairingUrl(customStoreId);
  const origin = window.location.origin + window.location.pathname;

  try {
    const res = await fetch('/api/public/pairing-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload, storeId: activeStore }),
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.code) {
        return {
          code: data.code,
          shortUrl: `${origin}?p=${data.code}`,
          encryptedUrl
        };
      }
    }
  } catch (_) {}

  return {
    code: '',
    shortUrl: encryptedUrl,
    encryptedUrl
  };
}

/**
 * Generate QR Code Image URL for fast smartphone/tablet scanning
 */
export function generateDevicePairingQrUrl(pairingUrl: string): string {
  if (!pairingUrl) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(pairingUrl)}`;
}

/**
 * Get active Supabase client with fallback hierarchy:
 * 1. Explicit arguments
 * 2. LocalStorage / Control Panel API keys (sembako_developer_api_keys, sem_api_keys, etc.)
 * 3. Vite environment variables (VITE_SUPABASE_URL, SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_PUBLISHABLE_KEY)
 */
export function getSupabaseClient(overrideUrl?: string, overrideKey?: string): SupabaseClient | null {
  const env = (import.meta as any).env || {};
  
  // Check localStorage for dynamically configured Supabase in Control Panel
  let localKeys: any = {};
  try {
    const rawDevKeys = localStorage.getItem('sembako_developer_api_keys');
    const rawSemKeys = localStorage.getItem('sem_api_keys');
    const rawRemote = localStorage.getItem('sembako_remote_config_v2');

    if (rawDevKeys) {
      localKeys = { ...localKeys, ...JSON.parse(rawDevKeys) };
    }
    if (rawSemKeys) {
      localKeys = { ...localKeys, ...JSON.parse(rawSemKeys) };
    }
    if (rawRemote) {
      const parsedRemote = JSON.parse(rawRemote);
      if (parsedRemote.apiKeys) {
        localKeys = { ...localKeys, ...parsedRemote.apiKeys };
      }
    }
  } catch (_) {}

  let url = (
    overrideUrl ||
    localKeys.supabaseUrl ||
    env.VITE_SUPABASE_URL ||
    ''
  ).trim();

  let key = (
    overrideKey ||
    localKeys.supabaseAnonKey ||
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

  url = sanitizeSupabaseUrl(url);
  key = sanitizeSupabaseKey(key);

  if (!url || !key) {
    return null;
  }

  const configSignature = `${url}:::${key}`;
  if (cachedClient && currentConfigKey === configSignature) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    currentConfigKey = configSignature;
    logSupabase('connected', `Koneksi Supabase aktif (${url})`);
    return cachedClient;
  } catch (err) {
    logSupabase('error', 'Inisialisasi klien Supabase gagal', err);
    return null;
  }
}

/**
 * Realtime Multi-Device Table Subscription
 * Listens for postgres_changes on specific table with automatic reconnect & filter
 */
export function subscribeRealtimeTable(
  tableName: string,
  storeId: string,
  onChange: (payload: any) => void
): () => void {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return () => {};
  }

  const channelKey = `${tableName}_${storeId || 'all'}`;
  
  // Clean up any existing channel with same key
  if (activeChannels.has(channelKey)) {
    try {
      supabase.removeChannel(activeChannels.get(channelKey));
    } catch (_) {}
  }

  try {
    const channel = supabase.channel(`realtime_${channelKey}`);

    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: tableName,
        },
        (payload) => {
          logSupabase('realtime', `Perubahan diterima pada tabel "${tableName}" (event: ${payload.eventType})`, payload);
          // Check if payload row matches store_id or is general
          const row = (payload.new as any) || (payload.old as any);
          if (!row || !row.store_id || row.store_id === storeId || row.store_id === DEFAULT_STORE_ID || !storeId) {
            onChange(payload);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          logSupabase('realtime', `Tersambung Realtime ke tabel "${tableName}" (Store ID: ${storeId || 'all'})`);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          // Graceful status - WebSockets might be inactive or restricted in container/iframe sandbox, background sync polling handles updates seamlessly
          logSupabase('realtime', `Status Realtime [${status}] tabel "${tableName}". Sinkronisasi polling otomatis aktif.`);
        } else if (err) {
          logSupabase('realtime', `Info Realtime "${tableName}": ${err.message || status}`);
        }
      });

    activeChannels.set(channelKey, channel);

    return () => {
      try {
        supabase.removeChannel(channel);
        activeChannels.delete(channelKey);
      } catch (_) {}
    };
  } catch (err) {
    logSupabase('realtime', `Notice subscribe realtime ke tabel ${tableName}:`, err);
    return () => {};
  }
}

/**
 * Detects if a PostgREST error is due to a missing column (e.g. store_id not yet migrated in Postgres)
 */
export function isMissingColumnError(error: any): boolean {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  const code = String(error.code || '');
  return (
    code === '42703' || // Postgres undefined_column error code
    msg.includes('does not exist') ||
    msg.includes('column') ||
    msg.includes('store_id')
  );
}

/**
 * Robust table query helper:
 * 1. Tries filtering by store_id
 * 2. If store_id column does not exist (code 42703), automatically queries without filter
 */
export async function queryTableWithFallback(
  supabase: SupabaseClient,
  tableName: string,
  storeId?: string,
  orderColumn: string = 'created_at',
  ascending: boolean = false
): Promise<{ data: any[] | null; error: any }> {
  try {
    let q = supabase.from(tableName).select('*');
    if (storeId && storeId !== 'all') {
      q = q.or(`store_id.eq.${storeId},store_id.eq.default_store,store_id.is.null`);
    }
    const res = await q.order(orderColumn, { ascending });
    if (!res.error) {
      return res;
    }
    if (isMissingColumnError(res.error)) {
      // Column store_id not present yet in remote DB, fetch all rows cleanly with standard schema
      logSupabase('query', `Tabel "${tableName}" menggunakan skema standar (kolom store_id belum dimigrasi).`);
      const fallbackRes = await supabase.from(tableName).select('*').order(orderColumn, { ascending });
      return fallbackRes;
    }
    return res;
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Robust table count helper:
 * 1. Tries count with store_id filter
 * 2. If 42703, falls back to count all rows
 */
export async function countTableWithFallback(
  supabase: SupabaseClient,
  tableName: string,
  storeId?: string
): Promise<number> {
  try {
    let q = supabase.from(tableName).select('id', { count: 'exact', head: true });
    if (storeId && storeId !== 'all') {
      q = q.or(`store_id.eq.${storeId},store_id.eq.default_store,store_id.is.null`);
    }
    const res = await q;
    if (!res.error && typeof res.count === 'number') {
      return res.count;
    }
    if (isMissingColumnError(res.error)) {
      const fallbackRes = await supabase.from(tableName).select('id', { count: 'exact', head: true });
      return fallbackRes.count || 0;
    }
    return res.count || 0;
  } catch (_) {
    return 0;
  }
}

/**
 * Robust table upsert helper:
 * 1. Tries upserting with full columns including store_id
 * 2. If 42703, strips store_id and retries upserting with standard columns
 */
export async function upsertWithColumnFallback(
  supabase: SupabaseClient,
  tableName: string,
  rows: Record<string, any> | Record<string, any>[],
  onConflict: string = 'id'
): Promise<{ data: any; error: any }> {
  try {
    const records = Array.isArray(rows) ? rows : [rows];
    const res = await supabase.from(tableName).upsert(records, { onConflict });
    if (!res.error) {
      return res;
    }
    if (isMissingColumnError(res.error)) {
      logSupabase('query', `Menyimpan data "${tableName}" dengan kompatibilitas skema standar...`);
      const stripped = records.map(({ store_id, ...rest }) => rest);
      const fallbackRes = await supabase.from(tableName).upsert(stripped, { onConflict });
      return fallbackRes;
    }
    return res;
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Sync single CRM user to Supabase table crm_users with automatic column adaptation
 */
export async function syncUserToSupabaseDirect(user: CrmUser): Promise<{ success: boolean; message: string }> {
  const sbClient = getSupabaseClient();
  if (!sbClient) {
    return {
      success: false,
      message: 'Klien Supabase belum aktif. Pastikan URL dan API Key telah dikonfigurasi di menu Database & API Keys.',
    };
  }

  const storeId = user.storeId || getEffectiveStoreId(user);

  try {
    // 1. Try full schema record
    const fullRecord: Record<string, any> = {
      id: user.id || `user-crm-${Date.now()}`,
      store_id: storeId,
      nama_pemilik: user.namaPemilik || 'Pelanggan Toko',
      nama_toko: user.namaToko || 'Toko Sembako',
      email: user.email || '',
      password: user.password || 'password123',
      no_hp: user.noHp || null,
      alamat_toko: user.alamatToko || null,
      plan: user.plan || 'pro_lifetime',
      status: user.status || 'aktif',
      license_key: user.licenseKey || null,
      device_limit: user.deviceLimit || 3,
      active_devices_count: user.activeDevicesCount || 0,
      role: user.role || 'owner',
      notes: user.notes || null,
      expires_at: user.expiresAt || null,
      created_at: user.createdAt || new Date().toISOString(),
      updated_at: user.updatedAt || new Date().toISOString(),
    };

    const { error: fullErr } = await sbClient.from('crm_users').upsert(fullRecord, { onConflict: 'id' });

    if (!fullErr) {
      logSupabase('sync', `Akun CRM "${user.namaPemilik}" tersimpan di crm_users (Store: ${storeId})`);
      return {
        success: true,
        message: `✅ Akun "${user.namaPemilik}" berhasil disinkronkan ke tabel crm_users Supabase!`,
      };
    }

    logSupabase('error', 'Upsert crm_users schema lengkap gagal, mencoba kolom standar', fullErr.message);

    // 2. Fallback to basic columns
    const basicRecord: Record<string, any> = {
      id: user.id || `user-crm-${Date.now()}`,
      nama_pemilik: user.namaPemilik || 'Pelanggan Toko',
      nama_toko: user.namaToko || 'Toko Sembako',
      email: user.email || '',
      password: user.password || 'password123',
    };

    const { error: basicErr } = await sbClient.from('crm_users').upsert(basicRecord, { onConflict: 'id' });

    if (!basicErr) {
      return {
        success: true,
        message: `✅ Akun "${user.namaPemilik}" tersimpan di Supabase (kolom standar)!`,
      };
    }

    return {
      success: false,
      message: `Gagal simpan ke Supabase: ${basicErr.message || fullErr.message}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Exception Supabase: ${err.message || 'Koneksi gagal'}`,
    };
  }
}

function sanitizeSupabaseKey(raw: string): string {
  if (!raw) return '';
  let k = raw.trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  if (k.toLowerCase().startsWith('bearer ')) {
    k = k.slice(7).trim();
  }
  return k;
}

function sanitizeSupabaseUrl(raw: string): string {
  if (!raw) return '';
  let u = raw.trim();
  if ((u.startsWith('"') && u.endsWith('"')) || (u.startsWith("'") && u.endsWith("'"))) {
    u = u.slice(1, -1).trim();
  }
  u = u.replace(/\/+$/, '');
  return u;
}

/**
 * Test connectivity to Supabase instance
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string; projectUrl?: string; tables?: string[] }> {
  const cleanUrl = sanitizeSupabaseUrl(url);
  const cleanKey = sanitizeSupabaseKey(anonKey);

  if (!cleanUrl || !cleanKey) {
    return {
      success: false,
      message: 'URL Supabase dan Anon/Public Key wajib diisi.',
    };
  }

  // Validate URL format
  if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
    return {
      success: false,
      message: 'Format URL Supabase tidak valid. Contoh yang benar: https://abcdefghijklmn.supabase.co',
    };
  }

  try {
    // 1. First test official Supabase Auth/GoTrue Settings endpoint (verifies API Key signature)
    let authValid = false;
    let authErrorDetail = '';
    try {
      const authSettingsRes = await fetch(`${cleanUrl}/auth/v1/settings`, {
        method: 'GET',
        headers: {
          apikey: cleanKey,
          Authorization: `Bearer ${cleanKey}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      if (authSettingsRes.ok) {
        authValid = true;
      } else if (authSettingsRes.status === 401 || authSettingsRes.status === 403) {
        const errJson = await authSettingsRes.json().catch(() => ({}));
        authErrorDetail = errJson.message || errJson.msg || 'Invalid API Key';
      }
    } catch (_) {}

    // 2. Test PostgREST table query with Supabase JS Client
    const tempClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    const { data: prodData, error: queryErr } = await tempClient
      .from('products')
      .select('id')
      .limit(1);

    // If query succeeded or failed ONLY because table doesn't exist yet (42P01)
    const isTableMissing = queryErr?.message?.toLowerCase().includes('does not exist') ||
                           queryErr?.code === '42P01' ||
                           queryErr?.code === 'PGRST204';

    const isQueryAuthenticated = !queryErr || isTableMissing;

    if (authValid || isQueryAuthenticated) {
      const tableNotice = isTableMissing
        ? ' (Tabel database belum dibuat, klik tombol "Skrip SQL Schema Supabase" untuk membuat tabel)'
        : ' (Semua tabel siap & aktif)';

      return {
        success: true,
        message: `✅ Berhasil Terhubung ke Supabase Cloud Database!${tableNotice}`,
        projectUrl: cleanUrl,
      };
    }

    // If genuinely unauthorized
    if (queryErr?.code === 'PGRST301' || queryErr?.message?.includes('JWT') || authErrorDetail) {
      return {
        success: false,
        message: `❌ Kunci API Tidak Valid (${authErrorDetail || queryErr?.message}). Pastikan menyalin "anon public" key dari Supabase > Project Settings > API.`,
      };
    }

    return {
      success: false,
      message: `❌ Gagal verifikasi: ${queryErr?.message || authErrorDetail || 'Koneksi ditolak'}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `❌ Gagal menghubungi Supabase: ${err?.message || 'Network Timeout'}`,
    };
  }
}

/**
 * SQL Schema script to run in Supabase SQL Editor
 * Complete Multi-Device Multi-Tenant Schema with store_id, profiles, store_members, RLS, and Realtime Publications
 */
export const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- SEMBAKO SMART AI POS - MULTI-DEVICE SUPABASE SCHEMA MIGRATION
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda
-- =========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE: STORES (Data Toko & Tenant)
CREATE TABLE IF NOT EXISTS public.stores (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  nama_toko TEXT NOT NULL,
  alamat_toko TEXT,
  no_hp TEXT,
  email_pemilik TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. TABLE: STORE_MEMBERS (Relasi Pengguna / Kasir / Admin ke Toko)
CREATE TABLE IF NOT EXISTS public.store_members (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'kasir',
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX IF NOT EXISTS idx_store_members_store ON public.store_members(store_id);
CREATE INDEX IF NOT EXISTS idx_store_members_user ON public.store_members(user_id);

-- 4. TABLE: PROFILES (Profil Pengguna POS & Multi Device)
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  photo_url TEXT,
  role TEXT DEFAULT 'owner',
  store_id TEXT DEFAULT 'default_store',
  nama_toko TEXT,
  no_hp TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLE: PRODUCTS (Data Produk Sembako, Kategori, Stok & Barcode)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT NOT NULL DEFAULT 'default_store',
  kode TEXT NOT NULL,
  barcode TEXT,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Sembako & Bumbu',
  harga_beli NUMERIC(15,2) NOT NULL DEFAULT 0,
  harga_jual NUMERIC(15,2) NOT NULL DEFAULT 0,
  stok NUMERIC(12,2) NOT NULL DEFAULT 0,
  satuan TEXT NOT NULL DEFAULT 'Pcs',
  min_stok NUMERIC(12,2) NOT NULL DEFAULT 5,
  terjual NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier TEXT DEFAULT 'Distributor Utama',
  gambar_url TEXT,
  deskripsi TEXT,
  expired_date TEXT,
  batch_no TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE: TRANSACTIONS (Transaksi Penjualan Kasir POS)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT NOT NULL DEFAULT 'default_store',
  kode_transaksi TEXT NOT NULL,
  tanggal TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  diskon_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  pajak_persen NUMERIC(5,2) NOT NULL DEFAULT 0,
  pajak_nominal NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_harga NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_refund NUMERIC(15,2) NOT NULL DEFAULT 0,
  bayar NUMERIC(15,2) NOT NULL DEFAULT 0,
  kembalian NUMERIC(15,2) NOT NULL DEFAULT 0,
  metode_pembayaran TEXT NOT NULL DEFAULT 'tunai',
  status_pembayaran TEXT NOT NULL DEFAULT 'lunas',
  bank_nama TEXT,
  no_referensi TEXT,
  nama_pelanggan TEXT,
  kasir_nama TEXT DEFAULT 'Kasir Utama',
  catatan TEXT,
  alasan_retur TEXT,
  retur_at TIMESTAMPTZ,
  riwayat_retur JSONB NOT NULL DEFAULT '[]'::jsonb,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. TABLE: CRM_USERS (Akun Toko, Lisensi CRM & Limit Perangkat)
CREATE TABLE IF NOT EXISTS public.crm_users (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT DEFAULT 'default_store',
  nama_pemilik TEXT NOT NULL,
  nama_toko TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'password123',
  no_hp TEXT,
  alamat_toko TEXT,
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'aktif',
  license_key TEXT UNIQUE,
  device_limit INT NOT NULL DEFAULT 3,
  active_devices_count INT NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT 'owner',
  notes TEXT,
  expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. TABLE: SUPPLIERS (Data Pemasok & Distributor Sembako)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT NOT NULL DEFAULT 'default_store',
  kode_supplier TEXT NOT NULL,
  nama_supplier TEXT NOT NULL,
  kontak_person TEXT,
  telepon TEXT,
  email TEXT,
  alamat TEXT,
  kategori_produk TEXT DEFAULT 'Umum',
  catatan TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. TABLE: STOCK_MOVEMENTS (Riwayat Mutasi Stok Masuk, Keluar, Penyesuaian)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT NOT NULL DEFAULT 'default_store',
  produk_id TEXT NOT NULL,
  nama_produk TEXT NOT NULL,
  kode_produk TEXT,
  tipe TEXT NOT NULL DEFAULT 'masuk',
  jumlah NUMERIC(12,2) NOT NULL DEFAULT 0,
  stok_awal NUMERIC(12,2) NOT NULL DEFAULT 0,
  stok_akhir NUMERIC(12,2) NOT NULL DEFAULT 0,
  keterangan TEXT,
  supplier TEXT,
  expired_date TEXT,
  batch_no TEXT,
  operator TEXT DEFAULT 'Admin Toko',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. TABLE: STOCK_OPNAMES (Audit Fisik Stok Toko)
CREATE TABLE IF NOT EXISTS public.stock_opnames (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT NOT NULL DEFAULT 'default_store',
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  produk_id TEXT,
  nama_produk TEXT,
  kode_produk TEXT,
  stok_sistem NUMERIC(12,2) DEFAULT 0,
  stok_fisik NUMERIC(12,2) DEFAULT 0,
  selisih NUMERIC(12,2) DEFAULT 0,
  alasan TEXT,
  status TEXT DEFAULT 'selesai',
  keterangan TEXT,
  operator TEXT DEFAULT 'Admin Toko',
  total_selisih_nominal NUMERIC(15,2) NOT NULL DEFAULT 0,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. TABLE: STAFF_ACCOUNTS (Akun Admin & Kasir Toko)
CREATE TABLE IF NOT EXISTS public.staff_accounts (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  store_id TEXT NOT NULL DEFAULT 'default_store',
  username TEXT NOT NULL,
  nama TEXT NOT NULL,
  password TEXT NOT NULL DEFAULT 'password123',
  role TEXT NOT NULL DEFAULT 'kasir',
  no_hp TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'aktif',
  catatan TEXT,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. TABLE: REMOTE_CONFIG & WEBHOOK_LOGS
CREATE TABLE IF NOT EXISTS public.remote_config (
  id TEXT PRIMARY KEY DEFAULT 'app_master_config',
  config JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT DEFAULT 'Super Admin'
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  sender TEXT NOT NULL,
  message_text TEXT,
  raw_body JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =========================================================================
-- AUTO MIGRATION: Pastikan kolom store_id dan kolom tambahan ada di tabel lama
-- (Mencegah error 42703 bila tabel sudah pernah dibuat sebelumnya)
-- =========================================================================
DO $$
BEGIN
  -- 1. products
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'products') THEN
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stok NUMERIC(12,2) NOT NULL DEFAULT 5;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS terjual NUMERIC(12,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier TEXT DEFAULT 'Distributor Utama';
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS gambar_url TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deskripsi TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS expired_date TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS batch_no TEXT;
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 2. transactions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transactions') THEN
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS total_refund NUMERIC(15,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS pajak_persen NUMERIC(5,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS pajak_nominal NUMERIC(15,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS metode_pembayaran TEXT NOT NULL DEFAULT 'tunai';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS status_pembayaran TEXT NOT NULL DEFAULT 'lunas';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS bank_nama TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS no_referensi TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS nama_pelanggan TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS kasir_nama TEXT DEFAULT 'Kasir Utama';
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS catatan TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS alasan_retur TEXT;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS retur_at TIMESTAMPTZ;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS riwayat_retur JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 3. suppliers
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'suppliers') THEN
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store';
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS kategori_produk TEXT DEFAULT 'Umum';
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS catatan TEXT;
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aktif';
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 4. stock_movements
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_movements') THEN
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store';
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS kode_produk TEXT;
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS supplier TEXT;
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS expired_date TEXT;
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS batch_no TEXT;
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS operator TEXT DEFAULT 'Admin Toko';
    ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 5. stock_opnames
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_opnames') THEN
    ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store';
    ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS total_selisih_nominal NUMERIC(15,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS items JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE public.stock_opnames ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 6. staff_accounts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'staff_accounts') THEN
    ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'default_store';
    ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aktif';
    ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS catatan TEXT;
    ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
    ALTER TABLE public.staff_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 7. crm_users
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'crm_users') THEN
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS store_id TEXT DEFAULT 'default_store';
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS device_limit INT NOT NULL DEFAULT 3;
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS active_devices_count INT NOT NULL DEFAULT 1;
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS license_key TEXT;
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'basic';
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'aktif';
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS notes TEXT;
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    ALTER TABLE public.crm_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  -- 8. profiles
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS store_id TEXT DEFAULT 'default_store';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'owner';
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nama_toko TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS no_hp TEXT;
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END $$;

-- =========================================================================
-- CREATE PERFORMANCE & PARTITION INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_products_store_id ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_kode ON public.products(kode);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_nama ON public.products(nama);

CREATE INDEX IF NOT EXISTS idx_tx_store_id ON public.transactions(store_id);
CREATE INDEX IF NOT EXISTS idx_tx_tanggal ON public.transactions(tanggal);
CREATE INDEX IF NOT EXISTS idx_tx_kode ON public.transactions(kode_transaksi);
CREATE INDEX IF NOT EXISTS idx_tx_status ON public.transactions(status_pembayaran);

CREATE INDEX IF NOT EXISTS idx_crm_store_id ON public.crm_users(store_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_store_id ON public.suppliers(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_store_id ON public.stock_movements(store_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_produk ON public.stock_movements(produk_id);
CREATE INDEX IF NOT EXISTS idx_stock_opnames_store_id ON public.stock_opnames(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_store_id ON public.staff_accounts(store_id);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_opnames ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Allow access with public API / anon key
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Stores') THEN
    CREATE POLICY "Public Access Stores" ON public.stores FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Store Members') THEN
    CREATE POLICY "Public Access Store Members" ON public.store_members FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Profiles') THEN
    CREATE POLICY "Public Access Profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Products') THEN
    CREATE POLICY "Public Access Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Transactions') THEN
    CREATE POLICY "Public Access Transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access CRM Users') THEN
    CREATE POLICY "Public Access CRM Users" ON public.crm_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Staff Accounts') THEN
    CREATE POLICY "Public Access Staff Accounts" ON public.staff_accounts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Suppliers') THEN
    CREATE POLICY "Public Access Suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Stock Movements') THEN
    CREATE POLICY "Public Access Stock Movements" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Stock Opnames') THEN
    CREATE POLICY "Public Access Stock Opnames" ON public.stock_opnames FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Remote Config') THEN
    CREATE POLICY "Public Access Remote Config" ON public.remote_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Webhook Logs') THEN
    CREATE POLICY "Public Access Webhook Logs" ON public.webhook_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =========================================================================
-- REALTIME REPLICATION PUBLICATION SETUP
-- Mengaktifkan event perubahan data langsung ke seluruh browser / perangkat
-- =========================================================================
DO $$
BEGIN
  -- Add tables to supabase_realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_movements;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_opnames;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.suppliers;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_users;
  EXCEPTION WHEN others THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_accounts;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;
`;
