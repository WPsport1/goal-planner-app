/**
 * Push Notification Service
 *
 * This service handles:
 * - Permission requests
 * - Service worker registration
 * - Local notification scheduling & triggering
 * - Sound playback via Web Audio (alarmSounds.js)
 * - Recurring notification rescheduling
 * - Quiet hours enforcement
 * - Escalation (re-alert if not acknowledged)
 */

import { playAlarm, stopAlarm } from './alarmSounds';

// Check if notifications are supported
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator;
};

// Get current permission status
export const getPermissionStatus = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission; // 'granted', 'denied', or 'default'
};

// Request notification permission
export const requestPermission = async () => {
  if (!isNotificationSupported()) {
    return { success: false, error: 'Notifications not supported on this device/browser' };
  }

  try {
    const permission = await Notification.requestPermission();
    return {
      success: permission === 'granted',
      permission,
      error: permission === 'denied' ? 'Permission denied by user' : null
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Register service worker
export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    return { success: false, error: 'Service workers not supported' };
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    console.log('[Notifications] Service Worker registered:', registration);
    return { success: true, registration };
  } catch (error) {
    console.error('[Notifications] Service Worker registration failed:', error);
    return { success: false, error: error.message };
  }
};

// Get notification settings from localStorage
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('notificationSettings') || '{}');
  } catch {
    return {};
  }
}

// Check if currently in quiet hours
function isQuietHours() {
  const settings = getSettings();
  if (!settings.quietHoursEnabled) return false;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = (settings.quietHoursStart || '22:00').split(':').map(Number);
  const [endH, endM] = (settings.quietHoursEnd || '07:00').split(':').map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
  // Wraps midnight (e.g., 22:00 - 07:00)
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// Show a local notification (for when app is open)
export const showLocalNotification = (title, options = {}) => {
  const body = options.body || '';

  // Always dispatch in-app event (NotificationToast listens for this)
  window.dispatchEvent(new CustomEvent('app-notification', {
    detail: {
      title,
      body,
      options,
      soundType: options.soundType || 'default',
      requireInteraction: options.requireInteraction !== false,
    }
  }));

  // Method 1: Try native Notification API
  if (getPermissionStatus() === 'granted') {
    const defaultOptions = {
      icon: '/vite.svg',
      badge: '/vite.svg',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: options.requireInteraction !== false,
      tag: options.tag || 'goal-planner-notification-' + Date.now(),
      renotify: true,
      silent: false,
      ...options
    };

    try {
      const notification = new Notification(title, defaultOptions);
      return notification;
    } catch (error) {
      console.error('[Notifications] Native notification failed:', error);
    }
  }

  // Method 2: Try via service worker (needed for iOS PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag: 'goal-planner-sw-' + Date.now(),
        renotify: true,
        actions: [
          { action: 'open', title: 'Open' },
          { action: 'snooze', title: 'Snooze' },
        ],
      });
    }).catch(err => console.error('[Notifications] SW notification failed:', err));
  }
};

// Play notification sound using Web Audio synthesizer
export const playNotificationSound = (soundType = 'default', volume = 70, loop = false) => {
  const settings = getSettings();
  const vol = settings.soundVolume || volume;
  return playAlarm(soundType, vol, loop);
};

// Stop currently playing notification sound
export const stopNotificationSound = () => {
  stopAlarm();
};

// Schedule a notification (stores in localStorage, checked periodically)
export const scheduleNotification = (notification) => {
  const scheduled = getScheduledNotifications();
  const newNotification = {
    id: Date.now().toString(),
    ...notification,
    createdAt: new Date().toISOString(),
  };

  scheduled.push(newNotification);
  localStorage.setItem('scheduledNotifications', JSON.stringify(scheduled));

  return newNotification;
};

// Get all scheduled notifications
export const getScheduledNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
  } catch {
    return [];
  }
};

// Remove a scheduled notification
export const removeScheduledNotification = (id) => {
  const scheduled = getScheduledNotifications().filter(n => n.id !== id);
  localStorage.setItem('scheduledNotifications', JSON.stringify(scheduled));
};

// Clear all scheduled notifications
export const clearScheduledNotifications = () => {
  localStorage.setItem('scheduledNotifications', JSON.stringify([]));
};

// Reschedule a recurring notification for its next occurrence
function rescheduleRecurring(notification) {
  const trigger = new Date(notification.triggerAt);
  let next;

  switch (notification.recurrenceType) {
    case 'daily':
      next = new Date(trigger);
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next = new Date(trigger);
      next.setDate(next.getDate() + 7);
      break;
    case 'weekdays': {
      next = new Date(trigger);
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      break;
    }
    case 'monthly':
      next = new Date(trigger);
      next.setMonth(next.getMonth() + 1);
      break;
    default:
      next = new Date(trigger);
      next.setDate(next.getDate() + 1);
  }

  // Update the notification in storage
  const scheduled = getScheduledNotifications();
  const updated = scheduled.map(n => {
    if (n.id === notification.id) {
      return { ...n, triggerAt: next.toISOString(), triggered: false };
    }
    return n;
  });
  localStorage.setItem('scheduledNotifications', JSON.stringify(updated));
}

// Track unacknowledged notifications for escalation
const unacknowledged = new Map();

// Acknowledge a notification (called from NotificationToast on dismiss/snooze)
export const acknowledgeNotification = (id) => {
  unacknowledged.delete(id);
};

// Check and trigger due notifications (called periodically)
export const checkDueNotifications = () => {
  if (isQuietHours()) return; // Respect quiet hours

  const now = new Date();
  const scheduled = getScheduledNotifications();
  const settings = getSettings();

  scheduled.forEach(notification => {
    const triggerTime = new Date(notification.triggerAt);

    if (triggerTime <= now && !notification.triggered) {
      // Trigger the notification
      showLocalNotification(notification.title, {
        body: notification.body,
        tag: notification.id,
        data: notification.data,
        soundType: notification.soundType || 'default',
        requireInteraction: true,
      });

      // Play sound if enabled
      if (notification.sound !== false) {
        playNotificationSound(notification.soundType || 'default');
      }

      // Track for escalation
      if (settings.escalationEnabled) {
        unacknowledged.set(notification.id, {
          ...notification,
          firedAt: Date.now(),
        });
      }

      // Handle recurring vs one-time
      if (notification.recurring) {
        rescheduleRecurring(notification);
      } else {
        removeScheduledNotification(notification.id);
      }
    }
  });

  // Escalation check: re-alert for unacknowledged notifications
  if (settings.escalationEnabled) {
    const escalateAfterMs = (settings.escalationAfterMinutes || 5) * 60 * 1000;

    unacknowledged.forEach((notif, id) => {
      if (Date.now() - notif.firedAt > escalateAfterMs) {
        // Escalate with urgent sound
        showLocalNotification(`${notif.title}`, {
          body: `REMINDER: ${notif.body || 'You have an unacknowledged alert!'}`,
          tag: `escalation-${id}`,
          soundType: settings.escalationSound || 'urgent',
          requireInteraction: true,
        });
        playNotificationSound(settings.escalationSound || 'urgent');

        // Reset timer so it escalates again if still not acknowledged
        unacknowledged.set(id, { ...notif, firedAt: Date.now() });
      }
    });
  }
};

// Snooze a notification (reschedule for N minutes from now)
export const snoozeNotification = (title, body, data = {}) => {
  const settings = getSettings();
  const snoozeMins = settings.snoozeDuration || 10;
  const snoozeTime = new Date(Date.now() + snoozeMins * 60 * 1000);

  scheduleNotification({
    type: 'snooze',
    title: `${title}`,
    body: `Snoozed: ${body}`,
    triggerAt: snoozeTime.toISOString(),
    sound: true,
    soundType: data.soundType || 'default',
    data,
  });

  console.log(`[Notifications] Snoozed for ${snoozeMins} minutes`);
};

// Notification types for the app
export const NotificationType = {
  TASK_REMINDER: 'task_reminder',
  HABIT_REMINDER: 'habit_reminder',
  MORNING_ROUTINE: 'morning_routine',
  NIGHT_ROUTINE: 'night_routine',
  REFLECTION_PROMPT: 'reflection_prompt',
  STREAK_ALERT: 'streak_alert',
  GOAL_DEADLINE: 'goal_deadline',
  CUSTOM: 'custom',
};

// Create a task reminder notification
export const createTaskReminder = (task, minutesBefore = 15) => {
  if (!task.scheduledDate || !task.startTime) return null;

  const taskDateTime = new Date(`${task.scheduledDate.split('T')[0]}T${task.startTime}`);
  const triggerTime = new Date(taskDateTime.getTime() - minutesBefore * 60 * 1000);

  if (triggerTime <= new Date()) return null; // Already past

  return scheduleNotification({
    type: NotificationType.TASK_REMINDER,
    title: `Task: ${task.title}`,
    body: `Starting in ${minutesBefore} minutes`,
    triggerAt: triggerTime.toISOString(),
    sound: true,
    soundType: task.priority === 'high' ? 'urgent' : 'default',
    data: { taskId: task.id },
  });
};

// Create a habit reminder
export const createHabitReminder = (habit, time) => {
  const today = new Date();
  const [hours, minutes] = time.split(':');
  const triggerTime = new Date(today);
  triggerTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  if (triggerTime <= new Date()) {
    triggerTime.setDate(triggerTime.getDate() + 1);
  }

  return scheduleNotification({
    type: NotificationType.HABIT_REMINDER,
    title: `Time for: ${habit.title}`,
    body: 'Keep your streak going!',
    triggerAt: triggerTime.toISOString(),
    sound: true,
    soundType: 'gentle',
    recurring: true,
    recurrenceType: 'daily',
    data: { habitId: habit.id },
  });
};

// Create morning routine reminder
export const createMorningRoutineReminder = (time) => {
  const today = new Date();
  const [hours, minutes] = time.split(':');
  const triggerTime = new Date(today);
  triggerTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  if (triggerTime <= new Date()) {
    triggerTime.setDate(triggerTime.getDate() + 1);
  }

  return scheduleNotification({
    type: NotificationType.MORNING_ROUTINE,
    title: 'Good Morning!',
    body: 'Time to start your morning routine',
    triggerAt: triggerTime.toISOString(),
    sound: true,
    soundType: 'gentle',
    recurring: true,
    recurrenceType: 'daily',
  });
};

// Create night routine reminder
export const createNightRoutineReminder = (time) => {
  const today = new Date();
  const [hours, minutes] = time.split(':');
  const triggerTime = new Date(today);
  triggerTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  if (triggerTime <= new Date()) {
    triggerTime.setDate(triggerTime.getDate() + 1);
  }

  return scheduleNotification({
    type: NotificationType.NIGHT_ROUTINE,
    title: 'Wind Down Time',
    body: 'Start your nighttime routine',
    triggerAt: triggerTime.toISOString(),
    sound: true,
    soundType: 'gentle',
    recurring: true,
    recurrenceType: 'daily',
  });
};

// Create reflection prompt
export const createReflectionReminder = (time) => {
  const today = new Date();
  const [hours, minutes] = time.split(':');
  const triggerTime = new Date(today);
  triggerTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

  if (triggerTime <= new Date()) {
    triggerTime.setDate(triggerTime.getDate() + 1);
  }

  return scheduleNotification({
    type: NotificationType.REFLECTION_PROMPT,
    title: 'Daily Reflection',
    body: 'Take a moment to reflect on your day',
    triggerAt: triggerTime.toISOString(),
    sound: true,
    soundType: 'gentle',
    recurring: true,
    recurrenceType: 'daily',
  });
};

// Track initialization to prevent duplicate intervals/listeners
let isInitialized = false;

// Initialize notification system
export const initializeNotifications = async () => {
  // Idempotent — safe to call multiple times
  if (isInitialized) {
    console.log('[Notifications] Already initialized, skipping');
    return { success: true, alreadyInitialized: true };
  }

  if (!isNotificationSupported()) {
    console.warn('[Notifications] Not supported');
    return { success: false, error: 'Not supported' };
  }

  // Register service worker
  const swResult = await registerServiceWorker();
  if (!swResult.success) {
    console.warn('[Notifications] Service worker registration failed:', swResult.error);
  }

  // Listen for snooze messages from service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'SCHEDULE_SNOOZE') {
        const { notification } = event.data;
        scheduleNotification(notification);
      }
      if (event.data?.type === 'CHECK_NOTIFICATIONS') {
        checkDueNotifications();
      }
    });
  }

  // Start checking for due notifications every 15 seconds
  setInterval(checkDueNotifications, 15000);

  // Check immediately
  checkDueNotifications();

  isInitialized = true;
  console.log('[Notifications] System initialized — checking every 15 seconds');

  return { success: true };
};

// Export everything for use
export default {
  isNotificationSupported,
  getPermissionStatus,
  requestPermission,
  registerServiceWorker,
  showLocalNotification,
  playNotificationSound,
  stopNotificationSound,
  scheduleNotification,
  getScheduledNotifications,
  removeScheduledNotification,
  clearScheduledNotifications,
  checkDueNotifications,
  snoozeNotification,
  acknowledgeNotification,
  createTaskReminder,
  createHabitReminder,
  createMorningRoutineReminder,
  createNightRoutineReminder,
  createReflectionReminder,
  initializeNotifications,
  NotificationType,
};
