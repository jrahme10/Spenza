import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { disableBillPush, enableBillPush, getPushSubscription, notificationPermission, pushSupported } from '../lib/pushNotifications'

export default function BillNotificationSettings(){
 const [enabled,setEnabled]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('Get bill reminders even when Spenza is closed.')
 useEffect(()=>{void getPushSubscription().then(s=>setEnabled(!!s)).catch(()=>{})},[])
 const toggle=async()=>{if(busy)return;try{setBusy(true);if(enabled){await disableBillPush();setEnabled(false);setMessage('Bill push notifications are off on this device.')}else{await enableBillPush();setEnabled(true);setMessage('Bill reminders are enabled on this device.')} }catch(error){setMessage(error instanceof Error?error.message:String(error))}finally{setBusy(false)}}
 const supported=pushSupported();const permission=notificationPermission()
 return <section className="settingsList billNotificationSettings"><div className="settingsRow"><div><span>Bill notifications</span><small>{message}</small></div>{enabled?<Bell size={20}/>:<BellOff size={20}/>}</div><button className="primary" onClick={toggle} disabled={busy||!supported}>{busy?'Please wait…':enabled?'Disable notifications':'Enable notifications'}</button>{!supported&&<div className="cloudSyncMessage error">Push notifications are not supported here. On iPhone, install Spenza to the Home Screen and open the installed app.</div>}{permission==='denied'&&<div className="cloudSyncMessage error">Notifications are blocked for Spenza. Allow notifications in your device settings, then try again.</div>}</section>
}
