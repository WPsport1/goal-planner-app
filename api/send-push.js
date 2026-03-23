/**
 * Vercel Serverless Function: Send Push Notifications
 *
 * Called by Vercel Cron every minute to check for tasks with
 * reminders due within the next 60 seconds and send Web Push
 * notifications to all subscribed devices.
 *
 * Environment variables required:
 * - VITE_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_EMAIL (mailto: contact)
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow GET (cron) and POST (manual trigger)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify cron secret (optional security — Vercel cron sends this header)
  const cronSecret = req.headers['authorization'];
  const expectedSecret = process.env.CRON_SECRET;
  if (expectedSecret && cronSecret !== `Bearer ${expectedSecret}`) {
    // Allow requests without auth for now (cron doesn't always send it)
    console.log('[SendPush] No auth header — proceeding anyway');
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
  const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:noreply@goalplanner.app';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return res.status(500).json({ error: 'VAPID keys not configured' });
  }

  // Configure web-push
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + 90 * 1000); // 90-second window

    // Get all tasks with reminders that have start times coming up
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('completed', false)
      .not('start_time', 'is', null)
      .not('scheduled_date', 'is', null);

    if (taskError) {
      console.error('[SendPush] Task query error:', taskError);
      return res.status(500).json({ error: 'Failed to query tasks' });
    }

    if (!tasks || tasks.length === 0) {
      return res.status(200).json({ message: 'No tasks found', sent: 0 });
    }

    // Find tasks whose reminder time falls within our check window
    const dueTasks = [];

    for (const task of tasks) {
      if (!task.scheduled_date || !task.start_time) continue;

      // Calculate reminder time
      const reminderMinutes = task.reminder_minutes || 15;
      const dateStr = task.scheduled_date;
      let taskDate;

      if (dateStr.includes('T')) {
        const parsed = new Date(dateStr);
        const year = parsed.getFullYear();
        const month = parsed.getMonth();
        const day = parsed.getDate();
        const [hours, minutes] = task.start_time.split(':').map(Number);
        taskDate = new Date(year, month, day, hours, minutes, 0, 0);
      } else {
        const [year, month, day] = dateStr.split('-').map(Number);
        const [hours, minutes] = task.start_time.split(':').map(Number);
        taskDate = new Date(year, month - 1, day, hours, minutes, 0, 0);
      }

      const reminderTime = new Date(taskDate.getTime() - reminderMinutes * 60 * 1000);

      // Check if reminder falls within our window (now to now+90s)
      if (reminderTime >= now && reminderTime <= windowEnd) {
        dueTasks.push({
          ...task,
          reminderTime,
          taskDate,
        });
      }
    }

    if (dueTasks.length === 0) {
      return res.status(200).json({ message: 'No due reminders', sent: 0 });
    }

    // Get unique user IDs from due tasks
    const userIds = [...new Set(dueTasks.map(t => t.user_id))];

    // Get push subscriptions for those users
    const { data: subscriptions, error: subError } = await supabase
      .from('push_subscriptions')
      .select('*')
      .in('user_id', userIds);

    if (subError) {
      console.error('[SendPush] Subscription query error:', subError);
      return res.status(500).json({ error: 'Failed to query subscriptions' });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return res.status(200).json({ message: 'No push subscriptions', sent: 0 });
    }

    // Group subscriptions by user
    const subsByUser = {};
    for (const sub of subscriptions) {
      if (!subsByUser[sub.user_id]) subsByUser[sub.user_id] = [];
      subsByUser[sub.user_id].push(sub);
    }

    // Send push notifications
    let sent = 0;
    let failed = 0;
    const staleSubscriptions = [];

    for (const task of dueTasks) {
      const userSubs = subsByUser[task.user_id] || [];

      for (const sub of userSubs) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys_p256dh,
            auth: sub.keys_auth,
          },
        };

        const payload = JSON.stringify({
          title: `Reminder: ${task.title}`,
          body: `Starting in ${task.reminder_minutes || 15} minutes`,
          icon: '/vite.svg',
          badge: '/vite.svg',
          tag: `push-task-${task.id}-${Date.now()}`,
          data: {
            taskId: task.id,
            soundType: task.priority === 'high' ? 'urgent' : 'default',
            url: '/',
          },
        });

        try {
          await webpush.sendNotification(pushSubscription, payload);
          sent++;
          console.log(`[SendPush] Sent to user ${task.user_id}: ${task.title}`);
        } catch (err) {
          failed++;
          console.error(`[SendPush] Failed:`, err.statusCode, err.body);

          // Remove stale subscriptions (410 Gone or 404)
          if (err.statusCode === 410 || err.statusCode === 404) {
            staleSubscriptions.push(sub.id);
          }
        }
      }
    }

    // Clean up stale subscriptions
    if (staleSubscriptions.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('id', staleSubscriptions);
      console.log(`[SendPush] Removed ${staleSubscriptions.length} stale subscriptions`);
    }

    return res.status(200).json({
      message: 'Push check complete',
      tasksChecked: tasks.length,
      dueReminders: dueTasks.length,
      sent,
      failed,
      staleRemoved: staleSubscriptions.length,
    });

  } catch (err) {
    console.error('[SendPush] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
