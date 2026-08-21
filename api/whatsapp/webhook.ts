import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Helper to get server-side Supabase client with strict environment variable validation
function getSupabaseServerClient(): SupabaseClient {
  console.log('[WA SUPABASE CONFIG]', {
    urlConfigured: !!process.env.SUPABASE_URL,
    serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY
  });

  if (!process.env.SUPABASE_URL) {
    throw new Error('SUPABASE_URL missing');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY missing');
  }

  const url = process.env.SUPABASE_URL.trim().replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim().replace(/^bearer\s+/i, '');

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

// Map sender phone to store_id and store name
function resolveStoreInfo(sender: string): { storeId: string; storeName: string } {
  const clean = (sender || '').replace(/\D/g, '');
  
  if (clean.includes('85223335816')) {
    return { storeId: 'store_toko_sembako_samsidi', storeName: 'Toko Sembako Samsidi' };
  }
  if (clean.includes('81234567890')) {
    return { storeId: 'store_toko_berkah_sembako_utama', storeName: 'Toko Berkah Sembako Utama' };
  }
  if (clean.includes('85712345678')) {
    return { storeId: 'store_warung_sembako_barokah', storeName: 'Warung Sembako Barokah' };
  }
  if (clean.includes('81398765432')) {
    return { storeId: 'store_minimarket_sumber_rezeki', storeName: 'Minimarket Sumber Rezeki' };
  }
  
  // Default to Toko Sembako Samsidi
  return { storeId: 'store_toko_sembako_samsidi', storeName: 'Toko Sembako Samsidi' };
}

interface ParsedProduct {
  name: string;
  category: string;
  purchase_price: number;
  selling_price: number;
  stock: number;
  unit: string;
  minimum_stock: number;
}

// Parse WhatsApp product message
function parseProductMessage(messageText: string): ParsedProduct | null {
  const upper = messageText.toUpperCase();
  
  // 1. Delimited Format: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok
  if (upper.startsWith('PRODUK#') || upper.startsWith('PRODUK|') || upper.startsWith('PRODUK:') || (messageText.includes('#') && messageText.split('#').length >= 3)) {
    const delimiter = messageText.includes('#') ? '#' : messageText.includes('|') ? '|' : ':';
    const parts = messageText.split(delimiter).map(p => p.trim());
    const startIndex = parts[0].toUpperCase() === 'PRODUK' || parts[0].toUpperCase() === 'TAMBAH' ? 1 : 0;

    const name = parts[startIndex] || '';
    if (!name) return null;

    const category = parts[startIndex + 1] || 'Sembako & Bumbu';
    const purchase_price = parseInt(parts[startIndex + 2]?.replace(/\D/g, '') || '0', 10);
    const rawSellingPrice = parseInt(parts[startIndex + 3]?.replace(/\D/g, '') || '0', 10);
    const selling_price = rawSellingPrice > 0 ? rawSellingPrice : Math.round(purchase_price * 1.15) || 12000;
    const stock = parseInt(parts[startIndex + 4]?.replace(/\D/g, '') || '10', 10);
    const unit = parts[startIndex + 5] || 'Pcs';
    const minimum_stock = parseInt(parts[startIndex + 6]?.replace(/\D/g, '') || '5', 10);

    return {
      name,
      category,
      purchase_price,
      selling_price,
      stock,
      unit,
      minimum_stock
    };
  }

  // 2. Multiline Format
  if (messageText.includes('\n') && (upper.includes('NAMA') || upper.includes('PRODUK') || upper.includes('HARGA') || upper.includes('STOK'))) {
    const lines = messageText.split('\n').map(l => l.trim()).filter(Boolean);
    let name = '';
    let category = 'Sembako & Bumbu';
    let purchase_price = 0;
    let selling_price = 0;
    let stock = 10;
    let unit = 'Pcs';
    let minimum_stock = 5;

    lines.forEach(line => {
      const lUpper = line.toUpperCase();
      if (lUpper.startsWith('NAMA') || lUpper.startsWith('PRODUK')) {
        name = line.split(/[:#=-]/).slice(1).join(':').trim() || name;
      } else if (lUpper.startsWith('KATEGORI')) {
        category = line.split(/[:#=-]/).slice(1).join(':').trim() || category;
      } else if (lUpper.includes('BELI') || lUpper.includes('MODAL') || lUpper.includes('KULAK')) {
        const num = parseInt(line.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) purchase_price = num;
      } else if (lUpper.includes('JUAL') || lUpper.includes('HARGA')) {
        const num = parseInt(line.replace(/\D/g, ''), 10);
        if (!isNaN(num) && num > 0) selling_price = num;
      } else if (lUpper.startsWith('STOK') || lUpper.startsWith('JUMLAH') || lUpper.startsWith('QTY')) {
        const num = parseInt(line.replace(/\D/g, ''), 10);
        if (!isNaN(num)) stock = num;
      } else if (lUpper.startsWith('SATUAN')) {
        unit = line.split(/[:#=-]/).slice(1).join(':').trim() || unit;
      } else if (lUpper.includes('MIN')) {
        const num = parseInt(line.replace(/\D/g, ''), 10);
        if (!isNaN(num)) minimum_stock = num;
      }
    });

    if (!name && lines.length > 0) {
      name = lines[0].replace(/^(PRODUK|TAMBAH PRODUK|TAMBAH)\s*[:#=-]?\s*/i, '').trim();
    }

    if (name) {
      return {
        name,
        category,
        purchase_price,
        selling_price: selling_price || Math.round(purchase_price * 1.15) || 12000,
        stock,
        unit,
        minimum_stock
      };
    }
  }

  return null;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET Verification & Health Check
  if (method === 'GET') {
    const hubChallenge = req.query ? req.query['hub.challenge'] : null;
    if (hubChallenge) {
      return res.status(200).send(String(hubChallenge));
    }
    return res.status(200).json({
      status: true,
      message: '✅ [POS Toko Sembako] Webhook WhatsApp Vercel Serverless Function Aktif & Siap',
      service: 'Sembako Smart AI WhatsApp Webhook Listener',
      supportedCommands: [
        'PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok',
        'STOK#NamaProduk#JumlahTambah',
        '!stok (Cek Ringkasan Stok Toko)'
      ]
    });
  }

  try {
    // 1. Safe Request Body Extraction
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e1) {
        try {
          const params = new URLSearchParams(body);
          const parsedObj: Record<string, any> = {};
          params.forEach((val, key) => { parsedObj[key] = val; });
          if (Object.keys(parsedObj).length > 0) body = parsedObj;
        } catch (e2) {
          body = { message: body };
        }
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch (e) {
        body = {};
      }
    }

    if (!body || typeof body !== 'object') {
      body = {};
    }

    // Unwrap array payloads (e.g. Fonnte / Wablas array format)
    if (Array.isArray(body) && body.length > 0) {
      body = body[0];
    } else if (body && Array.isArray(body.data) && body.data.length > 0) {
      body = body.data[0];
    }

    // Extract Sender and Message
    const sender = String(
      body.sender || 
      body.from || 
      body.phone || 
      body.wa_number || 
      body.number || 
      body.pushName || 
      body.sender_number || 
      'WhatsApp User'
    );
    const rawMsg = body.message || body.text || body.body || body.caption || body.payload || body.pesan || body.text_message || '';
    const messageText = typeof rawMsg === 'string' ? rawMsg.trim() : typeof rawMsg === 'object' ? JSON.stringify(rawMsg) : String(rawMsg).trim();

    if (!messageText) {
      const pingMsg = '✅ [POS Toko Sembako] Webhook terkoneksi dengan sukses! Layanan bot siap menerima perintah STOK# dan PRODUK#.';
      return res.status(200).json({
        status: true,
        message: pingMsg,
        reply: pingMsg,
        data: [{ message: pingMsg }]
      });
    }

    const upperMsg = messageText.toUpperCase();

    // Initialize Supabase Server Client
    let supabase: SupabaseClient;
    try {
      supabase = getSupabaseServerClient();
    } catch (configErr: any) {
      console.error('[WA SUPABASE ERROR]', configErr?.message);
      return res.status(200).json({
        status: false,
        message: `❌ Koneksi server Supabase belum terkonfigurasi: ${configErr?.message}`,
        error: configErr?.message || 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing',
        reply: `❌ [POS Toko Sembako] Gagal terhubung ke database cloud Supabase (${configErr?.message}).`,
        data: [{ message: `❌ [POS Toko Sembako] Gagal terhubung ke database cloud Supabase (${configErr?.message}).` }]
      });
    }

    // Identify Store ID
    const { storeId, storeName } = resolveStoreInfo(sender);

    console.log('[WABLAS RECEIVED]', new Date().toISOString());
    console.log('[WABLAS RAW BODY]', typeof body === 'object' ? JSON.stringify(body) : body);
    console.log('[WABLAS SENDER]', sender);
    console.log('[WABLAS MESSAGE]', messageText);
    console.log('[STORE FOUND]', { storeId, storeName });

    // Helper to persist webhook log to Supabase
    const recordWebhookLog = async (status: 'success' | 'error' | 'ignored', actionTaken: string) => {
      try {
        if (supabase) {
          await supabase.from('webhook_logs').insert([{
            store_id: storeId,
            sender: sender,
            message_text: messageText,
            raw_body: typeof body === 'object' ? JSON.stringify(body) : String(body),
            status: status,
            action_taken: actionTaken,
            created_at: new Date().toISOString()
          }]);
        }
      } catch (_) {}
    };

    // =========================================================================
    // FLOW A: PRODUK# (TAMBAH / INSERT PRODUK BARU KE SUPABASE)
    // =========================================================================
    const isProductCmd = upperMsg.startsWith('PRODUK#') || 
                         upperMsg.startsWith('PRODUK|') || 
                         upperMsg.startsWith('PRODUK:') || 
                         upperMsg.startsWith('TAMBAH#') ||
                         (messageText.includes('#') && (upperMsg.includes('PRODUK') || upperMsg.includes('SEMBAKO') || messageText.split('#').length >= 4)) ||
                         (messageText.includes('\n') && (upperMsg.includes('NAMA') || upperMsg.includes('PRODUK')));

    if (isProductCmd) {
      const parsed = parseProductMessage(messageText);

      console.log('[PRODUCT PARSED]', parsed);

      if (!parsed || !parsed.name) {
        await recordWebhookLog('error', 'Format pesan produk tidak valid');
        return res.status(200).json({
          status: false,
          message: 'Format pesan produk tidak valid. Contoh: PRODUK#Tepung Segitiga Biru 1kg#Bumbu & Tepung#11000#13000#25#Kg#5',
          reply: '❌ Format pesan tidak valid. Gunakan: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok',
          data: [{ message: '❌ Format pesan tidak valid. Gunakan: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok' }]
        });
      }

      // Check if product already exists in Supabase
      const { data: existingProds } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .ilike('nama', parsed.name)
        .limit(1);

      const existingProduct = existingProds && existingProds.length > 0 ? existingProds[0] : null;

      if (existingProduct) {
        // UPDATE EXISTING PRODUCT
        const oldStock = Number(existingProduct.stok) || 0;
        const newStock = oldStock + parsed.stock;
        const now = new Date().toISOString();

        const updatePayload: Record<string, any> = {
          stok: newStock,
          updated_at: now
        };
        if (parsed.purchase_price > 0) updatePayload.harga_beli = parsed.purchase_price;
        if (parsed.selling_price > 0) updatePayload.harga_jual = parsed.selling_price;
        if (parsed.category) updatePayload.kategori = parsed.category;
        if (parsed.unit) updatePayload.satuan = parsed.unit;

        console.log('[SUPABASE INSERT PAYLOAD]', updatePayload);

        const { data: updateData, error: updateError } = await supabase
          .from('products')
          .update(updatePayload)
          .eq('id', existingProduct.id)
          .select()
          .single();

        console.log('[SUPABASE INSERT DATA]', updateData);
        console.log('[SUPABASE INSERT ERROR]', updateError);

        if (updateError || !updateData) {
          await recordWebhookLog('error', `Gagal update produk: ${updateError?.message}`);
          return res.status(200).json({
            status: false,
            message: 'Produk gagal diperbarui di database.',
            error: updateError?.message,
            reply: `❌ [POS Toko Sembako] Gagal memperbarui stok "${parsed.name}" ke database.`,
            data: [{ message: `❌ [POS Toko Sembako] Gagal memperbarui stok "${parsed.name}" ke database.` }]
          });
        }

        // STEP 9: VERIFIKASI SETELAH UPDATE
        const { data: verifyData, error: verifyError } = await supabase
          .from('products')
          .select('*')
          .eq('id', updateData.id)
          .single();

        console.log('[PRODUCT VERIFIED]', verifyData);

        if (verifyError || !verifyData) {
          await recordWebhookLog('error', `Verifikasi update gagal untuk ${parsed.name}`);
          return res.status(200).json({
            status: false,
            message: 'Verifikasi produk di database gagal setelah update.',
            reply: `❌ [POS Toko Sembako] Verifikasi database gagal untuk "${parsed.name}".`,
            data: [{ message: `❌ [POS Toko Sembako] Verifikasi database gagal untuk "${parsed.name}".` }]
          });
        }

        // Record stock movement log in Supabase
        try {
          await supabase.from('stock_movements').insert([{
            store_id: storeId,
            produk_id: String(updateData.id),
            nama_produk: updateData.nama,
            kode_produk: updateData.kode || '',
            tipe: 'masuk',
            jumlah: parsed.stock,
            stok_awal: oldStock,
            stok_akhir: newStock,
            keterangan: `Tambah stok via WhatsApp (${sender})`,
            operator: 'WhatsApp Bot',
            created_at: now
          }]);
        } catch (_) {}

        const actionText = `Stok "${parsed.name}" diperbarui: ${oldStock} -> ${newStock} (${storeName})`;
        await recordWebhookLog('success', actionText);

        const replyMsg = `✅ [POS Toko Sembako] Produk "${parsed.name}" BERHASIL DIPERBARUI!\n\n` +
                         `📦 Stok Awal: ${oldStock} ${parsed.unit}\n` +
                         `➕ Tambahan: +${parsed.stock} ${parsed.unit}\n` +
                         `📊 Total Stok Sekarang: ${newStock} ${parsed.unit}\n` +
                         `💰 Harga Jual: Rp ${Number(updateData.harga_jual).toLocaleString('id-ID')}\n` +
                         `🏬 Toko: ${storeName}`;

        return res.status(200).json({
          status: true,
          message: replyMsg,
          reply: replyMsg,
          product_id: updateData.id,
          data: [{ message: replyMsg }]
        });

      } else {
        // STEP 3: INSERT NEW PRODUCT TO TABLE products
        const now = new Date().toISOString();
        const sku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;

        const payload = {
          store_id: storeId,
          kode: sku,
          nama: parsed.name,
          kategori: parsed.category,
          harga_beli: parsed.purchase_price,
          harga_jual: parsed.selling_price,
          stok: parsed.stock,
          satuan: parsed.unit,
          min_stok: parsed.minimum_stock,
          terjual: 0,
          created_at: now,
          updated_at: now
        };

        console.log('[SUPABASE INSERT PAYLOAD]', payload);

        // STEP 3: INSERT Supabase
        const { data, error } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();

        console.log('[SUPABASE INSERT DATA]', data);
        console.log('[SUPABASE INSERT ERROR]', error);

        if (error || !data) {
          await recordWebhookLog('error', `Gagal insert produk baru: ${error?.message}`);
          return res.status(200).json({
            status: false,
            message: 'Produk gagal disimpan ke database.',
            error: error?.message,
            reply: `❌ [POS Toko Sembako] Produk "${parsed.name}" gagal disimpan ke database. (${error?.message || 'Database error'})`,
            data: [{ message: `❌ [POS Toko Sembako] Produk "${parsed.name}" gagal disimpan ke database.` }]
          });
        }

        // STEP 9: VERIFIKASI INSERT SETELAH INSERT
        const { data: verifyData, error: verifyError } = await supabase
          .from('products')
          .select('*')
          .eq('id', data.id)
          .single();

        console.log('[PRODUCT VERIFIED]', verifyData);

        if (verifyError || !verifyData) {
          await recordWebhookLog('error', `Verifikasi insert gagal untuk ${parsed.name}`);
          return res.status(200).json({
            status: false,
            message: 'Verifikasi produk di database gagal.',
            error: verifyError?.message,
            reply: `❌ [POS Toko Sembako] Verifikasi data gagal untuk "${parsed.name}".`,
            data: [{ message: `❌ [POS Toko Sembako] Verifikasi data gagal untuk "${parsed.name}".` }]
          });
        }

        // Record stock movement log in Supabase
        try {
          await supabase.from('stock_movements').insert([{
            store_id: storeId,
            produk_id: String(data.id),
            nama_produk: data.nama,
            kode_produk: data.kode || sku,
            tipe: 'masuk',
            jumlah: parsed.stock,
            stok_awal: 0,
            stok_akhir: parsed.stock,
            keterangan: `Produk baru diinput via WhatsApp (${sender})`,
            operator: 'WhatsApp Bot',
            created_at: now
          }]);
        } catch (_) {}

        const actionText = `Produk baru "${parsed.name}" berhasil ditambahkan: Stok ${parsed.stock} ${parsed.unit} (${storeName})`;
        await recordWebhookLog('success', actionText);

        // STEP 10: RESPONSE YANG BENAR - ONLY AFTER STRICT DATABASE INSERT & VERIFICATION SUCCESS
        const replyMsg = `✅ [POS Toko Sembako] Produk baru "${parsed.name}" BERHASIL DITAMBAHKAN!\n\n` +
                         `📦 Stok Awal: ${parsed.stock} ${parsed.unit}\n` +
                         `💰 Harga Jual: Rp ${parsed.selling_price.toLocaleString('id-ID')}\n` +
                         `🏷️ Kategori: ${parsed.category}\n` +
                         `🏬 Toko: ${storeName}`;

        return res.status(200).json({
          status: true,
          message: replyMsg,
          reply: replyMsg,
          product_id: data.id,
          data: [{ message: replyMsg }]
        });
      }
    }

    // =========================================================================
    // FLOW B: STOK# (TAMBAH STOK CEPAT)
    // =========================================================================
    const isStockOnlyCmd = (upperMsg.startsWith('STOK#') || upperMsg.startsWith('TAMBAHSTOK#')) && messageText.includes('#');

    if (isStockOnlyCmd) {
      const parts = messageText.split('#').map(p => p.trim());
      const namaProduk = parts[1] || '';
      const addedStock = parseInt(parts[2]?.replace(/\D/g, '') || '0', 10);

      console.log('[WA STOCK] RAW MESSAGE:', messageText);
      console.log('[WA STOCK] NAMA:', namaProduk, '| ADDED:', addedStock);
      console.log('[WA STOCK] STORE ID:', storeId);

      if (!namaProduk || addedStock <= 0) {
        return res.status(200).json({
          status: false,
          message: 'Format perintah stok tidak valid. Contoh: STOK#Beras Setra Ramos#10',
          reply: '❌ Format salah. Gunakan: STOK#NamaProduk#JumlahTambah',
          data: [{ message: '❌ Format salah. Gunakan: STOK#NamaProduk#JumlahTambah' }]
        });
      }

      // Find matching product in Supabase
      const { data: matchedRows } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .ilike('nama', `%${namaProduk}%`)
        .limit(1);

      if (matchedRows && matchedRows.length > 0) {
        const prod = matchedRows[0];
        const oldStock = Number(prod.stok) || 0;
        const newStock = oldStock + addedStock;
        const now = new Date().toISOString();

        const { data: updateData, error: updateError } = await supabase
          .from('products')
          .update({ stok: newStock, updated_at: now })
          .eq('id', prod.id)
          .select()
          .single();

        if (updateError || !updateData) {
          console.error('[WA STOCK UPDATE FAILED]', updateError);
          return res.status(200).json({
            status: false,
            message: 'Stok gagal diperbarui ke database.',
            error: updateError?.message,
            reply: `❌ [POS Toko Sembako] Gagal update stok "${prod.nama}".`,
            data: [{ message: `❌ [POS Toko Sembako] Gagal update stok "${prod.nama}".` }]
          });
        }

        // Verify
        const { data: verifyData, error: verifyError } = await supabase
          .from('products')
          .select('*')
          .eq('id', updateData.id)
          .single();

        if (verifyError || !verifyData) {
          return res.status(200).json({
            status: false,
            message: 'Verifikasi database gagal.',
            reply: `❌ Verifikasi database gagal untuk "${prod.nama}".`,
            data: [{ message: `❌ Verifikasi database gagal untuk "${prod.nama}".` }]
          });
        }

        const replyMsg = `✅ [POS Toko Sembako] Stok "${prod.nama}" BERHASIL DITAMBAHKAN!\n\n` +
                         `📦 Stok Awal: ${oldStock} ${prod.satuan || 'Pcs'}\n` +
                         `➕ Tambahan: +${addedStock} ${prod.satuan || 'Pcs'}\n` +
                         `📊 Total Stok Sekarang: ${newStock} ${prod.satuan || 'Pcs'}\n` +
                         `🏬 Toko: ${storeName}`;

        return res.status(200).json({
          status: true,
          message: replyMsg,
          reply: replyMsg,
          product_id: updateData.id,
          data: [{ message: replyMsg }]
        });

      } else {
        // Product does not exist -> create new
        const now = new Date().toISOString();
        const sku = `SKU-${Math.floor(1000 + Math.random() * 9000)}`;
        const payload = {
          store_id: storeId,
          kode: sku,
          nama: namaProduk,
          kategori: 'Sembako Utama',
          harga_beli: 10000,
          harga_jual: 12000,
          stok: addedStock,
          satuan: 'Pcs',
          min_stok: 5,
          terjual: 0,
          created_at: now,
          updated_at: now
        };

        const { data: insertData, error: insertError } = await supabase
          .from('products')
          .insert([payload])
          .select()
          .single();

        if (insertError || !insertData) {
          return res.status(200).json({
            status: false,
            message: 'Produk gagal disimpan ke database.',
            error: insertError?.message,
            reply: `❌ Gagal menambahkan produk baru "${namaProduk}".`,
            data: [{ message: `❌ Gagal menambahkan produk baru "${namaProduk}".` }]
          });
        }

        const replyMsg = `✅ [POS Toko Sembako] Produk baru "${namaProduk}" BERHASIL DITAMBAHKAN!\n\n` +
                         `📦 Stok Awal: ${addedStock} Pcs\n` +
                         `🏬 Toko: ${storeName}`;

        return res.status(200).json({
          status: true,
          message: replyMsg,
          reply: replyMsg,
          product_id: insertData.id,
          data: [{ message: replyMsg }]
        });
      }
    }

    // =========================================================================
    // FLOW C: !stok / !cekstok (RINGKASAN STOK)
    // =========================================================================
    if (upperMsg.startsWith('!STOK') || upperMsg.startsWith('!CEKSTOK') || upperMsg === 'STOK' || upperMsg === 'CEK STOK') {
      const { data: prods } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(8);

      const itemsList = (prods || []).map(p => `• ${p.nama}: ${p.stok} ${p.satuan || 'Pcs'} (Rp ${Number(p.harga_jual).toLocaleString('id-ID')})`).join('\n');
      const replyMsg = `📦 *[POS TOKO SEMBAKO - INFO STOK]*\n🏬 Toko: ${storeName}\n\n*Daftar Produk Terkini:*\n${itemsList || '(Belum ada produk)'}\n\n_Ketik PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan untuk menambah produk baru._`;

      return res.status(200).json({
        status: true,
        message: replyMsg,
        reply: replyMsg,
        data: [{ message: replyMsg }]
      });
    }

    // Default Reply for unparsed messages
    const defaultMsg = 'ℹ️ *[POS Toko Sembako AI Bot]*\n\n' +
                       'Format yang didukung:\n' +
                       '1. *Tambah Produk Baru:*\nPRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok\n\n' +
                       '2. *Tambah Stok Cepat:*\nSTOK#NamaProduk#JumlahTambah\n\n' +
                       '3. *Cek Stok:*\n!stok';

    return res.status(200).json({
      status: true,
      message: defaultMsg,
      reply: defaultMsg,
      data: [{ message: defaultMsg }]
    });

  } catch (err: any) {
    console.error('[WA WEBHOOK CRITICAL ERROR]', err);
    return res.status(200).json({
      status: false,
      message: `Terjadi kendala pemrosesan webhook: ${err?.message || 'Internal error'}`,
      error: err?.message,
      reply: '❌ Terjadi kendala saat memproses permintaan WhatsApp.',
      data: [{ message: '❌ Terjadi kendala saat memproses permintaan WhatsApp.' }]
    });
  }
}
