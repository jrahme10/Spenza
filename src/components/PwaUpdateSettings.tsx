import { DownloadCloud } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getPwaUpdateAvailable, PwaUpdateAction, subscribePwaUpdate } from '../lib/pwaUpdate'

export default function PwaUpdateSettings(){
 const [update,setUpdate]=useState<PwaUpdateAction|null>(()=>getPwaUpdateAvailable())
 useEffect(()=>subscribePwaUpdate(setUpdate),[])
 if(!update)return null
 return <section className="settingsList pwaUpdateSettings" aria-live="polite">
  <div className="pwaUpdateSettingsCopy">
   <div className="pwaUpdateSettingsIcon"><DownloadCloud size={20}/></div>
   <div><span>App update available</span><small>A newer version of Spenza is ready. Update now to get the latest fixes and features.</small></div>
  </div>
  <button type="button" className="pwaUpdateSettingsButton" onClick={()=>update.apply()}><DownloadCloud size={16}/>Update Spenza</button>
 </section>
}
