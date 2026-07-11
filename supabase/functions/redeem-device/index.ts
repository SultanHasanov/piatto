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
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } })
    stage = 'pairing lookup'
    const publicClient = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: pairing, error: pairingError } = await publicClient.rpc('lookup_device_pairing', { p_shop_id: shopId, p_token: token ?? null, p_code: code ? String(code) : null })
    if (pairingError || !pairing) throw new Error(pairingError?.message ?? 'Код не найден')

    stage = 'device user creation'
    const email = `device-${crypto.randomUUID()}@devices.piatto.app`
    const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } })
    if (createError || !created.user) throw createError ?? new Error('Не удалось создать устройство')
    const userId = created.user.id
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
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
      await admin.auth.admin.deleteUser(createdUserId).catch(() => undefined)
    }
    return new Response(JSON.stringify({ error: message, stage }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
