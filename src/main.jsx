import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { unlockAudio } from './services/alarmSounds'
import { registerServiceWorker } from './services/notifications'

// Register service worker for push notifications and offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker();
  });
}

// iOS audio unlock: first user interaction enables Web Audio playback
const handleFirstInteraction = () => {
  unlockAudio();
  document.removeEventListener('touchstart', handleFirstInteraction);
  document.removeEventListener('click', handleFirstInteraction);
};
document.addEventListener('touchstart', handleFirstInteraction, { once: true });
document.addEventListener('click', handleFirstInteraction, { once: true });

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
