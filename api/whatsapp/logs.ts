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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
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
          .from('webhook_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && Array.isArray(data)) {
          const formattedLogs = data.map((l: any, idx: number) => ({
            id: String(l.id || idx),
            time: l.created_at ? new Date(l.created_at).toLocaleTimeString('id-ID') : new Date().toLocaleTimeString('id-ID'),
            sender: l.sender || 'WhatsApp User',
            message: l.message_text || l.message || '',
            status: l.status === 'success' ? 'success' : l.status === 'error' ? 'error' : 'ignored',
            actionTaken: l.action_taken || 'Diproses oleh server Supabase'
          }));

          return res.status(200).json({
            status: true,
            logs: formattedLogs
          });
        }
      }

      return res.status(200).json({
        status: true,
        logs: []
      });
    } catch (e: any) {
      return res.status(200).json({
        status: true,
        logs: []
      });
    }
  }

  if (method === 'POST' || method === 'DELETE') {
    try {
      if (supabase) {
        await supabase.from('webhook_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      }
      return res.status(200).json({
        status: true,
        message: 'Log webhook berhasil dibersihkan.'
      });
    } catch (e: any) {
      return res.status(200).json({
        status: true,
        message: 'Log dibersihkan.'
      });
    }
  }

  return res.status(405).json({ status: false, message: 'Method Not Allowed' });
}
