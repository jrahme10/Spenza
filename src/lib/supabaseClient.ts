import { createClient, SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null | undefined

function env(name: string) {
  const values = import.meta.env as Record<string, string | undefined>
  return values[name]?.trim()
}

function authRedirectUrl() {
  const configured = env('VITE_SUPABASE_REDIRECT_URL')
  if (configured) return configured
  if (typeof window === 'undefined') return undefined
  return new URL(import.meta.env.BASE_URL || '/', window.location.origin).toString()
}

export function isSupabaseConfigured() {
  return (
    !!env('VITE_SUPABASE_URL') &&
    !!(env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY'))
  )
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) return client
  const url = env('VITE_SUPABASE_URL')
  const key = env('VITE_SUPABASE_PUBLISHABLE_KEY') || env('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    client = null
    return client
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  })
  return client
}

export async function getSupabaseUserId() {
  const supabase = getSupabaseClient()
  if (!supabase) return undefined
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  return data.session?.user.id
}

export async function signInWithEmailPassword(email: string, password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmailPassword(email: string, password: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase is not configured')
  const emailRedirectTo = authRedirectUrl()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  })
  if (error) throw error
  return data
}

export async function resetSupabasePassword(email: string) {
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Supabase is not configured')
  const redirectTo = authRedirectUrl()
  const { data, error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  )
  if (error) throw error
  return data
}

export async function signOutSupabase() {
  const supabase = getSupabaseClient()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
