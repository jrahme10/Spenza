import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const responseSchema = {
  type: 'OBJECT',
  properties: {
    amount: { type: 'NUMBER', nullable: true },
    amountUSD: { type: 'NUMBER', nullable: true },
    amountLBP: { type: 'NUMBER', nullable: true },
    currency: { type: 'STRING', enum: ['USD', 'LBP'], nullable: true },
    date: { type: 'STRING', nullable: true },
    merchant: { type: 'STRING', nullable: true },
    category: { type: 'STRING' },
    description: { type: 'STRING' },
  },
  required: ['amount', 'currency', 'date', 'merchant', 'category', 'description'],
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Please sign in to scan receipts.' }, 401)

    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!url || !anonKey || !geminiKey) {
      return json({ error: 'Receipt scanning is not configured. Check the Gemini secret in Supabase.' }, 503)
    }

    const supabase = createClient(url, anonKey, {
      global: { headers: { Authorization: 'Bearer ' + token } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) return json({ error: 'Your session expired. Please sign in again.' }, 401)

    const payload = await req.json()
    const imageBase64 = typeof payload?.imageBase64 === 'string' ? payload.imageBase64 : ''
    const mimeType = typeof payload?.mimeType === 'string' ? payload.mimeType : ''
    if (!imageBase64 || imageBase64.length > 11_200_000) {
      return json({ error: 'Choose a receipt image smaller than 8 MB.' }, 400)
    }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(mimeType)) {
      return json({ error: 'This image format is not supported. Use JPEG, PNG, or WebP.' }, 415)
    }

    const categories = Array.isArray(payload?.categories)
      ? payload.categories
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim().slice(0, 60))
          .filter(Boolean)
          .slice(0, 80)
      : ['Food', 'Transport', 'Shopping', 'Bills', 'Other']
    const categoryList = categories.length ? categories : ['Other']
    const preferredCurrency = payload?.preferredCurrency === 'USD' || payload?.preferredCurrency === 'LBP'
      ? payload.preferredCurrency
      : null

    const prompt = [
      'You are a precise receipt data extraction engine for a personal finance app used in Lebanon.',
      'Read the supplied receipt image. It may contain English, Arabic, or a mixture of both.',
      'Extract the final amount the customer actually paid, not subtotal, tax, discount, change, or tendered cash.',
      'If the receipt lists both USD and LBP totals, extract amountUSD and amountLBP separately when each final total is clearly labelled.',
      'Set amount and currency to the preferred wallet currency when that currency total is clearly printed. Preferred wallet currency: ' + (preferredCurrency || 'not specified') + '.',
      'If the preferred currency is not printed, choose the primary final amount clearly marked as the grand total.',
      'Never compare USD and LBP amounts numerically. Currency must be exactly USD or LBP. Recognize LBP, LL, L.L., ل.ل and common Lebanese formatting.',
      'Normalize dates to YYYY-MM-DD. If the date is absent or ambiguous, return null.',
      'Do not guess an amount, currency, merchant, date, or purchased items. Return null for missing amount, currency, date, or merchant. Use null for amountUSD or amountLBP when that currency total is not clearly printed.',
      'Choose the closest category from this exact list: ' + categoryList.join(', ') + '. Do not invent a new category.',
      'Description should be a short plain-language summary of the purchased items when readable; otherwise an empty string.',
      'Return only the JSON object matching the required schema.',
    ].join('\n')

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: imageBase64 } },
            ],
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 500,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      },
    )

    if (geminiResponse.status === 429) {
      return json({ error: 'Gemini is temporarily busy. Please try again in a moment.' }, 429)
    }
    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text()
      console.error('Gemini receipt extraction failed:', geminiResponse.status, detail.slice(0, 400))
      return json({ error: 'Gemini could not read this receipt right now. Please retry.' }, 502)
    }

    const result = await geminiResponse.json()
    const output = result?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('')
    let receipt: Record<string, unknown>
    try {
      receipt = JSON.parse(output || '{}')
    } catch {
      return json({ error: 'The receipt result could not be read. Please try again.' }, 502)
    }

    const amount = Number(receipt.amount)
    const amountUSD = Number(receipt.amountUSD)
    const amountLBP = Number(receipt.amountLBP)
    const safeReceipt = {
      amount: Number.isFinite(amount) && amount > 0 ? amount : null,
      amountUSD: Number.isFinite(amountUSD) && amountUSD > 0 ? amountUSD : null,
      amountLBP: Number.isFinite(amountLBP) && amountLBP > 0 ? amountLBP : null,
      currency: receipt.currency === 'USD' || receipt.currency === 'LBP' ? receipt.currency : null,
      date: typeof receipt.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(receipt.date) ? receipt.date : null,
      merchant: typeof receipt.merchant === 'string' ? receipt.merchant.slice(0, 100) : null,
      category: categoryList.find((item) => item.toLowerCase() === String(receipt.category || '').toLowerCase()) || 'Other',
      description: typeof receipt.description === 'string' ? receipt.description.slice(0, 240) : '',
    }
    return json({ receipt: safeReceipt })
  } catch (error) {
    console.error('Receipt scan request failed:', error)
    return json({ error: 'Something went wrong while scanning this receipt.' }, 500)
  }
})
