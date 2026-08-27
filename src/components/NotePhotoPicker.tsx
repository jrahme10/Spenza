import { useRef, useState } from 'react'
import { Camera, Images, X } from 'lucide-react'
import { uploadNotePhoto } from '../lib/mediaStorage'
import './NotePhotoPicker.css'

type Props={images:string[];onChange:(images:string[])=>void;maxImages?:number}

type PickerInput=HTMLInputElement&{showPicker?:()=>void}

export default function NotePhotoPicker({images,onChange,maxImages=5}:Props){
 const galleryRef=useRef<HTMLInputElement>(null),cameraRef=useRef<HTMLInputElement>(null)
 const [uploading,setUploading]=useState(false),[error,setError]=useState(''),[open,setOpen]=useState(false)
 const addFiles=async(files?:FileList|null)=>{if(!files?.length||uploading)return;const remaining=Math.max(0,maxImages-images.length);const picked=Array.from(files).slice(0,remaining);if(!picked.length)return
  setUploading(true);setError('')
  try{const stored:string[]=[];for(const file of picked)stored.push(await uploadNotePhoto(file));onChange([...images,...stored]);setOpen(false)}catch(e){setError(e instanceof Error?e.message:'Photo upload failed.')}
  finally{setUploading(false);if(galleryRef.current)galleryRef.current.value='';if(cameraRef.current)cameraRef.current.value=''}
 }
 const openCamera=()=>{setOpen(false);cameraRef.current?.click()}
 const openGallery=()=>{setOpen(false);const input=galleryRef.current as PickerInput|null;if(!input)return;try{if(typeof input.showPicker==='function'){input.showPicker();return}}catch{}input.click()}
 return <div className="notePhotos compactPhotoPicker">
  <input ref={galleryRef} className="photoInput" type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)}/>
  <input ref={cameraRef} className="photoInput" type="file" accept="image/*" capture="environment" onChange={e=>addFiles(e.target.files)}/>
  <button type="button" className={`photoAttachmentTrigger ${images.length?'hasPhotos':''}`} aria-label="Add photo" onClick={()=>setOpen(true)} disabled={uploading||images.length>=maxImages}><Camera/>{images.length>0&&<span>{images.length}</span>}</button>
  {open&&<div className="photoChoiceBackdrop" onPointerDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
   <div className="photoChoiceSheet" onPointerDown={e=>e.stopPropagation()}>
    <div className="photoChoiceHandle"/>
    <div className="photoChoiceHead"><div><b>Add photo</b><small>Choose a source</small></div><button type="button" onClick={()=>setOpen(false)} aria-label="Close"><X/></button></div>
    <div className="photoChoiceActions"><button type="button" onClick={openCamera} disabled={uploading||images.length>=maxImages}><Camera/><span><b>Camera</b><small>Take a photo</small></span></button><button type="button" onClick={openGallery} disabled={uploading||images.length>=maxImages}><Images/><span><b>Gallery</b><small>Choose from photos</small></span></button></div>
    {error&&<small className="photoHint">{error}</small>}
   </div>
  </div>}
 </div>
}
