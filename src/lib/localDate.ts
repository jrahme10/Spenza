export function localDateString(date=new Date()){
  const year=date.getFullYear()
  const month=String(date.getMonth()+1).padStart(2,'0')
  const day=String(date.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}

export async function deterministicUuid(value:string){
  const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))
  // RFC 4122-compatible deterministic UUID. Version/variant bits are fixed so the value is accepted by UUID columns.
  bytes[6]=(bytes[6]&0x0f)|0x50
  bytes[8]=(bytes[8]&0x3f)|0x80
  const hex=Array.from(bytes.slice(0,16),b=>b.toString(16).padStart(2,'0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20,32)}`
}
