import { useEffect, useState } from 'react'
import { Laptop, Moon, Sun } from 'lucide-react'

type ThemePreference='auto'|'dark'|'light'
type ResolvedTheme='dark'|'light'

function getSystemTheme():ResolvedTheme{return window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'}
function initialPreference():ThemePreference{const saved=localStorage.getItem('spenza-theme') as ThemePreference|null;return saved==='dark'||saved==='light'||saved==='auto'?saved:'auto'}
function resolveTheme(preference:ThemePreference):ResolvedTheme{return preference==='auto'?getSystemTheme():preference}
export function applyTheme(preference:ThemePreference){const resolved=resolveTheme(preference);document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themePreference=preference;document.documentElement.style.colorScheme=resolved;localStorage.setItem('spenza-theme',preference);const meta=document.querySelector('meta[name="theme-color"]') as HTMLMetaElement|null;if(meta)meta.content=resolved==='dark'?'#07101c':'#f5f7fa'}
export function initTheme(){applyTheme(initialPreference())}

export default function ThemeControl(){
 const [preference,setPreference]=useState<ThemePreference>(initialPreference)
 const [systemTheme,setSystemTheme]=useState<ResolvedTheme>(getSystemTheme)
 useEffect(()=>{applyTheme(preference);const media=window.matchMedia('(prefers-color-scheme: dark)');const onChange=()=>{setSystemTheme(media.matches?'dark':'light');if(preference==='auto')applyTheme('auto')};media.addEventListener?.('change',onChange);return()=>media.removeEventListener?.('change',onChange)},[preference])
 return <div className="theme-settings-card"><div className="themeRowHead"><div><span>Theme</span><small>{preference==='auto'?`Auto · system ${systemTheme}`:`${preference[0].toUpperCase()}${preference.slice(1)} mode`}</small></div></div><div className="theme-segmented" role="group" aria-label="Theme preference"><button className={preference==='auto'?'selected':''} onClick={()=>setPreference('auto')}><Laptop size={15}/>Auto</button><button className={preference==='light'?'selected':''} onClick={()=>setPreference('light')}><Sun size={15}/>Light</button><button className={preference==='dark'?'selected':''} onClick={()=>setPreference('dark')}><Moon size={15}/>Dark</button></div></div>
}
