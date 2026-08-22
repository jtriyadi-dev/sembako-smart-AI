import { createClient } from '@supabase/supabase-js';

function getSupabaseKeyType(key: string): 'publishable' | 'legacy_anon' {
  const clean = key.trim().replace(/^bearer\s+/i, '');
  if (clean.startsWith('sb_publishable_') || clean.startsWith('sbp_') || clean.startsWith('pk_')) {
    return 'publishable';
  }
  if (clean.startsWith('eyJ')) {
    return 'legacy_anon';
  }
  return 'publishable';
}

function decodeSupabaseJwtIfPossible(jwt: string): { ref?: string; role?: string; exp?: number; isExpired?: boolean } | null {
  try {
    const clean = jwt.trim().replace(/^bearer\s+/i, '');
    const parts = clean.split('.');
    if (parts.length !== 3) {
      return null;
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
  } catch (_) {
    return null;
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
      body.supabaseKey ||
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
      anonKeyLength: anonKey.length,
      anonKeyType: anonKey ? getSupabaseKeyType(anonKey) : undefined,
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
        message: 'Kunci API Supabase (Publishable Key / Anon Key) tidak boleh kosong.'
      });
    }

    // 4. Validasi Format Project URL & Extract Project Ref
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

    const detectedKeyType = getSupabaseKeyType(anonKey || serviceRoleKey);
    let clientTestResult: { success: boolean; status: number; role?: string; message: string; tableReady?: boolean } | null = null;
    let serverTestResult: { success: boolean; status: number; role?: string; message: string } | null = null;

    // 5. TEST 1: SUPABASE CLIENT WEB (Publishable Key / Legacy Anon Key)
    if (anonKey) {
      // Optional JWT verification (only if token is legacy JWT format)
      const anonJwt = decodeSupabaseJwtIfPossible(anonKey);
      if (anonJwt) {
        if (anonJwt.ref && anonJwt.ref !== urlProjectRef) {
          return res.status(200).json({
            success: false,
            keyType: detectedKeyType,
            status: 401,
            source: 'SUPABASE',
            message: `❌ Project Mismatch pada Anon Key! Key berasal dari project "${anonJwt.ref}", sedangkan Project URL adalah "${urlProjectRef}". Harap salin public key dari project yang sama di Supabase Dashboard.`
          });
        }

        if (anonJwt.isExpired) {
          return res.status(200).json({
            success: false,
            keyType: detectedKeyType,
            status: 401,
            source: 'SUPABASE',
            message: '❌ Anon Key Supabase sudah kadaluarsa (expired).'
          });
        }
      }

      // Test Live Connection ke Supabase REST Endpoint
      try {
        // 1. Test table query (products / remote_config)
        const tableRes = await fetch(`${supabaseUrl}/rest/v1/products?select=id&limit=1`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(8000)
        });

        const tableStatus = tableRes.status;
        const tableBody = await tableRes.text().catch(() => '');

        console.log('[SUPABASE REST TEST]', {
          status: tableStatus,
          statusText: tableRes.statusText,
          keyType: detectedKeyType,
          bodySnippet: tableBody.substring(0, 300)
        });

        const isTableOk = tableStatus >= 200 && tableStatus < 300;
        const isTableMissing = tableStatus === 404 || 
          tableBody.includes('42P01') || 
          tableBody.includes('PGRST204') || 
          tableBody.includes('PGRST200') ||
          tableBody.toLowerCase().includes('relation') ||
          tableBody.toLowerCase().includes('does not exist') ||
          tableBody.toLowerCase().includes('schema');

        if (isTableOk || isTableMissing) {
          clientTestResult = {
            success: true,
            status: 200,
            role: anonJwt?.role || 'anon',
            tableReady: isTableOk,
            message: isTableOk
              ? 'Terhubung & Tabel database aktif'
              : 'Terhubung ke Supabase (Tabel database belum dibuat, klik "Skrip SQL Schema Supabase" di bawah)'
          };
        } else if (tableStatus === 401 || tableStatus === 403) {
          // Check with Auth settings endpoint
          const authRes = await fetch(`${supabaseUrl}/auth/v1/settings`, {
            headers: {
              'apikey': anonKey,
              'Authorization': `Bearer ${anonKey}`
            },
            signal: AbortSignal.timeout(6000)
          }).catch(() => null);

          if (authRes && (authRes.ok || authRes.status === 200)) {
            clientTestResult = {
              success: true,
              status: 200,
              role: anonJwt?.role || 'anon',
              tableReady: false,
              message: 'Terhubung ke Supabase Auth & Project (Tabel database belum dibuat, jalankan skrip SQL migration)'
            };
          } else {
            let errMsg = '401 Unauthorized';
            try {
              const parsed = JSON.parse(tableBody);
              errMsg = parsed.message || parsed.msg || parsed.error || tableBody;
            } catch (_) {
              errMsg = tableBody || tableRes.statusText;
            }
            return res.status(200).json({
              success: false,
              keyType: detectedKeyType,
              status: tableStatus,
              source: 'SUPABASE',
              message: `❌ Supabase mengembalikan HTTP ${tableStatus}: ${errMsg}`
            });
          }
        } else {
          clientTestResult = {
            success: true,
            status: 200,
            role: anonJwt?.role || 'anon',
            tableReady: false,
            message: 'Terhubung ke Supabase Cloud'
          };
        }
      } catch (clientErr: any) {
        console.error('[SUPABASE CLIENT TEST ERROR]', clientErr);
        return res.status(200).json({
          success: false,
          keyType: detectedKeyType,
          status: 500,
          source: 'INTERNAL_API',
          message: `Gagal menghubungi Supabase: ${clientErr?.message || 'Network Timeout'}`
        });
      }
    }

    // 6. TEST 2: SUPABASE SERVER (Service Role Key)
    const effectiveServiceKey = hasRawServiceKey ? serviceRoleKey : (process.env.SUPABASE_SERVICE_ROLE_KEY || '');
    if (effectiveServiceKey && !effectiveServiceKey.includes('•')) {
      const srvJwt = decodeSupabaseJwtIfPossible(effectiveServiceKey);
      if (srvJwt && srvJwt.ref && srvJwt.ref !== urlProjectRef) {
        return res.status(200).json({
          success: false,
          keyType: detectedKeyType,
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
            role: srvJwt?.role || 'service_role',
            message: 'Service Role Key terverifikasi & server bypass RLS aktif'
          };
        } else {
          serverTestResult = {
            success: false,
            status: 400,
            role: srvJwt?.role || 'service_role',
            message: srvErr.message
          };
        }
      } catch (srvErr: any) {
        console.error('[SUPABASE SERVER TEST ERROR]', srvErr);
      }
    }

    // 7. Format Final Output
    const isSuccess = Boolean(clientTestResult?.success || serverTestResult?.success);
    const keyTypeLabel = detectedKeyType === 'publishable' ? 'Publishable Key (sb_publishable)' : 'Legacy Anon Key (JWT)';
    const tableNotice = clientTestResult?.tableReady === false
      ? ' (Tabel database belum dibuat, klik "Skrip SQL Schema Supabase" di bawah)'
      : ' (Database & REST API Siap Digunakan)';

    if (isSuccess) {
      return res.status(200).json({
        success: true,
        keyType: detectedKeyType,
        status: 200,
        source: 'SUPABASE',
        projectUrl: supabaseUrl,
        projectRef: urlProjectRef,
        message: `✅ Berhasil Terhubung ke Supabase Cloud Database! (Tipe: ${keyTypeLabel} / Project: ${urlProjectRef})${tableNotice}`,
        clientTest: clientTestResult,
        serverTest: serverTestResult
      });
    }

    return res.status(200).json({
      success: false,
      keyType: detectedKeyType,
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

