/**
 * Firebase Cloud Functions for Goal Planner App
 *
 * These functions handle:
 * - Sending push notifications via FCM
 * - Processing scheduled notifications
 * - Recurring notification management
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

/**
 * Send a push notification to a specific device
 */
exports.sendNotification = onCall(async (request) => {
  const { token, title, body, data, sound } = request.data;

  if (!token) {
    throw new HttpsError('invalid-argument', 'FCM token is required');
  }

  const message = {
    token,
    notification: {
      title: title || 'Goal Planner',
      body: body || 'You have a notification',
    },
    data: {
      ...data,
      sound: sound || 'default',
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    },
    android: {
      priority: 'high',
      notification: {
        sound: sound || 'default',
        priority: 'high',
        channelId: 'goal_planner_notifications',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: sound || 'default',
          badge: 1,
        },
      },
    },
    webpush: {
      notification: {
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [200, 100, 200],
        requireInteraction: true,
      },
      fcmOptions: {
        link: data?.url || '/',
      },
    },
  };

  try {
    const response = await messaging.send(message);
    console.log('Notification sent successfully:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Error sending notification:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Send notification to multiple devices (for a user with multiple devices)
 */
exports.sendToUser = onCall(async (request) => {
  const { userId, title, body, data, sound } = request.data;

  if (!userId) {
    throw new HttpsError('invalid-argument', 'User ID is required');
  }

  try {
    // Get all tokens for this user
    const tokensSnapshot = await db
      .collection('user_fcm_tokens')
      .where('user_id', '==', userId)
      .get();

    if (tokensSnapshot.empty) {
      return { success: false, error: 'No tokens found for user' };
    }

    const tokens = tokensSnapshot.docs.map((doc) => doc.data().token);

    const message = {
      notification: {
        title: title || 'Goal Planner',
        body: body || 'You have a notification',
      },
      data: {
        ...data,
        sound: sound || 'default',
      },
      webpush: {
        notification: {
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [200, 100, 200],
          requireInteraction: true,
        },
      },
    };

    const response = await messaging.sendEachForMulticast({
      tokens,
      ...message,
    });

    console.log(`Sent to ${response.successCount}/${tokens.length} devices`);

    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const tokensToRemove = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            tokensToRemove.push(tokens[idx]);
          }
        }
      });

      // Remove invalid tokens from database
      for (const token of tokensToRemove) {
        await db
          .collection('user_fcm_tokens')
          .where('token', '==', token)
          .get()
          .then((snapshot) => {
            snapshot.forEach((doc) => doc.ref.delete());
          });
      }
    }

    return { success: true, sent: response.successCount };
  } catch (error) {
    console.error('Error sending to user:', error);
    throw new HttpsError('internal', error.message);
  }
});

/**
 * Process scheduled notifications every minute
 * This runs on a schedule and sends any notifications that are due
 */
exports.processScheduledNotifications = onSchedule('every 1 minutes', async (event) => {
  const now = new Date();
  console.log('Processing scheduled notifications at:', now.toISOString());

  try {
    // Get all notifications due to be sent
    const dueNotifications = await db
      .collection('scheduled_notifications')
      .where('trigger_at', '<=', now.toISOString())
      .where('sent', '==', false)
      .get();

    if (dueNotifications.empty) {
      console.log('No notifications due');
      return null;
    }

    console.log(`Found ${dueNotifications.size} notifications to send`);

    const sendPromises = dueNotifications.docs.map(async (doc) => {
      const notification = doc.data();

      try {
        const message = {
          token: notification.token,
          notification: {
            title: notification.title,
            body: notification.body,
          },
          data: notification.data || {},
          webpush: {
            notification: {
              icon: '/icon-192.png',
              badge: '/icon-192.png',
              vibrate: [200, 100, 200, 100, 200],
              requireInteraction: true,
            },
          },
        };

        await messaging.send(message);
        console.log('Sent notification:', notification.title);

        // Mark as sent or reschedule if recurring
        if (notification.recurring) {
          // Calculate next trigger time based on recurrence type
          const nextTrigger = calculateNextTrigger(
            new Date(notification.trigger_at),
            notification.recurrence_type
          );

          await doc.ref.update({
            trigger_at: nextTrigger.toISOString(),
            last_sent: now.toISOString(),
          });
        } else {
          await doc.ref.update({
            sent: true,
            sent_at: now.toISOString(),
          });
        }

        return { success: true, id: doc.id };
      } catch (error) {
        console.error('Failed to send notification:', doc.id, error);

        // If token is invalid, mark the notification for cleanup
        if (
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered'
        ) {
          await doc.ref.update({ invalid_token: true });
        }

        return { success: false, id: doc.id, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);
    console.log('Send results:', results);

    return results;
  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
    return null;
  }
});

/**
 * Calculate next trigger time for recurring notifications
 */
function calculateNextTrigger(currentTrigger, recurrenceType) {
  const next = new Date(currentTrigger);

  switch (recurrenceType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      break;
    case 'weekdays':
      do {
        next.setDate(next.getDate() + 1);
      } while (next.getDay() === 0 || next.getDay() === 6);
      break;
    case 'hourly':
      next.setHours(next.getHours() + 1);
      break;
    default:
      next.setDate(next.getDate() + 1);
  }

  return next;
}

/**
 * Clean up old sent notifications (runs daily)
 */
exports.cleanupOldNotifications = onSchedule('every 24 hours', async (event) => {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const oldNotifications = await db
      .collection('scheduled_notifications')
      .where('sent', '==', true)
      .where('sent_at', '<', thirtyDaysAgo.toISOString())
      .get();

    const deletePromises = oldNotifications.docs.map((doc) => doc.ref.delete());
    await Promise.all(deletePromises);

    console.log(`Cleaned up ${oldNotifications.size} old notifications`);
    return { deleted: oldNotifications.size };
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    return null;
  }
});

/**
 * When a new scheduled notification is created, validate it
 */
exports.onNotificationCreated = onDocumentCreated(
  'scheduled_notifications/{notificationId}',
  async (event) => {
    const notification = event.data.data();
    const docRef = event.data.ref;

    // Set defaults if not provided
    const updates = {
      sent: false,
      created_at: new Date().toISOString(),
    };

    if (!notification.trigger_at) {
      updates.trigger_at = new Date().toISOString();
    }

    await docRef.update(updates);
    console.log('Notification validated:', event.params.notificationId);
  }
);
