import { useEffect, useState } from 'react'
import { Laptop, Moon, Sun } from 'lucide-react'

type ThemePreference='auto'|'dark'|'light'
type ResolvedTheme='dark'|'light'

function getSystemTheme():ResolvedTheme{
 return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'
}

function initialPreference():ThemePreference{
 const saved=localStorage.getItem('spenza-theme') as ThemePreference|null
 return saved==='dark'||saved==='light'||saved==='auto'?saved:'auto'
}

function resolveTheme(preference:ThemePreference):ResolvedTheme{
 return preference==='auto'?getSystemTheme():preference
}

export function applyTheme(preference:ThemePreference){
 const resolved=resolveTheme(preference)
 document.documentElement.dataset.theme=resolved
 document.documentElement.dataset.themePreference=preference
 document.documentElement.style.colorScheme=resolved
 localStorage.setItem('spenza-theme',preference)
 const themeMeta=document.querySelector('meta[name="theme-color"]') as HTMLMetaElement|null
 if(themeMeta)themeMeta.content=resolved==='dark'?'#07101c':'#f5f7fa'
}

export function initTheme(){
 const preference=initialPreference()
 applyTheme(preference)
 if(preference==='auto'){
  const media=window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener?.('change',()=>applyTheme('auto'))
 }
}

export default function ThemeControl(){
 const [preference,setPreference]=useState<ThemePreference>(initialPreference)
 const [systemTheme,setSystemTheme]=useState<ResolvedTheme>(getSystemTheme)
 useEffect(()=>{
  applyTheme(preference)
  const media=window.matchMedia('(prefers-color-scheme: dark)')
  const onChange=()=>{setSystemTheme(media.matches?'dark':'light');if(preference==='auto')applyTheme('auto')}
  media.addEventListener?.('change',onChange)
  return()=>media.removeEventListener?.('change',onChange)
 },[preference])
 return <section className="theme-settings-card">
   <div><span className="eyebrow">APPEARANCE</span><h2>Theme</h2><p>Choose a fixed theme or let Spenza follow your device automatically.</p></div>
   <div className="theme-segmented" role="group" aria-label="Theme preference">
     <button className={preference==='auto'?'selected':''} onClick={()=>setPreference('auto')}><Laptop size={17}/><span>Auto<small>{systemTheme==='dark'?'System dark':'System light'}</small></span></button>
     <button className={preference==='light'?'selected':''} onClick={()=>setPreference('light')}><Sun size={17}/><span>Light</span></button>
     <button className={preference==='dark'?'selected':''} onClick={()=>setPreference('dark')}><Moon size={17}/><span>Dark</span></button>
   </div>
 </section>
}
