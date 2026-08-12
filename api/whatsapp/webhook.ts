import { processProductWebhook, processStockUpdateWebhook } from '../../src/services/backendStore';

export default async function handler(req: any, res: any) {
  try {
    // Enable CORS for Vercel Serverless Function & WA Gateways
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    const method = (req.method || 'GET').toUpperCase();

    if (method === 'OPTIONS') {
      return res.status(200).end();
    }

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

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        try {
          const params = new URLSearchParams(body);
          const parsed: Record<string, any> = {};
          params.forEach((val, key) => { parsed[key] = val; });
          if (Object.keys(parsed).length > 0) body = parsed;
        } catch (e2) {
          body = { text: body };
        }
      }
    }
    if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch (e) {
        body = {};
      }
    }

    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    } else if (body && Array.isArray(body.data) && body.data.length > 0) {
      body = body.data[0];
    }

    const sender = body.sender || body.from || body.phone || body.wa_number || body.number || body.pushName || 'WhatsApp User';
    const messageText = (body.message || body.text || body.body || body.caption || body.payload || body.pesan || '').toString().trim();

    if (!messageText) {
      return res.status(200).json({
        data: [
          {
            message: '✅ [POS Toko Sembako] Webhook terkoneksi dengan baik.'
          }
        ]
      });
    }

    // Command: STOK#Nama#Jumlah (or TAMBAHSTOK#Nama#Jumlah)
    const isStockOnlyCmd = (messageText.toUpperCase().startsWith('STOK#') || messageText.toUpperCase().startsWith('TAMBAHSTOK#')) && messageText.includes('#');
    if (isStockOnlyCmd) {
      const parts = messageText.split('#').map((p: string) => p.trim());
      const nama = parts[1] || 'Produk';
      const addedStock = parseInt(parts[2]?.replace(/\D/g, '') || '0', 10);

      const replyMsg = await processStockUpdateWebhook(nama, addedStock, String(sender));
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
      const kategori = parts[startIndex + 1] || 'Sembako Utama';
      const hargaBeli = parseInt(parts[startIndex + 2]?.replace(/\D/g, '') || '10000', 10);
      const hargaJual = parseInt(parts[startIndex + 3]?.replace(/\D/g, '') || '12000', 10);
      const stok = parseInt(parts[startIndex + 4]?.replace(/\D/g, '') || '10', 10);
      const satuan = parts[startIndex + 5] || 'Pcs';
      const minStok = parseInt(parts[startIndex + 6]?.replace(/\D/g, '') || '5', 10);

      const result = await processProductWebhook({
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
            message: result.message
          }
        ]
      });
    }

    if (messageText.toLowerCase().startsWith('!stok') || messageText.toLowerCase().startsWith('!cekstok')) {
      return res.status(200).json({
        data: [
          {
            message: '📦 [POS Toko Sembako] Layanan Bot Cek Stok Aktif.'
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
    console.error('Webhook Exception:', err);
    return res.status(200).json({
      data: [
        {
          message: '✅ [POS Toko Sembako] Webhook aktif dan siap menerima pesan.'
        }
      ]
    });
  }
}
