/**
 * Service Worker for Goal Planner App
 *
 * Handles:
 * - Web Push notifications (server-sent, works with screen locked)
 * - Notification click/action handling (Snooze, Dismiss, Open)
 * - Background notification checking (tells main thread to check)
 */

const CACHE_NAME = 'goal-planner-v3';

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing v3...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating v3...');
  event.waitUntil(clients.claim());
  startNotificationChecker();
});

// ============================================
// PUSH NOTIFICATION RECEIVED (from server)
// This fires even when the app is closed / screen locked!
// ============================================
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let data = {
    title: 'Goal Planner',
    body: 'You have a reminder!',
    icon: '/vite.svg',
    badge: '/vite.svg',
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon || '/vite.svg',
    badge: data.badge || '/vite.svg',
    vibrate: [300, 100, 300, 100, 300, 100, 300], // Strong vibration pattern
    requireInteraction: true, // Don't auto-dismiss — user must interact
    tag: data.tag || 'goal-planner-push-' + Date.now(),
    renotify: true,
    silent: false, // Play system notification sound
    data: data.data || {},
    actions: [
      { action: 'snooze', title: 'Snooze (10 min)' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ============================================
// NOTIFICATION CLICK HANDLER
// ============================================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'snooze') {
    // Tell main thread to schedule a snoozed notification
    const snoozeMins = data.snoozeDuration || 10;
    const snoozeTime = new Date(Date.now() + snoozeMins * 60 * 1000);

    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SCHEDULE_SNOOZE',
            notification: {
              title: event.notification.title,
              body: `Snoozed: ${event.notification.body}`,
              triggerAt: snoozeTime.toISOString(),
              sound: true,
              soundType: data.soundType || 'default',
              data,
            }
          });
        });

        // If no clients open, schedule via push again (would need server)
        if (clients.length === 0) {
          console.log('[SW] No clients open — snooze will fire when app opens');
        }
      })
    );
  } else if (action === 'dismiss') {
    // Tell main thread to acknowledge/dismiss
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'DISMISS_ALARM',
            notificationId: data.notificationId || event.notification.tag,
          });
        });
      })
    );
  } else {
    // Default: open/focus the app and trigger alarm
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          // Try to focus existing window
          for (const client of windowClients) {
            if ('focus' in client) {
              client.focus();
              // Tell the app to show the alarm UI
              client.postMessage({
                type: 'ALARM_OPENED',
                title: event.notification.title,
                body: event.notification.body,
                soundType: data.soundType || 'default',
              });
              return;
            }
          }
          // No window open — open new one
          if (self.clients.openWindow) {
            return self.clients.openWindow('/');
          }
        })
    );
  }
});

// ============================================
// BACKGROUND NOTIFICATION CHECKER
// Posts CHECK_NOTIFICATIONS to main thread every 15 seconds
// ============================================
let notificationCheckerInterval = null;

function startNotificationChecker() {
  if (notificationCheckerInterval) {
    clearInterval(notificationCheckerInterval);
  }

  notificationCheckerInterval = setInterval(() => {
    checkScheduledNotifications();
  }, 15000);

  checkScheduledNotifications();
}

async function checkScheduledNotifications() {
  const allClients = await self.clients.matchAll();
  allClients.forEach(client => {
    client.postMessage({ type: 'CHECK_NOTIFICATIONS' });
  });
}

// ============================================
// MESSAGE HANDLER (from main thread)
// ============================================
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SHOW_NOTIFICATION':
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/vite.svg',
        badge: '/vite.svg',
        vibrate: data.vibrate || [300, 100, 300, 100, 300],
        requireInteraction: data.requireInteraction !== false,
        tag: data.tag || 'goal-planner-' + Date.now(),
        renotify: true,
        silent: false,
        data: data.data,
        actions: [
          { action: 'snooze', title: 'Snooze' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      });
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    default:
      break;
  }
});

// ============================================
// PERIODIC SYNC (when browser supports it)
// ============================================
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'notification-check') {
    event.waitUntil(checkScheduledNotifications());
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(checkScheduledNotifications());
  }
});

console.log('[SW] Service Worker v3 loaded');
