import { useEffect, useRef, useState } from 'react'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { SpenzaData } from '../lib/db'
import { hashPin } from '../lib/security'
import { authenticateLocalBiometric, platformBiometricAvailable } from '../lib/biometrics'

type Props={data:SpenzaData}

export default function AppLockGate({data}:Props){
  const security=data.security
  const [locked,setLocked]=useState(!!security?.enabled)
  const [pin,setPin]=useState('')
  const [error,setError]=useState('')
  const [biometricSupported,setBiometricSupported]=useState(false)
  const [biometricBusy,setBiometricBusy]=useState(false)
  const biometricAutoAttempted=useRef(false)

  useEffect(()=>{platformBiometricAvailable().then(setBiometricSupported).catch(()=>setBiometricSupported(false))},[])
  useEffect(()=>{if(security?.enabled)setLocked(true);else setLocked(false)},[security?.enabled])
  useEffect(()=>{
    if(!security?.enabled)return
    const hiddenKey='spenza-hidden-at'
    const onVisibility=()=>{
      if(document.visibilityState==='hidden'){sessionStorage.setItem(hiddenKey,String(Date.now()));return}
      const hiddenAt=Number(sessionStorage.getItem(hiddenKey)||0)
      if(!hiddenAt)return
      const minutes=(Date.now()-hiddenAt)/60000
      if((security.timeoutMinutes??0)===0||minutes>=(security.timeoutMinutes??0))setLocked(true)
      sessionStorage.removeItem(hiddenKey)
    }
    const onPageHide=()=>sessionStorage.setItem(hiddenKey,String(Date.now()))
    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('pagehide',onPageHide)
    return()=>{document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',onPageHide)}
  },[security?.enabled,security?.timeoutMinutes])

  const canUseBiometric=!!security?.biometricEnabled&&!!security?.biometricCredentialId&&biometricSupported

  const unlockBiometric=async()=>{
    if(!security?.biometricCredentialId||biometricBusy)return
    setBiometricBusy(true);setError('')
    try{
      const ok=await authenticateLocalBiometric(security.biometricCredentialId)
      if(ok){setLocked(false);setPin('');setError('')}else setError('Biometric unlock was cancelled or could not be verified. Use your PIN instead.')
    }finally{
      setBiometricBusy(false)
    }
  }

  useEffect(()=>{
    if(!locked){biometricAutoAttempted.current=false;return}
    if(!canUseBiometric||biometricBusy||biometricAutoAttempted.current)return
    biometricAutoAttempted.current=true
    const timer=window.setTimeout(()=>{unlockBiometric()},120)
    return()=>window.clearTimeout(timer)
  },[locked,canUseBiometric])

  if(!security?.enabled||!locked)return null
  const unlock=async()=>{
    if(!security.salt||!security.pinHash)return
    const ok=(await hashPin(pin,security.salt))===security.pinHash
    if(ok){setLocked(false);setPin('');setError('')}else{setError('Incorrect PIN');setPin('')}
  }
  return <div className="appLockScreen"><div className="appLockCard"><div className="appLockLogo"><LockKeyhole/></div><span className="eyebrow">SPENZA</span><h1>Welcome back</h1><p>{canUseBiometric?'Face ID / biometrics will open automatically. You can also use your PIN.':'Enter your PIN to unlock your finances.'}</p>{canUseBiometric&&<button className="biometricUnlock" onClick={unlockBiometric} disabled={biometricBusy}><ShieldCheck/>{biometricBusy?'Waiting for device…':'Try Face ID / Biometrics again'}</button>}{canUseBiometric&&<div className="unlockDivider"><span>or use PIN</span></div>}<input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/g,''));setError('')}} onKeyDown={e=>{if(e.key==='Enter')unlock()}} placeholder="Enter PIN" autoFocus={!canUseBiometric}/>{error&&<div className="securityError">{error}</div>}<button className="primary" onClick={unlock}>Unlock Spenza</button></div></div>
}
