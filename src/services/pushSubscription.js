/**
 * Web Push Subscription Service
 *
 * Handles subscribing the browser to Web Push notifications.
 * Push notifications are the ONLY way to alert the user when the app
 * is completely closed or the screen is locked on iOS.
 *
 * Flow:
 * 1. Browser subscribes via pushManager.subscribe() with VAPID public key
 * 2. Subscription (endpoint + keys) is stored in Supabase
 * 3. Supabase Edge Function checks for due tasks and sends push
 * 4. Service Worker receives push event and shows notification
 */

import { supabase, isSupabaseConfigured } from './supabase';

// VAPID public key — set this in your .env file
// Generate a key pair with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

/**
 * Convert a VAPID key from base64 URL format to Uint8Array
 * (required by pushManager.subscribe)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe this browser/device to Web Push notifications.
 * Returns the PushSubscription object or null on failure.
 */
export async function subscribeToPush() {
  if (!VAPID_PUBLIC_KEY) {
    console.log('[WebPush] No VAPID public key configured');
    return null;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[WebPush] Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      // Subscribe with VAPID key
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('[WebPush] New push subscription created');
    } else {
      console.log('[WebPush] Existing push subscription found');
    }

    // Store subscription in Supabase
    await saveSubscription(subscription);

    return subscription;
  } catch (error) {
    console.error('[WebPush] Subscription failed:', error);
    return null;
  }
}

/**
 * Unsubscribe from Web Push notifications
 */
export async function unsubscribeFromPush() {
  if (!('serviceWorker' in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await removeSubscription(subscription);
      console.log('[WebPush] Unsubscribed successfully');
    }
  } catch (error) {
    console.error('[WebPush] Unsubscribe failed:', error);
  }
}

/**
 * Save push subscription to Supabase
 */
async function saveSubscription(subscription) {
  if (!isSupabaseConfigured || !supabase) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const subJson = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: user.id,
      endpoint: subJson.endpoint,
      keys_p256dh: subJson.keys?.p256dh || '',
      keys_auth: subJson.keys?.auth || '',
      user_agent: navigator.userAgent,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'endpoint',
    });

  if (error) {
    console.error('[WebPush] Failed to save subscription:', error);
  } else {
    console.log('[WebPush] Subscription saved to Supabase');
  }
}

/**
 * Remove push subscription from Supabase
 */
async function removeSubscription(subscription) {
  if (!isSupabaseConfigured || !supabase) return;

  const subJson = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subJson.endpoint);

  if (error) {
    console.error('[WebPush] Failed to remove subscription:', error);
  }
}

/**
 * Check if push is available and configured
 */
export function isPushAvailable() {
  return Boolean(
    VAPID_PUBLIC_KEY &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

/**
 * Get current push subscription status
 */
export async function getPushStatus() {
  if (!isPushAvailable()) return 'unavailable';

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'unsubscribed';
  } catch {
    return 'error';
  }
}

export default {
  subscribeToPush,
  unsubscribeFromPush,
  isPushAvailable,
  getPushStatus,
};
