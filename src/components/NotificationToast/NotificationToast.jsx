import { useState, useEffect, useRef } from 'react';
import { X, Bell, AlarmClock, Clock } from 'lucide-react';
import { playAlarm, stopAlarm } from '../../services/alarmSounds';
import { startAlarm, stopAlarmAudio, isAlarmActive } from '../../services/backgroundAudio';
import { snoozeNotification, acknowledgeNotification } from '../../services/notifications';
import './NotificationToast.css';

export default function NotificationToast() {
  const [notifications, setNotifications] = useState([]);
  const alarmHandles = useRef(new Map());

  useEffect(() => {
    const handleNotification = (event) => {
      const { title, body, soundType, requireInteraction } = event.detail;
      const id = Date.now();

      console.log('[NotificationToast] Received notification:', title);

      // Add notification to stack
      setNotifications((prev) => [...prev, {
        id,
        title,
        body,
        soundType: soundType || 'default',
        persistent: requireInteraction !== false,
        createdAt: Date.now(),
      }]);

      // Play alarm sound using BOTH systems for maximum reliability:
      // 1. Background Audio (<audio> element) — persists when screen locked
      // 2. Web Audio API — immediate, works when app is in foreground

      // System 1: Background audio alarm (persists in background on iOS)
      startAlarm(soundType || 'default', 80, (action) => {
        // This callback fires when user interacts via lock screen media controls
        console.log('[NotificationToast] Lock screen action:', action);
        if (action === 'snooze') {
          handleSnoozeById(id, title, body, soundType);
        } else {
          dismissNotification(id);
        }
      }).catch(e => {
        console.log('[NotificationToast] Background audio alarm failed:', e);
      });

      // System 2: Web Audio API alarm (works when app is in foreground)
      try {
        const handle = playAlarm(soundType || 'default', 70, requireInteraction !== false);
        alarmHandles.current.set(id, handle);

        // Auto-stop Web Audio after 30 seconds (background audio keeps going)
        setTimeout(() => {
          const h = alarmHandles.current.get(id);
          if (h) {
            h.stop();
            alarmHandles.current.delete(id);
          }
        }, 30000);
      } catch (e) {
        console.log('[NotificationToast] Web Audio alarm failed:', e);
      }

      // Auto-remove non-persistent notifications after 10 seconds
      // But persistent ones stay until dismissed (no auto-dismiss!)
      if (requireInteraction === false) {
        setTimeout(() => {
          dismissNotification(id);
        }, 10000);
      }
      // NOTE: Persistent alarms NO LONGER auto-dismiss after 60 seconds.
      // They ring until the user taps Snooze or Dismiss.
    };

    window.addEventListener('app-notification', handleNotification);
    return () => window.removeEventListener('app-notification', handleNotification);
  }, []);

  const dismissNotification = (id) => {
    // Stop Web Audio alarm for this notification
    const handle = alarmHandles.current.get(id);
    if (handle) {
      handle.stop();
      alarmHandles.current.delete(id);
    }

    // Stop background audio alarm
    stopAlarmAudio();

    // Acknowledge for escalation tracking
    acknowledgeNotification(id);

    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSnoozeById = (id, title, body, soundType) => {
    // Stop all alarms
    const handle = alarmHandles.current.get(id);
    if (handle) {
      handle.stop();
      alarmHandles.current.delete(id);
    }
    stopAlarmAudio();

    acknowledgeNotification(id);
    snoozeNotification(title, body || '', { soundType });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSnooze = (notification) => {
    handleSnoozeById(
      notification.id,
      notification.title,
      notification.body,
      notification.soundType
    );
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
