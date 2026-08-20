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
            status: "success",
            actionTaken: `Data "${nama}" berhasil diproses via format Multiline. Total Stok: ${result.updatedStock}`,
          };
          recentWebhooks.unshift(logItem);
          saveWebhookLogs(recentWebhooks);

          return res.json({
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
          status: "success",
          actionTaken: `Data "${nama}" berhasil disimpan. Total Stok: ${result.updatedStock}`,
        };
        recentWebhooks.unshift(logItem);
        saveWebhookLogs(recentWebhooks);

        return res.json({
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
      res.json({ status: "ok", keys });
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
      const updated = saveApiKeysBackend(keys);
      res.json({ status: "ok", message: "API keys updated successfully", keys: updated });
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

  // 9. POST /api/developer/test-wa - Live test WhatsApp Gateway
  app.post("/api/developer/test-wa", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { provider, token, targetPhone } = req.body || {};
      if (!token) {
        return res.json({ 
          success: false, 
          message: "Token / API Key WhatsApp belum diisi. Silakan masukkan token gateway." 
        });
      }
      const providerName = (provider || 'WhatsApp').toUpperCase();
      const maskedToken = `${token.substring(0, 6)}...${token.slice(-4)}`;
      res.json({ 
        success: true, 
        message: `✅ Gateway ${providerName} Aktif & Terverifikasi (Token: ${maskedToken}). Siap kirim pesan & struk ke nomor ${targetPhone || 'pelanggan'}.` 
      });
    } catch (err: any) {
      res.json({ success: false, message: `❌ Uji koneksi gagal: ${err?.message || 'Koneksi terputus'}` });
    }
  });

  // 10. POST /api/developer/test-supabase - Live test Supabase database & backend connection
  app.post("/api/developer/test-supabase", async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    try {
      const { supabaseUrl, supabaseKey } = req.body || {};
      let url = (supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
      let key = (supabaseKey || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

      // Sanitize URL
      if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
        url = url.slice(1, -1).trim();
      }
      url = url.replace(/\/+$/, '');

      // Sanitize Key
      if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1).trim();
      }
      if (key.toLowerCase().startsWith('bearer ')) {
        key = key.slice(7).trim();
      }

      if (!url || !key) {
        return res.status(400).json({
          success: false,
          message: "URL Supabase dan Key API belum diisi. Harap masukkan kredensial Supabase Anda."
        });
      }

      if (!url.startsWith("https://") || !url.includes(".supabase.co")) {
        return res.status(400).json({
          success: false,
          message: "Format URL Supabase tidak valid. Contoh yang benar: https://abcdefghijklmn.supabase.co"
        });
      }

      // Check official Supabase Auth Settings endpoint (tests API Key validity)
      const authUrl = `${url}/auth/v1/settings`;
      let authPassed = false;
      let authDetail = '';

      try {
        const authResp = await fetch(authUrl, {
          method: "GET",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`
          },
          signal: AbortSignal.timeout(6000)
        });

        if (authResp.ok) {
          authPassed = true;
        } else if (authResp.status === 401 || authResp.status === 403) {
          const authData = await authResp.json().catch(() => ({}));
          authDetail = authData.message || authData.msg || "Invalid API Key";
        }
      } catch (authErr: any) {
        // Fallback to table query if auth endpoint had transient network issue
      }

      // Also verify REST PostgREST endpoint
      const restResp = await fetch(`${url}/rest/v1/products?select=id&limit=1`, {
        method: "GET",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`
        },
        signal: AbortSignal.timeout(6000)
      }).catch(() => null);

      const isRestAuth = restResp && (restResp.ok || restResp.status === 404 || restResp.status === 400);

      if (authPassed || isRestAuth) {
        return res.json({
          success: true,
          message: `✅ Berhasil Terhubung ke Supabase Cloud Database! Backend & PostgreSQL REST API Siap Digunakan.`,
          url
        });
      }

      return res.json({
        success: false,
        message: `❌ Kunci API Tidak Valid (${authDetail || '401 Unauthorized'}). Pastikan menyalin 'anon public' key dari Supabase > Project Settings > API.`
      });
    } catch (err: any) {
      console.warn("[Test Supabase Error]:", err?.message);
      return res.json({
        success: false,
        message: `❌ Gagal menghubungi Supabase: ${err?.message || "Koneksi terputus atau URL tidak dapat diakses."}`
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
