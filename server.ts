import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  processProductWebhook, 
  processStockUpdateWebhook, 
  getProductsBackend, 
  saveProductBackend 
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
