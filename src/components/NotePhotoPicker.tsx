import { useEffect, useRef, useState } from 'react'
import { Camera, Images, Paperclip, Plus, X } from 'lucide-react'
import { isStoredMedia, loadStoredMedia, uploadNotePhoto } from '../lib/mediaStorage'
import './NotePhotoPicker.css'

type Props={images:string[];onChange:(images:string[])=>void;maxImages?:number}

function Preview({src,index}:{src:string;index:number}){
 const [url,setUrl]=useState(src)
 useEffect(()=>{let active=true;let objectUrl:string|undefined
  if(isStoredMedia(src))loadStoredMedia(src).then(v=>{objectUrl=v;if(active)setUrl(v)}).catch(()=>{if(active)setUrl('')})
  else setUrl(src)
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}
 },[src])
 return url?<img src={url} alt={`Note attachment ${index+1}`}/>:<span className="photoHint">Unavailable</span>
}

export default function NotePhotoPicker({images,onChange,maxImages=5}:Props){
 const galleryRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null)
 const [uploading,setUploading]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false)
 const addFiles=async(files?:FileList|null)=>{if(!files?.length||uploading)return;const remaining=Math.max(0,maxImages-images.length);const picked=Array.from(files).slice(0,remaining);if(!picked.length)return
  setUploading(true);setError('')
  try{const stored:string[]=[];for(const file of picked)stored.push(await uploadNotePhoto(file));onChange([...images,...stored]);setOpen(false)}catch(e){setError(e instanceof Error?e.message:'Photo upload failed.')}
  finally{setUploading(false);if(galleryRef.current)galleryRef.current.value='';if(cameraRef.current)cameraRef.current.value=''}
 }
 return <div className="notePhotos compactPhotoPicker">
  <input ref={galleryRef} className="photoInput" type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)}/>
  <input ref={cameraRef} className="photoInput" type="file" accept="image/*" capture="environment" onChange={e=>addFiles(e.target.files)}/>
  <button type="button" className={`photoAttachmentTrigger ${images.length?'hasPhotos':''}`} aria-label="Add photo" onClick={()=>setOpen(true)} disabled={uploading||images.length>=maxImages}><Paperclip/>{images.length>0&&<span>{images.length}</span>}</button>
  {open&&<div className="photoChoiceBackdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
   <div className="photoChoiceSheet" onPointerDown={e=>e.stopPropagation()}>
    <div className="photoChoiceHandle"/>
    <div className="photoChoiceHead"><div><b>Add photo</b><small>Choose where to get the image</small></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close"><X/></button></div>
    <div className="photoChoiceActions"><button type="button" onClick={()=>galleryRef.current?.click()} disabled={uploading||images.length>=maxImages}><Images/><span><b>Gallery</b><small>Choose from your photos</small></span></button><button type="button" onClick={()=>cameraRef.current?.click()} disabled={uploading||images.length>=maxImages}><Camera/><span><b>Take photo</b><small>Use the camera now</small></span></button></div>
    {images.length>0&&<div className="notePhotoGrid">{images.map((src,index)=><div className="notePhoto" key={`${src.slice(0,50)}-${index}`}><Preview src={src} index={index}/><button type="button" aria-label="Remove photo" onClick={()=>onChange(images.filter((_,i)=>i!==index))}><X/></button></div>)}{images.length<maxImages&&<button type="button" className="notePhotoAdd" onClick={()=>galleryRef.current?.click()} disabled={uploading}><Plus/><span>Add</span></button>}</div>}
    {error&&<small className="photoHint">{error}</small>}
   </div>
  </div>}
 </div>
}
