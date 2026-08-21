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

  if (method !== 'POST') {
    return res.status(405).json({ status: false, message: 'Method Not Allowed' });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const supabaseUrl = (
      body.supabaseUrl ||
      body.url ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ''
    ).trim().replace(/\/+$/, '');

    const supabaseKey = (
      body.supabaseServiceRoleKey ||
      body.supabaseAnonKey ||
      body.apiKey ||
      body.key ||
      body.supabaseKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim().replace(/^bearer\s+/i, '');

    if (!supabaseUrl || !supabaseKey) {
      return res.status(200).json({
        success: false,
        status: false,
        error: 'SERVER_ENV_NOT_CONFIGURED',
        message: 'URL Supabase dan Key API belum diisi. Harap masukkan kredensial di Control Panel atau set environment variable SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY di server.'
      });
    }

    const isServiceRole = Boolean(body.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY);
    const keyTypeLabel = isServiceRole ? 'Service Role Key' : 'API Key';

    // Ping Supabase PostgREST endpoint
    try {
      const restRes = await fetch(`${supabaseUrl}/rest/v1/`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        },
        signal: AbortSignal.timeout(6000)
      });

      if (restRes.ok || restRes.status === 200 || restRes.status === 206) {
        return res.status(200).json({
          success: true,
          status: true,
          message: `✅ Berhasil Terhubung ke Supabase Cloud Database! (${keyTypeLabel} Terverifikasi)`,
          projectUrl: supabaseUrl
        });
      } else if (restRes.status === 401 || restRes.status === 403) {
        return res.status(200).json({
          success: false,
          status: false,
          message: '❌ Kunci API Supabase Tidak Valid (401 Unauthorized). Pastikan URL dan Key sesuai dengan Project Settings di dashboard Supabase.'
        });
      } else {
        // Test query on table or root
        const errText = await restRes.text().catch(() => '');
        if (restRes.status === 404 || errText.includes('42P01') || errText.includes('does not exist')) {
          return res.status(200).json({
            success: true,
            status: true,
            message: `✅ Berhasil Terhubung ke Supabase Cloud Database! (${keyTypeLabel} Aktif)`,
            projectUrl: supabaseUrl
          });
        }
        return res.status(200).json({
          success: false,
          status: false,
          message: `Supabase mengembalikan status HTTP ${restRes.status}: ${errText}`
        });
      }
    } catch (fetchErr: any) {
      return res.status(200).json({
        success: false,
        status: false,
        message: `Koneksi ke Supabase gagal: ${fetchErr?.message || 'Timeout / Network Error'}`
      });
    }
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      status: false,
      message: `Error pengujian Supabase: ${err?.message || 'Unknown error'}`
    });
  }
}
