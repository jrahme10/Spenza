function randomBytes(length:number){const bytes=new Uint8Array(length);crypto.getRandomValues(bytes);return bytes}

function toBase64Url(buffer:ArrayBuffer){
  const bytes=new Uint8Array(buffer)
  let binary=''
  bytes.forEach(b=>binary+=String.fromCharCode(b))
  return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')
}

function fromBase64Url(value:string){
  const base64=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4)
  const binary=atob(base64)
  const bytes=new Uint8Array(binary.length)
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i)
  return bytes
}

export async function platformBiometricAvailable(){
  if(!window.isSecureContext||!('PublicKeyCredential' in window))return false
  const fn=PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  if(typeof fn!=='function')return false
  try{return await fn.call(PublicKeyCredential)}catch{return false}
}

export async function registerLocalBiometric(){
  if(!(await platformBiometricAvailable()))throw new Error('Biometric unlock is not available on this device.')
  const credential=await navigator.credentials.create({publicKey:{
    challenge:randomBytes(32),
    rp:{name:'Spenza'},
    user:{id:randomBytes(32),name:'spenza-local-user',displayName:'Spenza Local User'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    timeout:60000,
    authenticatorSelection:{authenticatorAttachment:'platform',residentKey:'discouraged',userVerification:'required'},
    attestation:'none',
  }}) as PublicKeyCredential|null
  if(!credential)throw new Error('Biometric setup was cancelled.')
  return toBase64Url(credential.rawId)
}

export async function authenticateLocalBiometric(credentialId:string){
  if(!(await platformBiometricAvailable()))return false
  try{
    const credential=await navigator.credentials.get({publicKey:{
      challenge:randomBytes(32),
      allowCredentials:[{type:'public-key',id:fromBase64Url(credentialId),transports:['internal']}],
      timeout:60000,
      userVerification:'required',
    }})
    return !!credential
  }catch{return false}
}
