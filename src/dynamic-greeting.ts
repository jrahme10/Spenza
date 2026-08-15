const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 22) return 'Good evening'
  return 'Good night'
}

const updateGreeting = () => {
  const header = document.querySelector('.refHeader h1')
  if (header) {
    const next = `${getGreeting()}! 👋`
    if (header.textContent !== next) header.textContent = next
  }
}

export function initDynamicGreeting() {
  updateGreeting()
  const observer = new MutationObserver(updateGreeting)
  observer.observe(document.documentElement, { childList: true, subtree: true })
  const timer = window.setInterval(updateGreeting, 60_000)
  window.addEventListener('focus', updateGreeting)
  document.addEventListener('visibilitychange', updateGreeting)
  return () => {
    observer.disconnect()
    window.clearInterval(timer)
    window.removeEventListener('focus', updateGreeting)
    document.removeEventListener('visibilitychange', updateGreeting)
  }
}
