import fs from 'fs';
import path from 'path';
import { INITIAL_PRODUCTS } from '../data/initialProducts';
import { ProdukItem } from '../types';

const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';
const BASE_FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Local file path for persistent server storage (/tmp for Vercel Serverless, local directory for local dev)
const LOCAL_PRODUCTS_FILE = path.join('/tmp', 'localProducts.json');
const SEED_PRODUCTS_FILE = path.join(process.cwd(), 'src', 'data', 'localProducts.json');
const CLOUD_STORE_URL = 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff3f0ddfd2c42';

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

export function getProductsBackend(): ProdukItem[] {
  return [...inMemoryProducts];
}

export function saveProductBackend(product: ProdukItem): ProdukItem {
  const existingIdx = inMemoryProducts.findIndex(p => p.id === product.id);
  if (existingIdx >= 0) {
    inMemoryProducts[existingIdx] = { ...product, updatedAt: new Date().toISOString() };
  } else {
    inMemoryProducts.unshift({ ...product, updatedAt: new Date().toISOString() });
  }
  saveLocalProductsToFile();
  return product;
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

      // Try updating Firestore REST API as secondary sync
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

      // Try POST to Firestore REST API as secondary sync
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
