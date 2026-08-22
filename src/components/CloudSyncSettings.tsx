import { useEffect, useState } from 'react'
import { AlertTriangle, Cloud, CloudDownload, CloudOff, Eye, EyeOff, RefreshCw, Trash2, XCircle } from 'lucide-react'
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
const syncErrorTitle=(state:GlobalSyncState)=>state.errorKind==='network'?'Network error':state.errorKind==='auth'?'Session expired':state.errorKind==='conflict'?'Sync conflict':state.errorKind==='data'?'Data sync error':state.errorKind==='server'?'Cloud service error':'Sync error'
const shortAccountId=(value:string)=>value.length>12?`${value.slice(0,6)}…${value.slice(-4)}`:value

export default function CloudSyncSettings({data,setData}:Props){
  const configured=isSupabaseConfigured()
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [showPassword,setShowPassword]=useState(false)
  const [authMode,setAuthMode]=useState<AuthMode>('signin')
  const [signedInEmail,setSignedInEmail]=useState('')
  const [signedInUserId,setSignedInUserId]=useState('')
  const [needsDataChoice,setNeedsDataChoice]=useState(false)
  const [status,setStatus]=useState<Status>(configured?'checking':'signed-out')
  const [message,setMessage]=useState(configured?'Checking cloud account…':'Cloud sync is not configured.')
  const [syncState,setSyncState]=useState<GlobalSyncState>(syncManager.getState())
  const [clearCloudOpen,setClearCloudOpen]=useState(false)
  const [clearCloudBusy,setClearCloudBusy]=useState(false)
  const [restoreCloudOpen,setRestoreCloudOpen]=useState(false)
  const [restoreCloudBusy,setRestoreCloudBusy]=useState(false)

  const syncing=syncState.status==='syncing'
  const syncError=syncState.status==='error'?syncState.error:undefined
  const progress=syncState.progress

  const refreshSession=async()=>{
    const supabase=getSupabaseClient()
    if(!supabase){setStatus('signed-out');setSignedInEmail('');setSignedInUserId('');setMessage('Cloud sync is not configured.');return}
    try{
      const {data:sessionData,error}=await withTimeout(supabase.auth.getSession())
      if(error)throw error
      const user=sessionData.session?.user
      if(user){setSignedInEmail(user.email||'Signed in');setSignedInUserId(user.id||'');setStatus('signed-in');setMessage(m=>m==='Checking cloud account…'?'Cloud account connected.':m)}
      else{setSignedInEmail('');setSignedInUserId('');setNeedsDataChoice(false);setStatus('signed-out');setMessage('Sign in to keep your Spenza data available across devices.')}
    }catch(error){setSignedInUserId('');setStatus('error');setMessage(error instanceof Error?error.message:String(error))}
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
      if(result.restored&&result.data){alignFiltersToRestoredHistory(result.data);setMessage(`Restored ${result.restored.wallets} account${result.restored.wallets===1?'':'s'} and ${result.restored.transactions} transaction${result.restored.transactions===1?'':'s'} from cloud.`);window.setTimeout(()=>window.location.reload(),250)}
      else setMessage(successMessage)
      return true
    }
    if(result.status==='cancelled'){setStatus('signed-in');setMessage('Sync cancelled. Unsynced local changes are still waiting and can be synced later.');return false}
    if(result.status==='signed-out'){setSignedInEmail('');setSignedInUserId('');setNeedsDataChoice(false);setStatus('signed-out');setMessage(result.error||'Your session expired. Sign in again.');return false}
    if(result.status==='disabled'){setStatus('error');setMessage('Cloud sync is not configured.');return false}
    setStatus('error');setMessage(result.error||'Cloud sync failed.');return false
  }

  const finishAuthentication=async()=>{const local=await localRepository.getSnapshot();await refreshSession();if(hasFinancialData(local)){setNeedsDataChoice(true);setMessage('This device already has local financial data. Choose how you want to continue.');return}setMessage('Restoring your cloud data…');await runSync('Cloud data restored to this device.')}
  const signIn=async()=>{const value=email.trim().toLowerCase();if(!value||!password)return;try{setStatus('authing');setMessage('Signing in…');await signInWithEmailPassword(value,password);setPassword('');await finishAuthentication()}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const createAccount=async()=>{const value=email.trim().toLowerCase();if(!value||!password)return;if(password.length<6){setStatus('error');setMessage('Use at least 6 characters for your password.');return}try{setStatus('authing');setMessage('Creating your account…');const result=await signUpWithEmailPassword(value,password);setPassword('');if(result.session)await finishAuthentication();else{setStatus('signed-out');setMessage('Account created, but email confirmation is still enabled in Supabase. Turn off Confirm email to allow instant account creation.')}}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const forgotPassword=async()=>{const value=email.trim().toLowerCase();if(!value){setStatus('error');setMessage('Enter your email address first.');return}try{setStatus('authing');setMessage('Sending password reset…');await resetSupabasePassword(value);setStatus('signed-out');setMessage('Password reset sent. Check your email to choose a new password.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const restoreCloudSnapshot=async()=>{try{setMessage('Preparing a full cloud restore…');const cleared=await localRepository.clearFinancialDataForAccountSwitch();setData(cleared);setMessage('Restoring all cloud data…');await runSync('Cloud data restored to this device.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const useCloudData=async()=>{await restoreCloudSnapshot()}
  const mergeLocalAndCloud=async()=>{await runSync('Local and cloud data are synced.')}
  const cancelDataChoice=async()=>{try{await signOutSupabase();setSignedInEmail('');setSignedInUserId('');setNeedsDataChoice(false);setStatus('signed-out');setMessage('Sign-in cancelled. Your local data was not changed.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const syncNow=async()=>{await runSync()}
  const forceRestoreFromCloud=()=>setRestoreCloudOpen(true)
  const confirmRestoreFromCloud=async()=>{if(restoreCloudBusy)return;try{setRestoreCloudBusy(true);await restoreCloudSnapshot();setRestoreCloudOpen(false)}finally{setRestoreCloudBusy(false)}}
  const cancelSync=()=>{if(syncManager.cancel())setMessage('Cancelling sync…')}
  const signOut=async()=>{try{setMessage('Signing out…');await signOutSupabase();const cleared=await localRepository.clearFinancialDataForAccountSwitch();setData(cleared);setSignedInEmail('');setSignedInUserId('');setNeedsDataChoice(false);setPassword('');setStatus('signed-out');setMessage('Signed out. Financial data was removed from this device; your cloud copy is unchanged.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}}
  const confirmClearCloud=async()=>{if(clearCloudBusy)return;try{setClearCloudBusy(true);setMessage('Clearing cloud data…');await clearSignedInUsersCloudData();setClearCloudOpen(false);setStatus('signed-in');setMessage('Cloud data cleared. You are still signed in. Your local data is unchanged and will stay local until you press Sync now.')}catch(error){setStatus('error');setMessage(error instanceof Error?error.message:String(error))}finally{setClearCloudBusy(false)}}

  const lastSync=data.sync.lastSyncAt?new Date(data.sync.lastSyncAt).toLocaleString():'Not synced yet'
  const pending=data.sync.pendingChanges.length
  const authBusy=status==='authing'
  const canSubmit=!!email.trim()&&password.length>0&&!authBusy

  if(!configured)return <section className="settingsList cloudSyncSettings"><div className="settingsRow"><div><span>Cloud Sync</span><small>Cloud backup is unavailable in this build.</small></div><CloudOff size={20}/></div></section>

  return <>
  <section className="settingsList cloudSyncSettings">
    <div className="settingsRow cloudSyncHeader"><div><span>Cloud Sync</span><small>{signedInEmail||'Secure backup across your devices'}</small>{signedInUserId&&<small>Account ID: {shortAccountId(signedInUserId)}</small>}</div>{signedInEmail?<Cloud size={20}/>:<CloudOff size={20}/>}</div>
    {signedInEmail?needsDataChoice?<div className="cloudDataChoice"><h3>Local data found</h3><p>This device already contains financial data. Choose whether to replace it with your cloud account or merge both copies.</p><div className="cloudDataChoiceActions"><button className="primary" onClick={useCloudData} disabled={syncing}>Use cloud data</button><button className="secondary" onClick={mergeLocalAndCloud} disabled={syncing}>Merge local + cloud</button><button className="cancel" onClick={cancelDataChoice} disabled={syncing}>Cancel</button></div></div>:<>
      <div className="cloudSyncStats"><div><span>Changes waiting</span><b>{syncing?(progress?.remaining??pending):pending}</b></div><div><span>Last backup</span><b>{lastSync}</b></div></div>
      <div className={`cloudProgressPanel ${syncError?'error':''}`}><div className="cloudProgressTop"><b>{syncing?'Syncing in background':syncState.status==='cancelled'?'Sync cancelled':syncError?syncErrorTitle(syncState):'Cloud status'}</b><span>{progress?.phase||syncState.errorKind||syncState.status}</span></div><p>{syncError||progress?.message||(pending?`${pending} change${pending===1?'':'s'} waiting to sync.`:'Everything is up to date.')}</p>{syncError&&syncState.retryable===true&&<small>Your local changes are safe. Press Sync now when you are ready to try again.</small>}{syncing&&typeof progress?.total==='number'&&progress.total>0&&<div className="cloudProgressTrack"><i style={{width:`${Math.min(100,((progress.processed||0)/progress.total)*100)}%`}}/></div>}</div>
      <div className="cloudSyncActions"><button className="primary" onClick={syncNow} disabled={syncing||clearCloudBusy||restoreCloudBusy}><RefreshCw className={syncing?'spin':''} size={16}/>{syncing?'Syncing…':'Sync now'}</button>{syncing?<button className="cloudCancelSync" onClick={cancelSync}><XCircle size={16}/>Cancel sync</button>:<button className="cloudSignOut" onClick={signOut} disabled={clearCloudBusy||restoreCloudBusy}>Sign out</button>}</div>
      <button className="secondary cloudRestoreButton" onClick={forceRestoreFromCloud} disabled={syncing||clearCloudBusy||restoreCloudBusy}><CloudDownload size={15}/>{restoreCloudBusy?'Restoring…':'Restore from cloud'}</button>
      <button className="settingsDanger cloudClearButton" onClick={()=>setClearCloudOpen(true)} disabled={syncing||clearCloudBusy||restoreCloudBusy}><Trash2 size={15}/>Clear cloud data</button>
    </>:<div className="cloudSignIn"><div className="cloudAuthIntro"><b>{authMode==='signin'?'Welcome back':'Create your Spenza account'}</b><small>{authMode==='signin'?'Sign in to restore or sync your financial data securely.':'Use an email and password. With email confirmation disabled in Supabase, your account is ready immediately.'}</small></div><div className="cloudAuthTabs"><button className={authMode==='signin'?'active':''} onClick={()=>setAuthMode('signin')}>Sign in</button><button className={authMode==='signup'?'active':''} onClick={()=>setAuthMode('signup')}>Create account</button></div><label>Email<input type="email" inputMode="email" autoCapitalize="none" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<div className="cloudInputWrap"><input type={showPassword?'text':'password'} autoComplete={authMode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={authMode==='signup'?'At least 6 characters':'Your password'}/><button type="button" className="cloudPasswordToggle" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?'Hide password':'Show password'}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label><button className="primary cloudAuthPrimary" onClick={authMode==='signin'?signIn:createAccount} disabled={!canSubmit}>{authBusy?'Please wait…':authMode==='signin'?'Sign in':'Create account'}</button>{authMode==='signin'?<button className="cloudForgotPassword" onClick={forgotPassword} disabled={authBusy||!email.trim()}>Forgot password?</button>:<div className="cloudAuthHint">Your password stays with Supabase authentication. Spenza never stores it in your expense data.</div>}</div>}
    <div className={`cloudSyncMessage ${status==='error'?'error':''}`}>{message}</div>
  </section>
  {restoreCloudOpen&&<div className="dialogOverlay" onClick={()=>{if(!restoreCloudBusy)setRestoreCloudOpen(false)}}><div className="dialogCard" role="dialog" aria-modal="true" aria-labelledby="restore-cloud-title" onClick={e=>e.stopPropagation()}><div className="dialogIcon infoIcon"><CloudDownload/></div><h2 id="restore-cloud-title">Restore from cloud?</h2><p>This will replace the wallets, transactions and bills currently stored on this device with the copy saved in your cloud account.</p><div className="dialogActions"><button className="dialogCancel" disabled={restoreCloudBusy} onClick={()=>setRestoreCloudOpen(false)}>Cancel</button><button className="dialogConfirm" disabled={restoreCloudBusy} onClick={confirmRestoreFromCloud}>{restoreCloudBusy?'Restoring…':'Restore backup'}</button></div></div></div>}
  {clearCloudOpen&&<div className="dialogOverlay" onClick={()=>{if(!clearCloudBusy)setClearCloudOpen(false)}}><div className="dialogCard" role="dialog" aria-modal="true" aria-labelledby="clear-cloud-title" onClick={e=>e.stopPropagation()}><div className="dialogIcon dangerIcon"><AlertTriangle/></div><h2 id="clear-cloud-title">Clear cloud data?</h2><p>All Spenza data stored in your cloud account will be permanently deleted. Your local data on this device will be kept and you will remain signed in.</p><div className="dialogActions"><button className="dialogCancel" disabled={clearCloudBusy} onClick={()=>setClearCloudOpen(false)}>Cancel</button><button className="dialogConfirm" disabled={clearCloudBusy} onClick={confirmClearCloud}>{clearCloudBusy?'Clearing…':'Clear cloud'}</button></div></div></div>}
  </>
}
