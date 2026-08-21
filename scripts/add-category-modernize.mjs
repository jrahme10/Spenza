import {readFileSync,writeFileSync} from 'node:fs'
const path=new URL('../src/App.tsx',import.meta.url)
let s=readFileSync(path,'utf8')
const old=`const addCategory=()=>{const raw=window.prompt('New category name');const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
const next=`const addCategory=(raw?:string)=>{const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
if(s.includes(old))s=s.replace(old,next)
else if(!s.includes(`const addCategory=(raw?:string)=>`))throw new Error('Add category transform failed: function not found')
writeFileSync(path,s)
console.log('Modernized Add Category handler')
