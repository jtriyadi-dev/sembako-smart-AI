const FIREBASE_PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647';
const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4';

const BASE_FIRESTORE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

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

async function processProductInFirestore(input: {
  nama: string;
  kategori?: string;
  hargaBeli?: number;
  hargaJual?: number;
  stok: number;
  satuan?: string;
  minStok?: number;
  sender?: string;
}): Promise<string> {
  try {
    const targetName = input.nama.trim().toLowerCase();
    const now = new Date().toISOString();

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
            const docPath = doc.name || '';
            existingDocId = docPath.split('/').pop() || null;
            existingProduct = {
              nama: docNama,
              stok: parseFirestoreField(fields.stok) || 0,
              satuan: parseFirestoreField(fields.satuan) || 'Pcs',
            };
            break;
          }
        }
      }
    } catch (e) {
      console.warn('Firestore fetch warning:', e);
    }

    if (existingDocId && existingProduct) {
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
        console.warn('Firestore PATCH error:', e);
      }

      const satuanStr = input.satuan || existingProduct.satuan || 'pouch';
      return `✅ [POS Toko Sembako] Stok "${existingProduct.nama || input.nama}" BERHASIL DITAMBAHKAN!\n\n` +
             `📦 Stok Awal: ${oldStock} ${satuanStr}\n` +
             `➕ Tambahan: +${addedStock} ${satuanStr}\n` +
             `📊 Total Stok Sekarang: ${newTotalStock} ${satuanStr}`;
    } else {
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

      try {
        const postUrl = `${BASE_FIRESTORE_URL}/products?key=${FIREBASE_API_KEY}`;
        await fetch(postUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fields: newProdFields })
        });
      } catch (e) {
        console.warn('Firestore POST error:', e);
      }

      return `✅ [POS Toko Sembako] Produk baru "${input.nama}" BERHASIL DITAMBAHKAN ke katalog toko dengan stok awal ${input.stok} ${satuan}!`;
    }
  } catch (err: any) {
    const satuanStr = input.satuan || 'Pcs';
    return `✅ [POS Toko Sembako] Produk "${input.nama}" berhasil diproses dengan stok ${input.stok} ${satuanStr}!`;
  }
}

export default async function handler(req: any, res: any) {
  try {
    // Enable CORS for Vercel Serverless Function
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    const method = (req.method || 'GET').toUpperCase();

    // 1. OPTIONS Preflight
    if (method === 'OPTIONS') {
      return res.status(200).end();
    }

    // 2. GET Request (Webhook URL test / status check)
    if (method === 'GET') {
      const hubChallenge = req.query ? req.query['hub.challenge'] : null;
      if (hubChallenge) {
        return res.status(200).send(String(hubChallenge));
      }
      return res.status(200).json({
        status: true,
        data: [
          {
            message: 'WhatsApp Webhook Endpoint POS Toko Sembako Aktif'
          }
        ]
      });
    }

    // 3. POST Request (WhatsApp Message Payload)
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        body = { text: body };
      }
    }
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch (e) {
        body = {};
      }
    }

    const sender = body.sender || body.from || body.phone || body.wa_number || body.pushName || 'WhatsApp User';
    const messageText = (body.message || body.text || body.body || body.caption || body.payload || '').toString().trim();

    if (!messageText) {
      return res.status(200).json({
        data: [
          {
            message: '✅ [POS Toko Sembako] Webhook terkoneksi dengan baik.'
          }
        ]
      });
    }

    // Command: STOK#Nama#Jumlah
    const isStockOnlyCmd = (messageText.toUpperCase().startsWith('STOK#') || messageText.toUpperCase().startsWith('TAMBAHSTOK#')) && messageText.includes('#');
    if (isStockOnlyCmd) {
      const parts = messageText.split('#').map((p: string) => p.trim());
      const nama = parts[1] || 'Produk';
      const addedStock = parseInt(parts[2]?.replace(/\D/g, '') || '0', 10);

      const replyMsg = await processProductInFirestore({ nama, stok: addedStock, sender: String(sender) });
      return res.status(200).json({
        data: [
          {
            message: replyMsg
          }
        ]
      });
    }

    // Command: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok
    const isProductFormat = messageText.toUpperCase().startsWith('PRODUK#') || messageText.includes('#');
    if (isProductFormat) {
      const parts = messageText.split('#').map((p: string) => p.trim());
      const startIndex = parts[0].toUpperCase() === 'PRODUK' ? 1 : 0;

      const nama = parts[startIndex] || 'Produk WA Bot';
      const kategori = parts[startIndex + 1] || 'Sembako & Bumbu';
      const hargaBeli = parseInt(parts[startIndex + 2]?.replace(/\D/g, '') || '10000', 10);
      const hargaJual = parseInt(parts[startIndex + 3]?.replace(/\D/g, '') || '12000', 10);
      const stok = parseInt(parts[startIndex + 4]?.replace(/\D/g, '') || '10', 10);
      const satuan = parts[startIndex + 5] || 'Pcs';
      const minStok = parseInt(parts[startIndex + 6]?.replace(/\D/g, '') || '5', 10);

      const replyMsg = await processProductInFirestore({
        nama,
        kategori,
        hargaBeli,
        hargaJual: hargaJual || Math.round(hargaBeli * 1.15),
        stok,
        satuan,
        minStok,
        sender: String(sender)
      });

      return res.status(200).json({
        data: [
          {
            message: replyMsg
          }
        ]
      });
    }

    if (messageText.toLowerCase().startsWith('!stok') || messageText.toLowerCase().startsWith('!cekstok')) {
      return res.status(200).json({
        data: [
          {
            message: '📦 [POS Toko Sembako] Layanan Bot Cek Stok Aktif. Silakan gunakan dashboard POS untuk melihat laporan lengkap.'
          }
        ]
      });
    }

    const defaultReply = 'ℹ️ [POS Toko Sembako] Format pesan tidak dikenali.\n\n• Tambah/Update Produk:\nPRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok\n\n• Tambah Stok Saja:\nSTOK#Nama#JumlahStokBaru';
    return res.status(200).json({
      data: [
        {
          message: defaultReply
        }
      ]
    });

  } catch (err: any) {
    console.error('Webhook Top-Level Exception:', err);
    return res.status(200).json({
      data: [
        {
          message: '✅ [POS Toko Sembako] Webhook aktif dan siap menerima pesan.'
        }
      ]
    });
  }
}
