import {readFileSync,writeFileSync} from 'node:fs'
const path=new URL('../src/App.tsx',import.meta.url)
let s=readFileSync(path,'utf8')
const old=`const addCategory=()=>{const raw=window.prompt('New category name');const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
const modern=`const addCategory=(raw?:string)=>{const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
if(s.includes(old))s=s.replace(old,modern)
else if(!s.includes(`const addCategory=(raw?:string)=>`))throw new Error('Add category transform failed: function not found')
if(!s.includes(`const editCategory=(oldValue:string,newValue:string)=>`)){
 const anchor=`const addCategory=(raw?:string)=>{const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
 const edit=`const editCategory=(oldValue:string,newValue:string)=>{const oldName=oldValue.trim();const nextName=newValue.trim();if(!oldName||!nextName||oldName===nextName)return;setData(d=>({...d,categories:d.categories.map(c=>c===oldName?nextName:c).filter((c,i,a)=>a.findIndex(x=>x.toLowerCase()===c.toLowerCase())===i),transactions:d.transactions.map(t=>t.category===oldName?{...t,category:nextName,updatedAt:new Date().toISOString()}:t),bills:d.bills.map(b=>b.category===oldName?{...b,category:nextName,updatedAt:new Date().toISOString()}:b)}));setCategory(c=>c===oldName?nextName:c)}`
 if(!s.includes(anchor))throw new Error('Edit category transform failed: addCategory anchor not found')
 s=s.replace(anchor,`${anchor}\n ${edit}`)
}
writeFileSync(path,s)
console.log('Modernized Add Category handler and enabled subcategory rename')
