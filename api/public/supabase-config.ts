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

  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://wwnvddrmwxkomkkbhfep.supabase.co'
  ).trim().replace(/\/+$/, '');

  const supabaseAnonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim().replace(/^bearer\s+/i, '');

  return res.status(200).json({
    configured: Boolean(supabaseUrl && supabaseAnonKey),
    supabaseUrl: supabaseUrl || 'https://wwnvddrmwxkomkkbhfep.supabase.co',
    supabaseAnonKey: supabaseAnonKey || '',
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)
  });
}
