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

    const geminiApiKey = (body.geminiApiKey || body.apiKey || process.env.GEMINI_API_KEY || '').trim();

    if (!geminiApiKey) {
      return res.status(200).json({
        success: false,
        status: false,
        message: 'Kunci API Gemini tidak boleh kosong.'
      });
    }

    try {
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;
      const aiRes = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Balas hanya dengan satu kata: OK' }] }]
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (aiRes.ok) {
        return res.status(200).json({
          success: true,
          status: true,
          message: '✅ Kunci API Google Gemini Valid & Model AI Siap Digunakan!'
        });
      } else {
        const errJson = await aiRes.json().catch(() => ({}));
        const errMsg = errJson.error?.message || `HTTP ${aiRes.status}`;
        return res.status(200).json({
          success: false,
          status: false,
          message: `❌ Kunci API Gemini Ditolak Google: ${errMsg}`
        });
      }
    } catch (fetchErr: any) {
      return res.status(200).json({
        success: false,
        status: false,
        message: `Koneksi ke Gemini AI gagal: ${fetchErr?.message || 'Timeout'}`
      });
    }
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      status: false,
      message: `Error pengujian Gemini: ${err?.message || 'Unknown error'}`
    });
  }
}
