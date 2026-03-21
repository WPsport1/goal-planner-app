/**
 * Notification & Alarm Service
 *
 * This service handles:
 * - In-app toast notifications (works on ALL devices, no permission needed)
 * - Native push notifications (when supported + permission granted)
 * - Alarm sound playback via Web Audio (alarmSounds.js)
 * - Scheduled notification checking every 15 seconds
 * - Recurring notification rescheduling
 * - Quiet hours enforcement
 * - Escalation (re-alert if not acknowledged)
 * - Snooze functionality
 *
 * KEY DESIGN: The in-app toast + alarm sound system works independently
 * of native Notification API support. Even on iOS Safari without PWA,
 * the alarm sound and in-app toast will fire as long as the app is open.
 */

import { playAlarm, stopAlarm } from './alarmSounds';

// ============================================
// NATIVE NOTIFICATION SUPPORT CHECKS
// ============================================

// Check if native browser notifications are supported
export const isNotificationSupported = () => {
  return 'Notification' in window;
};

// Get current permission status
export const getPermissionStatus = () => {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission; // 'granted', 'denied', or 'default'
};

// Request notification permission
export const requestPermission = async () => {
  if (!isNotificationSupported()) {
    console.log('[Notifications] Native notifications not supported — in-app alerts still work');
    return { success: false, error: 'Native notifications not supported, but in-app alerts work' };
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

// ============================================
// SETTINGS
// ============================================

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
  return currentMinutes >= startMinutes || currentMinutes < endMinutes;
}

// ============================================
// SHOW NOTIFICATION (multi-layer)
// ============================================

/**
 * Show a notification using all available methods:
 * 1. In-app toast (always works — custom DOM event)
 * 2. Native Notification API (desktop browsers with permission)
 * 3. Service Worker notification (iOS PWA with permission)
 */
export const showLocalNotification = (title, options = {}) => {
  const body = options.body || '';

  console.log('[Notifications] Firing notification:', title, body);

  // LAYER 1: Always dispatch in-app event (NotificationToast listens for this)
  // This works on ALL devices — no permission needed
  try {
    window.dispatchEvent(new CustomEvent('app-notification', {
      detail: {
        title,
        body,
        options,
        soundType: options.soundType || 'default',
        requireInteraction: options.requireInteraction !== false,
      }
    }));
    console.log('[Notifications] In-app toast dispatched');
  } catch (e) {
    console.error('[Notifications] Failed to dispatch in-app event:', e);
  }

  // LAYER 2: Try native Notification API (works on desktop, Android, some iOS)
  if (isNotificationSupported() && getPermissionStatus() === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: '/vite.svg',
        badge: '/vite.svg',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: options.requireInteraction !== false,
        tag: options.tag || 'goal-planner-' + Date.now(),
        renotify: true,
        silent: false,
      });
      console.log('[Notifications] Native notification shown');
      return notification;
    } catch (error) {
      console.log('[Notifications] Native notification failed (expected on iOS):', error.message);
    }
  }

  // LAYER 3: Try via service worker (needed for iOS PWA)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
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
      console.log('[Notifications] SW notification shown');
    }).catch(err => console.log('[Notifications] SW notification failed:', err.message));
  }
};

// ============================================
// SOUND CONTROLS
// ============================================

export const playNotificationSound = (soundType = 'default', volume = 70, loop = false) => {
  const settings = getSettings();
  const vol = settings.soundVolume || volume;
  console.log('[Notifications] Playing sound:', soundType, 'volume:', vol);
  return playAlarm(soundType, vol, loop);
};

export const stopNotificationSound = () => {
  stopAlarm();
};

// ============================================
// SCHEDULING
// ============================================

export const scheduleNotification = (notification) => {
  const scheduled = getScheduledNotifications();
  const newNotification = {
    id: Date.now().toString() + '_' + Math.random().toString(36).substr(2, 4),
    ...notification,
    createdAt: new Date().toISOString(),
  };

  scheduled.push(newNotification);
  localStorage.setItem('scheduledNotifications', JSON.stringify(scheduled));

  console.log('[Notifications] Scheduled:', newNotification.title, 'for', newNotification.triggerAt);
  return newNotification;
};

export const getScheduledNotifications = () => {
  try {
    return JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
  } catch {
    return [];
  }
};

export const removeScheduledNotification = (id) => {
  const scheduled = getScheduledNotifications().filter(n => n.id !== id);
  localStorage.setItem('scheduledNotifications', JSON.stringify(scheduled));
};

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

  const scheduled = getScheduledNotifications();
  const updated = scheduled.map(n => {
    if (n.id === notification.id) {
      return { ...n, triggerAt: next.toISOString(), triggered: false };
    }
    return n;
  });
  localStorage.setItem('scheduledNotifications', JSON.stringify(updated));
}

// ============================================
// ESCALATION TRACKING
// ============================================

const unacknowledged = new Map();

export const acknowledgeNotification = (id) => {
  unacknowledged.delete(id);
};

// ============================================
// DUE NOTIFICATION CHECKER (runs every 15 seconds)
// ============================================

export const checkDueNotifications = () => {
  if (isQuietHours()) return;

  const now = new Date();
  const scheduled = getScheduledNotifications();
  const settings = getSettings();

  let firedCount = 0;

  scheduled.forEach(notification => {
    const triggerTime = new Date(notification.triggerAt);

    if (triggerTime <= now && !notification.triggered) {
      firedCount++;

      // Show the in-app toast (NotificationToast handles its own sound)
      showLocalNotification(notification.title, {
        body: notification.body,
        tag: notification.id,
        data: notification.data,
        soundType: notification.soundType || 'default',
        requireInteraction: true,
      });

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

  if (firedCount > 0) {
    console.log(`[Notifications] Fired ${firedCount} notification(s)`);
  }

  // Escalation check: re-alert for unacknowledged notifications
  if (settings.escalationEnabled) {
    const escalateAfterMs = (settings.escalationAfterMinutes || 5) * 60 * 1000;

    unacknowledged.forEach((notif, id) => {
      if (Date.now() - notif.firedAt > escalateAfterMs) {
        showLocalNotification(`${notif.title}`, {
          body: `REMINDER: ${notif.body || 'You have an unacknowledged alert!'}`,
          tag: `escalation-${id}`,
          soundType: settings.escalationSound || 'urgent',
          requireInteraction: true,
        });

        unacknowledged.set(id, { ...notif, firedAt: Date.now() });
      }
    });
  }
};

// ============================================
// SNOOZE
// ============================================

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

  console.log(`[Notifications] Snoozed "${title}" for ${snoozeMins} minutes`);
};

// ============================================
// NOTIFICATION TYPES
// ============================================

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

// ============================================
// REMINDER FACTORY FUNCTIONS
// ============================================

/**
 * Create a task reminder notification.
 * IMPORTANT: Uses local timezone for date parsing to avoid UTC offset bugs.
 */
export const createTaskReminder = (task, minutesBefore = 15) => {
  if (!task.scheduledDate || !task.startTime) {
    console.log('[Notifications] Skipping reminder — no scheduledDate or startTime:', task.title);
    return null;
  }

  // Parse the scheduled date in LOCAL timezone (not UTC)
  // task.scheduledDate could be ISO string like "2026-03-20T14:00:00.000Z"
  // or a date string like "2026-03-20"
  const dateStr = task.scheduledDate;
  let taskDate;

  if (dateStr.includes('T')) {
    // It's an ISO string — parse as a Date object to get the local date parts
    const parsed = new Date(dateStr);
    const year = parsed.getFullYear();
    const month = parsed.getMonth();
    const day = parsed.getDate();
    const [hours, minutes] = task.startTime.split(':').map(Number);
    taskDate = new Date(year, month, day, hours, minutes, 0, 0);
  } else {
    // Simple date string like "2026-03-20"
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = task.startTime.split(':').map(Number);
    taskDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
  }

  const triggerTime = new Date(taskDate.getTime() - minutesBefore * 60 * 1000);

  if (triggerTime <= new Date()) {
    console.log('[Notifications] Skipping reminder — already past:', task.title, triggerTime.toLocaleString());
    return null;
  }

  console.log('[Notifications] Scheduling reminder for:', task.title, 'at', triggerTime.toLocaleString());

  return scheduleNotification({
    type: NotificationType.TASK_REMINDER,
    title: `Reminder: ${task.title}`,
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

// ============================================
// INITIALIZATION
// ============================================

let isInitialized = false;

/**
 * Initialize the notification system.
 * ALWAYS starts the check loop — even without native notification support.
 * The in-app toast + alarm sound works on ALL devices.
 */
export const initializeNotifications = async () => {
  if (isInitialized) {
    console.log('[Notifications] Already initialized, skipping');
    return { success: true, alreadyInitialized: true };
  }

  console.log('[Notifications] Initializing...');
  console.log('[Notifications] Native Notification API:', isNotificationSupported() ? 'YES' : 'NO');
  console.log('[Notifications] Permission:', isNotificationSupported() ? Notification.permission : 'N/A');
  console.log('[Notifications] Service Worker:', 'serviceWorker' in navigator ? 'YES' : 'NO');

  // Try to register service worker (for background support + iOS PWA)
  if ('serviceWorker' in navigator) {
    const swResult = await registerServiceWorker();
    if (swResult.success) {
      console.log('[Notifications] Service Worker ready');
    }

    // Listen for messages from service worker
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
  // This is the CORE of the system — runs regardless of native notification support
  setInterval(() => {
    checkDueNotifications();
  }, 15000);

  // Check immediately on init
  checkDueNotifications();

  isInitialized = true;

  const scheduledCount = getScheduledNotifications().length;
  console.log(`[Notifications] System initialized — ${scheduledCount} notifications scheduled, checking every 15s`);

  return { success: true };
};

// ============================================
// EXPORTS
// ============================================

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
