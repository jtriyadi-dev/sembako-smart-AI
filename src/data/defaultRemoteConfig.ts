import { RemoteAppConfig, CrmUser, DeveloperApiKeys } from '../types';

export const DEFAULT_REMOTE_CONFIG: RemoteAppConfig = {
  version: 1,
  updatedAt: new Date().toISOString(),
  updatedBy: 'Super Admin Developer',
  branding: {
    appName: 'Sembako Smart AI',
    appSubtitle: 'Sistem Kasir POS & Manajemen Toko Sembako Terintegrasi AI',
    tagline: 'Solusi Cerdas Kelola Toko Sembako, Minimarket, dan Grosir Tanpa Ribet',
    logoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=300&auto=format&fit=crop',
    faviconUrl: '',
    supportWa: '6281234567890',
    supportEmail: 'developer@sembakosmart.id',
    officialWebsite: 'https://sembakosmart.id',
  },
  hero: {
    badgeText: '🔥 PROMO KHUSUS HARI INI • LISENSI RESMI LIFETIME',
    headline: 'Toko Sembako Makin Rapi & Untung Berlipat dengan',
    headlineHighlight: 'Kasir Pintar POS Berbasis AI',
    subheadline: 'Kelola stok ratusan sembako, cetak struk kasir bluetooth super cepat, pantau omzet harian otomatis, dan asisten cerdas AI pencegah stok bocor serta barang kedaluwarsa.',
    ctaPrimaryText: '🔥 Beli Lisensi Rp 99rb (Sekali Bayar)',
    ctaSecondaryText: '⚡ Coba Demo Gratis 6 Jam',
    ratingScore: '4.98 / 5.0',
    ratingCountText: '1.420+ Ulasan Pemilik Toko',
    usersCountText: '3.850+ Toko Sembako Aktif',
  },
  announcement: {
    enabled: true,
    badgeText: '🎉 UPDATE TERBARU',
    message: 'Fitur WhatsApp Gateway & Asisten AI Stok Real-Time telah aktif! Nikmati lisensi resmi seumur hidup tanpa biaya bulanan.',
    linkText: 'Klaim Promo',
    linkUrl: '#pricing',
    theme: 'emerald',
  },
  maintenance: {
    enabled: false,
    title: 'Pemeliharaan Sistem Terjadwal',
    message: 'Aplikasi sedang dalam peningkatan performa server. Silakan coba kembali dalam beberapa menit.',
    estimatedEndTime: '15 Menit',
    allowDevBypass: true,
  },
  media: {
    heroBannerImage: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=1600&auto=format&fit=crop',
    promoBannerImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop',
    videos: [
      {
        id: 'vid-1',
        title: 'Tutorial Lengkap: Cara Pakai POS Kasir & Cetak Struk Bluetooth',
        description: 'Panduan step-by-step mulai dari scan barcode barang, transaksi kasir hitungan detik, hingga cetak struk thermal 58mm/80mm.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1556742049-0a67e557224f?q=80&w=800&auto=format&fit=crop',
        isFeatured: true,
        platform: 'youtube',
      },
      {
        id: 'vid-2',
        title: 'Demo WhatsApp Bot: Tambah & Cek Stok Otomatis lewat WA',
        description: 'Cukup ketik pesan WA ke bot nomor toko, stok langsung terupdate otomatis di kasir dan database cloud.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        thumbnailUrl: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?q=80&w=800&auto=format&fit=crop',
        isFeatured: false,
        platform: 'youtube',
      }
    ],
    galleryImages: [
      {
        id: 'gal-1',
        title: 'Tampilan Kasir Cepat (POS)',
        url: 'https://images.unsplash.com/photo-1556742049-0a67e557224f?q=80&w=800&auto=format&fit=crop',
        category: 'Fitur Utama',
      },
      {
        id: 'gal-2',
        title: 'Manajemen Stok & Kedaluwarsa',
        url: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?q=80&w=800&auto=format&fit=crop',
        category: 'Inventori',
      },
      {
        id: 'gal-3',
        title: 'Laporan Keuangan & Grafik Omzet',
        url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=800&auto=format&fit=crop',
        category: 'Laporan',
      }
    ]
  },
  pricing: {
    promoBadge: 'PENAWARAN TERBATAS • DISKON 78%',
    promoTitle: 'Lisensi Resmi Lifetime (Sekali Bayar Seumur Hidup)',
    promoPrice: 99000,
    normalPrice: 450000,
    discountPercent: 78,
    priceNote: 'Hanya Rp 99.000 sekali bayar untuk selamanya. Tanpa biaya bulanan atau tahunan.',
    checkoutWaText: 'Halo Developer Sembako Smart AI, saya ingin aktivasi Lisensi Resmi Lifetime Rp 99.000.',
    featuresList: [
      'Lisensi Resmi Lifetime (Sekali Bayar Seumur Hidup)',
      'Akses Penuh Semua Modul (Kasir, Stok, Supplier, Transaksi, Laporan)',
      'Integrasi AI Assistant untuk Rekomendasi Restock & Cek Kedaluwarsa',
      'Integrasi Bot WhatsApp untuk Update Stok Otomatis',
      'Dukungan Printer Kasir Thermal Bluetooth & USB (58mm/80mm)',
      'Dukungan USB/Kamera Barcode Scanner',
      'Penyimpanan Cloud & Mode Offline Tanpa Kuota',
      'Bebas Input Produk & Transaksi Tanpa Batas (Unlimited)',
      'Update Fitur & Perbaikan Gratis Selamanya',
      'Panduan Video & Bantuan Tim Developer Langsung'
    ]
  },
  faqs: [
    {
      id: 'faq-1',
      q: 'Apakah aplikasi ini memerlukan biaya langganan bulanan?',
      a: 'TIDAK! Sembako Smart POS AI harganya CUMA Rp 99.000 Sekali Bayar (Lifetime License). Setelah membeli lisensi resmi, Anda mendapatkan akses seumur hidup tanpa biaya bulanan atau tahunan tersembunyi.'
    },
    {
      id: 'faq-2',
      q: 'Apakah bisa digunakan di HP Android, Tablet, dan Komputer/Laptop?',
      a: 'BISA! Aplikasi ini berbasis Progressive Web App (PWA) yang dapat dibuka di semua perangkat (HP Android, iPhone, Tablet, Laptop Windows, MacBook) dan bisa di-install langsung layaknya aplikasi native.'
    },
    {
      id: 'faq-3',
      q: 'Bagaimana jika internet di toko mati atau sinyal buruk?',
      a: 'Aplikasi dilengkapi fitur Offline-First. Anda tetap bisa input transaksi kasir, scan barcode, dan cetak struk tanpa internet. Saat koneksi internet kembali menyala, data otomatis tersinkronisasi ke cloud.'
    },
    {
      id: 'faq-4',
      q: 'Apakah mendukung printer thermal struk kasir dan scanner barcode?',
      a: 'Sangat mendukung! Aplikasi kompatibel dengan semua jenis printer thermal bluetooth/USB (kertas 58mm maupun 80mm) dan barcode scanner USB/kamera.'
    }
  ],
  featureFlags: {
    enableAiAssistant: true,
    enableWhatsAppBot: true,
    enableBarcodeScanner: true,
    enableOfflineSync: true,
    enableCustomerReceiptWa: true,
  }
};

export const INITIAL_CRM_USERS: CrmUser[] = [
  {
    id: 'user-crm-dev',
    namaPemilik: 'Master Developer (Super Admin)',
    namaToko: 'Pusat Developer Sembako Smart AI',
    email: 'developer@sembakosmart.id',
    password: 'password123',
    noHp: '081234567899',
    alamatToko: 'Headquarters Sembako Smart POS, Jakarta',
    plan: 'enterprise',
    status: 'aktif',
    licenseKey: 'SBK-DEV-MASTER-9988',
    deviceLimit: 99,
    activeDevicesCount: 1,
    role: 'developer',
    notes: 'Akun Super Admin Developer dengan akses penuh ke CRM & POS',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-18T00:00:00.000Z',
    expiresAt: null,
    lastLoginAt: '2026-08-18T08:00:00.000Z',
    totalTransactions: 999
  },
  {
    id: 'user-crm-001',
    namaPemilik: 'Haji Budi Santoso',
    namaToko: 'Toko Berkah Sembako Utama',
    email: 'haji.budi@toko.id',
    password: 'password123',
    noHp: '081234567890',
    alamatToko: 'Pasar Induk Kramat Jati Blok B No. 12, Jakarta Timur',
    plan: 'pro_lifetime',
    status: 'aktif',
    licenseKey: 'SBK-PRO-8899-A1B2',
    deviceLimit: 3,
    activeDevicesCount: 2,
    role: 'owner',
    notes: 'Pelanggan VIP, toko grosir sembako ramai',
    createdAt: '2026-08-01T10:00:00.000Z',
    updatedAt: '2026-08-15T08:30:00.000Z',
    expiresAt: null, // Lifetime
    lastLoginAt: '2026-08-18T06:45:00.000Z',
    totalTransactions: 432
  },
  {
    id: 'user-crm-002',
    namaPemilik: 'Ibu Siti Rahmawati',
    namaToko: 'Warung Sembako Barokah',
    email: 'siti.barokah@gmail.com',
    password: 'password123',
    noHp: '085712345678',
    alamatToko: 'Jl. Melati No. 45, Bandung',
    plan: 'pro_lifetime',
    status: 'aktif',
    licenseKey: 'SBK-PRO-7744-X9Y8',
    deviceLimit: 2,
    activeDevicesCount: 1,
    role: 'owner',
    notes: 'Aktivasi via transfer BCA Rp 99.000',
    createdAt: '2026-08-05T14:20:00.000Z',
    updatedAt: '2026-08-16T11:10:00.000Z',
    expiresAt: null,
    lastLoginAt: '2026-08-17T19:22:00.000Z',
    totalTransactions: 289
  },
  {
    id: 'user-crm-003',
    namaPemilik: 'Ahmad Fauzi',
    namaToko: 'Minimarket Sumber Rezeki',
    email: 'ahmad.fauzi@rezeki.co.id',
    password: 'password123',
    noHp: '081398765432',
    alamatToko: 'Jl. Pemuda No. 100, Surabaya',
    plan: 'enterprise',
    status: 'aktif',
    licenseKey: 'SBK-ENT-9900-Z5W4',
    deviceLimit: 10,
    activeDevicesCount: 4,
    role: 'admin',
    notes: 'Paket Enterprise 4 Cabang Toko',
    createdAt: '2026-08-10T09:15:00.000Z',
    updatedAt: '2026-08-17T14:00:00.000Z',
    expiresAt: null,
    lastLoginAt: '2026-08-18T07:10:00.000Z',
    totalTransactions: 876
  },
  {
    id: 'user-crm-004',
    namaPemilik: 'Rendra Hendrawan',
    namaToko: 'Toko Kelontong Sejahtera',
    email: 'rendra.trial@gmail.com',
    password: 'password123',
    noHp: '087811223344',
    alamatToko: 'Jl. Cendrawasih No. 22, Semarang',
    plan: 'trial_6h',
    status: 'aktif',
    licenseKey: 'SBK-TRL-6H-8812',
    deviceLimit: 1,
    activeDevicesCount: 1,
    role: 'owner',
    notes: 'Masa percobaan 6 jam',
    createdAt: '2026-08-18T05:00:00.000Z',
    updatedAt: '2026-08-18T05:00:00.000Z',
    expiresAt: '2026-08-18T11:00:00.000Z',
    lastLoginAt: '2026-08-18T05:05:00.000Z',
    totalTransactions: 12
  }
];

export const DEFAULT_API_KEYS: DeveloperApiKeys = {
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: 'gemini-3.7-flash',
  waGatewayProvider: 'fonnte',
  waApiKey: '',
  waSenderNumber: '081234567890',
  waWebhookUrl: '/api/whatsapp/webhook',
  paymentGatewayKey: '',
  cloudSyncUrl: 'https://api.restful-api.dev/objects/ff8081819f7e10ae019ff3f0ddfd2c42',
  updatedAt: new Date().toISOString(),
};
