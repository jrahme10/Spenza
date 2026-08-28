import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AppState,Platform } from 'react-native'
import { createClient } from '@supabase/supabase-js'

const fallbackUrl='https://oizquulnfhipiwhdifmd.supabase.co'
const fallbackPublishableKey='sb_publishable_lV0bLFw0vSJiK_XviERdrQ_4mRrOZER'

const supabaseUrl=(process.env.EXPO_PUBLIC_SUPABASE_URL||fallbackUrl).trim()
const supabasePublishableKey=(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||fallbackPublishableKey).trim()

export const supabase=createClient(supabaseUrl,supabasePublishableKey,{
 auth:{
  ...(Platform.OS!=='web'?{storage:AsyncStorage}:{}),
  autoRefreshToken:true,
  persistSession:true,
  detectSessionInUrl:false,
 },
})

if(Platform.OS!=='web'){
 AppState.addEventListener('change',state=>{
  if(state==='active')supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
 })
}

export async function getSupabaseUserId(){
 const {data,error}=await supabase.auth.getSession()
 if(error)throw error
 return data.session?.user.id
}

export async function signInWithEmailPassword(email:string,password:string){
 const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password})
 if(error)throw error
 return data
}

export async function signUpWithEmailPassword(email:string,password:string){
 const {data,error}=await supabase.auth.signUp({email:email.trim(),password})
 if(error)throw error
 return data
}

export async function resetSupabasePassword(email:string){
 const {data,error}=await supabase.auth.resetPasswordForEmail(email.trim())
 if(error)throw error
 return data
}

export async function signOutSupabase(){
 const {error}=await supabase.auth.signOut()
 if(error)throw error
}
