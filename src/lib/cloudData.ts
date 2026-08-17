import { getSupabaseClient, getSupabaseUserId } from './supabaseClient'

export async function clearSignedInUsersCloudData(){
  const supabase=getSupabaseClient()
  if(!supabase)throw new Error('Cloud sync is not configured.')
  const userId=await getSupabaseUserId()
  if(!userId)throw new Error('Sign in before clearing cloud data.')

  // Delete children first, then wallets. RLS + owner_id keeps this scoped to the
  // currently authenticated user only. The authenticated session is intentionally
  // preserved; clearing cloud data must never sign the user out.
  for(const table of ['spenza_transactions','spenza_bills','spenza_tombstones','spenza_wallets'] as const){
    const {error}=await supabase.from(table).delete().eq('owner_id',userId)
    if(error)throw new Error(`Could not clear ${table.replace('spenza_','')}: ${error.message}`)
  }
}
