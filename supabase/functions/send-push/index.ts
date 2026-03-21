/**
 * Supabase Edge Function: send-push
 *
 * Checks for tasks with reminders due in the next 2 minutes and sends
 * Web Push notifications to all subscribed devices for that user.
 *
 * Triggered by:
 * - pg_cron every minute: SELECT net.http_post(...)
 * - Or external cron service hitting the function URL
 *
 * Setup:
 * 1. Deploy: supabase functions deploy send-push
 * 2. Set secrets:
 *    supabase secrets set VAPID_PRIVATE_KEY="your-private-key"
 *    supabase secrets set VAPID_PUBLIC_KEY="your-public-key"
 *    supabase secrets set VAPID_SUBJECT="mailto:your-email@example.com"
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Web Push crypto imports
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@goalplanner.app'

serve(async (req: Request) => {
  try {
    // Create Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const now = new Date()
    const twoMinutesFromNow = new Date(now.getTime() + 2 * 60 * 1000)

    // Find tasks with reminders due in the next 2 minutes
    // We look for tasks where:
    // - reminder = true
    // - scheduled_date + start_time - reminder_minutes = within next 2 minutes
    const { data: tasks, error: taskError } = await supabase
      .from('tasks')
      .select('*')
      .eq('reminder', true)
      .eq('completed', false)

    if (taskError) {
      console.error('Error fetching tasks:', taskError)
      return new Response(JSON.stringify({ error: taskError.message }), { status: 500 })
    }

    let pushCount = 0
    const errors: string[] = []

    for (const task of (tasks || [])) {
      if (!task.scheduled_date || !task.start_time) continue

      // Calculate when the reminder should fire
      const taskDate = new Date(task.scheduled_date)
      const [hours, minutes] = task.start_time.split(':').map(Number)
      taskDate.setHours(hours, minutes, 0, 0)

      const reminderMinutes = task.reminder_minutes || 15
      const reminderTime = new Date(taskDate.getTime() - reminderMinutes * 60 * 1000)

      // Check if reminder is due (within the next 2 minutes, but not more than 2 min in the past)
      const twoPast = new Date(now.getTime() - 2 * 60 * 1000)
      if (reminderTime >= twoPast && reminderTime <= twoMinutesFromNow) {
        // Get all push subscriptions for this user
        const { data: subscriptions } = await supabase
          .from('push_subscriptions')
          .select('*')
          .eq('user_id', task.user_id)

        for (const sub of (subscriptions || [])) {
          try {
            await sendWebPush(sub, {
              title: `Reminder: ${task.title}`,
              body: `Starting in ${reminderMinutes} minutes`,
              tag: `task-${task.id}`,
              data: {
                taskId: task.id,
                soundType: task.priority === 'high' ? 'urgent' : 'default',
                snoozeDuration: 10,
              },
            })
            pushCount++
          } catch (e) {
            errors.push(`Failed to push to ${sub.endpoint}: ${e.message}`)
            // If subscription is expired/invalid, remove it
            if (e.message?.includes('410') || e.message?.includes('404')) {
              await supabase
                .from('push_subscriptions')
                .delete()
                .eq('endpoint', sub.endpoint)
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      checked: tasks?.length || 0,
      pushed: pushCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})

/**
 * Send a Web Push notification using the Web Push protocol.
 * This is a simplified implementation using the fetch API.
 */
async function sendWebPush(
  subscription: { endpoint: string; keys_p256dh: string; keys_auth: string },
  payload: object
) {
  // For a production implementation, you'd use the web-push protocol
  // with VAPID JWT authentication. This requires:
  // 1. Creating a JWT signed with the VAPID private key
  // 2. Encrypting the payload with the subscription's public key
  // 3. Sending to the push service endpoint
  //
  // Since Deno Edge Functions have limited crypto, we'll use a
  // simpler approach with the webpush npm package via esm.sh

  const { default: webpush } = await import('https://esm.sh/web-push@3.6.7')

  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys_p256dh,
      auth: subscription.keys_auth,
    },
  }

  await webpush.sendNotification(
    pushSubscription,
    JSON.stringify(payload)
  )
}
