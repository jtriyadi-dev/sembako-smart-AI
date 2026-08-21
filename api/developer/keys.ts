import { createClient } from '@supabase/supabase-js';

function getSupabaseServerClient() {
  const url = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://wwnvddrmwxkomkkbhfep.supabase.co'
  ).trim().replace(/\/+$/, '');

  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim().replace(/^bearer\s+/i, '');

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
  const defaultKeys = {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    waApiKey: process.env.WABLAS_API_KEY || process.env.WA_API_KEY || '',
    waServerUrl: 'https://kudus.wablas.com',
    waPhoneNumber: '6285223335816',
    waWebhookUrl: '/api/whatsapp/webhook',
    supabaseUrl: 'https://wwnvddrmwxkomkkbhfep.supabase.co',
    supabaseAnonKey: ''
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
          return res.status(200).json({
            status: true,
            keys: { ...defaultKeys, ...data.config }
          });
        }
      }

      return res.status(200).json({
        status: true,
        keys: defaultKeys
      });
    } catch (e: any) {
      return res.status(200).json({
        status: true,
        keys: defaultKeys
      });
    }
  }

  if (method === 'POST') {
    try {
      const body = req.body || {};
      const newKeys = body.keys || body;

      if (supabase && typeof newKeys === 'object') {
        await supabase
          .from('remote_config')
          .upsert({
            id: 'app_api_keys',
            config: newKeys,
            updated_at: new Date().toISOString()
          });
      }

      return res.status(200).json({
        status: true,
        message: 'Kunci API berhasil disimpan ke remote config Supabase Cloud.',
        keys: newKeys
      });
    } catch (e: any) {
      return res.status(200).json({
        status: false,
        message: `Gagal menyimpan kunci: ${e?.message || 'Error'}`
      });
    }
  }

  return res.status(405).json({ status: false, message: 'Method Not Allowed' });
}
