import { useState, useEffect } from 'react';
import { X, Bell, Volume2 } from 'lucide-react';
import './NotificationToast.css';

export default function NotificationToast() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const handleNotification = (event) => {
      const { title, body } = event.detail;
      const id = Date.now();

      // Add notification to stack
      setNotifications((prev) => [...prev, { id, title, body }]);

      // Play sound
      try {
        // Create an audio context to ensure sound plays
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        gainNode.gain.value = 0.3;

        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioContext.close();
        }, 200);

        // Second beep
        setTimeout(() => {
          const ctx2 = new (window.AudioContext || window.webkitAudioContext)();
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx2.destination);
          osc2.frequency.value = 1000;
          osc2.type = 'sine';
          gain2.gain.value = 0.3;
          osc2.start();
          setTimeout(() => {
            osc2.stop();
            ctx2.close();
          }, 200);
        }, 250);
      } catch (e) {
        console.log('Could not play notification sound:', e);
      }

      // Auto-remove after 10 seconds (but stays visible for important notifications)
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, 10000);
    };

    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);

  const dismissNotification = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="notification-toast-container">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification-toast">
          <div className="toast-icon">
            <Bell size={24} />
          </div>
          <div className="toast-content">
            <h4>{notification.title}</h4>
            {notification.body && <p>{notification.body}</p>}
          </div>
          <button
            className="toast-close"
            onClick={() => dismissNotification(notification.id)}
          >
            <X size={18} />
          </button>
        </div>
      ))}
    </div>
  );
}
