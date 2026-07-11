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
    let query = admin.from('device_pairings').select('*').eq('shop_id', shopId).is('redeemed_at', null).gt('expires_at', new Date().toISOString())
    query = token ? query.eq('token', token) : query.eq('short_code', String(code))
    stage = 'pairing lookup'
    const { data: pairing, error: pairingError } = await query.maybeSingle()
    if (pairingError || !pairing) throw new Error('Код недействителен или истёк')

    stage = 'device user creation'
    const email = `device-${crypto.randomUUID()}@devices.piatto.app`
    const password = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } })
    if (createError || !created.user) throw createError ?? new Error('Не удалось создать устройство')
    const userId = created.user.id
    createdUserId = userId
    stage = 'shop membership creation'
    const { error: memberError } = await admin.from('shop_users').insert({ shop_id: shopId, user_id: userId, role: 'cashier' })
    if (memberError) throw memberError
    stage = 'device registration'
    const { data: device, error: deviceError } = await admin.from('devices').insert({ shop_id: shopId, auth_user_id: userId, name: String(name).trim().slice(0, 80) }).select('id').single()
    if (deviceError) throw deviceError
    await admin.from('device_pairings').update({ redeemed_at: new Date().toISOString() }).eq('id', pairing.id)

    stage = 'device sign in'
    const client = createClient(url, anonKey, { auth: { persistSession: false } })
    const { data: signed, error: signError } = await client.auth.signInWithPassword({ email, password })
    if (signError || !signed.session) throw signError ?? new Error('Не удалось открыть сессию')
    return new Response(JSON.stringify({ session: signed.session, deviceId: device.id }), { headers: { ...cors, 'Content-Type': 'application/json' } })
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
