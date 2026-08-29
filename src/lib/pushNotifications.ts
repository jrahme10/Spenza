import { getSupabaseClient, getSupabaseUserId } from './supabaseClient'

const publicKey = () =>
  String((import.meta.env as Record<string, string | undefined>).VITE_VAPID_PUBLIC_KEY || '').trim()
const urlBase64ToUint8Array = (value: string) => {
  const padding = '='.repeat((4 - (value.length % 4)) % 4)
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}
export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window
export const pushConfigured = () => !!publicKey()
export const notificationPermission = () =>
  pushSupported() ? Notification.permission : 'unsupported'
export async function getPushSubscription() {
  if (!pushSupported()) return null
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}
export async function enableBillPush() {
  if (!pushSupported())
    throw new Error('Push notifications are not supported on this device/browser.')
  const vapidPublicKey = publicKey()
  if (!vapidPublicKey) throw new Error('Bill notifications are not configured yet.')
  const ownerId = await getSupabaseUserId()
  if (!ownerId) throw new Error('Sign in to Cloud Sync before enabling bill notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    throw new Error(
      permission === 'denied'
        ? 'Notifications are blocked. Enable them for Spenza in your device settings.'
        : 'Notification permission was not granted.',
    )
  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription)
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
    throw new Error('The browser returned an incomplete push subscription.')
  const supabase = getSupabaseClient()
  if (!supabase) throw new Error('Cloud Sync is not configured.')
  const { error } = await supabase
    .from('spenza_push_subscriptions')
    .upsert(
      {
        owner_id: ownerId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth_key: json.keys.auth,
        device_name: navigator.userAgent,
        enabled: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'owner_id,endpoint' },
    )
  if (error) throw error
  return subscription
}
export async function disableBillPush() {
  const subscription = await getPushSubscription()
  const supabase = getSupabaseClient()
  const ownerId = await getSupabaseUserId()
  if (subscription && supabase && ownerId) {
    const { error } = await supabase
      .from('spenza_push_subscriptions')
      .delete()
      .eq('owner_id', ownerId)
      .eq('endpoint', subscription.endpoint)
    if (error) throw error
  }
  if (subscription) await subscription.unsubscribe()
}
