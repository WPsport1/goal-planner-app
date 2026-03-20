/**
 * Service Worker for Goal Planner App
 *
 * Handles:
 * - Push notifications with Snooze/Open actions
 * - Background notification checking
 * - Offline support
 */

const CACHE_NAME = 'goal-planner-v2';
const NOTIFICATION_CHECK_INTERVAL = 30000; // 30 seconds

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(clients.claim());
  startNotificationChecker();
});

// Push notification received from server
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);

  let data = {
    title: 'Goal Planner',
    body: 'You have a new notification',
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
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: data.tag || 'goal-planner-push',
    renotify: true,
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'snooze', title: 'Snooze' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'snooze') {
    // Read snooze duration from settings (default 10 min)
    const snoozeMins = data.snoozeDuration || 10;
    const snoozeTime = new Date(Date.now() + snoozeMins * 60 * 1000);

    // Tell main thread to schedule a snoozed notification
    self.clients.matchAll().then(clients => {
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
    });
  } else {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          for (const client of windowClients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              client.focus();
              if (data.url) {
                client.navigate(data.url);
              }
              return;
            }
          }
          if (clients.openWindow) {
            return clients.openWindow(data.url || '/');
          }
        })
    );
  }
});

// Periodic notification checker
let notificationCheckerInterval = null;

function startNotificationChecker() {
  if (notificationCheckerInterval) {
    clearInterval(notificationCheckerInterval);
  }

  notificationCheckerInterval = setInterval(() => {
    checkScheduledNotifications();
  }, NOTIFICATION_CHECK_INTERVAL);

  checkScheduledNotifications();
}

async function checkScheduledNotifications() {
  const allClients = await self.clients.matchAll();
  allClients.forEach(client => {
    client.postMessage({ type: 'CHECK_NOTIFICATIONS' });
  });
}

// Message handler from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SHOW_NOTIFICATION':
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/vite.svg',
        badge: '/vite.svg',
        vibrate: data.vibrate || [200, 100, 200, 100, 200],
        requireInteraction: data.requireInteraction !== false,
        tag: data.tag || 'goal-planner',
        renotify: true,
        data: data.data,
        actions: [
          { action: 'open', title: 'Open' },
          { action: 'snooze', title: 'Snooze' },
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

// Periodic sync for notification checking (when supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'notification-check') {
    event.waitUntil(checkScheduledNotifications());
  }
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(checkScheduledNotifications());
  }
});

console.log('[SW] Service Worker loaded');
