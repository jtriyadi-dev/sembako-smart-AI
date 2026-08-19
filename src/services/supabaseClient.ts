import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProdukItem, TransaksiItem, CrmUser } from '../types';

let cachedClient: SupabaseClient | null = null;
let currentConfigKey = '';

/**
 * Get active Supabase client with fallback hierarchy:
 * 1. Explicit arguments
 * 2. LocalStorage / Control Panel API keys
 * 3. Vite environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 */
export function getSupabaseClient(overrideUrl?: string, overrideKey?: string): SupabaseClient | null {
  const env = (import.meta as any).env || {};
  
  // Check localStorage for dynamically configured Supabase in Control Panel
  let localKeys: any = {};
  try {
    const raw = localStorage.getItem('sem_api_keys');
    if (raw) localKeys = JSON.parse(raw);
  } catch (_) {}

  const url = (overrideUrl || localKeys.supabaseUrl || env.VITE_SUPABASE_URL || '').trim();
  const key = (overrideKey || localKeys.supabaseAnonKey || env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!url || !key) {
    return null;
  }

  const configSignature = `${url}:::${key}`;
  if (cachedClient && currentConfigKey === configSignature) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    currentConfigKey = configSignature;
    return cachedClient;
  } catch (err) {
    console.warn('[Supabase Client Init Error]:', err);
    return null;
  }
}

/**
 * Test connectivity to Supabase instance
 */
export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ success: boolean; message: string; projectUrl?: string; tables?: string[] }> {
  const cleanUrl = (url || '').trim();
  const cleanKey = (anonKey || '').trim();

  if (!cleanUrl || !cleanKey) {
    return {
      success: false,
      message: 'URL Supabase dan Anon/Public Key wajib diisi.',
    };
  }

  // Validate URL format
  if (!cleanUrl.startsWith('https://') || !cleanUrl.includes('.supabase.co')) {
    return {
      success: false,
      message: 'Format URL Supabase tidak valid. Contoh yang benar: https://abcdefghijklmn.supabase.co',
    };
  }

  try {
    const tempClient = createClient(cleanUrl, cleanKey, {
      auth: { persistSession: false },
    });

    // 1. Check REST endpoint connectivity
    const pingRes = await fetch(`${cleanUrl}/rest/v1/`, {
      headers: {
        apikey: cleanKey,
        Authorization: `Bearer ${cleanKey}`,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (!pingRes.ok && pingRes.status === 401) {
      return {
        success: false,
        message: 'Koneksi gagal (401 Unauthorized): Anon/Public Key tidak valid.',
      };
    }

    // 2. Try querying products or version
    const { error: queryErr } = await tempClient
      .from('products')
      .select('id')
      .limit(1);

    if (queryErr && !queryErr.message.includes('relation "public.products" does not exist')) {
      // If error is other than missing table (e.g. invalid key)
      if (queryErr.code === 'PGRST301' || queryErr.message.includes('JWT')) {
        return {
          success: false,
          message: `Koneksi ditolak: ${queryErr.message}`,
        };
      }
    }

    const tableNotice = queryErr?.message.includes('does not exist')
      ? ' (Tabel belum dibuat, klik "Salin Skrip SQL" untuk membuat skema otomatis)'
      : ' (Tabel siap & aktif)';

    return {
      success: true,
      message: `✅ Berhasil Terhubung ke Supabase Cloud Database!${tableNotice}`,
      projectUrl: cleanUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      message: `❌ Gagal menghubungi Supabase: ${err?.message || 'Network Timeout'}`,
    };
  }
}

/**
 * SQL Schema script to run in Supabase SQL Editor
 */
export const SUPABASE_SCHEMA_SQL = `-- =========================================================================
-- SEMBAKO SMART AI POS - SUPABASE POSTGRESQL SCHEMA MIGRATION
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda
-- =========================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLE: PRODUCTS (Data Produk Sembako, Kategori, Stok & Barcode)
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  kode TEXT NOT NULL UNIQUE,
  barcode TEXT,
  nama TEXT NOT NULL,
  kategori TEXT NOT NULL DEFAULT 'Sembako & Bumbu',
  harga_beli NUMERIC(15,2) NOT NULL DEFAULT 0,
  harga_jual NUMERIC(15,2) NOT NULL DEFAULT 0,
  stok NUMERIC(12,2) NOT NULL DEFAULT 0,
  satuan TEXT NOT NULL DEFAULT 'Pcs',
  min_stok NUMERIC(12,2) NOT NULL DEFAULT 5,
  terjual NUMERIC(12,2) NOT NULL DEFAULT 0,
  supplier TEXT DEFAULT 'Distributor Utama',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast POS search
CREATE INDEX IF NOT EXISTS idx_products_kode ON public.products(kode);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_nama ON public.products(nama);

-- 3. TABLE: TRANSACTIONS (Transaksi Penjualan Kasir POS)
CREATE TABLE IF NOT EXISTS public.transactions (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  kode_transaksi TEXT NOT NULL UNIQUE,
  tanggal TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  diskon_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  pajak_persen NUMERIC(5,2) NOT NULL DEFAULT 0,
  pajak_nominal NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_harga NUMERIC(15,2) NOT NULL DEFAULT 0,
  bayar NUMERIC(15,2) NOT NULL DEFAULT 0,
  kembalian NUMERIC(15,2) NOT NULL DEFAULT 0,
  metode_pembayaran TEXT NOT NULL DEFAULT 'tunai',
  status_pembayaran TEXT NOT NULL DEFAULT 'lunas',
  kasir_nama TEXT DEFAULT 'Kasir Utama',
  catatan TEXT,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for transaction queries
CREATE INDEX IF NOT EXISTS idx_tx_tanggal ON public.transactions(tanggal);
CREATE INDEX IF NOT EXISTS idx_tx_status ON public.transactions(status_pembayaran);

-- 4. TABLE: CRM_USERS (Akun Toko, Lisensi CRM & Limit Perangkat)
CREATE TABLE IF NOT EXISTS public.crm_users (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  nama_pemilik TEXT NOT NULL,
  nama_toko TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL DEFAULT 'password123',
  no_hp TEXT,
  alamat_toko TEXT,
  plan TEXT NOT NULL DEFAULT 'basic',
  status TEXT NOT NULL DEFAULT 'aktif',
  license_key TEXT UNIQUE,
  device_limit INT NOT NULL DEFAULT 3,
  active_devices_count INT NOT NULL DEFAULT 1,
  role TEXT NOT NULL DEFAULT 'owner',
  notes TEXT,
  expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. TABLE: WEBHOOK_LOGS (Log Pesan WhatsApp Masuk & Bot Stok)
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  sender TEXT NOT NULL,
  message_text TEXT,
  raw_body JSONB,
  status TEXT NOT NULL DEFAULT 'success',
  action_taken TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. TABLE: REMOTE_CONFIG (Konfigurasi Live CMS & Branding)
CREATE TABLE IF NOT EXISTS public.remote_config (
  id TEXT PRIMARY KEY DEFAULT 'app_master_config',
  config JSONB NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT DEFAULT 'Super Admin'
);

-- Enable Row Level Security (RLS) & Public Access Policies for API
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_config ENABLE ROW LEVEL SECURITY;

-- Allow anon read & write with API key
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Products') THEN
    CREATE POLICY "Public Access Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Transactions') THEN
    CREATE POLICY "Public Access Transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access CRM Users') THEN
    CREATE POLICY "Public Access CRM Users" ON public.crm_users FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Webhook Logs') THEN
    CREATE POLICY "Public Access Webhook Logs" ON public.webhook_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Access Remote Config') THEN
    CREATE POLICY "Public Access Remote Config" ON public.remote_config FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;
