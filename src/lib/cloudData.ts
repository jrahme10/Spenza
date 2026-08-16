import { getSupabaseClient, getSupabaseUserId, signOutSupabase } from './supabaseClient'

export async function clearSignedInUsersCloudData(){
  const supabase=getSupabaseClient()
  if(!supabase)throw new Error('Cloud sync is not configured.')
  const userId=await getSupabaseUserId()
  if(!userId)throw new Error('Sign in before clearing cloud data.')

  // Delete children first, then wallets. RLS + owner_id keeps this scoped to the
  // currently authenticated user only.
  for(const table of ['spenza_transactions','spenza_bills','spenza_tombstones','spenza_wallets'] as const){
    const {error}=await supabase.from(table).delete().eq('owner_id',userId)
    if(error)throw new Error(`Could not clear ${table.replace('spenza_','')}: ${error.message}`)
  }

  // Stay safe from an automatic bootstrap immediately re-uploading the local copy.
  // Local IndexedDB is intentionally preserved; the user can sign back in later and
  // explicitly choose whether to merge/re-upload it.
  await signOutSupabase()
}
