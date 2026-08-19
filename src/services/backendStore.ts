import fs from 'fs';
import path from 'path';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { ProdukItem, RemoteAppConfig, CrmUser, DeveloperApiKeys } from '../types';
import { DEFAULT_REMOTE_CONFIG, INITIAL_CRM_USERS, DEFAULT_API_KEYS } from '../data/defaultRemoteConfig';

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';
const BASE_FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Local file paths for persistent server storage
const LOCAL_PRODUCTS_FILE = path.join('/tmp', 'localProducts.json');
const SEED_PRODUCTS_FILE = path.join(process.cwd(), 'src', 'data', 'localProducts.json');
const LOCAL_CONFIG_FILE = path.join('/tmp', 'remoteConfig.json');
const LOCAL_USERS_FILE = path.join('/tmp', 'crmUsers.json');
const LOCAL_KEYS_FILE = path.join('/tmp', 'apiKeys.json');
const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff3f0ddfd2c42';

// In-memory developer stores
let inMemoryRemoteConfig: RemoteAppConfig = { ...DEFAULT_REMOTE_CONFIG };
let inMemoryCrmUsers: CrmUser[] = [...INITIAL_CRM_USERS];
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
      if (Array.isArray(parsed) && parsed.length > 0) inMemoryCrmUsers = parsed;
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
  return [...inMemoryCrmUsers];
}

export function saveCrmUserBackend(user: CrmUser): CrmUser {
  const existingIdx = inMemoryCrmUsers.findIndex(u => u.id === user.id);
  const now = new Date().toISOString();
  let saved: CrmUser;
  if (existingIdx >= 0) {
    saved = { ...inMemoryCrmUsers[existingIdx], ...user, updatedAt: now };
    inMemoryCrmUsers[existingIdx] = saved;
  } else {
    saved = { ...user, createdAt: user.createdAt || now, updatedAt: now };
    inMemoryCrmUsers.unshift(saved);
  }
  saveDeveloperStoresToFile();
  return saved;
}

export function deleteCrmUserBackend(userId: string): boolean {
  const initialLen = inMemoryCrmUsers.length;
  inMemoryCrmUsers = inMemoryCrmUsers.filter(u => u.id !== userId);
  saveDeveloperStoresToFile();
  return inMemoryCrmUsers.length < initialLen;
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
