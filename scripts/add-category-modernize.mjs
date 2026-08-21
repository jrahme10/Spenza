import {readFileSync,writeFileSync} from 'node:fs'
const path=new URL('../src/App.tsx',import.meta.url)
let s=readFileSync(path,'utf8')
const old=`const addCategory=()=>{const raw=window.prompt('New category name');const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
const modern=`const addCategory=(raw?:string)=>{const name=raw?.trim();if(!name)return;const existing=data.categories.find(c=>c.toLowerCase()===name.toLowerCase());if(existing){setCategory(existing);return}setData(d=>({...d,categories:[...d.categories,name]}));setCategory(name)}`
if(s.includes(old))s=s.replace(old,modern)
else if(!s.includes(`const addCategory=(raw?:string)=>`))throw new Error('Add category transform failed: function not found')
const previous=`const editCategory=(oldValue:string,newValue:string)=>{const oldName=oldValue.trim();const nextName=newValue.trim();if(!oldName||!nextName||oldName===nextName)return;setData(d=>({...d,categories:d.categories.map(c=>c===oldName?nextName:c).filter((c,i,a)=>a.findIndex(x=>x.toLowerCase()===c.toLowerCase())===i),transactions:d.transactions.map(t=>t.category===oldName?{...t,category:nextName,updatedAt:new Date().toISOString()}:t),bills:d.bills.map(b=>b.category===oldName?{...b,category:nextName,updatedAt:new Date().toISOString()}:b)}));setCategory(c=>c===oldName?nextName:c)}`
const improved=`const editCategory=(oldValue:string,newValue:string)=>{const oldName=oldValue.trim();const nextName=newValue.trim();if(!oldName||!nextName||oldName===nextName)return;const isParent=!oldName.includes(' > ');const rename=(value:string)=>value===oldName?nextName:(isParent&&value.startsWith(oldName+' > ')?nextName+value.slice(oldName.length):value);setData(d=>({...d,categories:d.categories.map(rename).filter((c,i,a)=>a.findIndex(x=>x.toLowerCase()===c.toLowerCase())===i),transactions:d.transactions.map(t=>{const changed=rename(t.category);return changed!==t.category?{...t,category:changed,updatedAt:new Date().toISOString()}:t}),bills:d.bills.map(b=>{const changed=rename(b.category);return changed!==b.category?{...b,category:changed,updatedAt:new Date().toISOString()}:b})}));setCategory(c=>rename(c))}`
if(s.includes(previous))s=s.replace(previous,improved)
else if(!s.includes(improved)){
 const anchor=modern
 if(!s.includes(anchor))throw new Error('Edit category transform failed: addCategory anchor not found')
 s=s.replace(anchor,`${anchor}\n ${improved}`)
}
const remove=`const deleteCategory=(value:string)=>{const target=value.trim();if(!target)return;const isParent=!target.includes(' > ');const matches=(item:string)=>item===target||(isParent&&item.startsWith(target+' > '));const remaining=data.categories.filter(c=>!matches(c));setData(d=>({...d,categories:d.categories.filter(c=>!matches(c))}));setCategory(current=>matches(current)?(remaining[0]||'Other'):current)}`
if(!s.includes(`const deleteCategory=(value:string)=>`)){
 if(!s.includes(improved))throw new Error('Delete category transform failed: editCategory anchor not found')
 s=s.replace(improved,`${improved}\n ${remove}`)
}
writeFileSync(path,s)
console.log('Modernized category handlers with add, rename, and delete support')
