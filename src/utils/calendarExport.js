// ============================================
// CALENDAR EXPORT UTILITY
// Generates ICS files and Google Calendar URLs
// for native calendar integration
// ============================================

import { isCrossMidnight } from './recurrence';

// ── ICS Text Escaping (RFC 5545) ────────────
function escapeICS(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// ── Date Helpers ────────────────────────────

/**
 * Get the YYYY-MM-DD date string from a task.
 * Virtual instances use _instanceDate; regular tasks extract from scheduledDate.
 */
function getTaskDateStr(task) {
  if (task._instanceDate) return task._instanceDate;
  if (task.scheduledDate) {
    // scheduledDate is ISO 8601 — extract local date
    const d = new Date(task.scheduledDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // Fallback to today
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Format date + time into ICS datetime: YYYYMMDDTHHmmss
 */
function formatICSDateTime(dateStr, timeStr) {
  const [year, month, day] = dateStr.split('-');
  const [hour, minute] = (timeStr || '09:00').split(':');
  return `${year}${month}${day}T${hour}${minute}00`;
}

/**
 * Add one day to a YYYY-MM-DD string (for cross-midnight DTEND)
 */
function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d + 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get current UTC datetime in ICS format (for DTSTAMP)
 */
function nowUTC() {
  const d = new Date();
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// ── Recurrence Rule Builder ─────────────────

const ICS_DAY_NAMES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function buildRRule(task) {
  if (!task.recurrence || task.recurrence === 'none') return null;

  switch (task.recurrence) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';

    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';

    case 'weekly': {
      if (task.weeklyDays && task.weeklyDays.length > 0) {
        const days = task.weeklyDays.map(d => ICS_DAY_NAMES[d]).join(',');
        return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
      }
      const scheduledDay = new Date(task.scheduledDate).getDay();
      return `RRULE:FREQ=WEEKLY;BYDAY=${ICS_DAY_NAMES[scheduledDay]}`;
    }

    case 'biweekly': {
      const scheduledDay = new Date(task.scheduledDate).getDay();
      return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${ICS_DAY_NAMES[scheduledDay]}`;
    }

    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';

    case 'yearly':
      return 'RRULE:FREQ=YEARLY';

    case 'custom':
      return buildCustomRRule(task.customRecurrence);

    default:
      return null;
  }
}

function buildCustomRRule(cr) {
  if (!cr) return null;
  let rule = `RRULE:FREQ=${(cr.frequency || 'daily').toUpperCase()}`;
  if (cr.interval && cr.interval > 1) rule += `;INTERVAL=${cr.interval}`;
  if (cr.frequency === 'weekly' && cr.daysOfWeek?.length > 0) {
    rule += `;BYDAY=${cr.daysOfWeek.map(d => ICS_DAY_NAMES[d]).join(',')}`;
  }
  if (cr.endType === 'date' && cr.endDate) {
    rule += `;UNTIL=${cr.endDate.replace(/-/g, '')}T235959`;
  }
  if (cr.endType === 'count' && cr.endCount) {
    rule += `;COUNT=${cr.endCount}`;
  }
  return rule;
}

// ── VALARM Builder ──────────────────────────

function buildVAlarms(task) {
  const minutes = task.reminderMinutes || 15;
  const alarms = [buildSingleAlarm(minutes)];

  if (Array.isArray(task.extraReminders)) {
    task.extraReminders.forEach(m => {
      if (m !== minutes) alarms.push(buildSingleAlarm(m));
    });
  }

  return alarms.join('\r\n');
}

function buildSingleAlarm(minutes) {
  return [
    'BEGIN:VALARM',
    `TRIGGER:-PT${minutes}M`,
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder',
    'END:VALARM',
  ].join('\r\n');
}

// ── Description Builder ─────────────────────

function buildDescription(task, goalTitle) {
  const parts = [];
  if (task.description) parts.push(task.description);
  if (goalTitle) parts.push(`Goal: ${goalTitle}`);
  if (task.type) {
    const typeLabels = { task: 'Task', appointment: 'Appointment', habit: 'Habit', routine: 'Routine' };
    parts.push(`Type: ${typeLabels[task.type] || task.type}`);
  }
  return escapeICS(parts.join('\n'));
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Generate an ICS (iCalendar) string for a task.
 * @param {Object} task - The task/event object
 * @param {Object} options - { goalTitle?: string, exportMode?: 'single' | 'series' }
 * @returns {string} ICS file content
 */
export function generateICS(task, options = {}) {
  const { goalTitle, exportMode = 'single' } = options;

  const dateStr = getTaskDateStr(task);
  const startTime = task.startTime || '09:00';
  const endTime = task.endTime || '10:00';

  const dtStart = formatICSDateTime(dateStr, startTime);

  // Handle cross-midnight: DTEND should be next day
  const endDateStr = isCrossMidnight(task) ? addOneDay(dateStr) : dateStr;
  const dtEnd = formatICSDateTime(endDateStr, endTime);

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GoalPlannerApp//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${task.id}@goalplannerapp`,
    `DTSTAMP:${nowUTC()}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(task.title || 'Event')}`,
  ];

  // Description
  const desc = buildDescription(task, goalTitle);
  if (desc) lines.push(`DESCRIPTION:${desc}`);

  // Recurrence rule (only for series export)
  if (exportMode === 'series') {
    const rrule = buildRRule(task);
    if (rrule) lines.push(rrule);
  }

  // Priority mapping
  if (task.priority === 'high') lines.push('PRIORITY:1');
  else if (task.priority === 'low') lines.push('PRIORITY:9');

  // Alarms
  if (task.reminderEnabled !== false) {
    lines.push(buildVAlarms(task));
  }

  lines.push('END:VEVENT');
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

/**
 * Download an ICS file for a task.
 * @param {Object} task - The task/event object
 * @param {Object} options - { goalTitle?: string, exportMode?: 'single' | 'series' }
 */
export function downloadICS(task, options = {}) {
  const icsContent = generateICS(task, options);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (task.title || 'event')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  a.download = `${safeName}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a Google Calendar URL with pre-filled event data.
 * @param {Object} task - The task/event object
 * @param {Object} options - { goalTitle?: string, exportMode?: 'single' | 'series' }
 * @returns {string} Google Calendar URL
 */
export function generateGoogleCalendarURL(task, options = {}) {
  const { goalTitle, exportMode = 'single' } = options;

  const dateStr = getTaskDateStr(task);
  const startTime = task.startTime || '09:00';
  const endTime = task.endTime || '10:00';

  const startDT = formatICSDateTime(dateStr, startTime);
  const endDateStr = isCrossMidnight(task) ? addOneDay(dateStr) : dateStr;
  const endDT = formatICSDateTime(endDateStr, endTime);

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', task.title || 'Event');
  params.set('dates', `${startDT}/${endDT}`);

  // Description (plain text, not ICS-escaped)
  const descParts = [];
  if (task.description) descParts.push(task.description);
  if (goalTitle) descParts.push(`Goal: ${goalTitle}`);
  if (descParts.length > 0) params.set('details', descParts.join('\n'));

  // Recurrence (series mode)
  if (exportMode === 'series') {
    const rrule = buildRRule(task);
    if (rrule) params.set('recur', rrule);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
