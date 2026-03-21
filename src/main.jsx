import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { unlockAudio } from './services/alarmSounds'
import { initializeNotifications } from './services/notifications'

// Initialize notification system (registers SW + starts check loop)
window.addEventListener('load', () => {
  initializeNotifications().then(result => {
    console.log('[Main] Notifications initialized:', result);
  }).catch(err => {
    console.warn('[Main] Notification init failed:', err);
  });
});

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
