const PBKDF2_ALGORITHM = 'pbkdf2-sha256'
const PBKDF2_ITERATIONS = 210_000
const PBKDF2_BITS = 256

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) throw new Error('Invalid salt')
  const bytes = new Uint8Array(value.length / 2)
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

async function legacyHashPin(pin: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return bytesToHex(new Uint8Array(digest))
}

async function derivePbkdf2(pin: string, salt: string, iterations: number) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pin),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: hexToBytes(salt),
      iterations,
    },
    keyMaterial,
    PBKDF2_BITS,
  )
  return bytesToHex(new Uint8Array(bits))
}

export async function hashPin(pin: string, salt: string) {
  const hash = await derivePbkdf2(pin, salt, PBKDF2_ITERATIONS)
  return `${PBKDF2_ALGORITHM}$${PBKDF2_ITERATIONS}$${hash}`
}

export async function verifyPin(pin: string, salt: string, storedHash: string) {
  if (storedHash.startsWith(`${PBKDF2_ALGORITHM}$`)) {
    const [, rawIterations, expected] = storedHash.split('$')
    const iterations = Number(rawIterations)
    if (!Number.isSafeInteger(iterations) || iterations < 100_000 || !expected) {
      return { valid: false, needsUpgrade: false as const }
    }
    const actual = await derivePbkdf2(pin, salt, iterations)
    return { valid: actual === expected, needsUpgrade: false as const }
  }

  const valid = (await legacyHashPin(pin, salt)) === storedHash
  if (!valid) return { valid: false, needsUpgrade: false as const }
  return {
    valid: true,
    needsUpgrade: true as const,
    upgradedHash: await hashPin(pin, salt),
  }
}

export function createSalt() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}
