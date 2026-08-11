import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

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
      supportedFormat: "PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok",
      totalWebhooksReceived: recentWebhooks.length
    });
  });

  // POST /api/whatsapp/webhook - Primary Webhook Listener
  app.post("/api/whatsapp/webhook", (req, res) => {
    try {
      const body = req.body || {};
      
      // Extract sender and message text from various WA Gateway formats
      const sender = body.sender || body.from || body.phone || body.wa_number || body.pushName || "WhatsApp User";
      const messageText = (body.message || body.text || body.body || body.caption || body.payload || "").toString().trim();

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
          gambarUrl: "",
          deskripsi: `Otomatis diimpor oleh WhatsApp Bot Webhook (Pengirim: ${sender})`,
          expiredDate: "",
          batchNo: "",
          terjual: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        pendingProducts.unshift(newProduct);

        const logItem: WebhookLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString("id-ID"),
          sender: String(sender),
          rawBody: body,
          messageText,
          status: "success",
          actionTaken: `Otomatis menambahkan produk "${nama}" ke antrean katalog POS`,
          parsedProduct: newProduct
        };
        recentWebhooks.unshift(logItem);

        if (recentWebhooks.length > 50) recentWebhooks.pop();

        const replyMessage = `✅ [POS Toko Sembako] Produk "${nama}" berhasil ditambahkan ke katalog toko dengan stok ${stok} ${satuan}!`;

        return res.json({
          data: [
            {
              message: replyMessage
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
        actionTaken: "Pesan tidak menggunakan format PRODUK# atau !stok"
      };
      recentWebhooks.unshift(logItem);

      const defaultReply = "ℹ️ [POS Toko Sembako] Format pesan tidak dikenali. Gunakan format: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok untuk menambah produk.";

      return res.json({
        data: [
          {
            message: defaultReply
          }
        ]
      });

    } catch (err: any) {
      console.error("[WhatsApp Webhook Error]:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Internal Webhook Error" });
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
