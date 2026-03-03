import {
  parseISO, isSameDay, getDay, getDate, getMonth,
  startOfDay, startOfWeek,
  differenceInCalendarDays, differenceInCalendarWeeks,
  differenceInCalendarMonths, differenceInCalendarYears,
  isBefore, isAfter, format, addDays, addWeeks,
} from 'date-fns';

// Check if a recurring task should appear on a given date
export function doesTaskOccurOnDate(task, targetDate) {
  if (!task.scheduledDate || !task.recurrence || task.recurrence === 'none') {
    return false;
  }

  const origin = startOfDay(parseISO(task.scheduledDate));
  const target = startOfDay(targetDate);

  // Never show before the original date
  if (isBefore(target, origin)) return false;

  // Original date always matches
  if (isSameDay(origin, target)) return true;

  switch (task.recurrence) {
    case 'daily':
      return true;

    case 'weekdays': {
      const dow = getDay(target); // 0=Sun, 6=Sat
      return dow >= 1 && dow <= 5;
    }

    case 'weekly': {
      if (task.weeklyDays && task.weeklyDays.length > 0) {
        return task.weeklyDays.includes(getDay(target));
      }
      return getDay(target) === getDay(origin);
    }

    case 'biweekly': {
      if (getDay(target) !== getDay(origin)) return false;
      const daysDiff = differenceInCalendarDays(target, origin);
      return daysDiff % 14 === 0;
    }

    case 'monthly':
      return getDate(target) === getDate(origin);

    case 'yearly':
      return getDate(target) === getDate(origin)
        && getMonth(target) === getMonth(origin);

    case 'custom':
      return matchesCustomRecurrence(task.customRecurrence, origin, target);

    default:
      return false;
  }
}

// Evaluate custom recurrence rules
function matchesCustomRecurrence(cr, origin, target) {
  if (!cr) return false;
  const { frequency, interval = 1, daysOfWeek } = cr;

  // Check end conditions
  if (!isWithinEndCondition(cr, origin, target)) return false;

  switch (frequency) {
    case 'daily': {
      const daysDiff = differenceInCalendarDays(target, origin);
      return daysDiff % interval === 0;
    }

    case 'weekly': {
      // Check if target day-of-week is in selected days (or matches origin day)
      const targetDow = getDay(target);
      const isDayMatch = (daysOfWeek && daysOfWeek.length > 0)
        ? daysOfWeek.includes(targetDow)
        : getDay(target) === getDay(origin);
      if (!isDayMatch) return false;

      // Check correct interval week
      const originWeekStart = startOfWeek(origin, { weekStartsOn: 0 });
      const targetWeekStart = startOfWeek(target, { weekStartsOn: 0 });
      const weeksDiff = differenceInCalendarWeeks(targetWeekStart, originWeekStart, { weekStartsOn: 0 });
      return weeksDiff % interval === 0;
    }

    case 'monthly': {
      if (getDate(target) !== getDate(origin)) return false;
      const monthsDiff = differenceInCalendarMonths(target, origin);
      return monthsDiff % interval === 0;
    }

    case 'yearly': {
      if (getDate(target) !== getDate(origin)) return false;
      if (getMonth(target) !== getMonth(origin)) return false;
      const yearsDiff = differenceInCalendarYears(target, origin);
      return yearsDiff % interval === 0;
    }

    default:
      return false;
  }
}

// Check end conditions for custom recurrence
function isWithinEndCondition(cr, origin, target) {
  if (!cr) return true;

  switch (cr.endType) {
    case 'never':
      return true;

    case 'date': {
      if (!cr.endDate) return true;
      // endDate is 'YYYY-MM-DD' string — parse as local date
      const end = startOfDay(new Date(cr.endDate + 'T00:00:00'));
      return !isAfter(target, end);
    }

    case 'count': {
      if (!cr.endCount) return true;
      const count = countOccurrences(cr, origin, target);
      return count <= cr.endCount;
    }

    default:
      return true;
  }
}

// Count how many occurrences from origin through target (inclusive)
function countOccurrences(cr, origin, target) {
  const { frequency, interval = 1, daysOfWeek } = cr;

  switch (frequency) {
    case 'daily': {
      const daysDiff = differenceInCalendarDays(target, origin);
      return Math.floor(daysDiff / interval) + 1;
    }

    case 'weekly': {
      if (daysOfWeek && daysOfWeek.length > 0) {
        return countWeeklyWithDays(origin, target, interval, daysOfWeek);
      }
      const weeksDiff = differenceInCalendarWeeks(target, origin, { weekStartsOn: 0 });
      return Math.floor(weeksDiff / interval) + 1;
    }

    case 'monthly': {
      const monthsDiff = differenceInCalendarMonths(target, origin);
      return Math.floor(monthsDiff / interval) + 1;
    }

    case 'yearly': {
      const yearsDiff = differenceInCalendarYears(target, origin);
      return Math.floor(yearsDiff / interval) + 1;
    }

    default:
      return 1;
  }
}

// Count weekly occurrences with specific days-of-week
function countWeeklyWithDays(origin, target, interval, daysOfWeek) {
  const originWeekStart = startOfWeek(origin, { weekStartsOn: 0 });
  const targetWeekStart = startOfWeek(target, { weekStartsOn: 0 });
  const weeksDiff = differenceInCalendarWeeks(targetWeekStart, originWeekStart, { weekStartsOn: 0 });
  const periodIndex = Math.floor(weeksDiff / interval);
  const daysPerPeriod = daysOfWeek.length;
  let count = periodIndex * daysPerPeriod;

  // Add occurrences in current period up to target
  const currentPeriodStart = addWeeks(originWeekStart, periodIndex * interval);
  for (const dow of daysOfWeek.sort((a, b) => a - b)) {
    const dayInPeriod = addDays(currentPeriodStart, dow);
    if (!isBefore(dayInPeriod, origin) && !isAfter(dayInPeriod, target)) {
      count++;
    }
  }
  return count;
}

// Create a virtual instance of a recurring task for a specific date
export function createVirtualInstance(task, targetDate) {
  const dateStr = format(targetDate, 'yyyy-MM-dd');
  const isCompleted = Array.isArray(task.completedDates)
    && task.completedDates.includes(dateStr);

  return {
    ...task,
    id: `${task.id}_${dateStr}`,
    _parentId: task.id,
    _instanceDate: dateStr,
    _isVirtual: true,
    completed: isCompleted,
  };
}

// Parse a virtual instance ID back into parentId + dateStr
// Supports standard IDs ({parentId}_{YYYY-MM-DD}) and
// segment IDs ({parentId}_start_{YYYY-MM-DD}, {parentId}_cont_{YYYY-MM-DD})
export function parseVirtualId(id) {
  if (typeof id !== 'string') return null;
  // Segment IDs: {parentId}_start_{YYYY-MM-DD} or {parentId}_cont_{YYYY-MM-DD}
  const segMatch = id.match(/^(.+)_(start|cont)_(\d{4}-\d{2}-\d{2})$/);
  if (segMatch) {
    return { parentId: segMatch[1], dateStr: segMatch[3], segment: segMatch[2] };
  }
  // Standard virtual ID: {parentId}_{YYYY-MM-DD}
  const sep = id.lastIndexOf('_');
  if (sep === -1) return null;
  const dateStr = id.substring(sep + 1);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return { parentId: id.substring(0, sep), dateStr };
}

// Check if a task spans across midnight (endTime < startTime)
export function isCrossMidnight(task) {
  if (!task.startTime || !task.endTime) return false;
  const [sH, sM] = task.startTime.split(':').map(Number);
  const [eH, eM] = task.endTime.split(':').map(Number);
  return (eH * 60 + eM) < (sH * 60 + sM);
}

// Create start-segment instance for cross-midnight events (startTime → 23:59)
export function createStartSegmentInstance(task, targetDate) {
  const dateStr = format(targetDate, 'yyyy-MM-dd');
  const isCompleted = (task.recurrence && task.recurrence !== 'none')
    ? (Array.isArray(task.completedDates) && task.completedDates.includes(dateStr))
    : task.completed;
  return {
    ...task,
    id: `${task.id}_start_${dateStr}`,
    _parentId: task.id,
    _instanceDate: dateStr,
    _isVirtual: true,
    _segment: 'start',
    endTime: '23:59',
    completed: isCompleted,
  };
}

// Create continuation instance for cross-midnight events (00:00 → endTime)
// Appears on the NEXT day after the start; _instanceDate tracks the start date
export function createContinuationInstance(task, targetDate) {
  const prevDate = addDays(targetDate, -1);
  const startDateStr = format(prevDate, 'yyyy-MM-dd');
  const isCompleted = (task.recurrence && task.recurrence !== 'none')
    ? (Array.isArray(task.completedDates) && task.completedDates.includes(startDateStr))
    : task.completed;
  return {
    ...task,
    id: `${task.id}_cont_${startDateStr}`,
    _parentId: task.id,
    _instanceDate: startDateStr,
    _isVirtual: true,
    _segment: 'continuation',
    startTime: '00:00',
    completed: isCompleted,
  };
}
