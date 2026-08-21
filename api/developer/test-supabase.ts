import { createClient } from '@supabase/supabase-js';

function decodeSupabaseJwt(jwt: string): { ref?: string; role?: string; exp?: number; isExpired?: boolean; error?: string } {
  try {
    const clean = jwt.trim().replace(/^bearer\s+/i, '');
    const parts = clean.split('.');
    if (parts.length !== 3) {
      return { error: 'Format token bukan JWT 3-bagian (header.payload.signature).' };
    }
    const payloadStr = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const payload = JSON.parse(payloadStr);
    const now = Math.floor(Date.now() / 1000);
    return {
      ref: payload.ref,
      role: payload.role,
      exp: payload.exp,
      isExpired: payload.exp ? payload.exp < now : false
    };
  } catch (e: any) {
    return { error: `Gagal decode JWT payload: ${e.message}` };
  }
}

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

    // 1. Audit sumber nilai URL (Payload Control Panel -> Env Server)
    let supabaseUrl = (
      body.supabaseUrl ||
      body.url ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ''
    ).trim();

    if ((supabaseUrl.startsWith('"') && supabaseUrl.endsWith('"')) || (supabaseUrl.startsWith("'") && supabaseUrl.endsWith("'"))) {
      supabaseUrl = supabaseUrl.slice(1, -1).trim();
    }
    supabaseUrl = supabaseUrl.replace(/\/+$/, '');

    // 2. Audit sumber nilai Anon / Publishable Key (Client Web)
    let anonKey = (
      body.supabaseAnonKey ||
      body.publishableKey ||
      body.apiKey ||
      body.key ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      ''
    ).trim();

    if ((anonKey.startsWith('"') && anonKey.endsWith('"')) || (anonKey.startsWith("'") && anonKey.endsWith("'"))) {
      anonKey = anonKey.slice(1, -1).trim();
    }
    anonKey = anonKey.replace(/^bearer\s+/i, '');

    // 3. Audit sumber nilai Service Role Key (Server Backend)
    let serviceRoleKey = (
      body.supabaseServiceRoleKey ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
    ).trim();

    if ((serviceRoleKey.startsWith('"') && serviceRoleKey.endsWith('"')) || (serviceRoleKey.startsWith("'") && serviceRoleKey.endsWith("'"))) {
      serviceRoleKey = serviceRoleKey.slice(1, -1).trim();
    }
    serviceRoleKey = serviceRoleKey.replace(/^bearer\s+/i, '');
    const hasRawServiceKey = serviceRoleKey.length > 0 && !serviceRoleKey.includes('•');

    console.log('[SUPABASE TEST CONFIG]', {
      urlConfigured: !!supabaseUrl,
      anonKeyConfigured: !!anonKey,
      serviceRoleConfigured: hasRawServiceKey || !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });

    if (!supabaseUrl) {
      return res.status(200).json({
        success: false,
        status: 400,
        source: 'INTERNAL_API',
        message: 'URL Supabase tidak boleh kosong. Harap isi URL di Control Panel atau set environment variable SUPABASE_URL.'
      });
    }

    if (!anonKey && !hasRawServiceKey) {
      return res.status(200).json({
        success: false,
        status: 400,
        source: 'INTERNAL_API',
        message: 'Kunci API Supabase (Anon Key / Publishable Key) tidak boleh kosong.'
      });
    }

    // 4. Cek Format Project URL & Extract Project Ref
    const urlMatch = supabaseUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i);
    const urlProjectRef = urlMatch ? urlMatch[1] : '';

    if (!urlProjectRef) {
      return res.status(200).json({
        success: false,
        status: 400,
        source: 'INTERNAL_API',
        message: `Format URL Supabase tidak valid (${supabaseUrl}). Format yang benar: https://<project-ref>.supabase.co`
      });
    }

    let clientTestResult: { success: boolean; status: number; role?: string; message: string; tableReady?: boolean } | null = null;
    let serverTestResult: { success: boolean; status: number; role?: string; message: string } | null = null;

    // 5. TEST 1: SUPABASE CLIENT WEB (Anon / Publishable Key)
    if (anonKey) {
      const anonJwt = decodeSupabaseJwt(anonKey);
      if (anonJwt.error) {
        return res.status(200).json({
          success: false,
          status: 401,
          source: 'SUPABASE',
          message: `❌ Anon Key Supabase tidak valid: ${anonJwt.error}`
        });
      }

      // Validasi Project Match
      if (anonJwt.ref && anonJwt.ref !== urlProjectRef) {
        return res.status(200).json({
          success: false,
          status: 401,
          source: 'SUPABASE',
          message: `❌ Project Mismatch pada Anon Key! Key berasal dari project "${anonJwt.ref}", sedangkan Project URL adalah "${urlProjectRef}". Harap salin anon public key dari project yang sama di Supabase Dashboard.`
        });
      }

      if (anonJwt.isExpired) {
        return res.status(200).json({
          success: false,
          status: 401,
          source: 'SUPABASE',
          message: '❌ Anon Key Supabase sudah kadaluarsa (expired).'
        });
      }

      // Test Query menggunakan Supabase Client resmi
      try {
        const client = createClient(supabaseUrl, anonKey, {
          auth: { persistSession: false }
        });

        // Test REST ping langsung dengan header resmi
        const restRes = await fetch(`${supabaseUrl}/rest/v1/`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(7000)
        });

        const restStatus = restRes.status;
        const restBody = await restRes.text().catch(() => '');

        console.log('[SUPABASE ANON REST TEST]', {
          status: restStatus,
          statusText: restRes.statusText,
          body: restBody.substring(0, 300)
        });

        if (restStatus === 401 || restStatus === 403) {
          let errMsg = '401 Unauthorized';
          try {
            const parsed = JSON.parse(restBody);
            errMsg = parsed.message || parsed.msg || parsed.error || restBody;
          } catch (_) {
            errMsg = restBody || restRes.statusText;
          }
          return res.status(200).json({
            success: false,
            status: restStatus,
            source: 'SUPABASE',
            message: `❌ Supabase mengembalikan HTTP ${restStatus}: ${errMsg}`
          });
        }

        // Lakukan query ringan ke tabel products
        const { data: prodData, error: prodErr } = await client
          .from('products')
          .select('id')
          .limit(1);

        const isMissingTable = prodErr?.code === '42P01' || prodErr?.code === 'PGRST204' || prodErr?.message?.includes('does not exist');

        if (prodErr && !isMissingTable) {
          clientTestResult = {
            success: false,
            status: 400,
            role: anonJwt.role || 'anon',
            message: `Query gagal: ${prodErr.message}`
          };
        } else {
          clientTestResult = {
            success: true,
            status: 200,
            role: anonJwt.role || 'anon',
            tableReady: !isMissingTable,
            message: isMissingTable
              ? 'Terhubung (Tabel database belum dibuat, jalankan SQL migration)'
              : 'Terhubung & Tabel aktif'
          };
        }
      } catch (clientErr: any) {
        console.error('[SUPABASE CLIENT TEST ERROR]', clientErr);
        return res.status(200).json({
          success: false,
          status: 500,
          source: 'INTERNAL_API',
          message: `Gagal menghubungi Supabase: ${clientErr?.message || 'Network Timeout'}`
        });
      }
    }

    // 6. TEST 2: SUPABASE SERVER (Service Role Key)
    const effectiveServiceKey = hasRawServiceKey ? serviceRoleKey : (process.env.SUPABASE_SERVICE_ROLE_KEY || '');
    if (effectiveServiceKey && !effectiveServiceKey.includes('•')) {
      const srvJwt = decodeSupabaseJwt(effectiveServiceKey);
      if (!srvJwt.error) {
        if (srvJwt.ref && srvJwt.ref !== urlProjectRef) {
          return res.status(200).json({
            success: false,
            status: 401,
            source: 'SUPABASE',
            message: `❌ Project Mismatch pada Service Role Key! Key berasal dari project "${srvJwt.ref}", sedangkan Project URL adalah "${urlProjectRef}".`
          });
        }

        try {
          const srvClient = createClient(supabaseUrl, effectiveServiceKey, {
            auth: { persistSession: false }
          });

          const { error: srvErr } = await srvClient.from('remote_config').select('id').limit(1);
          const isMissingTable = srvErr?.code === '42P01' || srvErr?.code === 'PGRST204' || srvErr?.message?.includes('does not exist');

          if (!srvErr || isMissingTable) {
            serverTestResult = {
              success: true,
              status: 200,
              role: srvJwt.role || 'service_role',
              message: 'Service Role Key terverifikasi & server bypass RLS aktif'
            };
          } else {
            serverTestResult = {
              success: false,
              status: 400,
              role: srvJwt.role || 'service_role',
              message: srvErr.message
            };
          }
        } catch (srvErr: any) {
          console.error('[SUPABASE SERVER TEST ERROR]', srvErr);
        }
      }
    }

    // 7. Format Final Output
    const isSuccess = Boolean(clientTestResult?.success || serverTestResult?.success);
    const tableNotice = clientTestResult?.tableReady === false
      ? ' (Tabel database belum dibuat, klik "Skrip SQL Schema Supabase" di bawah)'
      : ' (Database & REST API Siap Digunakan)';

    if (isSuccess) {
      return res.status(200).json({
        success: true,
        status: 200,
        source: 'SUPABASE',
        projectUrl: supabaseUrl,
        projectRef: urlProjectRef,
        message: `✅ Berhasil Terhubung ke Supabase Cloud Database! (Project: ${urlProjectRef})${tableNotice}`,
        clientTest: clientTestResult,
        serverTest: serverTestResult
      });
    }

    return res.status(200).json({
      success: false,
      status: clientTestResult?.status || 401,
      source: 'SUPABASE',
      message: clientTestResult?.message || 'Gagal memverifikasi kredensial Supabase.'
    });

  } catch (err: any) {
    console.error('[SUPABASE TEST INTERNAL ERROR]', err);
    return res.status(200).json({
      success: false,
      status: 500,
      source: 'INTERNAL_API',
      message: `❌ Error internal server: ${err?.message || 'Unknown internal error'}`
    });
  }
}
