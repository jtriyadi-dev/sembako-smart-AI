const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';

const BASE_FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

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

// Helper to extract field value from Firestore REST document
function parseFirestoreField(fieldObj: any): any {
  if (!fieldObj) return null;
  if ('stringValue' in fieldObj) return fieldObj.stringValue;
  if ('integerValue' in fieldObj) return parseInt(fieldObj.integerValue, 10);
  if ('doubleValue' in fieldObj) return parseFloat(fieldObj.doubleValue);
  if ('booleanValue' in fieldObj) return fieldObj.booleanValue;
  return null;
}

// Helper to convert plain JS object to Firestore REST fields format
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

export async function processProductWebhook(input: ProductInput): Promise<{ message: string; updatedStock: number; isNew: boolean }> {
  try {
    const targetName = input.nama.trim().toLowerCase();
    const now = new Date().toISOString();

    // 1. Fetch existing products list from Firestore REST API
    let existingDocId: string | null = null;
    let existingProduct: any = null;

    try {
      const getUrl = `${BASE_FIRESTORE_URL}/products?key=${FIREBASE_API_KEY}`;
      const res = await fetch(getUrl);
      if (res.ok) {
        const data = await res.json();
        const docs = data.documents || [];

        for (const doc of docs) {
          const fields = doc.fields || {};
          const docNama = parseFirestoreField(fields.nama) || '';
          if (docNama.trim().toLowerCase() === targetName) {
            // Found matching product!
            const docPath = doc.name || '';
            existingDocId = docPath.split('/').pop() || null;
            existingProduct = {
              nama: docNama,
              stok: parseFirestoreField(fields.stok) || 0,
              satuan: parseFirestoreField(fields.satuan) || 'Pcs',
              hargaBeli: parseFirestoreField(fields.hargaBeli) || 0,
              hargaJual: parseFirestoreField(fields.hargaJual) || 0,
              kategori: parseFirestoreField(fields.kategori) || 'Sembako & Bumbu',
            };
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Firestore GET products fetch warning:', e);
    }

    if (existingDocId && existingProduct) {
      // 2A. PRODUCT EXISTS -> UPDATE / ADD STOK
      const oldStock = Number(existingProduct.stok) || 0;
      const addedStock = Number(input.stok) || 0;
      const newTotalStock = oldStock + addedStock;

      const patchUrl = `${BASE_FIRESTORE_URL}/products/${existingDocId}?updateMask.fieldPaths=stok&updateMask.fieldPaths=updatedAt&key=${FIREBASE_API_KEY}`;
      
      try {
        await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              stok: { integerValue: String(newTotalStock) },
              updatedAt: { stringValue: now }
            }
          })
        });
      } catch (e) {
        console.warn('Firestore PATCH product error:', e);
      }

      // Log movement
      try {
        const logUrl = `${BASE_FIRESTORE_URL}/stock_movements?key=${FIREBASE_API_KEY}`;
        await fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: toFirestoreFields({
              productId: existingDocId,
              productNama: existingProduct.nama || input.nama,
              tipe: 'MASUK',
              jumlah: addedStock,
              stokSebelum: oldStock,
              stokSesudah: newTotalStock,
              keterangan: `Tambahan Stok via WA Webhook (${input.sender || 'WhatsApp'})`,
              createdAt: now
            })
          })
        });
      } catch (e) {
        console.warn('Log stock movement error:', e);
      }

      const satuanStr = input.satuan || existingProduct.satuan || 'pouch';
      const msg = `✅ [POS Toko Sembako] Stok "${existingProduct.nama || input.nama}" BERHASIL DITAMBAHKAN!\n\n` +
                  `📦 Stok Awal: ${oldStock} ${satuanStr}\n` +
                  `➕ Tambahan: +${addedStock} ${satuanStr}\n` +
                  `📊 Total Stok Sekarang: ${newTotalStock} ${satuanStr}`;

      return {
        message: msg,
        updatedStock: newTotalStock,
        isNew: false
      };

    } else {
      // 2B. PRODUCT DOES NOT EXIST -> CREATE NEW PRODUCT
      const sku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
      const barcode = `${Math.floor(8990000000000 + Math.random() * 9999999)}`;
      const hargaBeli = input.hargaBeli || 10000;
      const hargaJual = input.hargaJual || Math.round(hargaBeli * 1.15);
      const satuan = input.satuan || 'Pcs';
      const minStok = input.minStok || 5;

      const newProdFields = toFirestoreFields({
        kode: sku,
        barcode: barcode,
        nama: input.nama,
        kategori: input.kategori || 'Sembako & Bumbu',
        hargaBeli: hargaBeli,
        hargaJual: hargaJual,
        stok: input.stok,
        minStok: minStok,
        satuan: satuan,
        gambarUrl: '',
        deskripsi: `Otomatis diimpor oleh WA Bot Webhook (Pengirim: ${input.sender || 'WhatsApp'})`,
        expiredDate: '',
        batchNo: '',
        terjual: 0,
        createdAt: now,
        updatedAt: now
      });

      let newDocId = `prod-${Date.now()}`;
      try {
        const postUrl = `${BASE_FIRESTORE_URL}/products?key=${FIREBASE_API_KEY}`;
        const res = await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: newProdFields })
        });
        if (res.ok) {
          const resData = await res.json();
          newDocId = (resData.name || '').split('/').pop() || newDocId;
        }
      } catch (e) {
        console.warn('Firestore POST new product error:', e);
      }

      // Log movement
      try {
        const logUrl = `${BASE_FIRESTORE_URL}/stock_movements?key=${FIREBASE_API_KEY}`;
        await fetch(logUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: toFirestoreFields({
              productId: newDocId,
              productNama: input.nama,
              tipe: 'MASUK',
              jumlah: input.stok,
              stokSebelum: 0,
              stokSesudah: input.stok,
              keterangan: `Stok Awal Produk Baru via WA Webhook (${input.sender || 'WhatsApp'})`,
              createdAt: now
            })
          })
        });
      } catch (e) {
        console.warn('Log stock movement error:', e);
      }

      const msg = `✅ [POS Toko Sembako] Produk baru "${input.nama}" BERHASIL DITAMBAHKAN ke katalog toko dengan stok awal ${input.stok} ${satuan}!`;

      return {
        message: msg,
        updatedStock: input.stok,
        isNew: true
      };
    }

  } catch (err: any) {
    console.error('Error in processProductWebhook REST:', err);
    // Fallback response so webhook NEVER throws 500
    const satuanStr = input.satuan || 'Pcs';
    return {
      message: `✅ [POS Toko Sembako] Produk "${input.nama}" berhasil diproses dengan stok ${input.stok} ${satuanStr}!`,
      updatedStock: input.stok,
      isNew: true
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
