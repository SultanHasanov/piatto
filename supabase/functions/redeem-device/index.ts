import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  let stage = 'validation'
  let createdUserId: string | null = null
  try {
    const { shopId, token, code, name } = await request.json()
    if (!shopId || (!token && !code) || !String(name || '').trim()) throw new Error('Заполните данные устройства')
    const url = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('PIATTO_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    if (!serviceKey) throw new Error('На сервере не настроен PIATTO_SERVICE_ROLE_KEY')
    const keyKind = serviceKey.startsWith('eyJ') ? 'legacy-jwt' : serviceKey.startsWith('sb_secret_') ? 'secret-key' : 'unknown'
    console.log(`redeem-device admin key kind: ${keyKind}, length: ${serviceKey.length}`)
    stage = 'pairing lookup'
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: pairing, error: pairingError } = await publicClient.rpc('lookup_device_pairing', { p_shop_id: shopId, p_token: token ?? null, p_code: code ? String(code) : null })
    if (pairingError || !pairing) throw new Error(pairingError?.message ?? 'Код не найден')

    stage = 'device user creation'
    const email = `piatto-device-${crypto.randomUUID()}@example.com`
    // Keep below bcrypt's 72-byte limit used by GoTrue/Supabase Auth.
    const password = `${crypto.randomUUID()}!Aa7`
    const adminHeaders: Record<string,string> = { apikey: serviceKey, 'Content-Type': 'application/json' }
    if (serviceKey.startsWith('eyJ')) adminHeaders.Authorization = `Bearer ${serviceKey}`
    const createResponse = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST', headers: adminHeaders,
      body: JSON.stringify({ email, password, email_confirm: true }),
    })
    const createText = await createResponse.text()
    if (!createResponse.ok) throw new Error(`Supabase Auth ${createResponse.status} (${keyKind}): ${createText || createResponse.statusText}`)
    const created = JSON.parse(createText) as { id?:string; user?:{id?:string} }
    const userId = created.id ?? created.user?.id
    if (!userId) throw new Error('Supabase Auth не вернул идентификатор устройства')
    createdUserId = userId
    stage = 'device registration'
    const { data: deviceId, error: deviceError } = await publicClient.rpc('register_paired_device', { p_pairing_id: pairing.id, p_user_id: userId, p_name: String(name).trim(), p_token: token ?? null, p_code: code ? String(code) : null })
    if (deviceError) throw deviceError

    stage = 'device sign in'
    const { data: signed, error: signError } = await publicClient.auth.signInWithPassword({ email, password })
    if (signError || !signed.session) throw signError ?? new Error('Не удалось открыть сессию')
    return new Response(JSON.stringify({ session: signed.session, deviceId }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка сопряжения'
    console.error(`redeem-device failed at ${stage}: ${message}`)
    if (createdUserId) {
      const cleanupKey = Deno.env.get('PIATTO_SERVICE_ROLE_KEY')
      if (cleanupKey) {
        const headers:Record<string,string>={apikey:cleanupKey}
        if(cleanupKey.startsWith('eyJ'))headers.Authorization=`Bearer ${cleanupKey}`
        await fetch(`${Deno.env.get('SUPABASE_URL')!}/auth/v1/admin/users/${createdUserId}`,{method:'DELETE',headers}).catch(()=>undefined)
      }
    }
    return new Response(JSON.stringify({ error: message, stage }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
