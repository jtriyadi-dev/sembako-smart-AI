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
      'https://wwnvddrmwxkomkkbhfep.supabase.co'
    ).trim().replace(/\/+$/, '');

    const supabaseAnonKey = (
      body.supabaseAnonKey ||
      body.apiKey ||
      body.key ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim().replace(/^bearer\s+/i, '');

    if (!supabaseUrl) {
      return res.status(200).json({
        success: false,
        status: false,
        message: 'URL Supabase tidak boleh kosong.'
      });
    }

    // Ping PostgREST endpoint
    try {
      const restRes = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`
        },
        signal: AbortSignal.timeout(5000)
      });

      if (restRes.ok || restRes.status === 200 || restRes.status === 206) {
        return res.status(200).json({
          success: true,
          status: true,
          message: '✅ Berhasil Terhubung ke Supabase Cloud Database! (PostgREST API Aktif)',
          projectUrl: supabaseUrl
        });
      } else if (restRes.status === 401 || restRes.status === 403) {
        return res.status(200).json({
          success: false,
          status: false,
          message: '❌ Kunci API Supabase Tidak Valid (401 Unauthorized).'
        });
      } else {
        // Table might not exist yet but connection authenticated
        const errText = await restRes.text().catch(() => '');
        if (errText.includes('42P01') || errText.includes('does not exist')) {
          return res.status(200).json({
            success: true,
            status: true,
            message: '✅ Berhasil Terhubung ke Supabase Cloud Database! (Tabel belum dibuat)',
            projectUrl: supabaseUrl
          });
        }
        return res.status(200).json({
          success: false,
          status: false,
          message: `Supabase mengembalikan status ${restRes.status}: ${errText}`
        });
      }
    } catch (fetchErr: any) {
      return res.status(200).json({
        success: false,
        status: false,
        message: `Koneksi ke Supabase gagal: ${fetchErr?.message || 'Timeout'}`
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
