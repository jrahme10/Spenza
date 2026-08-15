import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import BackupManager from './components/BackupManager'
import './styles.css'
import './transaction-polish.css'
import './exchange.css'
import './backup.css'
import { registerPwa } from './lib/pwa'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <BackupManager />
  </React.StrictMode>,
)

registerPwa()
