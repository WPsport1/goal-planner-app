/**
 * Vercel Serverless Function: iCalendar Feed
 *
 * Generates a .ics (iCalendar) feed of the user's tasks.
 * iPhone Calendar subscribes to this URL and auto-refreshes,
 * giving native notifications (lock screen, sound, vibration).
 *
 * URL: /api/calendar.ics?uid=<user_id>
 *
 * Environment variables required:
 * - VITE_SUPABASE_URL (or SUPABASE_URL)
 * - SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const uid = req.query.uid;

  if (!uid) {
    res.status(400).send('Missing uid parameter');
    return;
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    res.status(500).send('Server not configured');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // Fetch all non-completed tasks for this user
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', uid)
      .eq('completed', false)
      .not('start_time', 'is', null)
      .not('scheduled_date', 'is', null);

    if (error) {
      console.error('[Calendar] Query error:', error);
      res.status(500).send('Database error');
      return;
    }

    // Build iCalendar content
    const now = new Date();
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Goal Planner//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Goal Planner',
      'X-WR-TIMEZONE:' + Intl.DateTimeFormat().resolvedOptions().timeZone,
      // Suggest refresh every 15 minutes
      'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
      'X-PUBLISHED-TTL:PT15M',
    ];

    for (const task of (tasks || [])) {
      const event = taskToVEvent(task);
      if (event) {
        lines.push(...event);
      }
    }

    lines.push('END:VCALENDAR');

    const icsContent = lines.join('\r\n');

    // Set headers for iCalendar
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="goal-planner.ics"');
    // Allow iPhone to cache but refresh regularly
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.status(200).send(icsContent);

  } catch (err) {
    console.error('[Calendar] Error:', err);
    res.status(500).send('Internal error');
  }
}

/**
 * Convert a task to VEVENT lines
 */
function taskToVEvent(task) {
  if (!task.scheduled_date || !task.start_time) return null;

  // Parse date
  const dateStr = task.scheduled_date;
  let year, month, day;

  if (dateStr.includes('T')) {
    const parsed = new Date(dateStr);
    year = parsed.getFullYear();
    month = parsed.getMonth() + 1;
    day = parsed.getDate();
  } else {
    const parts = dateStr.split('-').map(Number);
    year = parts[0];
    month = parts[1];
    day = parts[2];
  }

  // Parse start time
  const [startH, startM] = task.start_time.split(':').map(Number);

  // Parse end time (default to 1 hour after start)
  let endH, endM;
  if (task.end_time) {
    [endH, endM] = task.end_time.split(':').map(Number);
  } else {
    endH = startH + 1;
    endM = startM;
    if (endH >= 24) endH = 23;
  }

  // Format as iCalendar datetime (YYYYMMDDTHHMMSS)
  const pad = (n) => String(n).padStart(2, '0');
  const dtStart = `${year}${pad(month)}${pad(day)}T${pad(startH)}${pad(startM)}00`;
  const dtEnd = `${year}${pad(month)}${pad(day)}T${pad(endH)}${pad(endM)}00`;

  // Build VEVENT
  const lines = [
    'BEGIN:VEVENT',
    `UID:goalplanner-${task.id}@goal-planner-app`,
    `DTSTAMP:${formatICSDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(task.title)}`,
  ];

  if (task.description) {
    lines.push(`DESCRIPTION:${escapeICS(task.description)}`);
  }

  // Priority mapping
  const priorityMap = { high: 1, medium: 5, low: 9 };
  if (task.priority && priorityMap[task.priority]) {
    lines.push(`PRIORITY:${priorityMap[task.priority]}`);
  }

  // Add alarm/reminder
  const reminderMins = task.reminder_minutes || 15;
  // Alarm at reminder time
  lines.push('BEGIN:VALARM');
  lines.push('ACTION:DISPLAY');
  lines.push(`DESCRIPTION:${escapeICS(task.title)} starting soon`);
  lines.push(`TRIGGER:-PT${reminderMins}M`);
  lines.push('END:VALARM');

  // Second alarm at event time
  lines.push('BEGIN:VALARM');
  lines.push('ACTION:DISPLAY');
  lines.push(`DESCRIPTION:${escapeICS(task.title)} starting now`);
  lines.push('TRIGGER:PT0M');
  lines.push('END:VALARM');

  // Recurrence
  const rrule = buildRRule(task);
  if (rrule) {
    lines.push(rrule);
  }

  // Last modified
  if (task.updated_at) {
    lines.push(`LAST-MODIFIED:${formatICSDate(new Date(task.updated_at))}`);
  }

  lines.push('END:VEVENT');
  return lines;
}

/**
 * Build RRULE from task recurrence
 */
function buildRRule(task) {
  switch (task.recurrence) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'weekly': {
      if (task.weekly_days && Array.isArray(task.weekly_days) && task.weekly_days.length > 0) {
        const dayMap = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
        const days = task.weekly_days.map(d => dayMap[d]).filter(Boolean).join(',');
        if (days) return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
      }
      return 'RRULE:FREQ=WEEKLY';
    }
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';
    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    default:
      return null;
  }
}

/**
 * Format a Date as iCalendar UTC datetime
 */
function formatICSDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

/**
 * Escape special characters for iCalendar text
 */
function escapeICS(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}
