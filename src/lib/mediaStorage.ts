import { getSupabaseClient, getSupabaseUserId } from './supabaseClient'

export const MEDIA_BUCKET = 'spenza-media'
export const MEDIA_PREFIX = 'spenza-storage:'
export const isStoredMedia = (value: string) => value.startsWith(MEDIA_PREFIX)
export const mediaPath = (value: string) =>
  isStoredMedia(value) ? value.slice(MEDIA_PREFIX.length) : value

async function canvasBlob(file: File, maxSide = 1280, quality = 0.76): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Image compression unavailable')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  let q = quality,
    blob: Blob | null = null
  do {
    blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', q))
    q -= 0.08
  } while (blob && blob.size > 900_000 && q >= 0.44)
  if (!blob) throw new Error('Image compression failed')
  if (blob.size > 1_000_000)
    throw new Error('Photo is too large after compression. Please choose a smaller image.')
  return blob
}

export async function uploadNotePhoto(file: File): Promise<string> {
  const supabase = getSupabaseClient()
  const userId = await getSupabaseUserId()
  if (!supabase || !userId) throw new Error('Sign in to Cloud Sync before uploading photos.')
  const blob = await canvasBlob(file)
  const path = `${userId}/notes/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false, cacheControl: '31536000' })
  if (error) throw error
  return `${MEDIA_PREFIX}${path}`
}

export async function loadStoredMedia(value: string): Promise<string> {
  if (!isStoredMedia(value)) return value
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Cloud storage is unavailable.')
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(mediaPath(value))
  if (error) throw error
  return URL.createObjectURL(data)
}

export async function deleteStoredMedia(values: string[]) {
  const supabase = getSupabaseClient()
  if (!supabase) return
  const paths = values.filter(isStoredMedia).map(mediaPath)
  if (!paths.length) return
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove(paths)
  if (error) throw error
}
