import { useState, useEffect, useRef } from 'react';
import { X, Bell, AlarmClock, Clock } from 'lucide-react';
import { playAlarm, stopAlarm } from '../../services/alarmSounds';
import { snoozeNotification, acknowledgeNotification } from '../../services/notifications';
import './NotificationToast.css';

export default function NotificationToast() {
  const [notifications, setNotifications] = useState([]);
  const alarmHandles = useRef(new Map());

  useEffect(() => {
    const handleNotification = (event) => {
      const { title, body, soundType, requireInteraction } = event.detail;
      const id = Date.now();

      // Add notification to stack
      setNotifications((prev) => [...prev, {
        id,
        title,
        body,
        soundType: soundType || 'default',
        persistent: requireInteraction !== false,
        createdAt: Date.now(),
      }]);

      // Play alarm sound (looping for persistent alerts)
      try {
        const handle = playAlarm(soundType || 'default', 70, requireInteraction !== false);
        alarmHandles.current.set(id, handle);

        // Auto-stop looping sound after 30 seconds to prevent endless alarm
        setTimeout(() => {
          const h = alarmHandles.current.get(id);
          if (h) {
            h.stop();
            alarmHandles.current.delete(id);
          }
        }, 30000);
      } catch (e) {
        console.log('[NotificationToast] Could not play sound:', e);
      }

      // Auto-remove non-persistent notifications after 10 seconds
      if (requireInteraction === false) {
        setTimeout(() => {
          dismissNotification(id);
        }, 10000);
      } else {
        // Even persistent ones auto-dismiss after 60 seconds
        setTimeout(() => {
          dismissNotification(id);
        }, 60000);
      }
    };

    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);

  const dismissNotification = (id) => {
    // Stop the alarm sound for this notification
    const handle = alarmHandles.current.get(id);
    if (handle) {
      handle.stop();
      alarmHandles.current.delete(id);
    }

    // Acknowledge for escalation tracking
    acknowledgeNotification(id);

    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSnooze = (notification) => {
    // Stop the alarm sound
    const handle = alarmHandles.current.get(notification.id);
    if (handle) {
      handle.stop();
      alarmHandles.current.delete(notification.id);
    }

    // Acknowledge for escalation tracking
    acknowledgeNotification(notification.id);

    // Schedule snooze
    snoozeNotification(
      notification.title,
      notification.body || '',
      { soundType: notification.soundType }
    );

    // Remove from display
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
  };

  if (notifications.length === 0) return null;

  return (
    <div className="notification-toast-container">
      {notifications.map((notification) => (
        <div key={notification.id} className="notification-toast">
          <div className="toast-icon">
            <AlarmClock size={24} />
          </div>
          <div className="toast-content">
            <h4>{notification.title}</h4>
            {notification.body && <p>{notification.body}</p>}
            <div className="toast-actions">
              <button
                className="toast-snooze-btn"
                onClick={() => handleSnooze(notification)}
              >
                <Clock size={14} />
                Snooze
              </button>
              <button
                className="toast-dismiss-btn"
                onClick={() => dismissNotification(notification.id)}
              >
                Dismiss
              </button>
            </div>
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
