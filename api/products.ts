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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  const method = (req.method || 'GET').toUpperCase();

  if (method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getSupabaseServerClient();
  const storeId = req.query?.store_id || 'store_toko_sembako_samsidi';

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return res.status(200).json({
          status: true,
          products: data
        });
      }
    }
  } catch (_) {}

  return res.status(200).json({
    status: true,
    products: []
  });
}
