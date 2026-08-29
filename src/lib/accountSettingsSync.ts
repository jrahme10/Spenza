import { SpenzaData, defaultCategories } from './db'
import { localRepository } from './repository'
import { getSupabaseClient, getSupabaseUserId } from './supabaseClient'

type SyncedSecurity = {
  enabled: boolean
  pinHash?: string
  salt?: string
  timeoutMinutes: number
}

type AccountSettingsPayload = {
  categories: string[]
  usdToLbpRate: number
  security: SyncedSecurity
  notificationReadIds: string[]
  notificationDismissedIds: string[]
}

type SettingsRow = {
  payload: AccountSettingsPayload | null
  changed_at: string
}

const META_FINGERPRINT = 'spenza-account-settings-fingerprint-v1'
const META_CHANGED_AT = 'spenza-account-settings-changed-at-v1'

function storageGet(key: string) {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function storageSet(key: string, value: string) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, value)
  } catch {}
}

function normalizeCategories(value: unknown) {
  const source = Array.isArray(value) ? value : defaultCategories
  const map = new Map<string, string>()
  for (const item of source) {
    const name = String(item || '').trim()
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name)
  }
  return [...map.values()]
}

function payloadFromData(data: SpenzaData): AccountSettingsPayload {
  return {
    categories: normalizeCategories(data.categories),
    usdToLbpRate: Number(data.usdToLbpRate) > 0 ? Number(data.usdToLbpRate) : 89500,
    security: {
      enabled: !!data.security?.enabled,
      pinHash: data.security?.pinHash,
      salt: data.security?.salt,
      timeoutMinutes: Number(data.security?.timeoutMinutes) || 0,
    },
    notificationReadIds: [...new Set(data.notificationReadIds || [])].sort(),
    notificationDismissedIds: [...new Set(data.notificationDismissedIds || [])].sort(),
  }
}

function normalizePayload(value: unknown, fallback: SpenzaData): AccountSettingsPayload {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<AccountSettingsPayload>
  const security = (
    raw.security && typeof raw.security === 'object' ? raw.security : {}
  ) as Partial<SyncedSecurity>
  return {
    categories: normalizeCategories(raw.categories ?? fallback.categories),
    usdToLbpRate:
      Number(raw.usdToLbpRate) > 0 ? Number(raw.usdToLbpRate) : fallback.usdToLbpRate || 89500,
    security: {
      enabled: security.enabled ?? fallback.security.enabled,
      pinHash: security.pinHash,
      salt: security.salt,
      timeoutMinutes: Number(security.timeoutMinutes ?? fallback.security.timeoutMinutes) || 0,
    },
    notificationReadIds: Array.isArray(raw.notificationReadIds)
      ? [...new Set(raw.notificationReadIds.map(String))].sort()
      : fallback.notificationReadIds,
    notificationDismissedIds: Array.isArray(raw.notificationDismissedIds)
      ? [...new Set(raw.notificationDismissedIds.map(String))].sort()
      : fallback.notificationDismissedIds,
  }
}

function fingerprint(payload: AccountSettingsPayload) {
  return JSON.stringify(payload)
}

function applyPayload(data: SpenzaData, payload: AccountSettingsPayload): SpenzaData {
  return {
    ...data,
    categories: payload.categories,
    usdToLbpRate: payload.usdToLbpRate,
    security: {
      ...data.security,
      enabled: payload.security.enabled,
      pinHash: payload.security.pinHash,
      salt: payload.security.salt,
      timeoutMinutes: payload.security.timeoutMinutes,
      // Biometrics remain device-specific because the credential is registered locally.
      biometricEnabled: data.security?.biometricEnabled ?? false,
      biometricCredentialId: data.security?.biometricCredentialId,
    },
    notificationReadIds: payload.notificationReadIds,
    notificationDismissedIds: payload.notificationDismissedIds,
  }
}

function remember(payload: AccountSettingsPayload, changedAt: string) {
  storageSet(META_FINGERPRINT, fingerprint(payload))
  storageSet(META_CHANGED_AT, changedAt)
  storageSet('spenza-usd-to-lbp-rate', String(payload.usdToLbpRate))
}

export async function syncAccountSettings(input?: SpenzaData): Promise<SpenzaData> {
  const supabase = getSupabaseClient()
  if (!supabase) return input ?? localRepository.getSnapshot()
  const userId = await getSupabaseUserId()
  if (!userId) return input ?? localRepository.getSnapshot()

  let data = input ?? (await localRepository.getSnapshot())
  const localPayload = payloadFromData(data)
  const localFingerprint = fingerprint(localPayload)
  const previousFingerprint = storageGet(META_FINGERPRINT)
  const previousChangedAt = storageGet(META_CHANGED_AT)

  const { data: row, error } = await supabase
    .from('spenza_account_settings')
    .select('payload,changed_at')
    .eq('owner_id', userId)
    .maybeSingle<SettingsRow>()
  if (error) throw error

  if (!row) {
    const changedAt = new Date().toISOString()
    const { error: upsertError } = await supabase
      .from('spenza_account_settings')
      .upsert(
        { owner_id: userId, payload: localPayload, changed_at: changedAt },
        { onConflict: 'owner_id' },
      )
    if (upsertError) throw upsertError
    remember(localPayload, changedAt)
    return data
  }

  const remotePayload = normalizePayload(row.payload, data)
  const remoteFingerprint = fingerprint(remotePayload)

  // First sync on this device: existing cloud settings are the source of truth.
  if (previousFingerprint === null) {
    if (remoteFingerprint !== localFingerprint) {
      data = applyPayload(data, remotePayload)
      await localRepository.replaceSnapshot(data)
    }
    remember(remotePayload, row.changed_at)
    return data
  }

  const localChanged = previousFingerprint !== localFingerprint
  const remoteChanged =
    remoteFingerprint !== previousFingerprint &&
    (!previousChangedAt || row.changed_at > previousChangedAt)

  if (localChanged) {
    const changedAt = new Date().toISOString()
    const { error: upsertError } = await supabase
      .from('spenza_account_settings')
      .upsert(
        { owner_id: userId, payload: localPayload, changed_at: changedAt },
        { onConflict: 'owner_id' },
      )
    if (upsertError) throw upsertError
    remember(localPayload, changedAt)
    return data
  }

  if (remoteChanged || remoteFingerprint !== localFingerprint) {
    data = applyPayload(data, remotePayload)
    await localRepository.replaceSnapshot(data)
    remember(remotePayload, row.changed_at)
    return data
  }

  remember(localPayload, row.changed_at)
  return data
}
