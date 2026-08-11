export default async function handler(req: any, res: any) {
  // Enable CORS for Vercel Serverless Function
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  const method = (req.method || 'GET').toUpperCase();

  // 1. Handle OPTIONS Preflight request
  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Handle GET Request (Webhook URL testing / verification)
  if (method === 'GET') {
    const hubChallenge = req.query ? req.query['hub.challenge'] : null;
    if (hubChallenge) {
      return res.status(200).send(String(hubChallenge));
    }
    return res.status(200).json({
      status: true,
      message: 'WhatsApp Webhook Endpoint POS Toko Sembako Siap Menerima HTTP POST',
      documentation: 'Kirim HTTP POST ke endpoint ini dengan payload JSON/Form dari Fonnte, Wablas, Whacenter, atau Custom Bot.',
      supportedFormat: 'PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok'
    });
  }

  // 3. Handle POST Request (WhatsApp Bot Message Payload)
  if (method === 'POST') {
    try {
      let body = req.body || {};
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = { text: body };
        }
      }

      // Extract sender and message text from various WA Gateway formats (Fonnte, Wablas, Whacenter, UltraMsg, etc)
      const sender = body.sender || body.from || body.phone || body.wa_number || body.pushName || 'WhatsApp User';
      const messageText = (body.message || body.text || body.body || body.caption || body.payload || '').toString().trim();

      if (!messageText) {
        return res.status(200).json({
          status: true,
          detail: 'Pesan diterima (kosong/non-teks)'
        });
      }

      // Check if message matches product creation format
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

        const newProduct = {
          kode: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          barcode: `${Math.floor(8990000000000 + Math.random() * 9999999)}`,
          nama,
          kategori,
          hargaBeli,
          hargaJual: hargaJual || Math.round(hargaBeli * 1.15),
          stok,
          minStok,
          satuan,
          gambarUrl: '',
          deskripsi: `Otomatis diimpor oleh WhatsApp Bot Webhook (Pengirim: ${sender})`,
          expiredDate: '',
          batchNo: '',
          terjual: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const replyMessage = `✅ [POS Toko Sembako] Produk "${nama}" berhasil ditambahkan ke katalog toko dengan stok ${stok} ${satuan}!`;

        return res.status(200).json({
          status: true,
          detail: `Berhasil memproses produk "${nama}"`,
          reply: replyMessage,
          response: replyMessage,
          text: replyMessage,
          message: replyMessage,
          data: [
            {
              message: replyMessage,
              product: newProduct
            }
          ]
        });
      }

      // Check for !stok command
      if (messageText.toLowerCase().startsWith('!stok') || messageText.toLowerCase().startsWith('!cekstok')) {
        const replyMessage = '📦 [POS Toko Sembako] Layanan Bot Cek Stok Aktif. Silakan gunakan dashboard POS untuk melihat laporan lengkap.';
        return res.status(200).json({
          status: true,
          detail: 'Perintah !stok diproses',
          reply: replyMessage,
          response: replyMessage,
          text: replyMessage,
          message: replyMessage,
          data: [
            {
              message: replyMessage
            }
          ]
        });
      }

      // Default response
      const defaultReply = 'ℹ️ [POS Toko Sembako] Format pesan tidak dikenali. Gunakan format: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok untuk menambah produk.';
      return res.status(200).json({
        status: true,
        detail: 'Pesan diterima tetapi tidak memicu kata kunci khusus',
        reply: defaultReply,
        response: defaultReply,
        text: defaultReply,
        message: defaultReply,
        help: 'Gunakan format PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok untuk menambah produk.'
      });
    } catch (err: any) {
      return res.status(200).json({
        status: false,
        message: err?.message || 'Internal Webhook Error'
      });
    }
  }

  // Fallback for any other HTTP method
  return res.status(200).json({ status: true, message: 'Webhook endpoint active' });
}
