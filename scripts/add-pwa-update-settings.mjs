import{readFileSync,writeFileSync}from'node:fs'
const path=new URL('../src/App.tsx',import.meta.url)
let s=readFileSync(path,'utf8')
const imp=`import PwaUpdateSettings from './components/PwaUpdateSettings'`
if(!s.includes(imp)){
 const anchor=`import CloudSyncSettings from './components/CloudSyncSettings'`
 if(!s.includes(anchor))throw new Error('PWA update settings transform: import anchor missing')
 s=s.replace(anchor,`${anchor}\n${imp}`)
}
if(!s.includes('<PwaUpdateSettings/>')){
 const anchor=`<h3 className="settingsGroupTitle">Security</h3>`
 if(!s.includes(anchor))throw new Error('PWA update settings transform: Settings anchor missing')
 s=s.replace(anchor,`<h3 className="settingsGroupTitle pwaUpdateSettingsTitle">App Update</h3><PwaUpdateSettings/>${anchor}`)
}
writeFileSync(path,s)
console.log('Added conditional PWA update section to Settings')
