import { DeveloperApiKeys } from '../types';
import { getCurrentStoreId, setCurrentStoreId, getSupabaseClient } from './supabaseClient';

const SALT = 'SEM_SMART_POS_2026_SECURE_SALT_KEY';

/**
 * Compact payload interface for minimum character length
 */
interface CompactPayload {
  u?: string;  // supabaseUrl
  k?: string;  // supabaseAnonKey
  g?: string;  // geminiApiKey
  w?: string;  // waApiKey
  p?: string;  // waGatewayProvider
  s?: string;  // waSenderNumber
  st?: string; // storeId
  t?: number;  // timestamp
}

/**
 * Fast XOR + Base64URL Obfuscator/Encryptor
 */
export function encryptPairingPayload(keys: Partial<DeveloperApiKeys>, storeId?: string): string {
  try {
    const compact: CompactPayload = {
      u: keys.supabaseUrl || '',
      k: keys.supabaseAnonKey || '',
      g: keys.geminiApiKey || '',
      w: keys.waApiKey || '',
      p: keys.waGatewayProvider || '',
      s: keys.waSenderNumber || '',
      st: storeId || getCurrentStoreId() || 'store_pusat_developer_sembako_smart_ai',
      t: Date.now()
    };

    const json = JSON.stringify(compact);
    let cipher = '';
    for (let i = 0; i < json.length; i++) {
      const charCode = json.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
      cipher += String.fromCharCode(charCode);
    }

    // Convert to URL-safe Base64
    const b64 = btoa(encodeURIComponent(cipher))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    return `enc_${b64}`;
  } catch (err) {
    console.error('Failed to encrypt pairing payload:', err);
    return '';
  }
}

/**
 * Decrypt obfuscated pairing payload
 */
export function decryptPairingPayload(token: string): {
  keys: Partial<DeveloperApiKeys>;
  storeId?: string;
} | null {
  if (!token) return null;

  try {
    const cleanToken = token.replace(/^enc_/, '');
    // Restore base64
    let b64 = cleanToken.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';

    const rawCipher = decodeURIComponent(atob(b64));
    let json = '';
    for (let i = 0; i < rawCipher.length; i++) {
      const charCode = rawCipher.charCodeAt(i) ^ SALT.charCodeAt(i % SALT.length);
      json += String.fromCharCode(charCode);
    }

    const compact: CompactPayload = JSON.parse(json);
    const keys: Partial<DeveloperApiKeys> = {};
    if (compact.u) keys.supabaseUrl = compact.u;
    if (compact.k) keys.supabaseAnonKey = compact.k;
    if (compact.g) keys.geminiApiKey = compact.g;
    if (compact.w) keys.waApiKey = compact.w;
    if (compact.p) keys.waGatewayProvider = compact.p as any;
    if (compact.s) keys.waSenderNumber = compact.s;

    return {
      keys,
      storeId: compact.st
    };
  } catch (err) {
    console.error('Failed to decrypt pairing payload:', err);
    return null;
  }
}

/**
 * Request server to generate a clean 6-digit Short Pairing Code (e.g. "KSR-8492" or "X9K2M4")
 */
export async function createShortPairingSession(
  keys: Partial<DeveloperApiKeys>,
  storeId?: string
): Promise<{
  code: string;
  pairingUrl: string;
  qrCodeUrl: string;
  encryptedToken: string;
}> {
  const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  const encryptedToken = encryptPairingPayload(keys, storeId);
  const fallbackCode = Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    const res = await fetch('/api/pairing/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keys, storeId }),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.code) {
        const pairingUrl = `${origin}?pair=${encodeURIComponent(data.code)}`;
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(pairingUrl)}`;
        return {
          code: data.code,
          pairingUrl,
          qrCodeUrl,
          encryptedToken
        };
      }
    }
  } catch (err) {
    console.warn('Server pairing API unreachable, using encrypted token fallback');
  }

  // Fallback to Encrypted URL (No plain keys exposed)
  const pairingUrl = `${origin}?token=${encodeURIComponent(encryptedToken)}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(pairingUrl)}`;

  return {
    code: fallbackCode,
    pairingUrl,
    qrCodeUrl,
    encryptedToken
  };
}

/**
 * Resolve pairing code or encrypted token on client startup
 */
export async function resolvePairingInput(input: string): Promise<{
  keys: Partial<DeveloperApiKeys>;
  storeId?: string;
} | null> {
  if (!input) return null;
  const clean = input.trim();

  // 1. If it's an encrypted token
  if (clean.startsWith('enc_') || clean.length > 20) {
    const decrypted = decryptPairingPayload(clean);
    if (decrypted) return decrypted;
  }

  // 2. If it's a short code (e.g. "KSR-8492" or "X9K2M4"), query server backend
  try {
    const res = await fetch(`/api/pairing/resolve/${encodeURIComponent(clean)}`, {
      signal: AbortSignal.timeout(3500)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'ok' && data.keys) {
        return {
          keys: data.keys,
          storeId: data.storeId
        };
      }
    }
  } catch (e) {}

  // 3. Query Supabase remote_config directly if code was saved there
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data } = await sb
        .from('remote_config')
        .select('config')
        .eq('id', `pairing_${clean.toUpperCase()}`)
        .maybeSingle();
      if (data && data.config) {
        return {
          keys: data.config.keys,
          storeId: data.config.storeId
        };
      }
    }
  } catch (e) {}

  return null;
}
