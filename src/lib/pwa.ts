export function registerPwa() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' })
      let refreshing = false
      let promptedWorker: ServiceWorker | null = null

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })

      const announceUpdate = (worker: ServiceWorker) => {
        if (promptedWorker === worker) return
        promptedWorker = worker
        window.dispatchEvent(new CustomEvent('spenza-pwa-update-available', {
          detail: {
            apply: () => worker.postMessage({ type: 'SKIP_WAITING' })
          }
        }))
      }

      if (registration.waiting && navigator.serviceWorker.controller) announceUpdate(registration.waiting)

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) announceUpdate(worker)
        })
      })

      // Check immediately whenever the app is opened, periodically while open,
      // and whenever it returns to the foreground.
      await registration.update().catch(() => undefined)
      const checkForUpdate = () => registration.update().catch(() => undefined)
      window.setInterval(checkForUpdate, 5 * 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate()
      })
      window.addEventListener('focus', checkForUpdate)
    } catch {
      // PWA support should never prevent Spenza from opening.
    }
  })
}
