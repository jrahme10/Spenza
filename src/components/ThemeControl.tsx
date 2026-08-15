import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme='dark'|'light'

function initialTheme():Theme{
 const saved=localStorage.getItem('spenza-theme') as Theme|null
 if(saved==='dark'||saved==='light')return saved
 return window.matchMedia?.('(prefers-color-scheme: light)').matches?'light':'dark'
}

export function applyTheme(theme:Theme){
 document.documentElement.dataset.theme=theme
 document.documentElement.style.colorScheme=theme
 localStorage.setItem('spenza-theme',theme)
}

export function initTheme(){applyTheme(initialTheme())}

export default function ThemeControl(){
 const [theme,setTheme]=useState<Theme>(initialTheme)
 const [settingsOpen,setSettingsOpen]=useState(false)
 useEffect(()=>{applyTheme(theme)},[theme])
 useEffect(()=>{const sync=()=>{const active=[...document.querySelectorAll('nav button')].find(b=>b.classList.contains('active'));setSettingsOpen(active?.textContent?.trim()==='Settings')};sync();const observer=new MutationObserver(sync);observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});return()=>observer.disconnect()},[])
 if(!settingsOpen)return null
 return <section className="theme-settings-card">
   <div><span className="eyebrow">APPEARANCE</span><h2>Theme</h2><p>Choose how Spenza looks on this device.</p></div>
   <div className="theme-segmented" role="group" aria-label="Theme">
     <button className={theme==='light'?'selected':''} onClick={()=>setTheme('light')}><Sun size={17}/>Light</button>
     <button className={theme==='dark'?'selected':''} onClick={()=>setTheme('dark')}><Moon size={17}/>Dark</button>
   </div>
 </section>
}
