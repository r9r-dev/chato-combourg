import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Register service worker with auto-update
// Check for updates every hour
registerSW({
  onRegisteredSW(_swUrl, r) {
    if (r) {
      setInterval(() => {
        r.update()
      }, 60 * 60 * 1000) // Check every hour
    }
  },
  onOfflineReady() {
    console.log('App ready for offline use')
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
