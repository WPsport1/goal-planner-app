import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { unlockAudio } from './services/alarmSounds'
import { startKeepAlive } from './services/backgroundAudio'
import { initializeNotifications } from './services/notifications'

// Initialize notification system (registers SW + starts check loop)
window.addEventListener('load', () => {
  initializeNotifications().then(result => {
    console.log('[Main] Notifications initialized:', result);
  }).catch(err => {
    console.warn('[Main] Notification init failed:', err);
  });
});

// iOS audio unlock + background audio keepalive on first user interaction
// Both MUST happen inside a user gesture for iOS to allow audio playback
const handleFirstInteraction = () => {
  console.log('[Main] First user interaction — unlocking audio + starting keepalive');

  // Unlock Web Audio API (for in-app alarm sounds)
  unlockAudio();

  // Start background audio keepalive (for persistent alarm when screen locked)
  startKeepAlive();

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
