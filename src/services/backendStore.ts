import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  setDoc 
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || 'AIzaSyBdN_T5Jj9mgq3DzQepGPNglE2eluW15s4',
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || 'gen-lang-client-0297359647.firebaseapp.com',
  projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0297359647',
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || 'gen-lang-client-0297359647.firebasestorage.app',
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '804065401730',
  appId: process.env.VITE_FIREBASE_APP_ID || '1:804065401730:web:b1b0002da06d566beecd9b',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

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

export async function processProductWebhook(input: ProductInput): Promise<{ message: string; updatedStock: number; isNew: boolean }> {
  try {
    const productsRef = collection(db, 'products');
    const snapshot = await getDocs(productsRef);
    
    // Find matching product by name (case-insensitive)
    let existingDocId: string | null = null;
    let existingProduct: any = null;

    const targetName = input.nama.trim().toLowerCase();

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.nama && data.nama.trim().toLowerCase() === targetName) {
        existingDocId = docSnap.id;
        existingProduct = data;
      }
    });

    const now = new Date().toISOString();

    if (existingDocId && existingProduct) {
      // PRODUCT EXISTS: ADD / INCREASE THE EXISTING STOCK
      const oldStock = Number(existingProduct.stok) || 0;
      const addedStock = Number(input.stok) || 0;
      const newTotalStock = oldStock + addedStock;

      const updateData: any = {
        stok: newTotalStock,
        updatedAt: now,
      };

      if (input.hargaBeli && input.hargaBeli > 0) updateData.hargaBeli = input.hargaBeli;
      if (input.hargaJual && input.hargaJual > 0) updateData.hargaJual = input.hargaJual;
      if (input.kategori && input.kategori !== 'Sembako & Bumbu') updateData.kategori = input.kategori;
      if (input.satuan && input.satuan !== 'Pcs') updateData.satuan = input.satuan;
      if (input.minStok) updateData.minStok = input.minStok;

      const productDocRef = doc(db, 'products', existingDocId);
      await updateDoc(productDocRef, updateData);

      // Log stock movement
      try {
        await addDoc(collection(db, 'stock_movements'), {
          productId: existingDocId,
          productNama: existingProduct.nama || input.nama,
          tipe: 'MASUK',
          jumlah: addedStock,
          stokSebelum: oldStock,
          stokSesudah: newTotalStock,
          keterangan: `Tambahan Stok via WhatsApp Webhook (Pengirim: ${input.sender || 'WhatsApp'})`,
          createdAt: now,
        });
      } catch (e) {
        console.warn('Stock movement log error:', e);
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
      // PRODUCT DOES NOT EXIST: CREATE NEW PRODUCT IN FIRESTORE
      const sku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
      const barcode = `${Math.floor(8990000000000 + Math.random() * 9999999)}`;
      const hargaBeli = input.hargaBeli || 10000;
      const hargaJual = input.hargaJual || Math.round(hargaBeli * 1.15);
      const satuan = input.satuan || 'Pcs';
      const minStok = input.minStok || 5;

      const newProdData = {
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
        deskripsi: `Otomatis diimpor oleh WhatsApp Bot Webhook (Pengirim: ${input.sender || 'WhatsApp'})`,
        expiredDate: '',
        batchNo: '',
        terjual: 0,
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(productsRef, newProdData);

      // Log stock movement
      try {
        await addDoc(collection(db, 'stock_movements'), {
          productId: docRef.id,
          productNama: input.nama,
          tipe: 'MASUK',
          jumlah: input.stok,
          stokSebelum: 0,
          stokSesudah: input.stok,
          keterangan: `Stok Awal Produk Baru via WhatsApp Webhook (Pengirim: ${input.sender || 'WhatsApp'})`,
          createdAt: now,
        });
      } catch (e) {
        console.warn('Stock movement log error:', e);
      }

      const msg = `✅ [POS Toko Sembako] Produk baru "${input.nama}" BERHASIL DITAMBAHKAN ke katalog toko dengan stok awal ${input.stok} ${satuan}!`;

      return {
        message: msg,
        updatedStock: input.stok,
        isNew: true
      };
    }

  } catch (err: any) {
    console.error('Error processing product webhook:', err);
    throw err;
  }
}

export async function processStockUpdateWebhook(nama: string, addedStock: number, sender?: string): Promise<string> {
  const productsRef = collection(db, 'products');
  const snapshot = await getDocs(productsRef);
  
  let existingDocId: string | null = null;
  let existingProduct: any = null;

  const targetName = nama.trim().toLowerCase();

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.nama && data.nama.trim().toLowerCase() === targetName) {
      existingDocId = docSnap.id;
      existingProduct = data;
    }
  });

  const now = new Date().toISOString();

  if (existingDocId && existingProduct) {
    const oldStock = Number(existingProduct.stok) || 0;
    const newTotalStock = oldStock + addedStock;

    const productDocRef = doc(db, 'products', existingDocId);
    await updateDoc(productDocRef, {
      stok: newTotalStock,
      updatedAt: now
    });

    try {
      await addDoc(collection(db, 'stock_movements'), {
        productId: existingDocId,
        productNama: existingProduct.nama || nama,
        tipe: 'MASUK',
        jumlah: addedStock,
        stokSebelum: oldStock,
        stokSesudah: newTotalStock,
        keterangan: `Update Stok via Command WA (Pengirim: ${sender || 'WhatsApp'})`,
        createdAt: now,
      });
    } catch (e) {
      console.warn('Stock movement log error:', e);
    }

    const satuanStr = existingProduct.satuan || 'Pcs';
    return `✅ [POS Toko Sembako] Stok "${existingProduct.nama || nama}" BERHASIL DITAMBAHKAN!\n\n` +
           `📦 Stok Awal: ${oldStock} ${satuanStr}\n` +
           `➕ Tambahan: +${addedStock} ${satuanStr}\n` +
           `📊 Total Stok Sekarang: ${newTotalStock} ${satuanStr}`;
  } else {
    // If product not found, create new product
    return await (await processProductWebhook({ nama, stok: addedStock, sender })).message;
  }
}
