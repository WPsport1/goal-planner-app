/**
 * Firebase Messaging Service Worker
 *
 * This service worker handles push notifications from Firebase Cloud Messaging.
 * It runs in the background and can receive notifications even when the app is closed.
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Firebase configuration - will be set via message from main app
let firebaseConfig = null;

// Listen for config message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'FIREBASE_CONFIG') {
    firebaseConfig = event.data.config;
    initializeFirebaseInSW();
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Initialize Firebase in service worker
function initializeFirebaseInSW() {
  if (!firebaseConfig) {
    // Try to get config from a fetch to a local file
    console.log('Firebase config not yet received, waiting...');
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // Handle background messages
    messaging.onBackgroundMessage((payload) => {
      console.log('Background message received:', payload);

      const notificationTitle = payload.notification?.title || payload.data?.title || 'Goal Planner';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'You have a new notification',
        icon: payload.notification?.icon || '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200, 100, 200],
        requireInteraction: true,
        tag: payload.data?.tag || 'goal-planner-fcm',
        renotify: true,
        data: payload.data || {},
        actions: [
          { action: 'open', title: 'Open App' },
          { action: 'snooze', title: 'Snooze' },
        ],
      };

      // Play sound if specified
      if (payload.data?.sound === 'alarm' || payload.data?.sound === 'urgent') {
        // Can't play audio from SW, but the notification sound setting on device will play
      }

      self.registration.showNotification(notificationTitle, notificationOptions);
    });

    console.log('Firebase Messaging initialized in Service Worker');
  } catch (error) {
    console.error('Firebase initialization in SW failed:', error);
  }
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  if (action === 'snooze') {
    // Snooze for 10 minutes - send message to main thread
    event.waitUntil(
      self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'SNOOZE_NOTIFICATION',
            notification: {
              title: event.notification.title,
              body: event.notification.body,
              snoozeMinutes: 10,
              data,
            },
          });
        });
      })
    );
  } else {
    // Open or focus the app
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        // Try to focus existing window
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            // Send data to the app
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data,
            });
            return;
          }
        }

        // No existing window, open new one
        if (self.clients.openWindow) {
          const url = data.url || '/';
          return self.clients.openWindow(url);
        }
      })
    );
  }
});

// Handle push events directly (for custom push handling)
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  if (!event.data) {
    console.log('Push event has no data');
    return;
  }

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { body: event.data.text() };
  }

  // If Firebase is handling it, let it. Otherwise show manually.
  if (!firebaseConfig) {
    const title = payload.notification?.title || payload.title || 'Goal Planner';
    const options = {
      body: payload.notification?.body || payload.body || 'New notification',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      tag: payload.tag || 'goal-planner-push',
      data: payload.data || payload,
      actions: [
        { action: 'open', title: 'Open' },
        { action: 'snooze', title: 'Snooze' },
      ],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Install event
self.addEventListener('install', (event) => {
  console.log('Firebase Messaging SW installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Firebase Messaging SW activating...');
  event.waitUntil(self.clients.claim());
});

console.log('Firebase Messaging Service Worker loaded');
