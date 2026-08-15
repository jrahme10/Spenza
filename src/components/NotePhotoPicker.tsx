import { useRef } from 'react'
import { Camera, Images, Plus, X } from 'lucide-react'

type Props = {
  images: string[]
  onChange: (images: string[]) => void
  maxImages?: number
}

async function compressImage(file: File): Promise<string> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const maxSide = 1280
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) return resolve(source)
      ctx.drawImage(img, 0, 0, width, height)
      resolve(canvas.toDataURL('image/jpeg', 0.78))
    }
    img.onerror = () => resolve(source)
    img.src = source
  })
}

export default function NotePhotoPicker({ images, onChange, maxImages = 5 }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const addFiles = async (files?: FileList | null) => {
    if (!files?.length) return
    const remaining = Math.max(0, maxImages - images.length)
    const picked = Array.from(files).slice(0, remaining)
    const encoded = await Promise.all(picked.map(compressImage))
    onChange([...images, ...encoded])
    if (galleryRef.current) galleryRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  return <div className="notePhotos">
    <input ref={galleryRef} className="photoInput" type="file" accept="image/*" multiple onChange={e=>addFiles(e.target.files)}/>
    <input ref={cameraRef} className="photoInput" type="file" accept="image/*" capture="environment" onChange={e=>addFiles(e.target.files)}/>

    <div className="notePhotoActions">
      <button type="button" onClick={()=>galleryRef.current?.click()} disabled={images.length>=maxImages}><Images/><span>Gallery</span></button>
      <button type="button" onClick={()=>cameraRef.current?.click()} disabled={images.length>=maxImages}><Camera/><span>Take photo</span></button>
    </div>

    {images.length>0&&<div className="notePhotoGrid">
      {images.map((src,index)=><div className="notePhoto" key={`${src.slice(0,30)}-${index}`}>
        <img src={src} alt={`Note attachment ${index+1}`}/>
        <button type="button" aria-label="Remove photo" onClick={()=>onChange(images.filter((_,i)=>i!==index))}><X/></button>
      </div>)}
      {images.length<maxImages&&<button type="button" className="notePhotoAdd" onClick={()=>galleryRef.current?.click()}><Plus/><span>Add</span></button>}
    </div>}
    <small className="photoHint">Up to {maxImages} photos. Images are compressed and saved locally with this transaction.</small>
  </div>
}
