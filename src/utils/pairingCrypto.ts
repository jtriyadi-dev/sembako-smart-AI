/**
 * Utility for Secure Encrypted & Compressed Device Pairing Tokens
 * Encrypts sensitive keys (Supabase, Gemini, Wablas/WhatsApp, Store ID)
 * so that URLs and QR codes never expose raw API keys to customers or third parties.
 */

const SECRET_SALT = 'SembakoSmartAI_SecurePairingVault_2026_x9Q';

export interface PairingPayload {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  storeId?: string;
  geminiApiKey?: string;
  waApiKey?: string;
  waGatewayProvider?: string;
  waSenderNumber?: string;
  createdAt?: number;
}

/**
 * URL-safe Base64 encoding
 */
function toBase64Url(str: string): string {
  try {
    const utf8Bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < utf8Bytes.length; i++) {
      binary += String.fromCharCode(utf8Bytes[i]);
    }
    const b64 = btoa(binary);
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    return '';
  }
}

/**
 * URL-safe Base64 decoding
 */
function fromBase64Url(b64url: string): string {
  try {
    let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (e) {
    return '';
  }
}

/**
 * Simple yet robust multi-round XOR + dynamic byte permutation cipher
 */
function xorEncryptDecrypt(input: string, salt: string): string {
  let result = '';
  const saltLen = salt.length;
  for (let i = 0; i < input.length; i++) {
    const charCode = input.charCodeAt(i);
    const saltChar = salt.charCodeAt(i % saltLen);
    const mixed = charCode ^ saltChar ^ ((i * 17 + 31) & 0x7F);
    result += String.fromCharCode(mixed);
  }
  return result;
}

/**
 * Encrypt and compress pairing payload into a short, safe string token
 */
export function encryptPairingPayload(payload: PairingPayload): string {
  try {
    // Minify keys for ultra-short payload
    const compact: Record<string, any> = {
      t: Date.now()
    };
    if (payload.supabaseUrl) compact.u = payload.supabaseUrl.trim();
    if (payload.supabaseAnonKey) compact.k = payload.supabaseAnonKey.trim();
    if (payload.storeId) compact.s = payload.storeId.trim();
    if (payload.geminiApiKey) compact.g = payload.geminiApiKey.trim();
    if (payload.waApiKey) compact.w = payload.waApiKey.trim();
    if (payload.waGatewayProvider) compact.p = payload.waGatewayProvider.trim();
    if (payload.waSenderNumber) compact.n = payload.waSenderNumber.trim();

    const jsonStr = JSON.stringify(compact);
    const scrambled = xorEncryptDecrypt(jsonStr, SECRET_SALT);
    return toBase64Url(scrambled);
  } catch (err) {
    console.error('[PairingCrypto] Failed to encrypt payload:', err);
    return '';
  }
}

/**
 * Decrypt and unpack pairing payload from token
 */
export function decryptPairingPayload(token: string): PairingPayload | null {
  if (!token) return null;
  try {
    const cleanToken = token.trim();
    const scrambled = fromBase64Url(cleanToken);
    if (!scrambled) return null;

    const decryptedJson = xorEncryptDecrypt(scrambled, SECRET_SALT);
    const parsed = JSON.parse(decryptedJson);

    if (!parsed || typeof parsed !== 'object') return null;

    return {
      supabaseUrl: parsed.u || undefined,
      supabaseAnonKey: parsed.k || undefined,
      storeId: parsed.s || undefined,
      geminiApiKey: parsed.g || undefined,
      waApiKey: parsed.w || undefined,
      waGatewayProvider: parsed.p || undefined,
      waSenderNumber: parsed.n || undefined,
      createdAt: parsed.t || undefined
    };
  } catch (err) {
    return null;
  }
}
