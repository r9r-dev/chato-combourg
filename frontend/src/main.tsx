import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'

// Register service worker with update prompt
const updateSW = registerSW({
  onNeedRefresh() {
    // New version available - prompt user to reload
    if (confirm('Nouvelle version disponible. Recharger maintenant ?')) {
      updateSW(true)
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
