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

    const waApiKey = body.waApiKey || body.apiKey || process.env.WABLAS_API_KEY || '';
    const waServerUrl = (body.waServerUrl || body.serverUrl || 'https://kudus.wablas.com').replace(/\/+$/, '');
    const phone = body.phone || '6285223335816';

    if (!waApiKey) {
      return res.status(200).json({
        success: false,
        status: false,
        message: 'Kunci API Wablas/WhatsApp tidak boleh kosong.'
      });
    }

    // Ping Wablas Device Info API
    try {
      const pingRes = await fetch(`${waServerUrl}/api/device/info`, {
        headers: {
          Authorization: waApiKey.startsWith('Bearer ') ? waApiKey : `${waApiKey}`
        },
        signal: AbortSignal.timeout(6000)
      });

      if (pingRes.ok) {
        const pingData = await pingRes.json().catch(() => ({}));
        return res.status(200).json({
          success: true,
          status: true,
          message: '✅ Koneksi Gateway WhatsApp Wablas Berhasil & Perangkat Terhubung!',
          device: pingData.data || pingData
        });
      } else {
        const status = pingRes.status;
        if (status === 401 || status === 403) {
          return res.status(200).json({
            success: false,
            status: false,
            message: '❌ Kunci API Wablas Tidak Valid (401 Unauthorized).'
          });
        }
        return res.status(200).json({
          success: false,
          status: false,
          message: `Koneksi Wablas menghasilkan status HTTP ${status}.`
        });
      }
    } catch (fetchErr: any) {
      return res.status(200).json({
        success: false,
        status: false,
        message: `Koneksi ke gateway WhatsApp gagal: ${fetchErr?.message || 'Timeout'}`
      });
    }
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      status: false,
      message: `Error pengujian WhatsApp: ${err?.message || 'Unknown error'}`
    });
  }
}
