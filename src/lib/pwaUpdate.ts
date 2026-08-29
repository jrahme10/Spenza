export type PwaUpdateAction = { apply: () => void }

type Listener = (update: PwaUpdateAction | null) => void
let current: PwaUpdateAction | null = null
const listeners = new Set<Listener>()

export function setPwaUpdateAvailable(update: PwaUpdateAction) {
  current = update
  for (const listener of listeners) listener(current)
}

export function clearPwaUpdateAvailable() {
  current = null
  for (const listener of listeners) listener(current)
}

export function getPwaUpdateAvailable() {
  return current
}

export function subscribePwaUpdate(listener: Listener) {
  listeners.add(listener)
  listener(current)
  return () => {
    listeners.delete(listener)
  }
}
