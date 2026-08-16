import { useState } from 'react'
import { LockKeyhole, ShieldCheck, X } from 'lucide-react'
import { SpenzaData } from '../lib/db'
import { createSalt, hashPin } from '../lib/security'

type Props={data:SpenzaData;setData:React.Dispatch<React.SetStateAction<SpenzaData>>}
type Mode='setup'|'change'|'disable'|null

export default function SecuritySettings({data,setData}:Props){
  const security=data.security||{enabled:false,timeoutMinutes:0}
  const [mode,setMode]=useState<Mode>(null)
  const [pin,setPin]=useState('')
  const [confirm,setConfirm]=useState('')
  const [error,setError]=useState('')

  const close=()=>{setMode(null);setPin('');setConfirm('');setError('')}
  const verify=async(value:string)=>!!security.pinHash&&!!security.salt&&(await hashPin(value,security.salt))===security.pinHash
  const submit=async()=>{
    if(!mode)return
    if(pin.length<4){setError('Use at least 4 digits.');return}
    if(mode==='setup'||mode==='change'){
      if(pin!==confirm){setError('PINs do not match.');return}
      const salt=createSalt();const pinHash=await hashPin(pin,salt)
      setData(d=>({...d,security:{enabled:true,pinHash,salt,timeoutMinutes:d.security?.timeoutMinutes??0}}));close();return
    }
    if(!(await verify(pin))){setError('Incorrect PIN.');return}
    setData(d=>({...d,security:{enabled:false,timeoutMinutes:d.security?.timeoutMinutes??0}}));close()
  }

  return <>
    <div className="settingsRow securitySettingsRow"><div><span>App Lock</span><small>{security.enabled?'PIN protection enabled':'Protect Spenza with a PIN'}</small></div>{security.enabled?<b className="securityOn"><ShieldCheck/> On</b>:<button className="settingsInlineButton" onClick={()=>setMode('setup')}>Enable</button>}</div>
    {security.enabled&&<div className="securityOptions"><label>Auto-lock<select value={security.timeoutMinutes} onChange={e=>setData(d=>({...d,security:{...(d.security||{enabled:true}),enabled:true,timeoutMinutes:Number(e.target.value)}}))}><option value={0}>Immediately</option><option value={1}>After 1 minute</option><option value={5}>After 5 minutes</option><option value={15}>After 15 minutes</option></select></label><div><button onClick={()=>setMode('change')}>Change PIN</button><button className="securityDisable" onClick={()=>setMode('disable')}>Disable</button></div></div>}
    {mode&&<div className="dialogOverlay securityDialog" onClick={close}><div className="dialogCard" onClick={e=>e.stopPropagation()}><button className="securityClose" onClick={close}><X/></button><div className="dialogIcon infoIcon"><LockKeyhole/></div><h2>{mode==='disable'?'Disable App Lock?':mode==='change'?'Change PIN':'Enable App Lock'}</h2><p>{mode==='disable'?'Enter your current PIN to remove the lock.':'Choose a PIN with at least 4 digits.'}</p><input className="securityPinInput" type="password" inputMode="numeric" autoComplete="off" value={pin} onChange={e=>{setPin(e.target.value.replace(/\D/g,''));setError('')}} placeholder="PIN" autoFocus/>{mode!=='disable'&&<input className="securityPinInput" type="password" inputMode="numeric" autoComplete="off" value={confirm} onChange={e=>{setConfirm(e.target.value.replace(/\D/g,''));setError('')}} placeholder="Confirm PIN"/>}{error&&<div className="securityError">{error}</div>}<button className="primary securitySubmit" onClick={submit}>{mode==='disable'?'Disable Lock':mode==='change'?'Save New PIN':'Enable Lock'}</button></div></div>}
  </>
}
