/**
 * Firebase Configuration and Messaging Service
 *
 * Firebase is NOT installed - this is a stub that provides fallback functionality.
 * The app uses Supabase for cloud sync across all devices.
 * Local browser notifications work without Firebase.
 *
 * To enable Firebase push notifications in the future:
 * 1. Run: npm install firebase
 * 2. Add Firebase config to .env
 * 3. Replace this stub with the full implementation
 */

// Firebase is not configured - always returns false
export const isFirebaseConfigured = () => false;

// Stub functions that gracefully handle missing Firebase
export const initializeFirebase = async () => {
  console.log('Firebase not installed - using local notifications');
  return null;
};

export const getFirebaseMessaging = async () => null;

export const getFCMToken = async () => {
  return { success: false, error: 'Firebase not installed' };
};

export const onForegroundMessage = (callback) => null;

export const saveTokenToServer = async (token, userId) => {
  return { success: false, error: 'Firebase not installed' };
};

export const deleteToken = async (userId) => {
  localStorage.removeItem('fcmToken');
  return { success: true };
};

export const scheduleServerNotification = async (notification) => {
  // Store locally for service worker to handle
  const scheduled = JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
  scheduled.push({
    id: Date.now().toString(),
    ...notification,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem('scheduledNotifications', JSON.stringify(scheduled));
  return { success: true, local: true };
};

export default {
  isFirebaseConfigured,
  initializeFirebase,
  getFirebaseMessaging,
  getFCMToken,
  onForegroundMessage,
  saveTokenToServer,
  deleteToken,
  scheduleServerNotification,
};
