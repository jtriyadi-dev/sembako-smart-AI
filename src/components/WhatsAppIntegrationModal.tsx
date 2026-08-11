import React, { useState } from 'react';
import { Modal } from './Modal';
import { ProdukItem } from '../types';
import { addProduct } from '../services/productService';
import { useToast } from '../context/ToastContext';
import {
  MessageSquare,
  Sparkles,
  Send,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  Boxes,
  PlusCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  Bot,
  ListChecks,
  Sliders,
  Bell
} from 'lucide-react';

interface WhatsAppIntegrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProdukItem[];
  defaultTab?: 'input' | 'bot-sim' | 'cek' | 'notif';
}

export const WhatsAppIntegrationModal: React.FC<WhatsAppIntegrationModalProps> = ({
  isOpen,
  onClose,
  products,
  defaultTab = 'input',
}) => {
  const { success, error: toastError, info } = useToast();
  const [activeTab, setActiveTab] = useState<'input' | 'bot-sim' | 'cek' | 'notif'>(defaultTab);

  // --- BOT WEBHOOK SIMULATOR STATE ---
  const [botSenderNumber, setBotSenderNumber] = useState('6281234567890');
  const [botMessage, setBotMessage] = useState('PRODUK#Minyak Bimoli 2L#Minyak & Margarin#32000#36500#30#pouch#5');
  const [isBotProcessing, setIsBotProcessing] = useState(false);
  const [webhookLogs, setWebhookLogs] = useState<Array<{ id: string; time: string; sender: string; message: string; status: 'success' | 'error'; detail: string }>>([
    {
      id: '1',
      time: new Date().toLocaleTimeString('id-ID'),
      sender: '6281234567890',
      message: 'PRODUK#Beras Sania 5kg#Beras & Tepung#65000#72000#20#sak#5',
      status: 'success',
      detail: 'Otomatis menambahkan 1 produk "Beras Sania 5kg" ke Katalog Database',
    },
  ]);

  // --- TAB 1: INPUT KATALOG VIA WHATSAPP ---
  const [rawText, setRawText] = useState('');
  const [parsedItems, setParsedItems] = useState<
    Array<{
      nama: string;
      kategori: string;
      hargaBeli: number;
      hargaJual: number;
      stok: number;
      satuan: string;
      minStok: number;
      valid: boolean;
    }>
  >([]);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedTemplate, setCopiedTemplate] = useState(false);

  // Template format for WhatsApp
  const sampleTemplate = `PRODUK#Beras Pandan Wangi 5kg#Beras & Tepung#64000#72000#30#sak#5
PRODUK#MinyakKita 1L#Minyak & Margarin#14000#15500#40#pouch#10
PRODUK#Gula Pasir Gulaku 1kg#Sembako & Bumbu#15000#17500#25#kg#5`;

  const sampleChatFormat = `Beras Sania 5kg, Beli 65000, Jual 72000, Stok 20, Satuan sak
Telur Ayam 1kg, Beli 26000, Jual 29000, Stok 50, Satuan kg
Minyak Filma 2L, Beli 32000, Jual 36000, Stok 15, Satuan pouch`;

  // Parser function
  const parseWhatsAppText = (text: string) => {
    if (!text.trim()) {
      setParsedItems([]);
      return;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    const results: Array<{
      nama: string;
      kategori: string;
      hargaBeli: number;
      hargaJual: number;
      stok: number;
      satuan: string;
      minStok: number;
      valid: boolean;
    }> = [];

    for (const line of lines) {
      // 1. Check Hash format: PRODUK#Nama#Kategori#HargaBeli#HargaJual#Stok#Satuan#MinStok
      if (line.toUpperCase().startsWith('PRODUK#') || line.includes('#')) {
        const parts = line.split('#').map((p) => p.trim());
        const startIndex = parts[0].toUpperCase() === 'PRODUK' ? 1 : 0;
        const nama = parts[startIndex] || '';
        const kategori = parts[startIndex + 1] || 'Sembako & Bumbu';
        const hargaBeli = parseInt(parts[startIndex + 2]?.replace(/\D/g, '') || '0', 10);
        const hargaJual = parseInt(parts[startIndex + 3]?.replace(/\D/g, '') || '0', 10);
        const stok = parseInt(parts[startIndex + 4]?.replace(/\D/g, '') || '0', 10);
        const satuan = parts[startIndex + 5] || 'Pcs';
        const minStok = parseInt(parts[startIndex + 6]?.replace(/\D/g, '') || '5', 10);

        if (nama) {
          results.push({
            nama,
            kategori,
            hargaBeli,
            hargaJual: hargaJual || Math.round(hargaBeli * 1.1),
            stok,
            satuan,
            minStok,
            valid: true,
          });
          continue;
        }
      }

      // 2. Check comma or dash separated format: Nama, Beli 10000, Jual 12000, Stok 10
      const commaParts = line.split(/,| - /);
      if (commaParts.length >= 2) {
        const nama = commaParts[0].trim();
        let hargaBeli = 0;
        let hargaJual = 0;
        let stok = 10;
        let satuan = 'Pcs';
        let kategori = 'Sembako & Bumbu';

        for (let i = 1; i < commaParts.length; i++) {
          const chunk = commaParts[i].toLowerCase();
          const num = parseInt(chunk.replace(/\D/g, '') || '0', 10);

          if (chunk.includes('beli')) hargaBeli = num;
          else if (chunk.includes('jual')) hargaJual = num;
          else if (chunk.includes('stok') || chunk.includes('qty')) stok = num;
          else if (chunk.includes('satuan')) satuan = chunk.replace('satuan', '').trim() || 'Pcs';
          else if (chunk.includes('kategori')) kategori = chunk.replace('kategori', '').trim();
          else if (num > 0 && hargaBeli === 0) hargaBeli = num;
          else if (num > 0 && hargaJual === 0) hargaJual = num;
        }

        if (nama) {
          results.push({
            nama,
            kategori,
            hargaBeli,
            hargaJual: hargaJual || Math.round(hargaBeli * 1.15),
            stok,
            satuan: satuan || 'Pcs',
            minStok: 5,
            valid: true,
          });
        }
      }
    }

    setParsedItems(results);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setRawText(val);
    parseWhatsAppText(val);
  };

  const handleImportToCatalog = async () => {
    const validItems = parsedItems.filter((i) => i.valid && i.nama);
    if (validItems.length === 0) {
      toastError('Tidak ada produk valid yang dapat diimpor.');
      return;
    }

    setIsImporting(true);
    try {
      let count = 0;
      for (const item of validItems) {
        await addProduct({
          kode: `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
          barcode: `${Math.floor(8990000000000 + Math.random() * 9999999)}`,
          nama: item.nama,
          kategori: item.kategori,
          hargaBeli: item.hargaBeli,
          hargaJual: item.hargaJual,
          stok: item.stok,
          minStok: item.minStok,
          satuan: item.satuan,
          gambarUrl: '',
          deskripsi: 'Diimpor otomatis via WhatsApp Integration',
          expiredDate: '',
          batchNo: '',
          terjual: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        count++;
      }

      success(`Berhasil mengimpor ${count} produk baru dari WhatsApp ke Katalog!`);
      setRawText('');
      setParsedItems([]);
    } catch (err) {
      console.error(err);
      toastError('Gagal mengimpor produk ke database.');
    } finally {
      setIsImporting(false);
    }
  };

  const copyFormatTemplate = () => {
    navigator.clipboard.writeText(sampleTemplate);
    setCopiedTemplate(true);
    success('Format template WhatsApp tersalin ke clipboard!');
    setTimeout(() => setCopiedTemplate(false), 2500);
  };

  // --- TAB BOT SIMULATOR & WEBHOOK HANDLER ---
  const [copiedWebhookUrl, setCopiedWebhookUrl] = useState(false);
  const [customDomain, setCustomDomain] = useState('sembako-smart-ai.vercel.app');
  
  const isPreviewEnv = typeof window !== 'undefined' && (window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost'));
  
  const productionWebhookUrl = `https://${customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '')}/api/whatsapp/webhook`;
  const currentPreviewWebhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/whatsapp/webhook` : productionWebhookUrl;
  
  const activeCopyUrl = isPreviewEnv ? productionWebhookUrl : currentPreviewWebhookUrl;

  const handleCopyWebhookUrl = (urlToCopy: string) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedWebhookUrl(true);
    success('URL Webhook Vercel berhasil disalin! Tempelkan di Webhook Settings Fonnte/Wablas Anda.');
    setTimeout(() => setCopiedWebhookUrl(false), 2500);
  };

  const handleSimulateBotWebhook = async () => {
    if (!botMessage.trim()) {
      toastError('Pesan WhatsApp simulasi tidak boleh kosong.');
      return;
    }

    setIsBotProcessing(true);
    try {
      // 1. Send HTTP POST to server endpoint
      try {
        await fetch('/api/whatsapp/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sender: botSenderNumber,
            message: botMessage,
          }),
        });
      } catch (e) {
        console.warn('Server webhook endpoint fetch notice:', e);
      }

      // 2. Process locally to add to Firebase/state
      const lines = botMessage.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
      let count = 0;
      const addedNames: string[] = [];

      for (const line of lines) {
        let nama = '';
        let kategori = 'Sembako & Bumbu';
        let hargaBeli = 10000;
        let hargaJual = 12000;
        let stok = 10;
        let minStok = 5;
        let satuan = 'Pcs';

        if (line.toUpperCase().startsWith('PRODUK#') || line.includes('#')) {
          const parts = line.split('#').map((p) => p.trim());
          const startIndex = parts[0].toUpperCase() === 'PRODUK' ? 1 : 0;
          nama = parts[startIndex] || '';
          kategori = parts[startIndex + 1] || 'Sembako & Bumbu';
          hargaBeli = parseInt(parts[startIndex + 2]?.replace(/\D/g, '') || '10000', 10);
          hargaJual = parseInt(parts[startIndex + 3]?.replace(/\D/g, '') || '12000', 10);
          stok = parseInt(parts[startIndex + 4]?.replace(/\D/g, '') || '10', 10);
          satuan = parts[startIndex + 5] || 'Pcs';
          minStok = parseInt(parts[startIndex + 6]?.replace(/\D/g, '') || '5', 10);
        } else {
          nama = line.split(',')[0].trim();
        }

        if (nama) {
          await addProduct({
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
            deskripsi: `Otomatis diimpor oleh WhatsApp Bot Webhook (Pengirim: ${botSenderNumber})`,
            expiredDate: '',
            batchNo: '',
            terjual: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          count++;
          addedNames.push(nama);
        }
      }

      if (count > 0) {
        const newLog = {
          id: Date.now().toString(),
          time: new Date().toLocaleTimeString('id-ID'),
          sender: botSenderNumber,
          message: botMessage,
          status: 'success' as const,
          detail: `Berhasil menambahkan ${count} produk (${addedNames.join(', ')}) ke katalog database`,
        };
        setWebhookLogs((prev) => [newLog, ...prev]);
        success(`🤖 [WhatsApp Bot Webhook] ${count} Produk baru ("${addedNames[0]}") otomatis masuk ke sistem POS!`);
      } else {
        toastError('Gagal memproses format pesan bot.');
      }
    } catch (err) {
      console.error(err);
      toastError('Terjadi kesalahan saat mengeksekusi bot webhook.');
    } finally {
      setIsBotProcessing(false);
    }
  };

  // --- TAB 2: CEK STOK VIA WHATSAPP ---
  const [searchStockKeyword, setSearchStockKeyword] = useState('');
  const [copiedStockReport, setCopiedStockReport] = useState(false);

  const filteredStockList = products.filter(
    (p) =>
      p.nama.toLowerCase().includes(searchStockKeyword.toLowerCase()) ||
      p.kategori.toLowerCase().includes(searchStockKeyword.toLowerCase())
  );

  const lowStockProducts = products.filter((p) => p.stok <= p.minStok);

  const generateWhatsAppStockReport = (onlyLowStock = false) => {
    const list = onlyLowStock ? lowStockProducts : filteredStockList.slice(0, 30);
    const storeName = localStorage.getItem('sembako_store_name') || 'Sembako Smart POS';
    const dateStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    let msg = `*📊 LAPORAN CEK STOK ${storeName.toUpperCase()}*\n`;
    msg += `📅 _${dateStr}_\n\n`;

    if (onlyLowStock) {
      msg += `🚨 *DAFTAR STOK MENIPIS/HABIS (${lowStockProducts.length} Barang):*\n`;
      if (lowStockProducts.length === 0) {
        msg += `✅ Semua stok produk dalam keadaan AMAN!\n`;
      } else {
        lowStockProducts.forEach((p, i) => {
          const status = p.stok === 0 ? '❌ HABIS' : '⚠️ MENIPIS';
          msg += `${i + 1}. *${p.nama}* -> Stok: *${p.stok} ${p.satuan}* (${status})\n`;
        });
      }
    } else {
      msg += `📦 *DAFTAR KATALOG & STOK PRODUK (${list.length} Items):*\n`;
      list.forEach((p, i) => {
        const isLow = p.stok <= p.minStok;
        const icon = p.stok === 0 ? '❌' : isLow ? '⚠️' : '✅';
        msg += `${i + 1}. ${icon} *${p.nama}* | Stok: *${p.stok} ${p.satuan}* | Rp ${p.hargaJual.toLocaleString('id-ID')}\n`;
      });
    }

    msg += `\n_Dikirim otomatis dari Sembako Smart POS AI_`;
    return msg;
  };

  const handleSendWhatsAppStock = (onlyLowStock = false) => {
    const text = generateWhatsAppStockReport(onlyLowStock);
    const adminPhone = localStorage.getItem('sembako_wa_admin') || '';
    const encoded = encodeURIComponent(text);
    const url = adminPhone
      ? `https://wa.me/${adminPhone.replace(/\D/g, '')}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  const copyStockReportText = (onlyLowStock = false) => {
    const text = generateWhatsAppStockReport(onlyLowStock);
    navigator.clipboard.writeText(text);
    setCopiedStockReport(true);
    success('Laporan stok tersalin dalam format WhatsApp!');
    setTimeout(() => setCopiedStockReport(false), 2500);
  };

  // --- TAB 3: NOTIFIKASI STOK MENIPIS KE WHATSAPP ---
  const [waAdminNumber, setWaAdminNumber] = useState(
    localStorage.getItem('sembako_wa_admin') || '085187869164'
  );
  const [autoWaAlert, setAutoWaAlert] = useState(
    localStorage.getItem('sembako_auto_wa_alert') !== 'false'
  );
  const [waGatewayToken, setWaGatewayToken] = useState(
    localStorage.getItem('sembako_wa_gateway_token') || ''
  );

  const saveNotificationSettings = () => {
    localStorage.setItem('sembako_wa_admin', waAdminNumber);
    localStorage.setItem('sembako_auto_wa_alert', String(autoWaAlert));
    localStorage.setItem('sembako_wa_gateway_token', waGatewayToken);
    success('Pengaturan Notifikasi WhatsApp berhasil disimpan!');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Integrasi WhatsApp Center" maxWidth="max-w-4xl">
      <div className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('input')}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'input'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <PlusCircle className="w-4 h-4 text-emerald-500" />
            <span>Salin Chat WA</span>
          </button>

          <button
            onClick={() => setActiveTab('bot-sim')}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'bot-sim'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Bot className="w-4 h-4 text-amber-400" />
            <span>🤖 Bot Webhook Otomatis</span>
          </button>

          <button
            onClick={() => setActiveTab('cek')}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'cek'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4 text-teal-500" />
            <span>Cek Stok via WA</span>
          </button>

          <button
            onClick={() => setActiveTab('notif')}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-bold border-b-2 flex items-center gap-2 cursor-pointer transition-colors ${
              activeTab === 'notif'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/5'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 text-amber-500" />
            <span>Alert Stok</span>
            {lowStockProducts.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-black animate-pulse">
                {lowStockProducts.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB 1: INPUT KATALOG VIA CHAT WHATSAPP */}
        {activeTab === 'input' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-sm">
                  <Sparkles className="w-4 h-4" /> Impor Katalog Cerdas dari Chat WhatsApp
                </span>
                <button
                  onClick={copyFormatTemplate}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all"
                >
                  {copiedTemplate ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedTemplate ? 'Tersalin' : 'Salin Format Template'}</span>
                </button>
              </div>

              {/* Explanatory Box: Kirim ke Nomor WA Mana? */}
              <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-500/30 text-xs space-y-2 shadow-sm">
                <h5 className="font-black text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 text-xs">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  Kirim Pesan ke Nomor WhatsApp Mana?
                </h5>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  <strong>1. Cara Paling Praktis & Gratis (Tanpa Sewa Bot):</strong><br />
                  Anda/Supplier/Kasir mengirim pesan daftar produk ke <strong>WhatsApp mana saja</strong> (misalnya ke WA pribadi Anda sendiri, ke WA Kasir, atau ke Grup WA Toko). Setelah itu, cukup <strong>Salin (Copy)</strong> pesan tersebut, lalu <strong>Tempel (Paste)</strong> di kotak di bawah. AI Parser akan otomatis membaca dan memasukkan barang ke katalog!
                </p>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                  <strong>2. Mode WhatsApp Bot Otomatis (Fonnte / Wablas Gateway):</strong><br />
                  Jika Anda mengaktifkan Token Gateway API di menu <em>Pengaturan &rarr; WhatsApp</em>, nomor tujuannya adalah <strong>Nomor WhatsApp Toko Anda Sendiri</strong> yang telah di-scan QR Code-nya di dashboard Fonnte/Wablas.
                </p>
              </div>
            </div>

            {/* Quick Fill Preset Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-500 dark:text-slate-400">Contoh Cepat:</span>
              <button
                onClick={() => {
                  setRawText(sampleTemplate);
                  parseWhatsAppText(sampleTemplate);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
              >
                Format Hash (#)
              </button>
              <button
                onClick={() => {
                  setRawText(sampleChatFormat);
                  parseWhatsAppText(sampleChatFormat);
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium cursor-pointer"
              >
                Format Chat Bebas
              </button>
            </div>

            {/* Input Text Area */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Tempel Pesan WhatsApp Di Sini:</span>
                <span className="text-slate-400 font-normal">
                  {parsedItems.length} Produk Terdeteksi
                </span>
              </label>
              <textarea
                rows={5}
                value={rawText}
                onChange={handleTextChange}
                placeholder="Contoh format hash:&#10;PRODUK#Beras Sania 5kg#Beras#65000#72000#20#sak#5&#10;&#10;Atau format chat bebas:&#10;MinyakKita 1L, Beli 14000, Jual 15500, Stok 40, Satuan pouch"
                className="w-full p-3 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Preview Parsed Items Table */}
            {parsedItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-emerald-500" />
                    Hasil Pembacaan Pesan ({parsedItems.length} Items)
                  </h4>
                  <button
                    onClick={handleImportToCatalog}
                    disabled={isImporting}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isImporting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Simpan {parsedItems.length} Produk Ke Katalog</span>
                  </button>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 font-bold sticky top-0">
                      <tr>
                        <th className="p-2.5">No</th>
                        <th className="p-2.5">Nama Produk</th>
                        <th className="p-2.5">Kategori</th>
                        <th className="p-2.5 text-right">Harga Beli</th>
                        <th className="p-2.5 text-right">Harga Jual</th>
                        <th className="p-2.5 text-right">Stok Awal</th>
                        <th className="p-2.5 text-center">Satuan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {parsedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-800 dark:text-slate-100">
                            {item.nama}
                          </td>
                          <td className="p-2.5 text-slate-500 dark:text-slate-400">
                            {item.kategori}
                          </td>
                          <td className="p-2.5 text-right font-mono text-slate-700 dark:text-slate-300">
                            Rp {item.hargaBeli.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                            Rp {item.hargaJual.toLocaleString('id-ID')}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                            {item.stok}
                          </td>
                          <td className="p-2.5 text-center text-slate-500">{item.satuan}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB BOT SIMULATOR & WEBHOOK DOKUMENTASI */}
        {activeTab === 'bot-sim' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 text-white space-y-3 border border-emerald-500/30">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-amber-300 flex items-center gap-2 text-sm">
                  <Bot className="w-5 h-5 text-emerald-400" />
                  Sistem Auto-Input WhatsApp Bot & Webhook Gateway
                </span>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                  Realtime Auto-Input
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Dengan fitur ini, pelanggan atau supplier cukup mengirimkan pesan chat dengan format khusus ke nomor WhatsApp Bot Toko. Sistem akan <strong>secara langsung (realtime)</strong> menerima pesan tersebut, memproses datanya, dan secara otomatis menambahkannya ke database katalog produk tanpa perlu Anda ketik manual!
              </p>

              {/* Webhook Endpoint Box */}
              <div className="p-4 rounded-xl bg-slate-950/90 border border-emerald-500/40 text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-400 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-amber-400" /> URL Webhook Vercel Deploy (Gunakan URL Ini di Fonnte/Wablas):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyWebhookUrl(productionWebhookUrl)}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer shadow-md transition-all"
                  >
                    {copiedWebhookUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedWebhookUrl ? 'Tersalin' : 'Salin URL Webhook Vercel'}</span>
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-900 border border-emerald-500/30 font-mono text-emerald-300 text-xs break-all select-all font-bold">
                  {productionWebhookUrl}
                </div>

                {/* Important Alert Callout for External Gateways */}
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-[11px] space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5 text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    Penting: Mengapa Dilarang Pakai URL Preview AI Studio (`*.run.app`)?
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[10px]">
                    URL preview Google AI Studio (`https://ais-dev-...run.app` / `ais-pre-...run.app`) dilindungi oleh sistem keamanan login/cookie. Jika Fonnte / Wablas dipasangi URL preview, server gateway akan menerima error balasan HTML <code className="text-amber-300 font-mono">Cookie check / Action required</code>.
                  </p>
                  <p className="text-emerald-300 font-semibold text-[10px]">
                    ✅ Selalu gunakan URL Vercel hasil deploy Publik: <span className="underline font-mono text-white">{productionWebhookUrl}</span> di dashboard WhatsApp Gateway Anda!
                  </p>
                </div>
              </div>
            </div>

            {/* Live Webhook Bot Interactive Simulator */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-emerald-500/30 space-y-4 shadow-xl text-white">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  Simulasi Langsung Pesan Masuk dari WhatsApp Bot (Live Webhook Tester)
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">Simulasi Realtime POS</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">Nomor WA Pengirim (Customer/Supplier):</label>
                  <input
                    type="text"
                    value={botSenderNumber}
                    onChange={(e) => setBotSenderNumber(e.target.value)}
                    placeholder="6281234567890"
                    className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 font-mono text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-bold mb-1">Isi Pesan WA Masuk (Format Bot):</label>
                  <input
                    type="text"
                    value={botMessage}
                    onChange={(e) => setBotMessage(e.target.value)}
                    placeholder="PRODUK#Minyak Bimoli 2L#Minyak & Margarin#32000#36500#30#pouch#5"
                    className="w-full p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-emerald-300 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setBotMessage('PRODUK#Gula Pasir Gulaku 1kg#Sembako & Bumbu#15000#17500#40#kg#5')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 font-mono cursor-pointer"
                  >
                    Preset: Gula 1kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setBotMessage('PRODUK#Teh Celup Sariwangi#Minuman & Kopi#6500#8000#50#kotak#10')}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono cursor-pointer"
                  >
                    Preset: Teh Celup
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSimulateBotWebhook}
                  disabled={isBotProcessing}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-2 cursor-pointer shadow-lg transition-all disabled:opacity-50"
                >
                  {isBotProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  <span>Jalankan Simulasi Pesan Bot Masuk</span>
                </button>
              </div>

              {/* Webhook Execution Activity Logs */}
              <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                <h5 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Log Aktivitas Bot Webhook Realtime</span>
                  <span className="text-[10px] text-emerald-400 font-mono">{webhookLogs.length} Event</span>
                </h5>
                <div className="max-h-40 overflow-y-auto space-y-1.5 font-mono text-[11px]">
                  {webhookLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-2"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-bold">[{log.time}]</span>
                          <span className="text-slate-300">Pengirim: {log.sender}</span>
                          <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            200 OK
                          </span>
                        </div>
                        <p className="text-slate-400 text-[10px]">Pesan: "{log.message}"</p>
                        <p className="text-emerald-400 font-bold text-[11px]">{log.detail}</p>
                      </div>
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Architecture Explanation Card */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-500" />
                Penjelasan Alur WhatsApp Bot Auto-Input ke Nomor Mana:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    1. Nomor WA Mana yang Dituju?
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Pelanggan/Supplier mengirim pesan ke <strong>Nomor WhatsApp Toko Anda (Nomor Bot)</strong> yang sudah terhubung ke layanan Gateway (Fonnte / Wablas).
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs font-black text-teal-600 dark:text-teal-400">
                    2. Penerusan Pesan Otomatis
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sistem WhatsApp Gateway (Fonnte/Wablas) secara instan meneruskan (forward) isi pesan tersebut melalui Webhook ke sistem POS ini.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                    3. Auto-Insert Database Realtime
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                    Sistem membaca format hashtag, memasukkan produk ke Katalog Database, dan langsung menampilkan produk baru di kasir!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CEK STOK VIA WHATSAPP */}
        {activeTab === 'cek' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <span className="font-extrabold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 text-sm">
                <Boxes className="w-4 h-4" /> Cek & Kirim Laporan Stok Realtime via WhatsApp
              </span>
              <p className="leading-relaxed">
                Anda dapat membuat dan mengirimkan rangkuman stok produk langsung ke WhatsApp HP Anda,
                pasangan bisnis, atau grup toko dalam sekali klik.
              </p>
            </div>

            {/* Filter / Search Stock */}
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                placeholder="Cari nama barang..."
                value={searchStockKeyword}
                onChange={(e) => setSearchStockKeyword(e.target.value)}
                className="flex-1 p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              />
              <button
                onClick={() => handleSendWhatsAppStock(false)}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Kirim Semua Stok ke WA</span>
              </button>
              <button
                onClick={() => copyStockReportText(false)}
                className="px-3 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                {copiedStockReport ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>Salin Teks</span>
              </button>
            </div>

            {/* Stock Message Preview Box */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Preview Teks Pesan WhatsApp:
              </label>
              <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-900 text-emerald-400 font-mono text-xs max-h-56 overflow-y-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                {generateWhatsAppStockReport(false)}
              </div>
            </div>

            {/* WhatsApp Bot Auto-Commands Sheet */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-emerald-500" />
                Panduan Perintah WhatsApp Bot (Jika Terhubung Gateway/Fonnte/Wablas)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono">
                  <span className="text-amber-500 font-bold">!stok</span>
                  <p className="text-[10px] text-slate-500 font-sans">Cek total ringkasan stok toko</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono">
                  <span className="text-amber-500 font-bold">!stok [nama]</span>
                  <p className="text-[10px] text-slate-500 font-sans">Cth: <code className="text-emerald-400">!stok beras</code></p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono">
                  <span className="text-amber-500 font-bold">!menipis</span>
                  <p className="text-[10px] text-slate-500 font-sans">Lihat daftar barang kritis</p>
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono">
                  <span className="text-amber-500 font-bold">!omzet</span>
                  <p className="text-[10px] text-slate-500 font-sans">Cek total omzet hari ini</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: NOTIFIKASI STOK MENIPIS KE WHATSAPP */}
        {activeTab === 'notif' && (
          <div className="space-y-5">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-slate-700 dark:text-slate-300 space-y-2">
              <span className="font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 text-sm">
                <AlertTriangle className="w-4 h-4" /> Laporan & Alert Stok Menipis Otomatis
              </span>
              <p className="leading-relaxed">
                Setiap kali transaksi kasir membuat stok produk berada di bawah batas minimum (
                <code>minStok</code>), sistem dapat mengirim pesan alert darurat ke WhatsApp Pemilik Toko!
              </p>
            </div>

            {/* Current Low Stock Items List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  Barang Stok Kritis / Menipis Saat Ini ({lowStockProducts.length})
                </h4>
                <button
                  onClick={() => handleSendWhatsAppStock(true)}
                  disabled={lowStockProducts.length === 0}
                  className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Kirim Laporan Stok Kritis ke WA</span>
                </button>
              </div>

              {lowStockProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                  ✅ Tidak ada barang dengan stok menipis saat ini! Semua aman.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  {lowStockProducts.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 flex items-center justify-between text-xs bg-rose-50/50 dark:bg-rose-950/20"
                    >
                      <div>
                        <span className="font-bold text-slate-800 dark:text-slate-100">
                          {p.nama}
                        </span>
                        <span className="text-slate-400 text-[10px] ml-2">({p.kategori})</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-slate-500">
                          Min: <strong className="text-slate-700 dark:text-slate-300">{p.minStok}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-md font-bold bg-rose-500 text-white">
                          Sisa: {p.stok} {p.satuan}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Configuration Controls */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50 dark:bg-slate-900/60">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-emerald-500" />
                Konfigurasi Penerima WhatsApp
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    No. WhatsApp Pemilik / Admin:
                  </label>
                  <input
                    type="text"
                    value={waAdminNumber}
                    onChange={(e) => setWaAdminNumber(e.target.value)}
                    placeholder="Contoh: 085187869164"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <p className="text-[10px] text-slate-400">Format nomor dimulai dengan 08... atau 62...</p>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Token Gateway API (Fonnte / Wablas - Opsional):
                  </label>
                  <input
                    type="password"
                    value={waGatewayToken}
                    onChange={(e) => setWaGatewayToken(e.target.value)}
                    placeholder="Masukkan Token Fonnte / Wablas"
                    className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                  />
                  <p className="text-[10px] text-slate-400">Untuk pengiriman pesan otomatis di latar belakang</p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoWaAlert}
                    onChange={(e) => setAutoWaAlert(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Aktifkan Notifikasi Pop-up & Alert WhatsApp Saat Stok Menipis
                  </span>
                  <p className="text-[10px] text-slate-400">
                    Memunculkan tombol kirim cepat saat kasir menyelesaikan transaksi yang membuat stok kritis
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={saveNotificationSettings}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
                >
                  <Check className="w-4 h-4" />
                  <span>Simpan Pengaturan Notifikasi</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
