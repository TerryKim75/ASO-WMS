import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function getSolapiAuthHeader(apiKey: string, apiSecret: string): Promise<string> {
  const date = new Date().toISOString()
  const salt = crypto.randomUUID().replace(/-/g, '').substring(0, 16)
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(date + salt))
  const signature = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { projectId } = await req.json()
    if (!projectId) throw new Error('projectId is required')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const solapiApiKey = Deno.env.get('SOLAPI_API_KEY')!
    const solapiApiSecret = Deno.env.get('SOLAPI_API_SECRET')!
    const senderPhone = Deno.env.get('SOLAPI_SENDER_PHONE')!
    const kakaoPfId = Deno.env.get('KAKAO_CHANNEL_PF_ID')!
    const appUrl = Deno.env.get('APP_URL')!

    const db = createClient(supabaseUrl, serviceKey)

    const { data: project } = await db
      .from('wms_projects')
      .select('name, exhibition, start_date, end_date, notes')
      .eq('id', projectId)
      .single()

    if (!project) throw new Error('프로젝트를 찾을 수 없습니다.')

    const { data: workers } = await db
      .from('construction_workers')
      .select('name, phone')
      .not('phone', 'is', null)

    const validWorkers = (workers || []).filter((w) => w.phone?.trim())
    if (validWorkers.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: '연락처가 등록된 시공인력이 없습니다.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const bidUrl = `${appUrl}/bid/${projectId}`
    const dateRange = project.start_date
      ? `${project.start_date.replace(/-/g, '.')}${project.end_date ? ` ~ ${project.end_date.replace(/-/g, '.')}` : ''}`
      : '일정 미정'

    const lines = [
      '[아소시스템] 시공 입찰 공고',
      '',
      `프로젝트: ${project.name}`,
      project.exhibition ? `전시: ${project.exhibition}` : null,
      `일정: ${dateRange}`,
      project.notes ? `내용: ${project.notes}` : null,
      '',
      '시공 참여를 원하시면 아래 버튼을 눌러 가격을 제안해 주세요.',
    ].filter(Boolean)
    const messageContent = lines.join('\n')

    const messages = validWorkers.map((w) => ({
      to: w.phone!.replace(/-/g, ''),
      from: senderPhone.replace(/-/g, ''),
      type: 'FT',
      kakaoOptions: {
        pfId: kakaoPfId,
        content: messageContent,
        buttons: [
          {
            buttonType: 'WL',
            buttonName: '입찰 참여하기',
            linkMo: bidUrl,
            linkPc: bidUrl,
          },
        ],
      },
    }))

    const authHeader = await getSolapiAuthHeader(solapiApiKey, solapiApiSecret)

    const res = await fetch('https://api.solapi.com/messages/v4/send-many', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({ messages }),
    })

    const result = await res.json()

    if (!res.ok) {
      throw new Error(result.errorMessage || `Solapi error: ${res.status}`)
    }

    return new Response(
      JSON.stringify({ success: true, sentCount: validWorkers.length, result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
