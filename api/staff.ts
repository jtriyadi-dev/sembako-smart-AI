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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
        const { data, error } = await supabase
          .from('staff_accounts')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          return res.status(200).json({
            status: true,
            staff: data
          });
        }
      }

      return res.status(200).json({
        status: true,
        staff: []
      });
    } catch (e: any) {
      return res.status(200).json({
        status: true,
        staff: []
      });
    }
  }

  if (method === 'POST') {
    try {
      const staffMember = req.body || {};
      if (supabase && staffMember && staffMember.id) {
        await supabase
          .from('staff_accounts')
          .upsert(staffMember);
      }
      return res.status(200).json({
        status: true,
        message: 'Akun staf berhasil disimpan.',
        staff: staffMember
      });
    } catch (e: any) {
      return res.status(200).json({
        status: false,
        message: `Gagal menyimpan staf: ${e?.message || 'Error'}`
      });
    }
  }

  return res.status(405).json({ status: false, message: 'Method Not Allowed' });
}
