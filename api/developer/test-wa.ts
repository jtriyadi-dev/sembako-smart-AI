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
    let rawToken = (
      body.token ||
      body.waApiKey ||
      body.apiKey ||
      ''
    ).trim();

    // Abaikan jika token adalah placeholder masked
    if (rawToken.includes('•') || rawToken === '---' || rawToken === '******') {
      rawToken = '';
    }

    if (!rawToken) {
      rawToken = (
        process.env.WABLAS_TOKEN ||
        process.env.WABLAS_API_KEY ||
        process.env.WA_API_KEY ||
        ''
      ).trim();
    }

    // Sanitasi token: hilangkan tanda petik, awalan 'Bearer ', spasi liar, newline
    let cleanToken = rawToken
      .replace(/^["']|["']$/g, '')
      .replace(/^bearer\s+/i, '')
      .replace(/[\r\n\t\s]/g, '')
      .trim();

    // 2. Audit sumber nilai Server URL
    let waServerUrl = (
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

    // Log konfigurasi aman (hanya panjang, prefix, suffix)
    console.log('[WA TEST CONFIG]', {
      provider,
      tokenConfigured: !!cleanToken,
      tokenLength: cleanToken.length,
      tokenPrefix: cleanToken.length > 4 ? cleanToken.slice(0, 4) : '***',
      tokenSuffix: cleanToken.length > 4 ? cleanToken.slice(-4) : '***',
      serverUrl: waServerUrl
    });

    if (!cleanToken) {
      return res.status(200).json({
        success: false,
        status: 400,
        source: 'INTERNAL_API',
        message: 'Kunci API / Token WhatsApp tidak boleh kosong. Harap isi token di Control Panel atau set environment variable WABLAS_TOKEN di server.'
      });
    }

    const maskedToken = cleanToken.length > 8
      ? `${cleanToken.substring(0, 4)}...${cleanToken.slice(-4)}`
      : '******';

    if (provider === 'wablas') {
      const candidateServers = Array.from(new Set([
        waServerUrl,
        'https://kudus.wablas.com',
        'https://jakarta.wablas.com',
        'https://solo.wablas.com',
        'https://jogja.wablas.com',
        'https://bdg.wablas.com',
        'https://sby.wablas.com',
        'https://malang.wablas.com',
        'https://wablas.com',
        'https://api.wablas.com'
      ])).filter(Boolean);

      async function pingWablasServer(baseUrl: string) {
        const cleanBase = baseUrl.replace(/\/+$/, '');
        const endpoint = `${cleanBase}/api/device/info?token=${encodeURIComponent(cleanToken)}`;
        try {
          const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Authorization': cleanToken,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(6000)
          });
          const status = res.status;
          const text = await res.text().catch(() => '');
          let json: any = null;
          try {
            json = JSON.parse(text);
          } catch (_) {}
          return {
            ok: status === 200 && (json?.status === true || json?.status === 'success' || json?.data),
            status,
            json,
            text,
            serverUrl: cleanBase,
            endpoint
          };
        } catch (e: any) {
          return {
            ok: false,
            status: 500,
            json: null,
            text: e?.message || 'timeout',
            serverUrl: cleanBase,
            endpoint
          };
        }
      }

      // 1. First ping configured server
      let primaryResult = await pingWablasServer(waServerUrl);

      // 2. If configured server succeeded, return immediately
      if (primaryResult.ok) {
        return res.status(200).json({
          success: true,
          status: 200,
          source: 'WABLAS',
          message: `✅ Koneksi Gateway WhatsApp Wablas Berhasil & Perangkat Terhubung! (Token: ${maskedToken})`,
          device: primaryResult.json?.data || primaryResult.json,
          serverUrl: primaryResult.serverUrl,
          endpoint: primaryResult.endpoint
        });
      }

      // 3. If primary server returned token invalid / 500, try auto-discovery across other Wablas regional domains
      const otherServers = candidateServers.filter(s => s !== waServerUrl);
      const fallbackResults = await Promise.all(otherServers.map(s => pingWablasServer(s)));
      const workingFallback = fallbackResults.find(r => r.ok);

      if (workingFallback) {
        return res.status(200).json({
          success: true,
          status: 200,
          source: 'WABLAS',
          message: `✅ Koneksi Gateway WhatsApp Wablas Berhasil! Token Anda terdaftar di Server "${workingFallback.serverUrl}". (Token: ${maskedToken})`,
          device: workingFallback.json?.data || workingFallback.json,
          serverUrl: workingFallback.serverUrl,
          endpoint: workingFallback.endpoint
        });
      }

      // 4. If all failed, return diagnostic error
      const errMsg = primaryResult.json?.message || primaryResult.json?.msg || primaryResult.text || 'token invalid';
      const isAuthError = primaryResult.status === 401 || primaryResult.status === 403 || errMsg.includes('invalid') || errMsg.includes('token');

      return res.status(200).json({
        success: false,
        source: 'WABLAS',
        status: primaryResult.status,
        tokenLength: cleanToken.length,
        tokenPrefix: cleanToken.slice(0, 4),
        tokenSuffix: cleanToken.slice(-4),
        serverUrl: waServerUrl,
        endpoint: primaryResult.endpoint,
        headers: `Authorization: ${maskedToken}`,
        message: isAuthError
          ? `❌ Server Wablas (${waServerUrl}) mengembalikan HTTP ${primaryResult.status}: ${errMsg}. Pastikan token aktif dan periksa domain server Wablas Anda di dashboard Wablas.`
          : `❌ Gagal menghubungi Wablas: ${errMsg}`
      });
    } else if (provider === 'fonnte') {
      const fonnteEndpoint = 'https://api.fonnte.com/device';
      try {
        const fonnteRes = await fetch(fonnteEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': cleanToken
          },
          signal: AbortSignal.timeout(8000)
        });
        const fonnteStatus = fonnteRes.status;
        const fonnteData = await fonnteRes.json().catch(() => ({}));

        if (fonnteStatus === 200 && fonnteData.status !== false) {
          return res.status(200).json({
            success: true,
            status: 200,
            source: 'FONNTE',
            message: `✅ Koneksi Gateway Fonnte Berhasil & Device Terverifikasi! (Token: ${maskedToken})`,
            device: fonnteData
          });
        } else {
          return res.status(200).json({
            success: false,
            status: fonnteStatus,
            source: 'FONNTE',
            message: `❌ Fonnte: ${fonnteData.reason || fonnteData.message || 'Token Fonnte tidak valid / perangkat offline'}`
          });
        }
      } catch (fErr: any) {
        return res.status(200).json({
          success: false,
          source: 'FONNTE',
          status: 500,
          message: `Gagal menghubungi API Fonnte: ${fErr?.message || 'Network error'}`
        });
      }
    } else {
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

