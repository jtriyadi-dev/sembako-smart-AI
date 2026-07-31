import { 
  db, 
  COLLECTIONS, 
  collection, 
  doc, 
  addDoc, 
  setDoc,
  updateDoc, 
  getDoc,
  query, 
  orderBy, 
  auth 
} from './firebase';
import { onSnapshot } from 'firebase/firestore';
import { StockMovement, StockOpname, MovementType, ProdukItem } from '../types';
import { handleFirestoreError, OperationType } from './productService';

// Subscribe to Realtime Stock Movements Log
export function subscribeStockMovements(
  onData: (movements: StockMovement[]) => void,
  onError?: (error: Error) => void
) {
  const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
  const q = query(movementsRef);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const movements: StockMovement[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          produkId: data.produkId || '',
          namaProduk: data.namaProduk || 'Produk Sembako',
          kodeProduk: data.kodeProduk || '',
          tipe: (data.tipe as MovementType) || 'masuk',
          jumlah: Number(data.jumlah) || 0,
          stokAwal: Number(data.stokAwal) || 0,
          stokAkhir: Number(data.stokAkhir) || 0,
          keterangan: data.keterangan || '',
          supplier: data.supplier || '',
          expiredDate: data.expiredDate || '',
          batchNo: data.batchNo || '',
          createdAt: data.createdAt || new Date().toISOString(),
          operator: data.operator || 'Admin',
        };
      });

      // Sort client side by createdAt descending
      movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(movements);
    },
    (err) => {
      console.error('Stock movements snapshot error:', err);
      if (onError) onError(err);
      onData([]);
    }
  );

  return unsubscribe;
}

// Record Stock Movement (Stok Masuk, Stok Keluar, Penyesuaian)
export async function recordStockMovement(params: {
  product: ProdukItem;
  tipe: MovementType;
  jumlah: number; // For penyesuaian, this is the target total stock
  keterangan: string;
  supplier?: string;
  expiredDate?: string;
  batchNo?: string;
  operator?: string;
}): Promise<string> {
  const { product, tipe, jumlah, keterangan, supplier, expiredDate, batchNo, operator } = params;
  const path = COLLECTIONS.STOCK_MOVEMENTS;

  try {
    const stokAwal = product.stok;
    let stokAkhir = stokAwal;
    let qtyDelta = jumlah;

    if (tipe === 'masuk') {
      stokAkhir = stokAwal + jumlah;
    } else if (tipe === 'keluar') {
      stokAkhir = Math.max(0, stokAwal - jumlah);
    } else if (tipe === 'penyesuaian') {
      // Penyesuaian sets the target stock directly
      stokAkhir = Math.max(0, jumlah);
      qtyDelta = Math.abs(stokAkhir - stokAwal);
    }

    const now = new Date().toISOString();

    // 1. Add movement log entry
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    const movementDoc = await addDoc(movementsRef, {
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      tipe,
      jumlah: qtyDelta,
      stokAwal,
      stokAkhir,
      keterangan: keterangan.trim() || `Transaksi stok ${tipe}`,
      supplier: supplier?.trim() || '',
      expiredDate: expiredDate?.trim() || '',
      batchNo: batchNo?.trim() || '',
      createdAt: now,
      operator: operator || 'Admin Toko',
    });

    // 2. Update product stock and expiredDate in Firestore
    const productRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
    const updatePayload: Record<string, any> = {
      stok: stokAkhir,
      updatedAt: now,
    };

    if (expiredDate?.trim()) {
      updatePayload.expiredDate = expiredDate.trim();
    }
    if (batchNo?.trim()) {
      updatePayload.batchNo = batchNo.trim();
    }

    await setDoc(productRef, updatePayload, { merge: true });

    return movementDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

// Subscribe to Realtime Stock Opnames
export function subscribeStockOpnames(
  onData: (opnames: StockOpname[]) => void,
  onError?: (error: Error) => void
) {
  const opnamesRef = collection(db, COLLECTIONS.STOCK_OPNAMES);
  const q = query(opnamesRef);

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const opnames: StockOpname[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          tanggal: data.tanggal || new Date().toISOString().split('T')[0],
          produkId: data.produkId || '',
          namaProduk: data.namaProduk || '',
          kodeProduk: data.kodeProduk || '',
          stokSistem: Number(data.stokSistem) || 0,
          stokFisik: Number(data.stokFisik) || 0,
          selisih: Number(data.selisih) || 0,
          alasan: data.alasan || '',
          status: data.status || 'selesai',
          createdAt: data.createdAt || new Date().toISOString(),
          operator: data.operator || 'Admin',
        };
      });

      opnames.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(opnames);
    },
    (err) => {
      console.error('Stock opnames snapshot error:', err);
      if (onError) onError(err);
      onData([]);
    }
  );

  return unsubscribe;
}

// Record Stock Opname Audit
export async function recordStockOpname(params: {
  product: ProdukItem;
  stokFisik: number;
  alasan: string;
  operator?: string;
}): Promise<string> {
  const { product, stokFisik, alasan, operator } = params;
  const path = COLLECTIONS.STOCK_OPNAMES;

  try {
    const stokSistem = product.stok;
    const selisih = stokFisik - stokSistem;
    const now = new Date().toISOString();
    const todayStr = now.split('T')[0];

    // 1. Add Stock Opname Record
    const opnamesRef = collection(db, COLLECTIONS.STOCK_OPNAMES);
    const opnameDoc = await addDoc(opnamesRef, {
      tanggal: todayStr,
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      stokSistem,
      stokFisik,
      selisih,
      alasan: alasan.trim() || 'Stock Opname Fisik Toko',
      status: 'selesai',
      createdAt: now,
      operator: operator || 'Admin Toko',
    });

    // 2. Also record in stock movements
    const movementsRef = collection(db, COLLECTIONS.STOCK_MOVEMENTS);
    await addDoc(movementsRef, {
      produkId: product.id,
      namaProduk: product.nama,
      kodeProduk: product.kode,
      tipe: 'opname',
      jumlah: Math.abs(selisih),
      stokAwal: stokSistem,
      stokAkhir: stokFisik,
      keterangan: `Stock Opname Audit: ${alasan} (Selisih: ${selisih > 0 ? '+' : ''}${selisih})`,
      createdAt: now,
      operator: operator || 'Admin Toko',
    });

    // 3. Update Product stock to stokFisik
    const productRef = doc(db, COLLECTIONS.PRODUCTS, product.id);
    await setDoc(productRef, {
      stok: stokFisik,
      updatedAt: now,
    }, { merge: true });

    return opnameDoc.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}
