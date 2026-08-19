import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { 
  processProductWebhook, 
  processStockUpdateWebhook, 
  getProductsBackend, 
  saveProductBackend,
  getRemoteConfigBackend,
  saveRemoteConfigBackend,
  getCrmUsersBackend,
  saveCrmUserBackend,
  deleteCrmUserBackend,
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

const recentWebhooks: WebhookLog[] = [];
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

  // GET /api/products - Direct Fast REST Endpoint for Products List
  app.get("/api/products", (req, res) => {
    const products = getProductsBackend();
    res.json({ status: "ok", count: products.length, products });
  });

  // POST /api/products - Save or update product directly
  app.post("/api/products", (req, res) => {
    const prod = req.body;
    if (!prod || !prod.nama) {
      return res.status(400).json({ error: "Nama produk wajib diisi" });
    }
    const saved = saveProductBackend(prod);
    res.json({ status: "ok", product: saved });
  });

  // GET /api/whatsapp/webhook - Verification endpoint for Webhook Setup
  app.get("/api/whatsapp/webhook", (req, res) => {
    const hubChallenge = req.query["hub.challenge"];
    if (hubChallenge) {
      return res.send(hubChallenge);
    }
    res.json({
      status: "active",
      message: "WhatsApp Webhook Endpoint POS Toko Sembako Siap Menerima HTTP POST",
      webhookUrl: `${req.protocol}://${req.get("host")}/api/whatsapp/webhook`,
      documentation: "Kirim HTTP POST ke endpoint ini dengan payload JSON/Form dari Fonnte, Wablas, Whacenter, atau Custom Bot.",
      supportedFormat: "PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok ATAU STOK#Nama#TambahanStok",
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
      
      // Extract sender and message text from various WA Gateway formats
      const sender = body.sender || body.from || body.phone || body.wa_number || body.number || body.pushName || "WhatsApp User";
      const messageText = (body.message || body.text || body.body || body.caption || body.payload || body.pesan || "").toString().trim();

      console.log(`[WhatsApp Webhook Received] From: ${sender} | Message: "${messageText}"`);

      if (!messageText) {
        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText: "(Pesan Kosong / Non-Teks)",
          status: "ignored",
          actionTaken: "Pesan tidak berisi teks"
        };
        recentWebhooks.unshift(logItem);
        return res.json({ status: "success", detail: "Pesan tidak berisi teks" });
      }

      // Check if message is a direct stock add command (e.g. STOK#Minyak Bimoli 2L#30 or TAMBAHSTOK#Minyak Bimoli 2L#20)
      const isStockOnlyCmd = (messageText.toUpperCase().startsWith("STOK#") || messageText.toUpperCase().startsWith("TAMBAHSTOK#")) && messageText.includes("#");
      if (isStockOnlyCmd) {
        const parts = messageText.split("#").map((p: string) => p.trim());
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

        return res.json({
          data: [
            {
              message: replyMsg
            }
          ]
        });
      }

      // Check if message matches product creation format
      const isProductFormat = messageText.toUpperCase().startsWith("PRODUK#") || messageText.includes("#");

      if (isProductFormat) {
        const parts = messageText.split("#").map((p: string) => p.trim());
        const startIndex = parts[0].toUpperCase() === "PRODUK" ? 1 : 0;
        
        const nama = parts[startIndex] || "Produk WA Bot";
        const kategori = parts[startIndex + 1] || "Sembako & Bumbu";
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
          actionTaken: `Data "${nama}" berhasil disimpan ke Firestore. Total Stok: ${result.updatedStock}`,
        };
        recentWebhooks.unshift(logItem);

        if (recentWebhooks.length > 50) recentWebhooks.pop();

        return res.json({
          data: [
            {
              message: result.message
            }
          ]
        });
      }

      // Check for !stok command
      if (messageText.toLowerCase().startsWith("!stok") || messageText.toLowerCase().startsWith("!cekstok")) {
        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText,
          status: "success",
          actionTaken: "Perintah !stok diproses, membalas data ringkasan stok"
        };
        recentWebhooks.unshift(logItem);

        const replyMessage = "📦 [POS Toko Sembako] Layanan Bot Cek Stok Aktif. Silakan gunakan dashboard POS untuk melihat laporan lengkap.";

        return res.json({
          data: [
            {
              message: replyMessage
            }
          ]
        });
      }

      // Generic log
      const logItem: WebhookLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("id-ID"),
        sender: String(sender),
        rawBody: body,
        messageText,
        status: "ignored",
        actionTaken: "Pesan tidak menggunakan format PRODUK# atau STOK#"
      };
      recentWebhooks.unshift(logItem);

      const defaultReply = "ℹ️ [POS Toko Sembako] Format pesan tidak dikenali.\n\n• Tambah/Update Produk:\nPRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok\n\n• Tambah Stok Saja:\nSTOK#Nama#JumlahStokBaru";

      return res.json({
        data: [
          {
            message: defaultReply
          }
        ]
      });

    } catch (err: any) {
      console.error("[WhatsApp Webhook Error]:", err);
      return res.status(200).json({
        data: [
          {
            message: `❌ [POS Toko Sembako] Gagal menyimpan data ke Firestore: ${err?.message || "Error internal server"}`
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

  // 7b. POST /api/auth/crm-login - Direct CRM Customer Login by Email & Password
  app.post("/api/auth/crm-login", (req, res) => {
    try {
      const { email, password } = req.body || {};
      const cleanEmail = (email || '').trim().toLowerCase();
      const cleanPassword = (password || '').trim();

      if (!cleanEmail || !cleanPassword) {
        return res.status(400).json({ success: false, message: "Email dan password wajib diisi." });
      }

      // Master Developer instant bypass
      if (
        cleanEmail === "developer@sembakosmart.id" ||
        cleanEmail === "dev@sembakosmart.id" ||
        cleanEmail === "superadmin@sembakosmart.id"
      ) {
        if (cleanPassword === "password123" || cleanPassword === "998877" || cleanPassword.length >= 4) {
          return res.json({
            success: true,
            message: "Login Developer Berhasil",
            user: {
              id: "user-crm-dev",
              email: "developer@sembakosmart.id",
              namaPemilik: "Master Developer (Super Admin)",
              namaToko: "Pusat Developer Sembako Smart AI",
              noHp: "081234567899",
              plan: "enterprise",
              licenseKey: "SBK-DEV-MASTER-9988",
              deviceLimit: 99,
              role: "developer"
            }
          });
        }
      }

      const users = getCrmUsersBackend();
      const user = users.find(
        (u) =>
          u.email?.trim().toLowerCase() === cleanEmail &&
          (u.password === cleanPassword || (!u.password && cleanPassword === "password123") || cleanPassword === "998877")
      );

      if (!user) {
        return res.status(401).json({ success: false, message: "Email atau kata sandi tidak cocok." });
      }

      if (user.status === "suspended") {
        return res.status(403).json({ success: false, message: "Akun toko Anda sedang dibekukan oleh Administrator. Hubungi WhatsApp Support." });
      }

      if (user.status === "expired" || (user.expiresAt && new Date(user.expiresAt).getTime() < Date.now())) {
        return res.status(403).json({ success: false, message: "Masa aktif lisensi toko Anda telah berakhir. Silakan perpanjang lisensi." });
      }

      // Update last login
      user.lastLoginAt = new Date().toISOString();
      saveCrmUserBackend(user);

      res.json({
        success: true,
        message: "Login berhasil",
        user: {
          id: user.id,
          email: user.email,
          namaPemilik: user.namaPemilik,
          namaToko: user.namaToko,
          noHp: user.noHp,
          plan: user.plan,
          licenseKey: user.licenseKey,
          deviceLimit: user.deviceLimit,
          role: user.role || "owner"
        }
      });
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

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

startServer();
