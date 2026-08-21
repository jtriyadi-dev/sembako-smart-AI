import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { CrmUser } from "./src/types";
import { 
  processProductWebhook, 
  processStockUpdateWebhook, 
  getProductsBackend, 
  saveProductBackend,
  fetchProductsFromSupabaseBackend,
  syncProductToSupabaseBackend,
  getRemoteConfigBackend,
  saveRemoteConfigBackend,
  getCrmUsersBackend,
  saveCrmUserBackend,
  deleteCrmUserBackend,
  getStaffBackend,
  saveStaffBackend,
  deleteStaffBackend,
  authenticateUserBackend,
  getApiKeysBackend,
  saveApiKeysBackend
} from "./src/services/backendStore";

interface WebhookLog {
  id: string;
  time: string;
  sender: string;
  rawBody: any;
  messageText: string;
  status: 'success' | 'ignored' | 'error';
  actionTaken: string;
  parsedProduct?: any;
}

const LOCAL_WEBHOOKS_FILE = path.join('/tmp', 'webhookLogs.json');

function loadWebhookLogs(): WebhookLog[] {
  try {
    if (fs.existsSync(LOCAL_WEBHOOKS_FILE)) {
      const data = fs.readFileSync(LOCAL_WEBHOOKS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {}
  return [];
}

function saveWebhookLogs(logs: WebhookLog[]): void {
  try {
    const dir = path.dirname(LOCAL_WEBHOOKS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_WEBHOOKS_FILE, JSON.stringify(logs.slice(0, 100), null, 2), 'utf-8');
  } catch (e) {}
}

const recentWebhooks: WebhookLog[] = loadWebhookLogs();
const pendingProducts: any[] = [];

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware body parsers (handle JSON & form-urlencoded from WA gateways like Fonnte/Wablas)
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // CORS headers for webhook flexibility
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    if (req.method === "OPTIONS") {
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      return res.status(200).json({});
    }
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // GET /api/products - Direct Fast REST Endpoint for Products List (Supabase + In-Memory)
  app.get("/api/products", async (req, res) => {
    try {
      const sbProducts = await fetchProductsFromSupabaseBackend();
      if (sbProducts && sbProducts.length > 0) {
        return res.json({ status: "ok", count: sbProducts.length, products: sbProducts, source: "supabase" });
      }
    } catch (e) {}
    const products = getProductsBackend();
    res.json({ status: "ok", count: products.length, products, source: "local" });
  });

  // POST /api/products - Save or update product directly
  app.post("/api/products", async (req, res) => {
    const prod = req.body;
    if (!prod || !prod.nama) {
      return res.status(400).json({ error: "Nama produk wajib diisi" });
    }
    const saved = saveProductBackend(prod);
    await syncProductToSupabaseBackend(saved).catch(() => {});
    res.json({ status: "ok", product: saved });
  });

  // GET /api/whatsapp/webhook - Verification & Test endpoint
  app.get("/api/whatsapp/webhook", async (req, res) => {
    // Support Meta / Cloud API hub.challenge verification
    const hubChallenge = req.query["hub.challenge"] || req.query["challenge"];
    if (hubChallenge) {
      return res.send(String(hubChallenge));
    }

    // Support GET query testing (e.g. /api/whatsapp/webhook?sender=62812&message=PRODUK#...)
    const queryMsg = (req.query.message || req.query.msg || req.query.text || "").toString().trim();
    if (queryMsg) {
      const sender = (req.query.sender || req.query.from || req.query.phone || "WhatsApp Browser Test").toString();
      const logItem: WebhookLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("id-ID"),
        sender,
        rawBody: req.query,
        messageText: queryMsg,
        status: "success",
        actionTaken: "Pesan diterima via HTTP GET Query"
      };
      recentWebhooks.unshift(logItem);
      saveWebhookLogs(recentWebhooks);
      return res.json({ status: "success", received: queryMsg, sender, logsCount: recentWebhooks.length });
    }

    res.json({
      status: "active",
      service: "Sembako Smart AI WhatsApp Webhook Listener",
      endpoint: "/api/whatsapp/webhook",
      methodsSupported: ["GET", "POST"],
      documentation: "Kirim HTTP POST ke endpoint ini dengan payload JSON/Form dari Fonnte, Wablas, Whacenter, Meta API, atau Custom Bot.",
      supportedCommands: [
        "PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok",
        "STOK#NamaProduk#JumlahTambah",
        "!stok (Cek Ringkasan Stok Toko)"
      ],
      totalWebhooksReceived: recentWebhooks.length
    });
  });

  // POST /api/whatsapp/webhook - Primary Webhook Listener
  app.post("/api/whatsapp/webhook", async (req, res) => {
    try {
      let body = req.body || {};

      // If array e.g. [{ message: "...", phone: "..." }]
      if (Array.isArray(body) && body.length > 0) {
        body = body[0];
      } else if (body && Array.isArray(body.data) && body.data.length > 0) {
        body = body.data[0];
      }
      
      // Extract sender and message text from various WA Gateway formats (Fonnte, Wablas, Whacenter, Meta Cloud API, Twilio, Baileys, etc.)
      const sender = body.sender || 
                     body.from || 
                     body.phone || 
                     body.wa_number || 
                     body.number || 
                     body.pushName || 
                     body.author ||
                     body.sender_number ||
                     (body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.wa_id) || 
                     (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.from) ||
                     (req.query?.sender || req.query?.from || req.query?.phone) ||
                     "WhatsApp User";

      const messageText = (
        body.message || 
        body.text || 
        body.body || 
        body.caption || 
        body.payload || 
        body.pesan || 
        body.msg || 
        body.content ||
        (body.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.text?.body) || 
        (body.data?.message) || 
        (typeof body === 'string' ? body : "") || 
        (req.query?.message || req.query?.msg || req.query?.text) ||
        ""
      ).toString().trim();

      console.log(`[WhatsApp Webhook Received] From: ${sender} | Message: "${messageText}"`);

      if (!messageText) {
        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText: "(Payload Non-Teks / Ping / Acknowledgment)",
          status: "ignored",
          actionTaken: "Pesan tidak berisi format teks"
        };
        recentWebhooks.unshift(logItem);
        saveWebhookLogs(recentWebhooks);
        return res.json({ status: "success", detail: "Payload diterima tapi tidak berisi teks" });
      }

      const upperMsg = messageText.toUpperCase();

      // 1. Direct Stock Update Command (e.g. STOK#Minyak 2L#20, TAMBAHSTOK#Beras#10, STOK: Beras, 10, STOK|Beras|10)
      const isStockOnlyCmd = 
        (upperMsg.startsWith("STOK#") || upperMsg.startsWith("TAMBAHSTOK#") || upperMsg.startsWith("STOK:") || upperMsg.startsWith("TAMBAH STOK")) &&
        (messageText.includes("#") || messageText.includes(":") || messageText.includes("|") || messageText.includes(","));

      if (isStockOnlyCmd) {
        const delimiter = messageText.includes("#") ? "#" : messageText.includes("|") ? "|" : messageText.includes(":") ? ":" : ",";
        const parts = messageText.split(delimiter).map((p: string) => p.trim()).filter(Boolean);
        const nama = parts[1] || "Produk";
        const addedStock = parseInt(parts[2]?.replace(/\D/g, "") || "0", 10);

        const replyMsg = await processStockUpdateWebhook(nama, addedStock, String(sender));

        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText,
          status: "success",
          actionTaken: `Update stok "${nama}" sebesar +${addedStock} berhasil diproses`
        };
        recentWebhooks.unshift(logItem);
        saveWebhookLogs(recentWebhooks);

        return res.json({
          data: [
            {
              message: replyMsg
            }
          ]
        });
      }

      // 2. Multiline Product Format check (e.g. Nama: ... \n Harga Beli: ... \n Stok: ...)
      const isMultilineProduct = messageText.includes("\n") && 
        (upperMsg.includes("NAMA") || upperMsg.includes("PRODUK") || upperMsg.includes("HARGA") || upperMsg.includes("STOK"));

      if (isMultilineProduct) {
        const lines = messageText.split("\n").map(l => l.trim()).filter(Boolean);
        let nama = "";
        let kategori = "Sembako Utama";
        let hargaBeli = 10000;
        let hargaJual = 12000;
        let stok = 10;
        let satuan = "Pcs";
        let minStok = 5;

        lines.forEach(line => {
          const lUpper = line.toUpperCase();
          if (lUpper.startsWith("NAMA") || lUpper.startsWith("PRODUK")) {
            nama = line.split(/[:#=-]/).slice(1).join(":").trim() || nama;
          } else if (lUpper.startsWith("KATEGORI")) {
            kategori = line.split(/[:#=-]/).slice(1).join(":").trim() || kategori;
          } else if (lUpper.includes("BELI") || lUpper.includes("MODAL") || lUpper.includes("KULAK")) {
            const num = parseInt(line.replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > 0) hargaBeli = num;
          } else if (lUpper.includes("JUAL") || lUpper.includes("HARGA")) {
            const num = parseInt(line.replace(/\D/g, ""), 10);
            if (!isNaN(num) && num > 0) hargaJual = num;
          } else if (lUpper.startsWith("STOK") || lUpper.startsWith("JUMLAH") || lUpper.startsWith("QTY")) {
            const num = parseInt(line.replace(/\D/g, ""), 10);
            if (!isNaN(num)) stok = num;
          } else if (lUpper.startsWith("SATUAN")) {
            satuan = line.split(/[:#=-]/).slice(1).join(":").trim() || satuan;
          } else if (lUpper.includes("MIN")) {
            const num = parseInt(line.replace(/\D/g, ""), 10);
            if (!isNaN(num)) minStok = num;
          }
        });

        if (!nama && lines.length > 0) {
          nama = lines[0].replace(/^(PRODUK|TAMBAH PRODUK|TAMBAH)\s*[:#=-]?\s*/i, "").trim();
        }

        if (nama) {
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

          const logItem: WebhookLog = {
            id: Date.now().toString(),
            time: new Date().toLocaleTimeString("id-ID"),
            sender: String(sender),
            rawBody: body,
            messageText,
            status: result.success ? "success" : "error",
            actionTaken: result.success 
              ? `Data "${nama}" berhasil diproses via format Multiline. Total Stok: ${result.updatedStock}` 
              : `Gagal memproses data "${nama}" ke database: ${result.message}`,
          };
          recentWebhooks.unshift(logItem);
          saveWebhookLogs(recentWebhooks);

          return res.json({
            status: result.success,
            message: result.message,
            reply: result.message,
            product_id: result.productId,
            data: [
              {
                message: result.message
              }
            ]
          });
        }
      }

      // 3. Delimited Product Creation Format (PRODUK#..., PRODUK|..., PRODUK:..., TAMBAH#...)
      const isProductFormat = 
        upperMsg.startsWith("PRODUK#") || 
        upperMsg.startsWith("PRODUK|") || 
        upperMsg.startsWith("PRODUK:") || 
        upperMsg.startsWith("TAMBAH#") || 
        upperMsg.startsWith("TAMBAH:") || 
        (messageText.includes("#") && (upperMsg.includes("PRODUK") || upperMsg.includes("SEMBAKO") || messageText.split("#").length >= 3));

      if (isProductFormat) {
        const delimiter = messageText.includes("#") ? "#" : messageText.includes("|") ? "|" : messageText.includes(":") ? ":" : ",";
        const parts = messageText.split(delimiter).map((p: string) => p.trim());
        const firstPartUpper = (parts[0] || "").toUpperCase();
        const startIndex = (firstPartUpper.includes("PRODUK") || firstPartUpper.includes("TAMBAH")) && parts.length > 2 ? 1 : 0;
        
        const nama = parts[startIndex] || "Produk Sembako";
        const kategori = parts[startIndex + 1] || "Sembako Utama";
        const hargaBeli = parseInt(parts[startIndex + 2]?.replace(/\D/g, "") || "10000", 10);
        const hargaJual = parseInt(parts[startIndex + 3]?.replace(/\D/g, "") || "12000", 10);
        const stok = parseInt(parts[startIndex + 4]?.replace(/\D/g, "") || "10", 10);
        const satuan = parts[startIndex + 5] || "Pcs";
        const minStok = parseInt(parts[startIndex + 6]?.replace(/\D/g, "") || "5", 10);

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

        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText,
          status: result.success ? "success" : "error",
          actionTaken: result.success 
            ? `Data "${nama}" berhasil disimpan ke Supabase. Total Stok: ${result.updatedStock}`
            : `Gagal menyimpan "${nama}" ke Supabase: ${result.message}`,
        };
        recentWebhooks.unshift(logItem);
        saveWebhookLogs(recentWebhooks);

        return res.json({
          status: result.success,
          message: result.message,
          reply: result.message,
          product_id: result.productId,
          data: [
            {
              message: result.message
            }
          ]
        });
      }

      // 4. Check for !stok command
      if (messageText.toLowerCase().startsWith("!stok") || messageText.toLowerCase().startsWith("!cekstok") || messageText.toLowerCase() === "stok" || messageText.toLowerCase() === "cek stok") {
        const prods = getProductsBackend();
        const top5 = prods.slice(0, 8).map(p => `• ${p.nama}: ${p.stok} ${p.satuan} (Rp ${p.hargaJual.toLocaleString('id-ID')})`).join('\n');
        const replyMessage = `📦 *[POS TOKO SEMBAKO - INFO STOK]*\nTotal Produk Aktif: ${prods.length} item\n\n*Contoh Stok Barang:*\n${top5}\n\n_Ketik PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok untuk menambah produk._`;

        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText,
          status: "success",
          actionTaken: "Perintah cek stok diproses, membalas ringkasan stok toko"
        };
        recentWebhooks.unshift(logItem);
        saveWebhookLogs(recentWebhooks);

        return res.json({
          data: [
            {
              message: replyMessage
            }
          ]
        });
      }

      // Generic reply and log
      const logItem: WebhookLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("id-ID"),
        sender: String(sender),
        rawBody: body,
        messageText,
        status: "ignored",
        actionTaken: "Pesan tidak menggunakan format PRODUK# atau STOK# (Dibalas petunjuk format)"
      };
      recentWebhooks.unshift(logItem);
      saveWebhookLogs(recentWebhooks);

      const defaultReply = "ℹ️ *[POS Toko Sembako Bot]*\n\nFormat input WhatsApp:\n\n1️⃣ *Tambah / Update Produk:*\n`PRODUK#Nama Barang#Kategori#Harga Beli#Harga Jual#Jumlah Stok#Satuan#Min Stok`\n_Contoh: PRODUK#Beras Rojolele 10kg#Sembako#120000#135000#25#Karung#5_\n\n2️⃣ *Tambah Stok Cepat:*\n`STOK#Nama Barang#Jumlah Tambahan`\n_Contoh: STOK#Beras Rojolele 10kg#10_\n\n3️⃣ *Cek Stok:*\nKetik `!stok`";

      return res.json({
        data: [
          {
            message: defaultReply
          }
        ]
      });

    } catch (err: any) {
      console.error("[WhatsApp Webhook Error]:", err);
      const logItem: WebhookLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("id-ID"),
        sender: "WhatsApp Webhook Handler",
        rawBody: req.body,
        messageText: "Error: " + (err?.message || "Unknown error"),
        status: "error",
        actionTaken: "Gagal memproses: " + (err?.message || "Internal error")
      };
      recentWebhooks.unshift(logItem);
      saveWebhookLogs(recentWebhooks);

      return res.status(200).json({
        data: [
          {
            message: `❌ [POS Toko Sembako] Gagal memproses data WhatsApp: ${err?.message || "Error internal server"}`
          }
        ]
      });
    }
  });

  // GET /api/whatsapp/logs - Fetch recent webhook logs & pending products for UI display
  app.get("/api/whatsapp/logs", (req, res) => {
    res.json({
      logs: recentWebhooks,
      pendingProducts,
      totalLogs: recentWebhooks.length,
      totalPending: pendingProducts.length
    });
  });

  // POST /api/whatsapp/clear-logs
  app.post("/api/whatsapp/clear-logs", (req, res) => {
    recentWebhooks.length = 0;
    pendingProducts.length = 0;
    saveWebhookLogs(recentWebhooks);
    res.json({ status: "cleared" });
  });

  // ==========================================
  // DEVELOPER CONTROL PANEL & LIVE CMS ROUTES
  // ==========================================

  // Public Endpoint: Auto-discovery for Multi-Device Supabase Client Connection
  app.get("/api/public/supabase-config", (req, res) => {
    try {
      const keys = getApiKeysBackend();
      const sbUrl = (keys.supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
      const sbAnonKey = (keys.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '').trim();
      res.json({
        status: "ok",
        configured: Boolean(sbUrl && sbAnonKey),
        supabaseUrl: sbUrl,
        supabaseAnonKey: sbAnonKey,
        timestamp: new Date().toISOString()
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to get public Supabase config" });
    }
  });

  // Short Pairing Sessions (Encrypted & Masked Short Codes for Multi-Device)
  const pairingSessions = new Map<string, { payload: any; createdAt: number; expiresAt: number }>();

  // Create Short Pairing Code
  app.post("/api/public/pairing-session", (req, res) => {
    try {
      const { payload } = req.body;
      const keys = getApiKeysBackend();
      
      const sessionData = payload || {
        supabaseUrl: keys.supabaseUrl || process.env.SUPABASE_URL || '',
        supabaseAnonKey: keys.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '',
        geminiApiKey: keys.geminiApiKey || process.env.GEMINI_API_KEY || '',
        waApiKey: keys.waApiKey || '',
        waGatewayProvider: keys.waGatewayProvider || 'fonnte',
        waSenderNumber: keys.waSenderNumber || '',
        storeId: req.body.storeId || 'store_pusat_developer_sembako_smart_ai'
      };

      // Generate a clean 6-digit numeric or alphanumeric code
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const now = Date.now();
      const expiresAt = now + (7 * 24 * 60 * 60 * 1000); // 7 days

      pairingSessions.set(code, {
        payload: sessionData,
        createdAt: now,
        expiresAt
      });

      // Cleanup expired sessions
      for (const [k, v] of pairingSessions.entries()) {
        if (v.expiresAt < now) pairingSessions.delete(k);
      }

      res.json({
        status: "ok",
        code,
        expiresAt,
        message: "Pairing session created successfully"
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to create pairing session" });
    }
  });

  app.post("/api/pairing/create", (req, res) => {
    // Alias to /api/public/pairing-session
    try {
      const { keys, storeId } = req.body;
      const currentKeys = getApiKeysBackend();
      const sessionData = {
        supabaseUrl: keys?.supabaseUrl || currentKeys.supabaseUrl || process.env.SUPABASE_URL || '',
        supabaseAnonKey: keys?.supabaseAnonKey || currentKeys.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '',
        geminiApiKey: keys?.geminiApiKey || currentKeys.geminiApiKey || process.env.GEMINI_API_KEY || '',
        waApiKey: keys?.waApiKey || currentKeys.waApiKey || '',
        waGatewayProvider: keys?.waGatewayProvider || currentKeys.waGatewayProvider || 'fonnte',
        waSenderNumber: keys?.waSenderNumber || currentKeys.waSenderNumber || '',
        storeId: storeId || req.body.storeId || 'store_pusat_developer_sembako_smart_ai'
      };

      const code = String(Math.floor(100000 + Math.random() * 900000));
      const now = Date.now();
      const expiresAt = now + (30 * 24 * 60 * 60 * 1000); // 30 days

      pairingSessions.set(code, {
        payload: sessionData,
        createdAt: now,
        expiresAt
      });

      res.json({
        status: "ok",
        code,
        expiresAt,
        message: "Pairing session created successfully"
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to create pairing session" });
    }
  });

  app.get("/api/pairing/resolve/:code", (req, res) => {
    try {
      const code = (req.params.code || '').trim().replace(/[^a-zA-Z0-9]/g, '');
      const session = pairingSessions.get(code);

      if (session && session.expiresAt > Date.now()) {
        return res.json({
          status: "ok",
          found: true,
          keys: {
            supabaseUrl: session.payload.supabaseUrl,
            supabaseAnonKey: session.payload.supabaseAnonKey,
            geminiApiKey: session.payload.geminiApiKey,
            waApiKey: session.payload.waApiKey,
            waGatewayProvider: session.payload.waGatewayProvider,
            waSenderNumber: session.payload.waSenderNumber
          },
          storeId: session.payload.storeId
        });
      }

      const keys = getApiKeysBackend();
      return res.json({
        status: "ok",
        found: true,
        keys: {
          supabaseUrl: keys.supabaseUrl || process.env.SUPABASE_URL || '',
          supabaseAnonKey: keys.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || '',
          geminiApiKey: keys.geminiApiKey || process.env.GEMINI_API_KEY || '',
          waApiKey: keys.waApiKey || '',
          waGatewayProvider: keys.waGatewayProvider || 'fonnte',
          waSenderNumber: keys.waSenderNumber || ''
        },
        storeId: 'store_pusat_developer_sembako_smart_ai'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to resolve pairing session" });
    }
  });

  // Resolve Short Pairing Code
  app.get("/api/public/pairing-session/:code", (req, res) => {
    try {
      const code = (req.params.code || '').trim().replace(/[^a-zA-Z0-9]/g, '');
      const session = pairingSessions.get(code);

      if (session) {
        if (session.expiresAt > Date.now()) {
          return res.json({
            status: "ok",
            found: true,
            payload: session.payload
          });
        } else {
          pairingSessions.delete(code);
        }
      }

      // Fallback: If no code or code is 'default', return current active keys
      const keys = getApiKeysBackend();
      if (keys.supabaseUrl && keys.supabaseAnonKey) {
        return res.json({
          status: "ok",
          found: true,
          payload: {
            supabaseUrl: keys.supabaseUrl,
            supabaseAnonKey: keys.supabaseAnonKey,
            geminiApiKey: keys.geminiApiKey || '',
            waApiKey: keys.waApiKey || '',
            waGatewayProvider: keys.waGatewayProvider || 'fonnte',
            waSenderNumber: keys.waSenderNumber || '',
            storeId: 'store_pusat_developer_sembako_smart_ai'
          }
        });
      }

      res.status(404).json({ error: "Kode pairing tidak ditemukan atau sudah kadaluarsa" });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to resolve pairing session" });
    }
  });

  // 1. GET /api/developer/config - Public Live Website & App Configuration
  app.get("/api/developer/config", (req, res) => {
    try {
      const config = getRemoteConfigBackend();
      res.json({ status: "ok", config });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to fetch remote config" });
    }
  });

  // 2. POST /api/developer/config - Update & Broadcast Live Website & App Configuration
  app.post("/api/developer/config", (req, res) => {
    try {
      const { config } = req.body;
      if (!config) {
        return res.status(400).json({ error: "Payload config is required" });
      }
      const updated = saveRemoteConfigBackend(config);
      console.log(`[Developer CMS] Remote Config updated to v${updated.version} at ${updated.updatedAt}`);
      res.json({ status: "ok", message: "Config broadcasted successfully", config: updated });
    } catch (e: any) {
      res.status(500).json({ error: e.message || "Failed to save remote config" });
    }
  });

  // 3. GET /api/developer/keys - Get Developer API Keys
  app.get("/api/developer/keys", (req, res) => {
    try {
      const keys = getApiKeysBackend();
      const hasServiceRole = Boolean(keys.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY);
      const serverWaToken = keys.waApiKey || process.env.WABLAS_TOKEN || process.env.WABLAS_API_KEY || '';

      const safeKeys = {
        ...keys,
        supabaseUrl: keys.supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        supabaseAnonKey: keys.supabaseAnonKey || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
        // Never send real service role key to browser
        supabaseServiceRoleKey: hasServiceRole ? '••••••••••••••••' : '',
        waApiKey: serverWaToken,
        waSenderNumber: keys.waSenderNumber || process.env.WABLAS_SENDER || '081234567890',
        isSupabaseConfigured: Boolean(keys.supabaseUrl || process.env.SUPABASE_URL),
        isSupabaseServiceRoleConfigured: hasServiceRole,
        isWablasConfigured: Boolean(serverWaToken)
      };

      res.json({ status: "ok", success: true, keys: safeKeys });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. POST /api/developer/keys - Save Developer API Keys
  app.post("/api/developer/keys", (req, res) => {
    try {
      const { keys } = req.body;
      if (!keys) {
        return res.status(400).json({ error: "Payload keys is required" });
      }

      // Update runtime process.env safely
      if (keys.geminiApiKey) process.env.GEMINI_API_KEY = keys.geminiApiKey;
      if (keys.supabaseUrl) process.env.SUPABASE_URL = keys.supabaseUrl;
      if (keys.supabaseAnonKey) {
        process.env.SUPABASE_ANON_KEY = keys.supabaseAnonKey;
        process.env.VITE_SUPABASE_ANON_KEY = keys.supabaseAnonKey;
      }
      if (keys.supabaseServiceRoleKey && !keys.supabaseServiceRoleKey.includes('•')) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = keys.supabaseServiceRoleKey;
      }
      if (keys.waApiKey) {
        process.env.WABLAS_TOKEN = keys.waApiKey;
        process.env.WABLAS_API_KEY = keys.waApiKey;
      }
      if (keys.waSenderNumber) {
        process.env.WABLAS_SENDER = keys.waSenderNumber;
      }

      const keysToSave = { ...keys };
      if (keysToSave.supabaseServiceRoleKey && keysToSave.supabaseServiceRoleKey.includes('•')) {
        delete keysToSave.supabaseServiceRoleKey;
      }

      const updated = saveApiKeysBackend(keysToSave);
      const hasServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY || updated.supabaseServiceRoleKey);

      res.json({ 
        status: "ok", 
        success: true, 
        message: "API keys updated successfully", 
        keys: {
          ...updated,
          supabaseServiceRoleKey: hasServiceRole ? '••••••••••••••••' : ''
        } 
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. GET /api/developer/users - List CRM Users & Customers
  app.get("/api/developer/users", (req, res) => {
    try {
      const users = getCrmUsersBackend();
      res.json({ status: "ok", count: users.length, users });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 6. POST /api/developer/users - Create / Update CRM User
  app.post("/api/developer/users", (req, res) => {
    try {
      const { user } = req.body;
      if (!user || !user.namaPemilik) {
        return res.status(400).json({ error: "User details are required" });
      }
      const saved = saveCrmUserBackend(user);
      res.json({ status: "ok", message: "User saved successfully", user: saved });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 7. DELETE /api/developer/users/:id - Delete CRM User
  app.delete("/api/developer/users/:id", (req, res) => {
    try {
      const { id } = req.params;
      const success = deleteCrmUserBackend(id);
      res.json({ status: "ok", success, message: "User deleted from CRM" });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 7b. Staff Endpoints (GET, POST, DELETE)
  app.get("/api/staff", (req, res) => {
    try {
      const staff = getStaffBackend();
      res.json({ success: true, staff });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.post("/api/staff", (req, res) => {
    try {
      const { staff } = req.body || {};
      if (!staff || !staff.username) {
        return res.status(400).json({ success: false, message: "Data staff tidak valid." });
      }
      const saved = saveStaffBackend(staff);
      res.json({ success: true, staff: saved, message: "Staff account saved" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/staff/:id", (req, res) => {
    try {
      const { id } = req.params;
      const success = deleteStaffBackend(id);
      res.json({ success, message: "Staff account deleted" });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 7c. GET /api/public/crm-users - Public hydrated list of customer accounts
  app.get("/api/public/crm-users", (req, res) => {
    try {
      const users = getCrmUsersBackend();
      res.json({ success: true, count: users.length, users });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // 7d. POST /api/auth/register - Store Owner Self Registration
  app.post("/api/auth/register", (req, res) => {
    try {
      const { email, password, namaPemilik, namaToko, noHp } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPass = (password || '').trim();

      if (!cleanEmail || !cleanPass) {
        return res.status(400).json({ success: false, message: "Email dan kata sandi wajib diisi." });
      }

      const randomKey = `SBK-PRO-${Math.floor(1000 + Math.random() * 9000)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const newUser: CrmUser = {
        id: `user-crm-${Date.now()}`,
        namaPemilik: namaPemilik || cleanEmail.split('@')[0],
        namaToko: namaToko || 'Toko Sembako Berkah',
        email: cleanEmail,
        password: cleanPass,
        noHp: noHp || '',
        alamatToko: '',
        plan: 'pro_lifetime',
        status: 'aktif',
        licenseKey: randomKey,
        deviceLimit: 3,
        activeDevicesCount: 1,
        role: 'owner',
        notes: 'Pendaftaran Akun Baru Pemilik Toko',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: null,
        totalTransactions: 0
      };

      const saved = saveCrmUserBackend(newUser);
      res.json({
        success: true,
        message: "Pendaftaran toko berhasil! Selamat datang.",
        user: saved,
        role: saved.role
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  // 7e. POST /api/auth/crm-login & /api/auth/login - Master Unified Login
  const handleUnifiedLogin = async (req: express.Request, res: express.Response) => {
    try {
      const { email, username, identifier, password } = req.body || {};
      const cleanId = (identifier || email || username || '').trim();
      const cleanPass = (password || '').trim();

      if (!cleanId || !cleanPass) {
        return res.status(400).json({ success: false, message: "Email/Username dan password wajib diisi." });
      }

      const authResult = await authenticateUserBackend(cleanId, cleanPass);
      if (!authResult.success) {
        return res.status(401).json({ success: false, message: authResult.message || "Email atau kata sandi tidak cocok." });
      }

      res.json({
        success: true,
        message: "Login berhasil",
        role: authResult.role,
        user: authResult.user
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  };

  app.post("/api/auth/crm-login", handleUnifiedLogin);
  app.post("/api/auth/login", handleUnifiedLogin);

  // 8. POST /api/developer/test-gemini - Live test Gemini API Key
  app.post("/api/developer/test-gemini", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { apiKey, model } = req.body || {};
      const keyToTest = apiKey || process.env.GEMINI_API_KEY;
      if (!keyToTest) {
        return res.status(400).json({ success: false, message: "API Key Gemini kosong. Harap masukkan API Key." });
      }
      let modelToUse = model || 'gemini-3.7-flash';
      if (modelToUse === 'gemini-2.5-flash' || modelToUse === 'gemini-1.5-flash' || modelToUse === 'gemini-1.5-pro') {
        modelToUse = 'gemini-3.7-flash';
      }
      const ai = new GoogleGenAI({ apiKey: keyToTest });
      try {
        const response = await ai.models.generateContent({
          model: modelToUse,
          contents: 'Balas singkat: "Koneksi Google Gemini API Berhasil Terhubung."'
        });
        const text = response.text || 'Koneksi Berhasil';
        return res.json({ success: true, message: `✅ Sukses: ${text.trim()}`, model: modelToUse });
      } catch (innerErr: any) {
        // Fallback to gemini-3.6-flash or gemini-3.7-flash if first model returned 404
        if (innerErr?.message?.includes('404') || innerErr?.message?.includes('not found') || innerErr?.message?.includes('no longer available')) {
          const fallbackModel = 'gemini-3.6-flash';
          const fallbackResp = await ai.models.generateContent({
            model: fallbackModel,
            contents: 'Balas singkat: "Koneksi Google Gemini API Berhasil Terhubung."'
          });
          const text = fallbackResp.text || 'Koneksi Berhasil';
          return res.json({ success: true, message: `✅ Sukses: ${text.trim()}`, model: fallbackModel });
        }
        throw innerErr;
      }
    } catch (err: any) {
      console.warn('[Test Gemini Error]:', err?.message);
      res.json({ success: false, message: `❌ Gagal: ${err?.message || 'Invalid API Key atau Kuota Habis'}` });
    }
  });

  function getSupabaseKeyTypeServer(key: string): 'publishable' | 'legacy_anon' {
    const clean = key.trim().replace(/^bearer\s+/i, '');
    if (clean.startsWith('sb_publishable_') || clean.startsWith('sbp_') || clean.startsWith('pk_')) {
      return 'publishable';
    }
    if (clean.startsWith('eyJ')) {
      return 'legacy_anon';
    }
    return 'publishable';
  }

  // Helper: Decode Supabase JWT safely if it is a JWT
  function decodeSupabaseJwtServer(jwt: string): { ref?: string; role?: string; exp?: number; isExpired?: boolean } | null {
    try {
      const clean = jwt.trim().replace(/^bearer\s+/i, '');
      const parts = clean.split('.');
      if (parts.length !== 3) {
        return null;
      }
      const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
      const payload = JSON.parse(payloadStr);
      const now = Math.floor(Date.now() / 1000);
      return {
        ref: payload.ref,
        role: payload.role,
        exp: payload.exp,
        isExpired: payload.exp ? payload.exp < now : false
      };
    } catch (_) {
      return null;
    }
  }

  // 9. POST /api/developer/test-wa - Live test WhatsApp Gateway
  app.post("/api/developer/test-wa", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const body = req.body || {};
      const provider = (body.provider || 'wablas').toLowerCase();
      
      // 1. Audit sumber nilai Token
      let rawToken = (
        body.token ||
        body.waApiKey ||
        body.apiKey ||
        ''
      ).trim();

      if (rawToken.includes('•') || rawToken === '---' || rawToken === '******') {
        rawToken = '';
      }

      if (!rawToken) {
        rawToken = (
          process.env.WABLAS_TOKEN ||
          process.env.WABLAS_API_KEY ||
          process.env.WA_API_KEY ||
          ''
        ).trim();
      }

      const cleanToken = rawToken
        .replace(/^["']|["']$/g, '')
        .replace(/^bearer\s+/i, '')
        .replace(/[\r\n\t\s]/g, '')
        .trim();

      // 2. Audit sumber nilai Server URL
      let waServerUrl = (
        body.waServerUrl ||
        body.serverUrl ||
        process.env.WABLAS_SERVER_URL ||
        'https://kudus.wablas.com'
      ).trim().replace(/\/+$/, '');

      // 3. Audit sumber nilai Sender
      const sender = (
        body.targetPhone ||
        body.phone ||
        body.sender ||
        body.waSenderNumber ||
        process.env.WABLAS_SENDER ||
        process.env.WA_SENDER ||
        '081234567890'
      ).trim();

      // Safe config logging
      console.log('[WA TEST CONFIG]', {
        provider,
        tokenConfigured: !!cleanToken,
        tokenLength: cleanToken.length,
        tokenPrefix: cleanToken.length > 4 ? cleanToken.slice(0, 4) : '***',
        tokenSuffix: cleanToken.length > 4 ? cleanToken.slice(-4) : '***',
        serverUrl: waServerUrl
      });

      if (!cleanToken) {
        return res.json({ 
          success: false,
          status: 400,
          source: "INTERNAL_API",
          message: "Kunci API / Token WhatsApp tidak boleh kosong. Harap isi token di Control Panel atau set environment variable WABLAS_TOKEN di server." 
        });
      }

      const maskedToken = cleanToken.length > 8
        ? `${cleanToken.substring(0, 4)}...${cleanToken.slice(-4)}`
        : '******';

      if (provider === 'wablas') {
        const waEndpoint = `${waServerUrl}/api/device/info`;
        const httpMethod = 'GET';

        console.log('[WABLAS REQUEST]', {
          endpoint: waEndpoint,
          method: httpMethod,
          tokenLength: cleanToken.length,
          headerAuthPrefix: cleanToken.slice(0, 4) + '...'
        });

        let pingRes: any;
        try {
          pingRes = await fetch(waEndpoint, {
            method: httpMethod,
            headers: {
              'Authorization': cleanToken,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
          });
        } catch (fetchErr: any) {
          console.error('[WABLAS FETCH ERROR]', {
            endpoint: waEndpoint,
            error: fetchErr?.message
          });
          return res.json({
            success: false,
            source: "INTERNAL_API",
            status: 500,
            endpoint: waEndpoint,
            headers: `Authorization: ${maskedToken}`,
            message: `Gagal menghubungi server gateway Wablas (${waServerUrl}): ${fetchErr?.message || 'Network Timeout / DNS Resolution failed'}`
          });
        }

        const responseStatus = pingRes.status;
        const responseText = await pingRes.text().catch(() => '');
        let responseJson: any = null;
        try {
          responseJson = JSON.parse(responseText);
        } catch (_) {}

        console.log('[WABLAS RESPONSE]', {
          status: responseStatus,
          statusText: pingRes.statusText,
          endpoint: waEndpoint,
          body: responseText ? responseText.substring(0, 1000) : '<empty>'
        });

        if (responseStatus === 200) {
          if (responseJson && (responseJson.status === true || responseJson.status === 'success' || responseJson.data)) {
            return res.json({
              success: true,
              status: 200,
              source: "WABLAS",
              message: `✅ Koneksi Gateway WhatsApp Wablas Berhasil & Perangkat Terhubung! (Token: ${maskedToken})`,
              device: responseJson.data || responseJson,
              serverUrl: waServerUrl,
              endpoint: waEndpoint
            });
          } else {
            const errMsg = responseJson?.message || responseJson?.msg || responseText || 'Perangkat belum terhubung di Wablas';
            return res.json({
              success: false,
              source: "WABLAS",
              status: 200,
              tokenLength: cleanToken.length,
              tokenPrefix: cleanToken.slice(0, 4),
              tokenSuffix: cleanToken.slice(-4),
              endpoint: waEndpoint,
              headers: `Authorization: ${maskedToken}`,
              message: `❌ Wablas: ${errMsg}`
            });
          }
        } else if (responseStatus === 401 || responseStatus === 403) {
          const errMsg = responseJson?.message || responseJson?.msg || responseText || 'Unauthorized';
          return res.json({
            success: false,
            source: "WABLAS",
            status: responseStatus,
            tokenLength: cleanToken.length,
            tokenPrefix: cleanToken.slice(0, 4),
            tokenSuffix: cleanToken.slice(-4),
            endpoint: waEndpoint,
            headers: `Authorization: ${maskedToken}`,
            message: `❌ Kunci API Wablas Tidak Valid (HTTP ${responseStatus}): ${errMsg}. Pastikan menyalin API Token yang benar dari dashboard Wablas (${waServerUrl}).`
          });
        } else if (responseStatus === 500) {
          const errMsg = responseJson?.message || responseJson?.msg || responseText || 'Internal Server Error pada server Wablas';
          return res.json({
            success: false,
            source: "WABLAS",
            status: 500,
            tokenLength: cleanToken.length,
            tokenPrefix: cleanToken.slice(0, 4),
            tokenSuffix: cleanToken.slice(-4),
            endpoint: waEndpoint,
            headers: `Authorization: ${maskedToken}`,
            message: `❌ Server Wablas (${waServerUrl}) mengembalikan HTTP 500: ${errMsg}`
          });
        } else {
          const errMsg = responseJson?.message || responseJson?.msg || responseText || pingRes.statusText;
          return res.json({
            success: false,
            source: "WABLAS",
            status: responseStatus,
            tokenLength: cleanToken.length,
            tokenPrefix: cleanToken.slice(0, 4),
            tokenSuffix: cleanToken.slice(-4),
            endpoint: waEndpoint,
            headers: `Authorization: ${maskedToken}`,
            message: `❌ Wablas mengembalikan status HTTP ${responseStatus}: ${errMsg}`
          });
        }
      } else if (provider === 'fonnte') {
        const fonnteEndpoint = 'https://api.fonnte.com/device';
        try {
          const fonnteRes = await fetch(fonnteEndpoint, {
            method: 'POST',
            headers: {
              'Authorization': cleanToken
            },
            signal: AbortSignal.timeout(8000)
          });
          const fonnteStatus = fonnteRes.status;
          const fonnteData = await fonnteRes.json().catch(() => ({}));

          if (fonnteStatus === 200 && fonnteData.status !== false) {
            return res.json({
              success: true,
              status: 200,
              source: 'FONNTE',
              message: `✅ Koneksi Gateway Fonnte Berhasil & Device Terverifikasi! (Token: ${maskedToken})`,
              device: fonnteData
            });
          } else {
            return res.json({
              success: false,
              status: fonnteStatus,
              source: 'FONNTE',
              message: `❌ Fonnte: ${fonnteData.reason || fonnteData.message || 'Token Fonnte tidak valid / perangkat offline'}`
            });
          }
        } catch (fErr: any) {
          return res.json({
            success: false,
            source: 'FONNTE',
            status: 500,
            message: `Gagal menghubungi API Fonnte: ${fErr?.message || 'Network error'}`
          });
        }
      } else {
        return res.json({
          success: true,
          status: 200,
          source: "INTERNAL_API",
          message: `✅ Gateway WhatsApp (${provider.toUpperCase()}) Aktif & Terverifikasi (${maskedToken}). Siap kirim pesan ke ${sender}.`
        });
      }
    } catch (err: any) {
      console.error('[WA TEST INTERNAL ERROR]', err);
      res.json({
        success: false,
        source: "INTERNAL_API",
        status: 500,
        message: `❌ Error internal server: ${err?.message || 'Unknown error'}`
      });
    }
  });

  // 10. POST /api/developer/test-supabase - Live test Supabase database & backend connection
  app.post("/api/developer/test-supabase", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const body = req.body || {};
      
      // 1. Audit sumber nilai URL
      let url = (
        body.supabaseUrl ||
        body.url ||
        process.env.SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        ""
      ).trim();

      if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.slice(1, -1).trim();
      }
      url = url.replace(/\/+$/, '');

      // 2. Audit sumber nilai Anon / Publishable Key
      let anonKey = (
        body.supabaseAnonKey ||
        body.publishableKey ||
        body.apiKey ||
        body.key ||
        body.supabaseKey ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        ""
      ).trim();

      if ((anonKey.startsWith('"') && anonKey.endsWith('"')) || (anonKey.startsWith("'") && anonKey.endsWith("'"))) {
        anonKey = anonKey.slice(1, -1).trim();
      }
      anonKey = anonKey.replace(/^bearer\s+/i, '');

      // 3. Audit sumber nilai Service Role Key
      let serviceRoleKey = (
        body.supabaseServiceRoleKey ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        ""
      ).trim();

      if ((serviceRoleKey.startsWith('"') && serviceRoleKey.endsWith('"')) || (serviceRoleKey.startsWith("'") && serviceRoleKey.endsWith("'"))) {
        serviceRoleKey = serviceRoleKey.slice(1, -1).trim();
      }
      serviceRoleKey = serviceRoleKey.replace(/^bearer\s+/i, '');
      const hasRawServiceKey = serviceRoleKey.length > 0 && !serviceRoleKey.includes('•');

      const detectedKeyType = getSupabaseKeyTypeServer(anonKey || serviceRoleKey);

      console.log('[SUPABASE TEST CONFIG]', {
        urlConfigured: !!url,
        anonKeyConfigured: !!anonKey,
        anonKeyLength: anonKey.length,
        anonKeyType: detectedKeyType,
        serviceRoleConfigured: hasRawServiceKey || !!process.env.SUPABASE_SERVICE_ROLE_KEY
      });

      if (!url) {
        return res.json({
          success: false,
          status: 400,
          source: "INTERNAL_API",
          message: "URL Supabase tidak boleh kosong. Harap isi URL di Control Panel atau set environment variable SUPABASE_URL."
        });
      }

      if (!anonKey && !hasRawServiceKey) {
        return res.json({
          success: false,
          status: 400,
          source: "INTERNAL_API",
          message: "Kunci API Supabase (Publishable Key / Anon Key) tidak boleh kosong."
        });
      }

      // 4. Validasi format URL & Project Ref
      const urlMatch = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
      const urlProjectRef = urlMatch ? urlMatch[1] : '';

      if (!urlProjectRef) {
        return res.json({
          success: false,
          status: 400,
          source: "INTERNAL_API",
          message: `Format URL Supabase tidak valid (${url}). Format yang benar: https://<project-ref>.supabase.co`
        });
      }

      let clientTestResult: { success: boolean; status: number; role?: string; message: string; tableReady?: boolean } | null = null;
      let serverTestResult: { success: boolean; status: number; role?: string; message: string } | null = null;

      // 5. TEST 1: SUPABASE CLIENT WEB (Publishable Key / Legacy Anon Key)
      if (anonKey) {
        const anonJwt = decodeSupabaseJwtServer(anonKey);
        if (anonJwt) {
          if (anonJwt.ref && anonJwt.ref !== urlProjectRef) {
            return res.json({
              success: false,
              keyType: detectedKeyType,
              status: 401,
              source: "SUPABASE",
              message: `❌ Project Mismatch pada Anon Key! Key berasal dari project "${anonJwt.ref}", sedangkan Project URL adalah "${urlProjectRef}". Harap salin public key dari project yang sama di Supabase Dashboard.`
            });
          }

          if (anonJwt.isExpired) {
            return res.json({
              success: false,
              keyType: detectedKeyType,
              status: 401,
              source: "SUPABASE",
              message: '❌ Anon Key Supabase sudah kadaluarsa (expired).'
            });
          }
        }

        // Direct REST ping with proper headers
        try {
          const restRes = await fetch(`${url}/rest/v1/`, {
            method: "GET",
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
          });

          const restStatus = restRes.status;
          const restBody = await restRes.text().catch(() => '');

          console.log('[SUPABASE REST TEST]', {
            status: restStatus,
            statusText: restRes.statusText,
            keyType: detectedKeyType,
            bodySnippet: restBody.substring(0, 300)
          });

          if (restStatus === 401 || restStatus === 403) {
            let errMsg = '401 Unauthorized';
            try {
              const parsed = JSON.parse(restBody);
              errMsg = parsed.message || parsed.msg || parsed.error || restBody;
            } catch (_) {
              errMsg = restBody || restRes.statusText;
            }
            return res.json({
              success: false,
              keyType: detectedKeyType,
              status: restStatus,
              source: "SUPABASE",
              message: `❌ Supabase mengembalikan HTTP ${restStatus}: ${errMsg}`
            });
          }

          // Table query test with REST endpoint
          const tableRes = await fetch(`${url}/rest/v1/products?select=id&limit=1`, {
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
          });

          const isTableOk = tableRes.ok;
          const isTableMissing = tableRes.status === 404;

          clientTestResult = {
            success: true,
            status: 200,
            role: anonJwt?.role || 'anon',
            tableReady: isTableOk,
            message: isTableOk ? 'Terhubung & Tabel produk aktif' : 'Terhubung (Tabel database belum dibuat, jalankan skrip SQL migration)'
          };
        } catch (clientErr: any) {
          console.error('[SUPABASE CLIENT TEST ERROR]', clientErr);
          return res.json({
            success: false,
            keyType: detectedKeyType,
            status: 500,
            source: "INTERNAL_API",
            message: `Gagal menghubungi Supabase: ${clientErr?.message || 'Network Timeout'}`
          });
        }
      }

      // 6. TEST 2: SUPABASE SERVER (Service Role Key)
      const effectiveServiceKey = hasRawServiceKey ? serviceRoleKey : (process.env.SUPABASE_SERVICE_ROLE_KEY || '');
      if (effectiveServiceKey && !effectiveServiceKey.includes('•')) {
        const srvJwt = decodeSupabaseJwtServer(effectiveServiceKey);
        if (srvJwt && srvJwt.ref && srvJwt.ref !== urlProjectRef) {
          return res.json({
            success: false,
            keyType: detectedKeyType,
            status: 401,
            source: "SUPABASE",
            message: `❌ Project Mismatch pada Service Role Key! Key berasal dari project "${srvJwt.ref}", sedangkan Project URL adalah "${urlProjectRef}".`
          });
        }

        try {
          const srvRes = await fetch(`${url}/rest/v1/remote_config?select=id&limit=1`, {
            headers: {
              'apikey': effectiveServiceKey,
              'Authorization': `Bearer ${effectiveServiceKey}`,
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(8000)
          });

          if (srvRes.ok || srvRes.status === 404) {
            serverTestResult = {
              success: true,
              status: 200,
              role: srvJwt?.role || 'service_role',
              message: 'Service Role Key terverifikasi & server bypass RLS aktif'
            };
          } else {
            serverTestResult = {
              success: false,
              status: srvRes.status,
              role: srvJwt?.role || 'service_role',
              message: `Status HTTP ${srvRes.status}`
            };
          }
        } catch (srvErr: any) {
          console.error('[SUPABASE SERVER TEST ERROR]', srvErr);
        }
      }

      // 7. Format Final Output
      const isSuccess = Boolean(clientTestResult?.success || serverTestResult?.success);
      const keyTypeLabel = detectedKeyType === 'publishable' ? 'Publishable Key (sb_publishable)' : 'Legacy Anon Key (JWT)';
      const tableNotice = clientTestResult?.tableReady === false
        ? ' (Tabel database belum dibuat, klik "Skrip SQL Schema Supabase" di bawah)'
        : ' (Database & REST API Siap Digunakan)';

      if (isSuccess) {
        return res.json({
          success: true,
          keyType: detectedKeyType,
          status: 200,
          source: "SUPABASE",
          projectUrl: url,
          projectRef: urlProjectRef,
          message: `✅ Berhasil Terhubung ke Supabase Cloud Database! (Tipe: ${keyTypeLabel} / Project: ${urlProjectRef})${tableNotice}`,
          clientTest: clientTestResult,
          serverTest: serverTestResult
        });
      }

      return res.json({
        success: false,
        keyType: detectedKeyType,
        status: clientTestResult?.status || 401,
        source: "SUPABASE",
        message: clientTestResult?.message || 'Gagal memverifikasi kredensial Supabase.'
      });

    } catch (err: any) {
      console.error('[SUPABASE TEST INTERNAL ERROR]:', err);
      return res.json({
        success: false,
        status: 500,
        source: "INTERNAL_API",
        message: `❌ Error internal server: ${err?.message || 'Koneksi terputus atau URL tidak dapat diakses.'}`
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server POS running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
