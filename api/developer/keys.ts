import { createClient } from '@supabase/supabase-js';

function getSupabaseServerClient() {
  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim().replace(/^bearer\s+/i, '');

  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseServerClient();
  const serverSupabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serverSupabaseAnonKey = (process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
  const hasServiceRoleKey = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const serverWaToken = (process.env.WABLAS_TOKEN || process.env.WABLAS_API_KEY || process.env.WA_API_KEY || '').trim();
  const serverWaSender = (process.env.WABLAS_SENDER || process.env.WA_SENDER || '081234567890').trim();

  const defaultKeys = {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: 'gemini-2.5-flash',
    waGatewayProvider: 'wablas',
    waApiKey: serverWaToken,
    waSenderNumber: serverWaSender,
    waServerUrl: process.env.WABLAS_SERVER_URL || 'https://kudus.wablas.com',
    waPhoneNumber: serverWaSender,
    waWebhookUrl: '/api/whatsapp/webhook',
    supabaseUrl: serverSupabaseUrl,
    supabaseAnonKey: serverSupabaseAnonKey,
    supabaseServiceRoleKey: hasServiceRoleKey ? '••••••••••••••••' : '',
    isSupabaseConfigured: Boolean(serverSupabaseUrl && (serverSupabaseAnonKey || hasServiceRoleKey)),
    isSupabaseServiceRoleConfigured: hasServiceRoleKey,
    isWablasConfigured: Boolean(serverWaToken)
  };

  if (method === 'GET') {
    try {
      if (supabase) {
        const { data } = await supabase
          .from('remote_config')
          .select('config')
          .eq('id', 'app_api_keys')
          .maybeSingle();

        if (data && data.config) {
          const cfg = data.config;
          const merged = {
            ...defaultKeys,
            ...cfg,
            // Never expose real server service role key back to frontend
            supabaseServiceRoleKey: (cfg.supabaseServiceRoleKey || hasServiceRoleKey) ? '••••••••••••••••' : '',
            isSupabaseServiceRoleConfigured: Boolean(cfg.supabaseServiceRoleKey || hasServiceRoleKey),
            isWablasConfigured: Boolean(cfg.waApiKey || serverWaToken)
          };
          return res.status(200).json({
            status: true,
            success: true,
            keys: merged
          });
        }
      }

      return res.status(200).json({
        status: true,
        success: true,
        keys: defaultKeys
      });
    } catch (e: any) {
      return res.status(200).json({
        status: true,
        success: true,
        keys: defaultKeys
      });
    }
  }

  if (method === 'POST') {
    try {
      const body = req.body || {};
      const newKeys = body.keys || body;

      // Update runtime process.env safely
      if (newKeys.geminiApiKey) process.env.GEMINI_API_KEY = newKeys.geminiApiKey;
      if (newKeys.supabaseUrl) process.env.SUPABASE_URL = newKeys.supabaseUrl;
      if (newKeys.supabaseAnonKey) {
        process.env.SUPABASE_ANON_KEY = newKeys.supabaseAnonKey;
        process.env.VITE_SUPABASE_ANON_KEY = newKeys.supabaseAnonKey;
      }
      if (newKeys.supabaseServiceRoleKey && !newKeys.supabaseServiceRoleKey.includes('•')) {
        process.env.SUPABASE_SERVICE_ROLE_KEY = newKeys.supabaseServiceRoleKey;
      }
      if (newKeys.waApiKey) {
        process.env.WABLAS_TOKEN = newKeys.waApiKey;
        process.env.WABLAS_API_KEY = newKeys.waApiKey;
      }
      if (newKeys.waSenderNumber) {
        process.env.WABLAS_SENDER = newKeys.waSenderNumber;
      }

      if (supabase && typeof newKeys === 'object') {
        const toSave = { ...newKeys };
        // Don't overwrite with masked stars
        if (toSave.supabaseServiceRoleKey && toSave.supabaseServiceRoleKey.includes('•')) {
          delete toSave.supabaseServiceRoleKey;
        }
        await supabase
          .from('remote_config')
          .upsert({
            id: 'app_api_keys',
            config: toSave,
            updated_at: new Date().toISOString()
          });
      }

      return res.status(200).json({
        status: true,
        success: true,
        message: 'Kunci API berhasil disimpan ke remote config dan server runtime.',
        keys: {
          ...newKeys,
          supabaseServiceRoleKey: (newKeys.supabaseServiceRoleKey || hasServiceRoleKey) ? '••••••••••••••••' : ''
        }
      });
    } catch (e: any) {
      return res.status(200).json({
        status: false,
        success: false,
        message: `Gagal menyimpan kunci: ${e?.message || 'Error'}`
      });
    }
  }

  return res.status(405).json({ status: false, message: 'Method Not Allowed' });
}
