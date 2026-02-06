/**
 * Service Worker for Goal Planner App
 *
 * Handles:
 * - Push notifications
 * - Background sync
 * - Scheduled notification checking
 * - Offline support
 */

const CACHE_NAME = 'goal-planner-v1';
const NOTIFICATION_CHECK_INTERVAL = 60000; // 1 minute

// Install event - cache essential files
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(clients.claim());

  // Start periodic notification check
  startNotificationChecker();
});

// Push notification received from server (Firebase)
self.addEventListener('push', (event) => {
  console.log('Push notification received:', event);

  let data = {
    title: 'Goal Planner',
    body: 'You have a new notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
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
    icon: data.icon || '/icon-192.png',
    badge: data.badge || '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: data.tag || 'goal-planner-push',
    renotify: true,
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'snooze', title: 'Snooze 10min' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'snooze') {
    // Snooze for 10 minutes
    const snoozeTime = new Date(Date.now() + 10 * 60 * 1000);
    scheduleSnoozeNotification(event.notification.title, event.notification.body, snoozeTime, data);
  } else {
    // Open or focus the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((windowClients) => {
          // Check if app is already open
          for (const client of windowClients) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              // Focus existing window and navigate if needed
              client.focus();
              if (data.url) {
                client.navigate(data.url);
              }
              return;
            }
          }

          // Open new window
          if (clients.openWindow) {
            const url = data.url || '/';
            return clients.openWindow(url);
          }
        })
    );
  }
});

// Schedule a snooze notification
function scheduleSnoozeNotification(title, body, triggerTime, data) {
  // Store in IndexedDB or use the main thread
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'SCHEDULE_SNOOZE',
        notification: {
          title: `⏰ ${title}`,
          body: `Snoozed: ${body}`,
          triggerAt: triggerTime.toISOString(),
          data,
        }
      });
    });
  });
}

// Periodic notification checker
let notificationCheckerInterval = null;

function startNotificationChecker() {
  if (notificationCheckerInterval) {
    clearInterval(notificationCheckerInterval);
  }

  notificationCheckerInterval = setInterval(() => {
    checkScheduledNotifications();
  }, NOTIFICATION_CHECK_INTERVAL);

  // Check immediately
  checkScheduledNotifications();
}

// Check for due notifications
async function checkScheduledNotifications() {
  // Request the main thread to check notifications
  const clients = await self.clients.matchAll();

  clients.forEach(client => {
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
        icon: data.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: data.vibrate || [200, 100, 200],
        requireInteraction: data.requireInteraction !== false,
        tag: data.tag || 'goal-planner',
        renotify: true,
        data: data.data,
        actions: data.actions || [
          { action: 'open', title: 'Open' },
          { action: 'snooze', title: 'Snooze' },
        ],
      });
      break;

    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    default:
      console.log('Unknown message type:', type);
  }
});

// Periodic sync for notification checking (when supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'notification-check') {
    event.waitUntil(checkScheduledNotifications());
  }
});

// Background sync for offline notification scheduling
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

async function syncNotifications() {
  // Sync notification schedules when coming back online
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_NOTIFICATIONS' });
  });
}

console.log('Service Worker loaded');
