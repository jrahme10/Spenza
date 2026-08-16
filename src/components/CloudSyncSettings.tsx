import { useEffect, useState } from 'react'
import { Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { SpenzaData } from '../lib/db'
import { getSupabaseClient, isSupabaseConfigured, resetSupabasePassword, signInWithEmailPassword, signOutSupabase, signUpWithEmailPassword } from '../lib/supabaseClient'
import { syncSupabaseIfAuthenticated } from '../lib/supabaseSync'

type Props={data:SpenzaData;setData:React.Dispatch<React.SetStateAction<SpenzaData>>}

type Status='checking'|'signed-out'|'signed-in'|'authing'|'syncing'|'error'

export default function CloudSyncSettings({data,setData}:Props){
  const configured=isSupabaseConfigured()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [signedInEmail,setSignedInEmail]=useState('')
  const [status,setStatus]=useState<Status>(configured?'checking':'signed-out')
  const [message,setMessage]=useState(configured?'Checking cloud account…':'Cloud sync is not configured.')

  const refreshSession=async()=>{
    const supabase=getSupabaseClient()
    if(!supabase){setStatus('signed-out');setSignedInEmail('');setMessage('Cloud sync is not configured.');return}
    const {data:sessionData,error}=await supabase.auth.getSession()
    if(error){setStatus('error');setMessage(error.message);return}
    const user=sessionData.session?.user
    if(user){setSignedInEmail(user.email||'Signed in');setStatus('signed-in');setMessage('Cloud sync is ready.')}
    else{setSignedInEmail('');setStatus('signed-out');setMessage('Sign in to sync this device.')}
  }

  useEffect(()=>{
    if(!configured)return
    refreshSession()
    const supabase=getSupabaseClient()
    if(!supabase)return
    const {data:listener}=supabase.auth.onAuthStateChange(()=>{refreshSession()})
    return()=>listener.subscription.unsubscribe()
  },[configured])

  const signIn=async()=>{
    const value=email.trim().toLowerCase()
    if(!value||!password)return
    try{
      setStatus('authing');setMessage('Signing in…')
      await signInWithEmailPassword(value,password)
      setPassword('')
      await refreshSession()
      setMessage('Signed in. Cloud sync is ready.')
    }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
  }

  const createAccount=async()=>{
    const value=email.trim().toLowerCase()
    if(!value||!password)return
    if(password.length<6){setStatus('error');setMessage('Password must be at least 6 characters.');return}
    try{
      setStatus('authing');setMessage('Creating account…')
      const result=await signUpWithEmailPassword(value,password)
      setPassword('')
      if(result.session){
        await refreshSession()
        setMessage('Account created and signed in. Cloud sync is ready.')
      }else{
        setStatus('signed-out')
        setMessage('Account created. Check your email once to confirm the account, then sign in with your password.')
      }
    }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
  }

  const forgotPassword=async()=>{
    const value=email.trim().toLowerCase()
    if(!value){setStatus('error');setMessage('Enter your email address first.');return}
    try{
      setStatus('authing');setMessage('Sending password reset email…')
      await resetSupabasePassword(value)
      setStatus('signed-out')
      setMessage('Password reset email sent. Open it to continue in Spenza.')
    }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
  }

  const syncNow=async()=>{
    try{
      setStatus('syncing');setMessage('Syncing local changes…')
      const result=await syncSupabaseIfAuthenticated()
      if(result.status==='synced'){
        if(result.data)setData(result.data)
        setStatus('signed-in')
        setMessage(result.rejected?`Sync completed with ${result.rejected} rejected change${result.rejected===1?'':'s'}.`:'Everything is synced.')
      }else if(result.status==='signed-out'){
        setSignedInEmail('');setStatus('signed-out');setMessage('Your cloud session has expired. Sign in again.')
      }else if(result.status==='disabled'){
        setStatus('error');setMessage('Cloud sync is not configured.')
      }else{
        setStatus('error');setMessage(result.error||'Cloud sync failed.')
      }
    }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
  }

  const signOut=async()=>{
    try{await signOutSupabase();setSignedInEmail('');setPassword('');setStatus('signed-out');setMessage('Signed out. Local data stays on this device.')}
    catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
  }

  const lastSync=data.sync.lastSyncAt?new Date(data.sync.lastSyncAt).toLocaleString():'Never'
  const pending=data.sync.pendingChanges.length
  const authBusy=status==='authing'

  if(!configured)return <section className="settingsList cloudSyncSettings"><div className="settingsRow"><div><span>Cloud Sync</span><small>Supabase is not configured for this build.</small></div><CloudOff size={20}/></div></section>

  return <section className="settingsList cloudSyncSettings">
    <div className="settingsRow cloudSyncHeader"><div><span>Cloud Sync</span><small>{signedInEmail||'Supabase account'}</small></div>{signedInEmail?<Cloud size={20}/>:<CloudOff size={20}/>}</div>
    {signedInEmail?<>
      <div className="cloudSyncStats"><div><span>Pending</span><b>{pending}</b></div><div><span>Last sync</span><b>{lastSync}</b></div></div>
      <div className="cloudSyncActions"><button className="primary" onClick={syncNow} disabled={status==='syncing'}><RefreshCw size={16}/>{status==='syncing'?'Syncing…':'Sync now'}</button><button className="cloudSignOut" onClick={signOut} disabled={status==='syncing'}>Sign out</button></div>
    </>:<div className="cloudSignIn">
      <label>Email<input type="email" inputMode="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label>
      <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" onKeyDown={e=>{if(e.key==='Enter'&&!authBusy)void signIn()}}/></label>
      <div className="cloudSyncActions"><button className="primary" onClick={signIn} disabled={authBusy||!email.trim()||!password}>{authBusy?'Please wait…':'Sign in'}</button><button className="cloudSignOut" onClick={createAccount} disabled={authBusy||!email.trim()||!password}>Create account</button></div>
      <button className="cloudForgotPassword" onClick={forgotPassword} disabled={authBusy||!email.trim()}>Forgot password?</button>
      <small>After account creation, normal sign-ins use only your email and password.</small>
    </div>}
    <div className={`cloudSyncMessage ${status==='error'?'error':''}`}>{message}</div>
  </section>
}
