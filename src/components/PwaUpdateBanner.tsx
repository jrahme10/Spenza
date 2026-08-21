import { useEffect, useState } from 'react'

type UpdateDetail={apply:()=>void}

export default function PwaUpdateBanner(){
 const [update,setUpdate]=useState<UpdateDetail|null>(null)
 useEffect(()=>{
  const onAvailable=(event:Event)=>setUpdate((event as CustomEvent<UpdateDetail>).detail)
  window.addEventListener('spenza-pwa-update-available',onAvailable)
  return()=>window.removeEventListener('spenza-pwa-update-available',onAvailable)
 },[])
 if(!update)return null
 return <div className="pwaUpdateBanner" role="status" aria-live="polite">
  <div><b>New version available</b><span>Update Spenza to load the latest changes.</span></div>
  <button type="button" onClick={()=>update.apply()}>Update</button>
 </div>
}
