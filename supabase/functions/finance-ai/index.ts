import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const systemInstruction = `
You are Spenza Coach, a focused personal-finance assistant inside the Spenza expense tracker.
ONLY help with the user's money management inside Spenza: expenses, income, transactions, budgets, wallets, categories, saving habits, monthly comparisons and spending forecasts.
Do NOT answer general questions, weather, sports, news, coding, medical, legal, or unrelated topics. If unrelated, politely say you can only help with money management in Spenza.
Never invent balances, transaction history, amounts, categories or dates. Use only supplied financial context.
Do not claim to have added, edited, deleted or transferred a transaction. You cannot change data.
If asked how to add a transaction, explain they can use the + Add Transaction button. If asked to add one in chat, explain chat-based transaction entry is not enabled yet.
Reply in the same language as the user (Lebanese Arabic when they use Lebanese Arabic). Keep answers concise, useful and friendly.
Return ONLY valid JSON with keys allowed (boolean) and answer (string).
`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Please sign in to use Spenza Coach.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const geminiKey = Deno.env.get('GEMINI_API_KEY')
    if (!url || !anonKey || !geminiKey) return json({ error: 'Spenza Coach is not configured yet. Add the Gemini API key to Supabase secrets.' }, 503)
    const supabase = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } })
    const { data: userData, error: authError } = await supabase.auth.getUser(token)
    if (authError || !userData.user) return json({ error: 'Your session expired. Please sign in again.' }, 401)
    const payload = await req.json()
    const question = typeof payload?.question === 'string' ? payload.question.trim() : ''
    if (!question || question.length > 500) return json({ error: 'Enter a question up to 500 characters.' }, 400)
    const { data: quotaAllowed, error: quotaError } = await supabase.rpc('consume_finance_ai_quota')
    if (quotaError) { console.error('Finance AI quota check failed:', quotaError.message); return json({ error: 'Spenza Coach is temporarily unavailable. Please try again later.' }, 503) }
    if (!quotaAllowed) return json({ error: 'Free daily limit reached. Please try again tomorrow.' }, 429)
    const context = payload?.context && typeof payload.context === 'object' ? payload.context : {}
    const safeContext = { currency: context.currency === 'LBP' ? 'LBP' : 'USD', month: typeof context.month === 'string' ? context.month.slice(0, 7) : '', spent: Number(context.spent) || 0, previousMonthSpent: Number(context.previousMonthSpent) || 0, income: Number(context.income) || 0, net: Number(context.net) || 0, dailyAverage: Number(context.dailyAverage) || 0, monthEndEstimate: Number(context.monthEndEstimate) || 0, topCategories: Array.isArray(context.topCategories) ? context.topCategories.slice(0, 5) : [], possibleRecurring: Array.isArray(context.possibleRecurring) ? context.possibleRecurring.slice(0, 4) : [] }
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: systemInstruction }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify({ question, financialContext: safeContext }) }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 350, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { allowed: { type: 'BOOLEAN' }, answer: { type: 'STRING' } }, required: ['allowed', 'answer'] } } }),
    })
    if (response.status === 429) return json({ error: 'Gemini free-tier capacity is temporarily unavailable. Please try again later.' }, 429)
    if (!response.ok) { const detail = await response.text(); console.error('Gemini API error:', response.status, detail.slice(0, 500)); return json({ error: 'The financial assistant could not answer right now. Please try again.' }, 502) }
    const result = await response.json()
    const output = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('')
    let parsed: { allowed?: boolean; answer?: string }
    try { parsed = JSON.parse(output || '{}') } catch { return json({ error: 'Could not read the assistant response. Please try again.' }, 502) }
    if (parsed.allowed !== true) return json({ answer: parsed.answer || 'I can help only with money management inside Spenza.' })
    return json({ answer: typeof parsed.answer === 'string' ? parsed.answer.slice(0, 1600) : 'I could not answer that. Try asking about your spending or budget.' })
  } catch (error) { console.error('Finance AI request failed:', error); return json({ error: 'Something went wrong. Please try again.' }, 500) }
})