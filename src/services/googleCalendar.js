/**
 * Google Calendar Integration Service
 *
 * Syncs Short-Term Calendar tasks to Google Calendar so users get
 * native notifications (lock screen, vibration, sound) on all devices.
 *
 * Uses Google Identity Services (GIS) for OAuth2 and the
 * Google Calendar API v3 for event CRUD.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

let tokenClient = null;
let accessToken = null;
let tokenExpiresAt = 0;

// ============================================
// INITIALIZATION
// ============================================

/**
 * Check if Google Calendar integration is configured
 */
export function isGoogleCalendarConfigured() {
  return Boolean(CLIENT_ID);
}

/**
 * Load the Google Identity Services script dynamically
 */
function loadGISScript() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', resolve);
      existing.addEventListener('error', reject);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Initialize the Google OAuth token client.
 * Must be called once before any sign-in attempt.
 */
export async function initGoogleCalendar() {
  if (!CLIENT_ID) {
    console.log('[GCal] No client ID configured');
    return false;
  }

  try {
    await loadGISScript();

    // Check for saved token
    const saved = localStorage.getItem('gcal_token');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.expiresAt > Date.now()) {
          accessToken = parsed.token;
          tokenExpiresAt = parsed.expiresAt;
          console.log('[GCal] Restored saved token');
        }
      } catch (e) {
        localStorage.removeItem('gcal_token');
      }
    }

    console.log('[GCal] Initialized');
    return true;
  } catch (err) {
    console.error('[GCal] Failed to load GIS script:', err);
    return false;
  }
}

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Sign in to Google and request Calendar access.
 * Opens a popup for the user to grant permission.
 * Returns the access token on success.
 */
export function signInToGoogle() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          console.error('[GCal] Auth error:', response.error);
          reject(new Error(response.error));
          return;
        }

        accessToken = response.access_token;
        // Token expires in ~3600 seconds
        tokenExpiresAt = Date.now() + (response.expires_in || 3600) * 1000;

        // Save token
        localStorage.setItem('gcal_token', JSON.stringify({
          token: accessToken,
          expiresAt: tokenExpiresAt,
        }));

        console.log('[GCal] Signed in successfully');
        resolve(accessToken);
      },
    });

    tokenClient.requestAccessToken();
  });
}

/**
 * Sign out of Google Calendar
 */
export function signOutOfGoogle() {
  if (accessToken && window.google?.accounts?.oauth2) {
    window.google.accounts.oauth2.revoke(accessToken, () => {
      console.log('[GCal] Token revoked');
    });
  }

  accessToken = null;
  tokenExpiresAt = 0;
  localStorage.removeItem('gcal_token');
  localStorage.removeItem('gcal_event_map');
  console.log('[GCal] Signed out');
}

/**
 * Check if currently signed in with a valid token
 */
export function isGoogleSignedIn() {
  return Boolean(accessToken && tokenExpiresAt > Date.now());
}

/**
 * Get a valid access token, refreshing if needed
 */
async function getToken() {
  if (accessToken && tokenExpiresAt > Date.now() + 60000) {
    return accessToken;
  }

  // Token expired or about to — need to re-auth
  // GIS doesn't support silent refresh without interaction,
  // so we'll try with prompt: 'none' first
  return signInToGoogle();
}

// ============================================
// EVENT MAPPING (app task ID <-> Google event ID)
// ============================================

function getEventMap() {
  try {
    return JSON.parse(localStorage.getItem('gcal_event_map') || '{}');
  } catch {
    return {};
  }
}

function saveEventMap(map) {
  localStorage.setItem('gcal_event_map', JSON.stringify(map));
}

function setEventMapping(taskId, googleEventId) {
  const map = getEventMap();
  map[taskId] = googleEventId;
  saveEventMap(map);
}

function getGoogleEventId(taskId) {
  return getEventMap()[taskId] || null;
}

function removeEventMapping(taskId) {
  const map = getEventMap();
  delete map[taskId];
  saveEventMap(map);
}

// ============================================
// TASK → GOOGLE EVENT CONVERSION
// ============================================

/**
 * Convert an app task to a Google Calendar event object
 */
function taskToGoogleEvent(task) {
  // Parse scheduled date
  const dateStr = task.scheduledDate;
  let year, month, day;

  if (dateStr && dateStr.includes('T')) {
    const parsed = new Date(dateStr);
    year = parsed.getFullYear();
    month = parsed.getMonth();
    day = parsed.getDate();
  } else if (dateStr) {
    const parts = dateStr.split('-').map(Number);
    year = parts[0];
    month = parts[1] - 1;
    day = parts[2];
  } else {
    const now = new Date();
    year = now.getFullYear();
    month = now.getMonth();
    day = now.getDate();
  }

  // Parse start time
  const [startH, startM] = (task.startTime || '09:00').split(':').map(Number);
  const startDate = new Date(year, month, day, startH, startM);

  // Parse end time
  let endDate;
  if (task.endTime) {
    const [endH, endM] = task.endTime.split(':').map(Number);
    endDate = new Date(year, month, day, endH, endM);
    // If end is before start, assume next day
    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }
  } else {
    // Default to 1 hour duration
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
  }

  // Format as RFC3339 with timezone offset
  const formatRFC3339 = (d) => {
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const absOffset = Math.abs(offset);
    const hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const minutes = String(absOffset % 60).padStart(2, '0');
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0') + 'T' +
      String(d.getHours()).padStart(2, '0') + ':' +
      String(d.getMinutes()).padStart(2, '0') + ':00' +
      sign + hours + ':' + minutes;
  };

  const event = {
    summary: task.title,
    description: task.description || '',
    start: {
      dateTime: formatRFC3339(startDate),
    },
    end: {
      dateTime: formatRFC3339(endDate),
    },
    reminders: {
      useDefault: false,
      overrides: [],
    },
  };

  // Add reminders if enabled
  if (task.reminder) {
    const mins = task.reminderMinutes || 15;
    event.reminders.overrides.push(
      { method: 'popup', minutes: mins },
    );
    // Also add a second reminder at event time
    if (mins > 0) {
      event.reminders.overrides.push(
        { method: 'popup', minutes: 0 },
      );
    }
  } else {
    // Default: remind at event time and 10 min before
    event.reminders.overrides.push(
      { method: 'popup', minutes: 10 },
      { method: 'popup', minutes: 0 },
    );
  }

  // Add recurrence if applicable
  if (task.recurrence && task.recurrence !== 'none') {
    const rrule = buildRRule(task);
    if (rrule) {
      event.recurrence = [rrule];
    }
  }

  // Color mapping (Google Calendar color IDs)
  const colorMap = {
    red: '11',
    orange: '6',
    yellow: '5',
    green: '10',
    blue: '9',
    purple: '3',
    pink: '4',
  };
  if (task.color && colorMap[task.color]) {
    event.colorId = colorMap[task.color];
  }

  return event;
}

/**
 * Build an RRULE string from task recurrence settings
 */
function buildRRule(task) {
  switch (task.recurrence) {
    case 'daily':
      return 'RRULE:FREQ=DAILY';
    case 'weekly':
      if (task.weeklyDays && task.weeklyDays.length > 0) {
        const dayMap = { 0: 'SU', 1: 'MO', 2: 'TU', 3: 'WE', 4: 'TH', 5: 'FR', 6: 'SA' };
        const days = task.weeklyDays.map(d => dayMap[d]).join(',');
        return `RRULE:FREQ=WEEKLY;BYDAY=${days}`;
      }
      return 'RRULE:FREQ=WEEKLY';
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY';
    case 'weekdays':
      return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
    default:
      return null;
  }
}

// ============================================
// GOOGLE CALENDAR API CALLS
// ============================================

/**
 * Create an event on Google Calendar
 * @returns {string|null} Google event ID
 */
export async function createGoogleEvent(task) {
  if (!isGoogleSignedIn()) {
    console.log('[GCal] Not signed in — skipping sync');
    return null;
  }

  const token = await getToken();
  const event = taskToGoogleEvent(task);

  try {
    const response = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const err = await response.json();
      console.error('[GCal] Create failed:', err.error?.message || response.status);
      return null;
    }

    const created = await response.json();
    setEventMapping(task.id, created.id);
    console.log('[GCal] Event created:', task.title, '→', created.id);
    return created.id;
  } catch (err) {
    console.error('[GCal] Create error:', err);
    return null;
  }
}

/**
 * Update an existing Google Calendar event
 */
export async function updateGoogleEvent(taskId, task) {
  if (!isGoogleSignedIn()) return null;

  const googleEventId = getGoogleEventId(taskId);
  if (!googleEventId) {
    // No existing event — create new one
    return createGoogleEvent({ ...task, id: taskId });
  }

  const token = await getToken();
  const event = taskToGoogleEvent(task);

  try {
    const response = await fetch(`${CALENDAR_API}/calendars/primary/events/${googleEventId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Event was deleted on Google side — recreate
        removeEventMapping(taskId);
        return createGoogleEvent({ ...task, id: taskId });
      }
      const err = await response.json();
      console.error('[GCal] Update failed:', err.error?.message || response.status);
      return null;
    }

    console.log('[GCal] Event updated:', task.title);
    return googleEventId;
  } catch (err) {
    console.error('[GCal] Update error:', err);
    return null;
  }
}

/**
 * Delete a Google Calendar event
 */
export async function deleteGoogleEvent(taskId) {
  if (!isGoogleSignedIn()) return;

  const googleEventId = getGoogleEventId(taskId);
  if (!googleEventId) return;

  const token = await getToken();

  try {
    const response = await fetch(`${CALENDAR_API}/calendars/primary/events/${googleEventId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (response.ok || response.status === 404 || response.status === 410) {
      removeEventMapping(taskId);
      console.log('[GCal] Event deleted for task:', taskId);
    } else {
      console.error('[GCal] Delete failed:', response.status);
    }
  } catch (err) {
    console.error('[GCal] Delete error:', err);
  }
}

/**
 * Sync ALL existing tasks to Google Calendar.
 * Used after initial sign-in to push everything.
 */
export async function syncAllTasksToGoogle(tasks) {
  if (!isGoogleSignedIn()) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  for (const task of tasks) {
    // Only sync tasks with a scheduled date and time
    if (!task.scheduledDate || !task.startTime) continue;
    if (task.completed) continue;

    try {
      const existingId = getGoogleEventId(task.id);
      if (existingId) {
        await updateGoogleEvent(task.id, task);
      } else {
        await createGoogleEvent(task);
      }
      synced++;
    } catch (err) {
      failed++;
      console.error('[GCal] Sync failed for:', task.title, err);
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`[GCal] Bulk sync complete: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}

// ============================================
// EXPORTS
// ============================================

export default {
  isGoogleCalendarConfigured,
  initGoogleCalendar,
  signInToGoogle,
  signOutOfGoogle,
  isGoogleSignedIn,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
  syncAllTasksToGoogle,
};
