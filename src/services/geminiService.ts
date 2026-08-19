import { GoogleGenAI } from '@google/genai';
import { ProdukItem, TransaksiItem } from '../types';
import { formatRupiah } from '../utils/formatters';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const env = (import.meta as any).env || {};
    const apiKey =
      env.VITE_GEMINI_API_KEY ||
      (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');

    if (apiKey) {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

export interface FirestoreDataContext {
  products: ProdukItem[];
  transactions: TransaksiItem[];
}

export interface ChatHistoryMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export interface AiChatOptions {
  prompt: string;
  history?: ChatHistoryMessage[];
  contextData?: FirestoreDataContext;
}

/**
 * Build a structured summary of Firestore data for Gemini context
 */
export function buildFirestoreContextSummary(data?: FirestoreDataContext): string {
  if (!data) return 'Data toko tidak tersedia.';

  const { products, transactions } = data;

  // 1. Calculate Today's Omset
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayTxs = transactions.filter((t) => {
    const d = new Date(t.createdAt);
    return d >= today && t.statusPembayaran !== 'retur';
  });

  const todayOmset = todayTxs.reduce((acc, t) => acc + t.totalHarga, 0);
  const todayTxCount = todayTxs.length;

  // 2. Top Sellers (terjual terbanyak)
  const sortedByTerjual = [...products].sort((a, b) => (b.terjual || 0) - (a.terjual || 0));
  const topSellers = sortedByTerjual.slice(0, 5).map(
    (p, i) => `${i + 1}. ${p.nama} (${p.kode}) - Terjual: ${p.terjual || 0} ${p.satuan}, Stok Sisa: ${p.stok}`
  );

  // 3. Low Stock (hampir habis)
  const lowStockItems = products.filter((p) => p.stok <= p.minStok);
  const lowStockList = lowStockItems.map(
    (p) => `- ${p.nama}: Sisa ${p.stok} ${p.satuan} (Min Stok: ${p.minStok})`
  );

  // 4. Dead Stock (Produk Mati / Tidak Laku - terjual == 0)
  const deadStockItems = products.filter((p) => !p.terjual || p.terjual === 0);
  const deadStockList = deadStockItems.map(
    (p) => `- ${p.nama} (${p.kode}): Stok ${p.stok} ${p.satuan}, Harga Modal: ${formatRupiah(p.hargaBeli)}`
  );

  // 5. Total Asset & Revenue
  const totalOmsetAllTime = transactions
    .filter((t) => t.statusPembayaran !== 'retur')
    .reduce((acc, t) => acc + t.totalHarga, 0);

  const totalNilaiAset = products.reduce((acc, p) => acc + p.stok * p.hargaBeli, 0);

  return `
[SUMMARY DATA TOKO SEMBAKO REAL-TIME FROM FIRESTORE]
- Tanggal Hari Ini: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}
- Omset Hari Ini: ${formatRupiah(todayOmset)} (${todayTxCount} transaksi)
- Total Omset Keseluruhan: ${formatRupiah(totalOmsetAllTime)}
- Total Nilai Modal Aset Stok: ${formatRupiah(totalNilaiAset)}
- Total SKU Produk Terdaftar: ${products.length} Jenis

[PRODUK PALING LARIS / TOP SELLERS]
${topSellers.length > 0 ? topSellers.join('\n') : 'Belum ada data penjualan.'}

[PRODUK HAMPIR HABIS / CRITICAL STOCK]
Total ${lowStockItems.length} produk hampir habis:
${lowStockList.length > 0 ? lowStockList.join('\n') : 'Semua stok dalam kondisi aman.'}

[PRODUK MATI / UNFORMED / TIDAK LAKU (Terjual = 0)]
Total ${deadStockItems.length} produk belum pernah terjual:
${deadStockList.length > 0 ? deadStockList.join('\n') : 'Semua produk pernah terjual.'}
  `.trim();
}

/**
 * Generate intelligent fallback response from Firestore data when Gemini API Key is missing
 */
function generateFirestoreSmartFallback(prompt: string, contextData?: FirestoreDataContext): string {
  if (!contextData) {
    return 'Halo! Saya Sembako Smart AI Assistant. Data toko saat ini sedang disinkronkan dengan Firestore.';
  }

  const query = prompt.toLowerCase();
  const { products, transactions } = contextData;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Question 1: Health Diagnostic (Toko Sehat atau Tidak?)
  if (
    query.includes('sehat') ||
    query.includes('kesehatan') ||
    query.includes('kondisi') ||
    query.includes('diagnosa') ||
    query.includes('performa')
  ) {
    const totalSKU = products.length;
    const lowStockCount = products.filter((p) => p.stok <= p.minStok).length;
    const deadStockCount = products.filter((p) => !p.terjual || p.terjual === 0).length;
    const activeProducts = totalSKU - deadStockCount;
    
    const todayTxs = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      return d >= today && t.statusPembayaran !== 'retur';
    });
    const todayOmset = todayTxs.reduce((acc, t) => acc + t.totalHarga, 0);

    const totalAset = products.reduce((acc, p) => acc + p.stok * p.hargaBeli, 0);
    const totalPotentialProfit = products.reduce(
      (acc, p) => acc + p.stok * (p.hargaJual - p.hargaBeli),
      0
    );

    // Calculate Store Health Score (0 - 100)
    let healthScore = 100;
    if (totalSKU > 0) {
      const lowStockPenalty = Math.min(30, (lowStockCount / totalSKU) * 50);
      const deadStockPenalty = Math.min(30, (deadStockCount / totalSKU) * 40);
      healthScore = Math.max(10, Math.round(100 - lowStockPenalty - deadStockPenalty));
    }

    let statusCategory = '🟢 SANGAT SEHAT & PRIMA';
    if (healthScore < 60) statusCategory = '🔴 PERLU PERHATIAN KHUSUS';
    else if (healthScore < 80) statusCategory = '🟡 CUKUP SEHAT (OPTIMALKAN STOK)';

    let response = `🏥 **DIAGNOSA KESEHATAN TOKO SEMBAKO**\n\n`;
    response += `Status Kesehatan Toko: **${statusCategory}**\n`;
    response += `Skor Kesehatan Bisnis: **${healthScore} / 100**\n\n`;

    response += `📊 **Rincian Indikator Utama:**\n`;
    response += `- 📦 **Ketersediaan Stok:** ${totalSKU - lowStockCount} dari ${totalSKU} produk stoknya aman (${
      totalSKU > 0 ? Math.round(((totalSKU - lowStockCount) / totalSKU) * 100) : 100
    }%)\n`;
    response += `- ⚠️ **Produk Kritis (Restok):** **${lowStockCount} SKU**\n`;
    response += `- 🧊 **Produk Mati (Slow Moving):** **${deadStockCount} SKU**\n`;
    response += `- 💰 **Nilai Aset Modal Terikat:** **${formatRupiah(totalAset)}**\n`;
    response += `- 📈 **Estimasi Potensi Laba Kotor:** **${formatRupiah(totalPotentialProfit)}**\n`;
    response += `- 🧾 **Penjualan Hari Ini:** **${todayTxs.length} Transaksi** (${formatRupiah(todayOmset)})\n\n`;

    response += `💡 **Rekomendasi Strategis AI:**\n`;
    if (lowStockCount > 0) {
      response += `1. **Restok Segera:** Ada ${lowStockCount} produk kritis yang berpotensi menyebabkan pembeli berpaling jika stok kosong.\n`;
    }
    if (deadStockCount > 0) {
      response += `2. **Cairkan Modal Mati:** Buat promo bundling paket sembako untuk ${deadStockCount} produk yang belum terjual.\n`;
    }
    response += `3. **Pertahankan Pelayanan:** Pastikan pencetakan struk dan transaksi di kasir berjalan cepat untuk kepuasan pelanggan.\n`;

    return response;
  }

  // Question 2: Barang paling laris?
  if (query.includes('laris') || query.includes('terlaris') || query.includes('paling laku')) {
    const sorted = [...products].sort((a, b) => (b.terjual || 0) - (a.terjual || 0));
    const top5 = sorted.slice(0, 5);

    if (top5.length === 0 || !top5[0].terjual) {
      return 'Saat ini belum ada data produk yang terjual pada sistem kasir Toko Sembako Anda.';
    }

    let response = `🏆 **Daftar Produk Paling Laris (Top Sellers):**\n\n`;
    top5.forEach((p, idx) => {
      response += `${idx + 1}. **${p.nama}** (${p.kode})\n   - Total Terjual: **${p.terjual || 0} ${p.satuan}**\n   - Sisa Stok: ${p.stok} ${p.satuan}\n   - Harga Jual: ${formatRupiah(p.hargaJual)}\n\n`;
    });
    response += `💡 *Saran AI:* Pastikan stok produk di atas selalu tersedia karena merupakan kontributor omset utama toko Anda!`;
    return response;
  }

  // Question 2: Barang hampir habis? / stok kritis
  if (query.includes('habis') || query.includes('menipis') || query.includes('kritis') || query.includes('restok')) {
    const lowStock = products.filter((p) => p.stok <= p.minStok);

    if (lowStock.length === 0) {
      return `✅ **Status Stok Aman!** Saat ini tidak ada produk yang berada di bawah batas stok minimum (${products.length} SKU terdaftar aman).`;
    }

    let response = `⚠️ **Peringatan Stok Hampir Habis (${lowStock.length} Produk):**\n\n`;
    lowStock.forEach((p, idx) => {
      response += `${idx + 1}. **${p.nama}** (${p.kode})\n   - Sisa Stok: **${p.stok} ${p.satuan}** (Batas Min: ${p.minStok} ${p.satuan})\n   - Kategori: ${p.kategori}\n\n`;
    });
    response += `🛍️ *Rekomendasi AI:* Segera buat Pesanan Pembelian (PO) ke pemasok untuk menghindari kehabisan stok saat pembeli datang.`;
    return response;
  }

  // Question 3: Omzet hari ini?
  if (query.includes('omzet') || query.includes('omset') || query.includes('pendapatan') || query.includes('hari ini')) {
    const todayTxs = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      return d >= today && t.statusPembayaran !== 'retur';
    });

    const todayOmset = todayTxs.reduce((acc, t) => acc + t.totalHarga, 0);
    const totalItemToday = todayTxs.reduce(
      (acc, t) => acc + t.items.reduce((sum, item) => sum + item.jumlah, 0),
      0
    );

    let response = `📊 **Laporan Omzet Hari Ini (${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}):**\n\n`;
    response += `- 💰 **Total Omzet:** **${formatRupiah(todayOmset)}**\n`;
    response += `- 🧾 **Jumlah Transaksi:** **${todayTxs.length} Transaksi**\n`;
    response += `- 📦 **Total Produk Terjual:** **${totalItemToday} Item**\n\n`;

    if (todayTxs.length > 0) {
      const avgBasket = todayOmset / todayTxs.length;
      response += `- 🛒 Rata-rata Pembelian per Transaksi: **${formatRupiah(avgBasket)}**\n`;
    }

    response += `\n📈 *Catatan AI:* Data ini diperbarui secara real-time langsung dari Firestore Kasir Sembako.`;
    return response;
  }

  // Question 4: Produk mati / tidak laku?
  if (query.includes('mati') || query.includes('tidak laku') || query.includes('slow moving') || query.includes('unformed')) {
    const deadStock = products.filter((p) => !p.terjual || p.terjual === 0);

    if (deadStock.length === 0) {
      return `🎉 **Luar Biasa!** Tidak ada produk mati. Seluruh ${products.length} variasi sembako di toko Anda telah memiliki riwayat penjualan.`;
    }

    const totalDeadValue = deadStock.reduce((acc, p) => acc + p.stok * p.hargaBeli, 0);

    let response = `🧊 **Daftar Produk Mati / Belum Ada Penjualan (${deadStock.length} SKU):**\n\n`;
    deadStock.slice(0, 8).forEach((p, idx) => {
      response += `${idx + 1}. **${p.nama}** (${p.kategori})\n   - Stok Mengendap: ${p.stok} ${p.satuan}\n   - Nilai Modal Terikat: ${formatRupiah(p.stok * p.hargaBeli)}\n\n`;
    });

    if (deadStock.length > 8) {
      response += `*...dan ${deadStock.length - 8} produk mati lainnya.*\n\n`;
    }

    response += `💰 **Total Modal Terikat di Produk Mati:** **${formatRupiah(totalDeadValue)}**\n\n`;
    response += `💡 *Strategi AI:* Pertimbangkan membuat diskon bundling dengan produk terlaris atau promo paket sembako hemat untuk mencairkan modal terikat.`;
    return response;
  }

  // General default fallback answer using full Firestore Context
  const summaryContext = buildFirestoreContextSummary(contextData);
  return (
    `[Sembako Smart AI Assistant]\n\n` +
    `Terima kasih telah bertanya! Berdasarkan analisis data Firestore toko saat ini:\n\n` +
    `Pertanyaan: "${prompt}"\n\n` +
    `• **Kondisi Toko Real-time:**\n` +
    `  - Total SKU: ${products.length} variasi\n` +
    `  - Omzet Hari Ini: ${formatRupiah(
      transactions
        .filter((t) => new Date(t.createdAt) >= today && t.statusPembayaran !== 'retur')
        .reduce((a, b) => a + b.totalHarga, 0)
    )}\n` +
    `  - Stok Menipis: ${products.filter((p) => p.stok <= p.minStok).length} barang\n\n` +
    `💡 *Rekomendasi Operasional AI:* Tingkatkan promosi paket sembako murah menjelang awal bulan dan pantau terus stok beras, minyak goreng, dan gula pasir.\n\n` +
    `*(Keterangan: Layanan AI Engine siap terhubung secara penuh saat API Key diaktifkan di Secrets)*`
  );
}

/**
 * Send Prompt to Gemini AI Assistant with full Firestore Context Memory
 */
export async function askGeminiAssistant(options: AiChatOptions): Promise<string> {
  const client = getAiClient();
  const contextSummary = buildFirestoreContextSummary(options.contextData);

  if (!client) {
    // Intelligent fallback with exact live calculations when API key is pending
    return new Promise((resolve) => {
      setTimeout(() => {
        const fallbackText = generateFirestoreSmartFallback(options.prompt, options.contextData);
        resolve(fallbackText);
      }, 700);
    });
  }

  try {
    const systemInstruction =
      "Anda adalah Sembako Smart AI, asisten virtual analitik bisnis senior khusus untuk pemilik toko sembako dan kelontong di Indonesia. " +
      "Gunakan data real-time toko yang diberikan dalam konteks secara presisi. Berikan jawaban dalam bahasa Indonesia yang ramah, ringkas, mudah dipahami, berstruktur menggunakan bold & markdown bullet points, serta berikan rekomendasi aksi solutif.";

    const contents = [
      ...(options.history || []),
      {
        role: 'user' as const,
        parts: [
          {
            text: `[DATA REALTIME TOKO DARI FIRESTORE]:\n${contextSummary}\n\n[PERTANYAAN PEMILIK TOKO]:\n${options.prompt}`,
          },
        ],
      },
    ];

    let response;
    try {
      response = await client.models.generateContent({
        model: 'gemini-3.7-flash',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
    } catch (modelErr: any) {
      if (modelErr?.message?.includes('404') || modelErr?.message?.includes('not found') || modelErr?.message?.includes('no longer available')) {
        response = await client.models.generateContent({
          model: 'gemini-3.6-flash',
          contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
      } else {
        throw modelErr;
      }
    }

    return response.text ?? 'Maaf, AI tidak dapat menghasilkan jawaban saat ini.';
  } catch (error: any) {
    console.warn('Gemini API Warning / Error, falling back to local Firestore engine:', error);
    return generateFirestoreSmartFallback(options.prompt, options.contextData);
  }
}

