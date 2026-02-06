/**
 * Firebase Configuration and Messaging Service
 *
 * This module handles:
 * - Firebase app initialization
 * - Firebase Cloud Messaging (FCM) setup
 * - Push notification token management
 * - Message handling
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration - these will be loaded from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is configured
export const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId
  );
};

// Initialize Firebase app (lazy initialization)
let app = null;
let messaging = null;

export const initializeFirebase = () => {
  if (!isFirebaseConfigured()) {
    console.warn('Firebase is not configured. Push notifications will be limited.');
    return null;
  }

  if (!app) {
    try {
      app = initializeApp(firebaseConfig);
      console.log('Firebase initialized successfully');
    } catch (error) {
      console.error('Firebase initialization failed:', error);
      return null;
    }
  }

  return app;
};

// Get Firebase Messaging instance
export const getFirebaseMessaging = () => {
  if (!isFirebaseConfigured()) return null;

  if (!app) {
    initializeFirebase();
  }

  if (!messaging && app) {
    try {
      messaging = getMessaging(app);
    } catch (error) {
      console.error('Failed to get Firebase Messaging:', error);
      return null;
    }
  }

  return messaging;
};

// Request permission and get FCM token
export const getFCMToken = async () => {
  const messagingInstance = getFirebaseMessaging();
  if (!messagingInstance) {
    return { success: false, error: 'Firebase Messaging not available' };
  }

  try {
    // Request notification permission first
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied' };
    }

    // Get the token using the VAPID key
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      return { success: false, error: 'VAPID key not configured' };
    }

    const token = await getToken(messagingInstance, { vapidKey });

    if (token) {
      console.log('FCM Token obtained:', token.substring(0, 20) + '...');
      // Store token in localStorage for reference
      localStorage.setItem('fcmToken', token);
      return { success: true, token };
    } else {
      return { success: false, error: 'No registration token available' };
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return { success: false, error: error.message };
  }
};

// Listen for foreground messages
export const onForegroundMessage = (callback) => {
  const messagingInstance = getFirebaseMessaging();
  if (!messagingInstance) return null;

  return onMessage(messagingInstance, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};

// Store FCM token to your backend (Supabase)
export const saveTokenToServer = async (token, userId) => {
  if (!token || !userId) return { success: false };

  try {
    // Import Supabase client
    const { supabase, isSupabaseConfigured } = await import('./supabase');

    if (!isSupabaseConfigured()) {
      // Store locally if no backend
      const tokens = JSON.parse(localStorage.getItem('fcmTokens') || '[]');
      if (!tokens.includes(token)) {
        tokens.push(token);
        localStorage.setItem('fcmTokens', JSON.stringify(tokens));
      }
      return { success: true, local: true };
    }

    // Upsert token to Supabase
    const { error } = await supabase
      .from('user_fcm_tokens')
      .upsert(
        { user_id: userId, token, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,token' }
      );

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error saving FCM token:', error);
    return { success: false, error: error.message };
  }
};

// Delete FCM token (for logout)
export const deleteToken = async (userId) => {
  const token = localStorage.getItem('fcmToken');
  if (!token) return { success: true };

  try {
    const { supabase, isSupabaseConfigured } = await import('./supabase');

    if (isSupabaseConfigured() && userId) {
      await supabase
        .from('user_fcm_tokens')
        .delete()
        .eq('user_id', userId)
        .eq('token', token);
    }

    localStorage.removeItem('fcmToken');
    return { success: true };
  } catch (error) {
    console.error('Error deleting FCM token:', error);
    return { success: false, error: error.message };
  }
};

// Schedule a notification via your backend
export const scheduleServerNotification = async (notification) => {
  const token = localStorage.getItem('fcmToken');
  if (!token) {
    return { success: false, error: 'No FCM token available' };
  }

  try {
    const { supabase, isSupabaseConfigured } = await import('./supabase');

    if (!isSupabaseConfigured()) {
      // Store locally for service worker to handle
      const scheduled = JSON.parse(localStorage.getItem('scheduledNotifications') || '[]');
      scheduled.push({
        id: Date.now().toString(),
        ...notification,
        token,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem('scheduledNotifications', JSON.stringify(scheduled));
      return { success: true, local: true };
    }

    // Store in Supabase scheduled_notifications table
    const { data, error } = await supabase
      .from('scheduled_notifications')
      .insert({
        token,
        title: notification.title,
        body: notification.body,
        trigger_at: notification.triggerAt,
        recurring: notification.recurring || false,
        recurrence_type: notification.recurrenceType || null,
        data: notification.data || {},
        sound: notification.sound || 'default',
      })
      .select()
      .single();

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return { success: false, error: error.message };
  }
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
