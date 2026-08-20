export function registerPwa() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      let refreshing = false

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })

      const activateWaitingWorker = () => {
        if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      activateWaitingWorker()
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) activateWaitingWorker()
        })
      })

      // Check immediately whenever the app is opened, and again when it returns to foreground.
      await registration.update().catch(() => undefined)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => undefined)
      })
    } catch {
      // PWA support should never prevent Spenza from opening.
    }
  })
}
