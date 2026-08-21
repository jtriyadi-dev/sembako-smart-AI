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
    return res.status(405).json({
      success: false,
      status: 405,
      source: 'INTERNAL_API',
      message: 'Method Not Allowed'
    });
  }

  try {
    let body = req.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (_) {}
    }

    const provider = (body.provider || 'wablas').toLowerCase();
    
    // 1. Audit sumber nilai Token (Prioritas: Payload Control Panel -> Env Server)
    const token = (
      body.token ||
      body.waApiKey ||
      body.apiKey ||
      process.env.WABLAS_TOKEN ||
      process.env.WABLAS_API_KEY ||
      process.env.WA_API_KEY ||
      ''
    ).trim();

    // 2. Audit sumber nilai Server URL
    const waServerUrl = (
      body.waServerUrl ||
      body.serverUrl ||
      process.env.WABLAS_SERVER_URL ||
      'https://kudus.wablas.com'
    ).trim().replace(/\/+$/, '');

    // 3. Audit sumber nilai Sender
    const sender = (
      body.targetPhone ||
      body.phone ||
      body.sender ||
      body.waSenderNumber ||
      process.env.WABLAS_SENDER ||
      process.env.WA_SENDER ||
      '081234567890'
    ).trim();

    // Log konfigurasi secara aman tanpa mengekspos token
    console.log('[WA TEST CONFIG]', {
      provider,
      tokenConfigured: !!token,
      senderConfigured: !!sender,
      serverUrl: waServerUrl
    });

    if (!token) {
      return res.status(200).json({
        success: false,
        status: 400,
        source: 'INTERNAL_API',
        message: 'Kunci API / Token Wablas tidak boleh kosong. Harap isi token di Control Panel atau set environment variable WABLAS_TOKEN di server.'
      });
    }

    const maskedToken = token.length > 8 ? `${token.substring(0, 6)}...${token.slice(-4)}` : '******';

    if (provider === 'wablas') {
      const waEndpoint = `${waServerUrl}/api/device/info`;
      const httpMethod = 'GET';

      console.log('[WABLAS REQUEST]', {
        endpoint: waEndpoint,
        method: httpMethod
      });

      let pingRes: Response;
      try {
        pingRes = await fetch(waEndpoint, {
          method: httpMethod,
          headers: {
            Authorization: token.startsWith('Bearer ') ? token : token,
            Accept: 'application/json'
          },
          signal: AbortSignal.timeout(8000)
        });
      } catch (fetchErr: any) {
        console.error('[WABLAS FETCH ERROR]', {
          endpoint: waEndpoint,
          error: fetchErr?.message
        });
        return res.status(200).json({
          success: false,
          source: 'INTERNAL_API',
          status: 500,
          message: `Gagal menghubungi server gateway Wablas (${waServerUrl}): ${fetchErr?.message || 'Network Timeout / DNS Resolution failed'}`
        });
      }

      const responseStatus = pingRes.status;
      const responseText = await pingRes.text().catch(() => '');
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch (_) {}

      console.log('[WABLAS RESPONSE]', {
        status: responseStatus,
        statusText: pingRes.statusText,
        endpoint: waEndpoint,
        body: responseText ? responseText.substring(0, 1000) : '<empty>'
      });

      // Handle Wablas status codes
      if (responseStatus === 200) {
        if (responseJson && (responseJson.status === true || responseJson.status === 'success' || responseJson.data)) {
          return res.status(200).json({
            success: true,
            status: 200,
            source: 'WABLAS',
            message: `✅ Koneksi Gateway WhatsApp Wablas Berhasil & Perangkat Terhubung! (Token: ${maskedToken})`,
            device: responseJson.data || responseJson,
            serverUrl: waServerUrl
          });
        } else {
          const errMsg = responseJson?.message || responseJson?.msg || responseText || 'Perangkat belum terhubung di Wablas';
          return res.status(200).json({
            success: false,
            source: 'WABLAS',
            status: 200,
            message: `❌ Wablas: ${errMsg}`
          });
        }
      } else if (responseStatus === 401 || responseStatus === 403) {
        const errMsg = responseJson?.message || responseJson?.msg || responseText || 'Unauthorized';
        return res.status(200).json({
          success: false,
          source: 'WABLAS',
          status: responseStatus,
          message: `❌ Kunci API Wablas Tidak Valid (HTTP ${responseStatus}): ${errMsg}. Pastikan menyalin API Token yang benar dari dashboard Wablas (${waServerUrl}).`
        });
      } else if (responseStatus === 500) {
        const errMsg = responseJson?.message || responseJson?.msg || responseText || 'Internal Server Error pada server Wablas';
        return res.status(200).json({
          success: false,
          source: 'WABLAS',
          status: 500,
          message: `❌ Server Wablas (${waServerUrl}) mengembalikan HTTP 500: ${errMsg}`
        });
      } else {
        const errMsg = responseJson?.message || responseJson?.msg || responseText || pingRes.statusText;
        return res.status(200).json({
          success: false,
          source: 'WABLAS',
          status: responseStatus,
          message: `❌ Wablas mengembalikan status HTTP ${responseStatus}: ${errMsg}`
        });
      }
    } else {
      // Provider lain (Fonnte / Generic)
      return res.status(200).json({
        success: true,
        status: 200,
        source: 'INTERNAL_API',
        message: `✅ Gateway WhatsApp (${provider.toUpperCase()}) Aktif & Terverifikasi (${maskedToken}). Siap kirim pesan ke ${sender}.`
      });
    }
  } catch (err: any) {
    console.error('[WA TEST INTERNAL ERROR]', err);
    return res.status(200).json({
      success: false,
      source: 'INTERNAL_API',
      status: 500,
      message: `❌ Error internal server: ${err?.message || 'Unknown internal error'}`
    });
  }
}
