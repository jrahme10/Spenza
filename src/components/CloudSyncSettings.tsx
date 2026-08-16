import { useEffect, useState } from 'react'
import { Cloud, CloudOff, Eye, EyeOff, RefreshCw, Trash2 } from 'lucide-react'
import { SpenzaData } from '../lib/db'
import { clearSignedInUsersCloudData } from '../lib/cloudData'
import { getSupabaseClient, isSupabaseConfigured, resetSupabasePassword, signInWithEmailPassword, signOutSupabase, signUpWithEmailPassword } from '../lib/supabaseClient'
import { hasFinancialData, localRepository } from '../lib/repository'
import { GlobalSyncState, syncManager } from '../lib/syncManager'

type Props={data:SpenzaData;setData:React.Dispatch<React.SetStateAction<SpenzaData>>}
type Status='checking'|'signed-out'|'signed-in'|'authing'|'error'
type AuthMode='signin'|'signup'

const withTimeout=<T,>(promise:Promise<T>,ms=7000)=>Promise.race<T>([promise,new Promise<T>((_,reject)=>setTimeout(()=>reject(new Error('Cloud account check timed out. Check your connection and try again.')),ms))])
const alignFiltersToRestoredHistory=(restored:SpenzaData)=>{const latest=restored.transactions.reduce((value,t)=>!value||t.date>value?t.date:value,'');if(!latest)return;localStorage.setItem('spenza-home-date',latest);localStorage.setItem('spenza-activity-date',latest);localStorage.setItem('spenza-insight-date',latest)}

export default function CloudSyncSettings({data,setData}:Props){
  const configured=isSupabaseConfigured()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [authMode,setAuthMode]=useState<AuthMode>('signin')
  const [signedInEmail,setSignedInEmail]=useState('')
  const [needsDataChoice,setNeedsDataChoice]=useState(false)
  const [status,setStatus]=useState<Status>(configured?'checking':'signed-out')
  const [message,setMessage]=useState(configured?'Checking cloud account…':'Cloud sync is not configured.')
  const [syncState,setSyncState]=useState<GlobalSyncState>(syncManager.getState())

  const syncing=syncState.status==='syncing'
  const syncError=syncState.status==='error'?syncState.error:undefined
  const progress=syncState.progress

  const refreshSession=async()=>{
    const supabase=getSupabaseClient()
    if(!supabase){setStatus('signed-out');setSignedInEmail('');setMessage('Cloud sync is not configured.');return}
    try{
      const {data:sessionData,error}=await withTimeout(supabase.auth.getSession())
      if(error)throw error
      const user=sessionData.session?.user
      if(user){setSignedInEmail(user.email||'Signed in');setStatus('signed-in');setMessage(m=>m==='Checking cloud account…'?'Cloud account connected.':m)}
      else{setSignedInEmail('');setNeedsDataChoice(false);setStatus('signed-out');setMessage('Sign in to keep your Spenza data available across devices.')}
    }catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
  }

  useEffect(()=>{
    if(!configured)return
    void refreshSession()
    const unsubscribeSync=syncManager.subscribe(setSyncState)
    const supabase=getSupabaseClient()
    if(!supabase)return unsubscribeSync
    const {data:listener}=supabase.auth.onAuthStateChange(()=>{void refreshSession()})
    return()=>{unsubscribeSync();listener.subscription.unsubscribe()}
  },[configured])

  const runSync=async(successMessage='Everything is up to date.')=>{
    const result=await syncManager.run()
    if(result.status==='synced'){
      if(result.data)setData(result.data)
      setNeedsDataChoice(false)
      setStatus('signed-in')
      if(result.restored&&result.data){
        alignFiltersToRestoredHistory(result.data)
        setMessage(`Restored ${result.restored.wallets} account${result.restored.wallets===1?'':'s'} and ${result.restored.transactions} transaction${result.restored.transactions===1?'':'s'} from cloud.`)
        window.setTimeout(()=>window.location.reload(),250)
      }else setMessage(successMessage)
      return true
    }
    if(result.status==='signed-out'){setSignedInEmail('');setNeedsDataChoice(false);setStatus('signed-out');setMessage('Your session expired. Sign in again.');return false}
    if(result.status==='disabled'){setStatus('error');setMessage('Cloud sync is not configured.');return false}
    setStatus('error');setMessage(result.error||'Cloud sync failed.');return false
  }

  const finishAuthentication=async()=>{
    const local=await localRepository.getSnapshot()
    await refreshSession()
    if(hasFinancialData(local)){setNeedsDataChoice(true);setMessage('This device already has local financial data. Choose how you want to continue.');return}
    setMessage('Restoring your cloud data…')
    await runSync('Cloud data restored to this device.')
  }

  const signIn=async()=>{const value=email.trim().toLowerCase();if(!value||!password)return;try{setStatus('authing');setMessage('Signing in…');await signInWithEmailPassword(value,password);setPassword('');await finishAuthentication()}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const createAccount=async()=>{const value=email.trim().toLowerCase();if(!value||!password)return;if(password.length<6){setStatus('error');setMessage('Use at least 6 characters for your password.');return}try{setStatus('authing');setMessage('Creating your account…');const result=await signUpWithEmailPassword(value,password);setPassword('');if(result.session)await finishAuthentication();else{setStatus('signed-out');setMessage('Account created, but email confirmation is still enabled in Supabase. Turn off Confirm email to allow instant account creation.')}}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const forgotPassword=async()=>{const value=email.trim().toLowerCase();if(!value){setStatus('error');setMessage('Enter your email address first.');return}try{setStatus('authing');setMessage('Sending password reset…');await resetSupabasePassword(value);setStatus('signed-out');setMessage('Password reset sent. Check your email to choose a new password.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const useCloudData=async()=>{try{setMessage('Clearing local financial data safely…');const cleared=await localRepository.clearFinancialDataForAccountSwitch();setData(cleared);setMessage('Restoring your cloud data…');await runSync('Cloud data restored to this device.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const mergeLocalAndCloud=async()=>{await runSync('Local and cloud data are synced.')}
  const cancelDataChoice=async()=>{try{await signOutSupabase();setSignedInEmail('');setNeedsDataChoice(false);setStatus('signed-out');setMessage('Sign-in cancelled. Your local data was not changed.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const syncNow=async()=>{await runSync()}
  const signOut=async()=>{try{setMessage('Signing out…');await signOutSupabase();const cleared=await localRepository.clearFinancialDataForAccountSwitch();setData(cleared);setSignedInEmail('');setNeedsDataChoice(false);setPassword('');setStatus('signed-out');setMessage('Signed out. Financial data was removed from this device; your cloud copy is unchanged.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const clearCloud=async()=>{if(!window.confirm('Delete all Spenza data stored in your cloud account? Your local data on this device will be kept. You will be signed out so it is not uploaded again automatically.'))return;try{setMessage('Clearing cloud data…');await clearSignedInUsersCloudData();setSignedInEmail('');setNeedsDataChoice(false);setStatus('signed-out');setMessage('Cloud data cleared. Your local data is still on this device.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}

  const lastSync=data.sync.lastSyncAt?new Date(data.sync.lastSyncAt).toLocaleString():'Not synced yet'
  const pending=data.sync.pendingChanges.length
  const authBusy=status==='authing'
  const canSubmit=!!email.trim()&&password.length>0&&!authBusy

  if(!configured)return <section className="settingsList cloudSyncSettings"><div className="settingsRow"><div><span>Cloud Sync</span><small>Cloud backup is unavailable in this build.</small></div><CloudOff size={20}/></div></section>

  return <section className="settingsList cloudSyncSettings">
    <div className="settingsRow cloudSyncHeader"><div><span>Cloud Sync</span><small>{signedInEmail||'Secure backup across your devices'}</small></div>{signedInEmail?<Cloud size={20}/>:<CloudOff size={20}/>}</div>
    {signedInEmail?needsDataChoice?<div className="cloudDataChoice"><h3>Local data found</h3><p>This device already contains financial data. Choose whether to replace it with your cloud account or merge both copies.</p><div className="cloudDataChoiceActions"><button className="primary" onClick={useCloudData} disabled={syncing}>Use cloud data</button><button className="secondary" onClick={mergeLocalAndCloud} disabled={syncing}>Merge local + cloud</button><button className="cancel" onClick={cancelDataChoice} disabled={syncing}>Cancel</button></div></div>:<>
      <div className="cloudSyncStats"><div><span>Changes waiting</span><b>{progress?.remaining??pending}</b></div><div><span>Last backup</span><b>{lastSync}</b></div></div>
      <div className={`cloudProgressPanel ${syncError?'error':''}`}><div className="cloudProgressTop"><b>{syncing?'Syncing in background':syncError?'Sync error':'Cloud status'}</b><span>{progress?.phase||syncState.status}</span></div><p>{syncError||progress?.message||(pending?`${pending} change${pending===1?'':'s'} waiting to sync.`:'Everything is up to date.')}</p>{typeof progress?.total==='number'&&progress.total>0&&<div className="cloudProgressTrack"><i style={{width:`${Math.min(100,((progress.processed||0)/progress.total)*100)}%`}}/></div>}</div>
      <div className="cloudSyncActions"><button className="primary" onClick={syncNow} disabled={syncing}><RefreshCw className={syncing?'spin':''} size={16}/>{syncing?'Syncing…':'Sync now'}</button><button className="cloudSignOut" onClick={signOut} disabled={syncing}>Sign out</button></div>
      <button className="settingsDanger cloudClearButton" onClick={clearCloud} disabled={syncing}><Trash2 size={15}/>Clear cloud data</button>
    </>:<div className="cloudSignIn"><div className="cloudAuthIntro"><b>{authMode==='signin'?'Welcome back':'Create your Spenza account'}</b><small>{authMode==='signin'?'Sign in to restore or sync your financial data securely.':'Use an email and password. With email confirmation disabled in Supabase, your account is ready immediately.'}</small></div><div className="cloudAuthTabs"><button className={authMode==='signin'?'active':''} onClick={()=>setAuthMode('signin')}>Sign in</button><button className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Create account</button></div><label>Email<input type="email" inputMode="email" autoCapitalize="none" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<div className="cloudInputWrap"><input type={showPassword?'text':'password'} autoComplete={authMode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={authMode==='signup'?'At least 6 characters':'Your password'}/><button type="button" className="cloudPasswordToggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label><button className="primary cloudAuthPrimary" onClick={authMode==='signin'?signIn:createAccount} disabled={!canSubmit}>{authBusy?'Please wait…':authMode==='signin'?'Sign in':'Create account'}</button>{authMode==='signin'?<button className="cloudForgotPassword" onClick={forgotPassword} disabled={authBusy||!email.trim()}>Forgot password?</button>:<div className="cloudAuthHint">Your password stays with Supabase authentication. Spenza never stores it in your expense data.</div>}</div>}
    <div className={`cloudSyncMessage ${status==='error'?'error':''}`}>{message}</div>
  </section>
}
