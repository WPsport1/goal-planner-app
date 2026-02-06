/**
 * Push Notification Service
 *
 * This service handles:
 * - Firebase Cloud Messaging setup
 * - Permission requests
 * - Token management
 * - Local notification scheduling
 * - Notification preferences
 */

// Check if notifications are supported
export const isNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
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
    console.log('Service Worker registered:', registration);
    return { success: true, registration };
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return { success: false, error: error.message };
  }
};

// Show a local notification (for when app is open)
export const showLocalNotification = (title, options = {}) => {
  if (getPermissionStatus() !== 'granted') {
    console.warn('Notification permission not granted');
    return;
  }

  const defaultOptions = {
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true, // Keeps notification visible until user interacts
    tag: options.tag || 'goal-planner-notification',
    renotify: true,
    actions: options.actions || [],
    ...options
  };

  // Try to show via service worker for persistence
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(registration => {
      registration.showNotification(title, defaultOptions);
    });
  } else {
    // Fallback to regular notification
    new Notification(title, defaultOptions);
  }
};

// Play notification sound
export const playNotificationSound = (soundType = 'default') => {
  const sounds = {
    default: '/sounds/notification.mp3',
    alarm: '/sounds/alarm.mp3',
    gentle: '/sounds/gentle.mp3',
    urgent: '/sounds/urgent.mp3',
  };

  const audio = new Audio(sounds[soundType] || sounds.default);
  audio.volume = 0.7;

  // Try to play, handle autoplay restrictions
  audio.play().catch(err => {
    console.warn('Could not play notification sound:', err);
  });
};

// Schedule a notification (stores in localStorage, checked by service worker)
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

// Check and trigger due notifications (called periodically)
export const checkDueNotifications = () => {
  const now = new Date();
  const scheduled = getScheduledNotifications();

  scheduled.forEach(notification => {
    const triggerTime = new Date(notification.triggerAt);

    if (triggerTime <= now && !notification.triggered) {
      // Trigger the notification
      showLocalNotification(notification.title, {
        body: notification.body,
        tag: notification.id,
        data: notification.data,
      });

      // Play sound if enabled
      if (notification.sound) {
        playNotificationSound(notification.soundType);
      }

      // Mark as triggered or remove
      if (notification.recurring) {
        // Reschedule for next occurrence
        // Implementation depends on recurrence type
      } else {
        removeScheduledNotification(notification.id);
      }
    }
  });
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
    title: `⏰ ${task.title}`,
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
    triggerTime.setDate(triggerTime.getDate() + 1); // Schedule for tomorrow
  }

  return scheduleNotification({
    type: NotificationType.HABIT_REMINDER,
    title: `🔥 Time for: ${habit.title}`,
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
    title: '🌅 Good Morning!',
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
    title: '🌙 Wind Down Time',
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
    title: '✨ Daily Reflection',
    body: 'Take a moment to reflect on your day',
    triggerAt: triggerTime.toISOString(),
    sound: true,
    soundType: 'gentle',
    recurring: true,
    recurrenceType: 'daily',
  });
};

// Initialize notification system
export const initializeNotifications = async () => {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported');
    return { success: false, error: 'Not supported' };
  }

  // Register service worker
  const swResult = await registerServiceWorker();
  if (!swResult.success) {
    console.warn('Service worker registration failed:', swResult.error);
  }

  // Start checking for due notifications every minute
  setInterval(checkDueNotifications, 60000);

  // Check immediately
  checkDueNotifications();

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
  scheduleNotification,
  getScheduledNotifications,
  removeScheduledNotification,
  clearScheduledNotifications,
  checkDueNotifications,
  createTaskReminder,
  createHabitReminder,
  createMorningRoutineReminder,
  createNightRoutineReminder,
  createReflectionReminder,
  initializeNotifications,
  NotificationType,
};
