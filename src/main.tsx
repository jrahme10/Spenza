import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initTheme } from './components/ThemeControl'
import './styles.css'
import './transaction-polish.css'
import './exchange.css'
import './backup.css'
import './spenza-design.css'
import './theme-settings.css'
import './spenza-layout.css'
import { registerPwa } from './lib/pwa'

initTheme()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

registerPwa()
