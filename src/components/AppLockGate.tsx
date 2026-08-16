import { useEffect, useState } from 'react'
import { LockKeyhole } from 'lucide-react'
import { SpenzaData } from '../lib/db'
import { hashPin } from '../lib/security'

type Props={data:SpenzaData}

export default function AppLockGate({data}:Props){
  const security=data.security
  const [locked,setLocked]=useState(!!security?.enabled)
  const [pin,setPin]=useState('')
  const [error,setError]=useState('')

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
    document.addEventListener('visibilitychange',onVisibility)
    window.addEventListener('pagehide',()=>sessionStorage.setItem(hiddenKey,String(Date.now())))
    return()=>document.removeEventListener('visibilitychange',onVisibility)
  },[security?.enabled,security?.timeoutMinutes])

  if(!security?.enabled||!locked)return null
  const unlock=async()=>{
    if(!security.salt||!security.pinHash)return
    const ok=(await hashPin(pin,security.salt))===security.pinHash
    if(ok){setLocked(false);setPin('');setError('')}else{setError('Incorrect PIN');setPin('')}
  }
  return <div className="appLockScreen"><div className="appLockCard"><div className="appLockLogo"><LockKeyhole/></div><span className="eyebrow">SPENZA</span><h1>Welcome back</h1><p>Enter your PIN to unlock your finances.</p><input type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/g,''));setError('')}} onKeyDown={e=>{if(e.key==='Enter')unlock()}} placeholder="Enter PIN" autoFocus/>{error&&<div className="securityError">{error}</div>}<button className="primary" onClick={unlock}>Unlock Spenza</button></div></div>
}
