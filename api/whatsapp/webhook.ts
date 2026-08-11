import { processProductWebhook, processStockUpdateWebhook } from '../../src/services/backendStore';

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
      supportedFormat: 'PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok ATAU STOK#Nama#TambahanStok'
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

      // Check if message is a direct stock add command (e.g. STOK#Minyak Bimoli 2L#30 or TAMBAHSTOK#Minyak Bimoli 2L#20)
      const isStockOnlyCmd = (messageText.toUpperCase().startsWith('STOK#') || messageText.toUpperCase().startsWith('TAMBAHSTOK#')) && messageText.includes('#');
      if (isStockOnlyCmd) {
        const parts = messageText.split('#').map((p: string) => p.trim());
        const nama = parts[1] || 'Produk';
        const addedStock = parseInt(parts[2]?.replace(/\D/g, '') || '0', 10);

        const replyMsg = await processStockUpdateWebhook(nama, addedStock, sender);
        return res.status(200).json({
          data: [
            {
              message: replyMsg
            }
          ]
        });
      }

      // Check if message matches product creation/update format
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

        // Process in Firestore (Add new or Update existing stock)
        const result = await processProductWebhook({
          nama,
          kategori,
          hargaBeli,
          hargaJual: hargaJual || Math.round(hargaBeli * 1.15),
          stok,
          satuan,
          minStok,
          sender
        });

        return res.status(200).json({
          data: [
            {
              message: result.message
            }
          ]
        });
      }

      // Check for !stok command
      if (messageText.toLowerCase().startsWith('!stok') || messageText.toLowerCase().startsWith('!cekstok')) {
        const replyMessage = '📦 [POS Toko Sembako] Layanan Bot Cek Stok Aktif. Silakan gunakan dashboard POS untuk melihat laporan lengkap.';
        return res.status(200).json({
          data: [
            {
              message: replyMessage
            }
          ]
        });
      }

      // Default response
      const defaultReply = 'ℹ️ [POS Toko Sembako] Format pesan tidak dikenali.\n\n• Tambah/Update Produk:\nPRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok\n\n• Tambah Stok Saja:\nSTOK#Nama#JumlahStokBaru';
      return res.status(200).json({
        data: [
          {
            message: defaultReply
          }
        ]
      });
    } catch (err: any) {
      console.error('Webhook error:', err);
      return res.status(200).json({
        data: [
          {
            message: `❌ [POS Toko Sembako] Gagal memproses data: ${err?.message || 'Error internal server'}`
          }
        ]
      });
    }
  }

  // Fallback for any other HTTP method
  return res.status(200).json({ status: true, message: 'Webhook endpoint active' });
}

