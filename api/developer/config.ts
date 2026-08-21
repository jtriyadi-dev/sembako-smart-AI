import { createClient } from '@supabase/supabase-js';

function getSupabaseServerClient() {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '').trim().replace(/^bearer\s+/i, '');

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

  if (method === 'GET') {
    try {
      if (supabase) {
        const { data } = await supabase
          .from('remote_config')
          .select('config')
          .eq('id', 'app_remote_config')
          .maybeSingle();

        if (data && data.config) {
          return res.status(200).json({
            status: true,
            config: data.config
          });
        }
      }

      return res.status(200).json({
        status: true,
        config: null
      });
    } catch (e: any) {
      return res.status(200).json({
        status: true,
        config: null
      });
    }
  }

  if (method === 'POST') {
    try {
      const body = req.body || {};
      const newConfig = body.config || body;

      if (supabase && typeof newConfig === 'object') {
        await supabase
          .from('remote_config')
          .upsert({
            id: 'app_remote_config',
            config: newConfig,
            updated_at: new Date().toISOString()
          });
      }

      return res.status(200).json({
        status: true,
        message: 'Konfigurasi remote berhasil disimpan.',
        config: newConfig
      });
    } catch (e: any) {
      return res.status(200).json({
        status: false,
        message: `Gagal menyimpan konfigurasi: ${e?.message || 'Error'}`
      });
    }
  }

  return res.status(405).json({ status: false, message: 'Method Not Allowed' });
}
