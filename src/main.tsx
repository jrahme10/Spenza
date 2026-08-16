import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './components/ThemeControl'
import { initDynamicGreeting } from './dynamic-greeting'
import './styles.css'
import './transaction-polish.css'
import './exchange.css'
import './backup.css'
import './spenza-design.css'
import './theme-settings.css'
import './spenza-layout.css'
import './bills.css'
import './reset-danger.css'
import './center-add.css'
import './mobile-safe.css'
import './security-notifications.css'
import { registerPwa } from './lib/pwa'
import { syncSupabaseIfAuthenticated } from './lib/supabaseSync'

async function bootstrap(){
  initTheme()
  // Cloud sync is optional. Missing config, signed-out users, or network failures
  // never prevent the local IndexedDB app from starting.
  await syncSupabaseIfAuthenticated().catch(()=>undefined)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  initDynamicGreeting()
  registerPwa()
}

void bootstrap()
