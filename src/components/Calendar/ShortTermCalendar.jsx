import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  format,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  addMonths,
  isSameDay,
  isToday,
  parseISO,
  setHours,
  setMinutes,
  differenceInMinutes,
  eachDayOfInterval,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  Clock,
  X,
  Save,
  Trash2,
  Bell,
  Repeat,
  Plus,
  Sun,
  Moon,
  CheckCircle2,
  Circle,
  ZoomIn,
  ZoomOut,
  Crosshair,
} from 'lucide-react';
import './ShortTermCalendar.css';

const viewOptions = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

// Generate time slots for 24 hours in 1-minute increments (display every 15 min)
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 1) {
      slots.push({
        hour,
        minute,
        label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        displayLabel: minute === 0 ? format(setHours(setMinutes(new Date(), minute), hour), 'h a') : '',
        isHourMark: minute === 0,
        is15MinMark: minute % 15 === 0,
      });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

// Zoom presets: each level increases pixels-per-hour
// Normal zoom: scrollable 24-hour view at various densities
// Hour-focus: locks view to a small time window for maximum detail
const ZOOM_LEVELS = [
  { label: '1x',   hourHeight: 60,   hourFocus: false },
  { label: '1.5x', hourHeight: 90,   hourFocus: false },
  { label: '2x',   hourHeight: 120,  hourFocus: false },
  { label: '3x',   hourHeight: 180,  hourFocus: false },
  { label: '5x',   hourHeight: 300,  hourFocus: false },
  { label: '8x',   hourHeight: 480,  hourFocus: false },
  { label: '12x',  hourHeight: 720,  hourFocus: true },  // ~2hr window, 12px/min
  { label: '20x',  hourHeight: 1200, hourFocus: true },  // ~1hr window, 20px/min — a 5min event = 100px
  { label: '30x',  hourHeight: 1800, hourFocus: true },  // 30min window, 30px/min — a 4min event = 120px
];

// Recurrence options
const recurrenceOptions = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom...' },
];

// Task type options
const taskTypeOptions = [
  { value: 'task', label: 'Task' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'habit', label: 'Habit' },
  { value: 'routine', label: 'Routine' },
];

// Color options for events — solid opaque colors
// bg = card background (solid), accent = left border (darker shade)
const EVENT_COLORS = [
  { id: 'default', label: 'Default (Priority)', color: null },
  { id: 'blue', label: 'Blue', bg: '#2563eb', accent: '#1e40af', border: '#3b82f6', text: '#fff' },
  { id: 'purple', label: 'Purple', bg: '#7c3aed', accent: '#5b21b6', border: '#8b5cf6', text: '#fff' },
  { id: 'green', label: 'Green', bg: '#16a34a', accent: '#14532d', border: '#22c55e', text: '#fff' },
  { id: 'orange', label: 'Orange', bg: '#ea580c', accent: '#9a3412', border: '#f97316', text: '#fff' },
  { id: 'red', label: 'Red', bg: '#dc2626', accent: '#991b1b', border: '#ef4444', text: '#fff' },
  { id: 'yellow', label: 'Yellow', bg: '#ca8a04', accent: '#854d0e', border: '#eab308', text: '#fff' },
  { id: 'pink', label: 'Pink', bg: '#db2777', accent: '#9d174d', border: '#ec4899', text: '#fff' },
  { id: 'teal', label: 'Teal', bg: '#0d9488', accent: '#134e4a', border: '#14b8a6', text: '#fff' },
  { id: 'indigo', label: 'Indigo', bg: '#4f46e5', accent: '#3730a3', border: '#6366f1', text: '#fff' },
  { id: 'cyan', label: 'Cyan', bg: '#0891b2', accent: '#164e63', border: '#06b6d4', text: '#fff' },
];

const getEventColor = (task) => {
  if (task.color && task.color !== 'default') {
    const colorObj = EVENT_COLORS.find(c => c.id === task.color);
    if (colorObj) return colorObj;
  }
  return null; // Use priority-based colors
};

// =========================================================
// Overlap Layout Algorithm (Google Calendar / TickTick style)
// Detects overlapping events and assigns column positions
// so they render side-by-side instead of stacking.
// =========================================================
const computeOverlapLayout = (tasks) => {
  // Parse time fields into minutes for comparison
  const timed = tasks
    .filter(t => t.startTime && t.endTime)
    .map(t => {
      const [sH, sM] = t.startTime.split(':').map(Number);
      const [eH, eM] = t.endTime.split(':').map(Number);
      return { id: t.id, start: sH * 60 + sM, end: eH * 60 + eM };
    })
    .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  if (timed.length === 0) return new Map();

  const layout = new Map(); // taskId -> { column, totalColumns }

  // Step 1: Group into clusters — a cluster is a maximal set of events
  // where each event overlaps with at least one other in the cluster.
  // A cluster ends when the next event starts at or after all current events end.
  let clusters = [];
  let currentCluster = [timed[0]];
  let clusterEnd = timed[0].end;

  for (let i = 1; i < timed.length; i++) {
    if (timed[i].start < clusterEnd) {
      // Overlaps with cluster — add to it
      currentCluster.push(timed[i]);
      clusterEnd = Math.max(clusterEnd, timed[i].end);
    } else {
      // No overlap — close current cluster, start new one
      clusters.push(currentCluster);
      currentCluster = [timed[i]];
      clusterEnd = timed[i].end;
    }
  }
  clusters.push(currentCluster);

  // Step 2: Within each cluster, assign columns greedily.
  // For each event, pick the first column where it doesn't overlap
  // with any existing event in that column.
  for (const cluster of clusters) {
    const columns = []; // columns[i] = array of events assigned to column i

    for (const event of cluster) {
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        // Check if this event overlaps with the last event in this column
        const lastInCol = columns[col][columns[col].length - 1];
        if (event.start >= lastInCol.end) {
          // No overlap — place here
          columns[col].push(event);
          layout.set(event.id, { column: col, totalColumns: 0 });
          placed = true;
          break;
        }
      }
      if (!placed) {
        // New column needed
        columns.push([event]);
        layout.set(event.id, { column: columns.length - 1, totalColumns: 0 });
      }
    }

    // Set totalColumns for every event in this cluster
    const totalCols = columns.length;
    for (const event of cluster) {
      const info = layout.get(event.id);
      info.totalColumns = totalCols;
    }
  }

  return layout;
};

export default function ShortTermCalendar() {
  const { tasks, addTask, updateTask, deleteTask, openDetail, toggleTaskComplete, lastSaveStatus } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('day');
  const [currentTime, setCurrentTime] = useState(new Date());
  const calendarRef = useRef(null);
  const timeIndicatorRef = useRef(null);

  // Zoom state (default to 2x for Day view so entries are readable)
  const [zoomLevel, setZoomLevel] = useState(2);
  const [focusHour, setFocusHour] = useState(() => new Date().getHours()); // Which hour to focus on in hour-focus mode
  const isHourFocus = ZOOM_LEVELS[zoomLevel].hourFocus && view === 'day';
  const HOUR_HEIGHT = (view === 'day' || view === 'week') ? ZOOM_LEVELS[zoomLevel].hourHeight : 60;
  const SLOT_HEIGHT = HOUR_HEIGHT / 60; // px per minute

  // Ctrl+Scroll wheel zoom — standard zoom UX
  useEffect(() => {
    const container = calendarRef.current;
    if (!container || view === 'month') return;

    const handleWheel = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();

      // Get scroll position ratio before zoom to maintain position
      const scrollRatio = container.scrollTop / (container.scrollHeight - container.clientHeight || 1);
      const maxLevel = view === 'week' ? 5 : ZOOM_LEVELS.length - 1;

      setZoomLevel((prev) => {
        const next = e.deltaY < 0
          ? Math.min(maxLevel, prev + 1)    // scroll up = zoom in
          : Math.max(0, prev - 1);           // scroll down = zoom out
        // When entering hour-focus, set focus to current hour
        if (ZOOM_LEVELS[next].hourFocus && !ZOOM_LEVELS[prev].hourFocus) {
          // Calculate which hour is at the center of the viewport
          const centerY = container.scrollTop + container.clientHeight / 2;
          const centerHour = Math.floor(centerY / ZOOM_LEVELS[prev].hourHeight);
          setFocusHour(Math.max(0, Math.min(23, centerHour)));
        }
        return next;
      });

      // Restore scroll position after React re-render
      requestAnimationFrame(() => {
        const newMaxScroll = container.scrollHeight - container.clientHeight;
        container.scrollTop = scrollRatio * newMaxScroll;
      });
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [view, zoomLevel]);

  // Routine progress banner visibility (collapsed by default to prioritize calendar)
  const [routineBannerOpen, setRoutineBannerOpen] = useState(false);

  // Routine progress tracking for today
  const todayRoutineTasks = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return tasks.filter(
      (t) => t.type === 'routine' && t.scheduledDate && t.scheduledDate.startsWith(todayStr)
    );
  }, [tasks]);

  const routineProgress = useMemo(() => {
    if (todayRoutineTasks.length === 0) return null;
    const completed = todayRoutineTasks.filter((t) => t.completed).length;
    const total = todayRoutineTasks.length;
    const percentage = Math.round((completed / total) * 100);

    // Find current/next routine task
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    let currentTask = null;
    let nextTask = null;

    for (const task of todayRoutineTasks) {
      if (task.completed) continue;
      if (!task.startTime || !task.endTime) continue;

      const [startH, startM] = task.startTime.split(':').map(Number);
      const [endH, endM] = task.endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        currentTask = task;
      } else if (currentMinutes < startMinutes && !nextTask) {
        nextTask = task;
      }
    }

    return { completed, total, percentage, currentTask, nextTask };
  }, [todayRoutineTasks]);

  // Modal state for creating/editing events
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    color: 'default',
    scheduledDate: '',
    startTime: '09:00',
    endTime: '10:00',
    recurrence: 'none',
    customRecurrence: {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [],
      endType: 'never',
      endDate: '',
      endCount: 10,
    },
    reminder: false,
    reminderMinutes: 15,
  });
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to current time on mount and when view changes
  useEffect(() => {
    if (timeIndicatorRef.current && calendarRef.current) {
      const indicatorTop = timeIndicatorRef.current.offsetTop;
      calendarRef.current.scrollTop = indicatorTop - 200;
    }
  }, [view, currentDate]);

  // Navigation handlers
  const navigatePrev = () => {
    switch (view) {
      case 'day':
        setCurrentDate(addDays(currentDate, -1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, -1));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get tasks for a specific date
  const getTasksForDate = (date) => {
    return tasks.filter((task) => {
      if (!task.scheduledDate) return false;
      const taskDate = parseISO(task.scheduledDate);
      return isSameDay(taskDate, date);
    });
  };

  // Calculate task position and height based on time (1-minute precision)
  // Hour-focus window sizing: deeper zoom = narrower window
  const focusWindowHours = HOUR_HEIGHT >= 1800 ? 1 : HOUR_HEIGHT >= 1200 ? 2 : 3;
  const focusPaddingHours = Math.floor((focusWindowHours - 1) / 2);

  // Like One Calendar / TickTick: event height is STRICTLY proportional to duration.
  // A 6-minute event = 1/10th of an hour. A 30-minute event = half an hour.
  // GAP_PX scales with zoom so events are visually separated at every level.
  const GAP_PX = HOUR_HEIGHT >= 480 ? 3 : HOUR_HEIGHT >= 120 ? 2 : 1;

  const getTaskStyle = (task) => {
    if (!task.startTime || !task.endTime) return {};

    const [startHour, startMinute] = task.startTime.split(':').map(Number);
    const [endHour, endMinute] = task.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    // NO minimum duration override — actual duration drives the visual size
    const duration = Math.max(1, endMinutes - startMinutes);
    const heightPx = duration * SLOT_HEIGHT;

    return {
      // Inset from top by GAP_PX so there's a strip of grid above this event
      top: `${startMinutes * SLOT_HEIGHT + GAP_PX}px`,
      // Shrink height by 2*GAP_PX (top + bottom inset) to show grid between events
      height: `${Math.max(2, heightPx - GAP_PX * 2)}px`,
      minHeight: `${Math.max(2, heightPx - GAP_PX * 2)}px`,
    };
  };

  // Get duration category for CSS class (for visual scaling)
  const getDurationClass = (task) => {
    if (!task.startTime || !task.endTime) return '';
    const [startH, startM] = task.startTime.split(':').map(Number);
    const [endH, endM] = task.endTime.split(':').map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM);
    if (duration <= 10) return 'duration-tiny';
    if (duration <= 25) return 'duration-short';
    if (duration <= 60) return 'duration-medium';
    if (duration <= 120) return 'duration-long';
    return 'duration-extra-long';
  };

  // Calculate current time indicator position
  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    return totalMinutes * SLOT_HEIGHT;
  };

  // Get header text based on view
  const getHeaderText = () => {
    switch (view) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
        return format(currentDate, 'MMMM yyyy');
    }
  };

  // Get days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate);
    return eachDayOfInterval({ start, end: addDays(start, 6) });
  }, [currentDate]);

  // Get days for month view
  const monthDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Handle click on empty calendar slot to create new event
  const handleSlotClick = (date, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickY = e.clientY - rect.top + (calendarRef.current?.scrollTop || 0);
    const totalMinutes = Math.floor(clickY / SLOT_HEIGHT);
    const hour = Math.floor(totalMinutes / 60);
    const minute = Math.round((totalMinutes % 60) / 5) * 5; // Round to nearest 5 min

    const startTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    const endHour = hour + 1;
    const endTime = `${endHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    setEditingTask(null);
    setEventForm({
      title: '',
      description: '',
      type: 'task',
      priority: 'medium',
      color: 'default',
      scheduledDate: format(date, 'yyyy-MM-dd'),
      startTime,
      endTime,
      recurrence: 'none',
      customRecurrence: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [],
        endType: 'never',
        endDate: '',
        endCount: 10,
      },
      reminder: false,
      reminderMinutes: 15,
    });
    setShowEventModal(true);
  };

  // Handle click on existing task to edit
  const handleTaskClick = (task, e) => {
    e.stopPropagation();
    setEditingTask(task);
    setEventForm({
      title: task.title || '',
      description: task.description || '',
      type: task.type || 'task',
      priority: task.priority || 'medium',
      color: task.color || 'default',
      scheduledDate: task.scheduledDate ? format(parseISO(task.scheduledDate), 'yyyy-MM-dd') : '',
      startTime: task.startTime || '09:00',
      endTime: task.endTime || '10:00',
      recurrence: task.recurrence || 'none',
      customRecurrence: task.customRecurrence || {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [],
        endType: 'never',
        endDate: '',
        endCount: 10,
      },
      reminder: task.reminder || false,
      reminderMinutes: task.reminderMinutes || 15,
    });
    setShowEventModal(true);
  };

  // Double-click on event to zoom into its time range
  const handleTaskDoubleClick = (task, e) => {
    e.stopPropagation();
    if (!task.startTime || view !== 'day') return;
    const [sH] = task.startTime.split(':').map(Number);
    // Jump to a deep zoom level focused on this event's hour
    const targetLevel = Math.max(zoomLevel, 6); // At least 12x
    setZoomLevel(Math.min(targetLevel, ZOOM_LEVELS.length - 1));
    setFocusHour(sH);
  };

  // Save confirmation state
  const [saveConfirmation, setSaveConfirmation] = useState(null);

  // Save event (create or update)
  const handleSaveEvent = async () => {
    if (!eventForm.title.trim()) return;
    if (!eventForm.scheduledDate) return;

    // Build scheduledDate as local time to avoid timezone issues
    // Parse the date parts manually to avoid UTC interpretation
    const [year, month, day] = eventForm.scheduledDate.split('-').map(Number);
    const [startH, startM] = (eventForm.startTime || '09:00').split(':').map(Number);
    const localDate = new Date(year, month - 1, day, startH, startM);

    const eventData = {
      title: eventForm.title.trim(),
      description: eventForm.description,
      type: eventForm.type,
      priority: eventForm.priority,
      color: eventForm.color || 'default',
      scheduledDate: localDate.toISOString(),
      startTime: eventForm.startTime,
      endTime: eventForm.endTime,
      recurrence: eventForm.recurrence,
      customRecurrence: eventForm.recurrence === 'custom' ? eventForm.customRecurrence : null,
      reminder: eventForm.reminder,
      reminderMinutes: eventForm.reminderMinutes,
    };

    if (editingTask) {
      await updateTask(editingTask.id, eventData);
    } else {
      await addTask(eventData);
    }

    // Show save confirmation
    setSaveConfirmation(editingTask ? 'Event updated!' : 'Event saved!');
    setTimeout(() => setSaveConfirmation(null), 2500);

    setShowEventModal(false);
    setEditingTask(null);
  };

  // Delete event
  const handleDeleteEvent = () => {
    if (editingTask) {
      deleteTask(editingTask.id);
      setShowEventModal(false);
      setEditingTask(null);
    }
  };

  // Scroll to focused hour when hour-focus mode is active or focusHour changes
  useEffect(() => {
    if (isHourFocus && calendarRef.current) {
      const targetTop = focusHour * HOUR_HEIGHT;
      calendarRef.current.scrollTop = targetTop;
    }
  }, [focusHour, isHourFocus, HOUR_HEIGHT]);

  // Render time grid with tasks
  const renderTimeGrid = (dates, showTimeColumn = true) => {
    const isMultiDay = dates.length > 1;

    const hourFocusStyle = isHourFocus ? {
      height: `${focusWindowHours * HOUR_HEIGHT}px`,
      overflow: 'hidden',
    } : {};

    // Which hours to render time labels for
    const hoursToRender = isHourFocus
      ? Array.from({ length: focusWindowHours }, (_, i) => Math.max(0, Math.min(23, focusHour - focusPaddingHours + i)))
      : Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className={`time-grid-container ${isHourFocus ? 'hour-focus-mode' : ''}`} ref={calendarRef} style={isHourFocus ? { overflow: 'hidden' } : {}}>
        <div className={`time-grid ${isMultiDay ? 'multi-day' : 'single-day'}`} style={isHourFocus ? { minHeight: `${HOUR_HEIGHT * focusWindowHours}px`, position: 'relative' } : { minHeight: `${24 * HOUR_HEIGHT}px` }}>
          {/* Time labels column */}
          {showTimeColumn && (
            <div className="time-labels">
              {hoursToRender.map((hour) => (
                <div
                  key={hour}
                  className={`time-label ${isHourFocus && hour === focusHour ? 'focused' : ''}`}
                  style={{ height: HOUR_HEIGHT }}
                >
                  {format(setHours(new Date(), hour), 'h a')}
                </div>
              ))}
            </div>
          )}

          {/* Day columns */}
          {dates.map((date) => {
            const dayTasks = getTasksForDate(date);
            // In hour-focus mode, filter to tasks that overlap the focused hour window
            const visibleTasks = isHourFocus
              ? dayTasks.filter((task) => {
                  if (!task.startTime || !task.endTime) return false;
                  const [sH, sM] = task.startTime.split(':').map(Number);
                  const [eH, eM] = task.endTime.split(':').map(Number);
                  const taskStart = sH * 60 + sM;
                  const taskEnd = eH * 60 + eM;
                  const windowStart = Math.max(0, focusHour - focusPaddingHours) * 60;
                  const windowEnd = Math.min(24, focusHour + focusWindowHours - focusPaddingHours) * 60;
                  return taskEnd > windowStart && taskStart < windowEnd;
                })
              : dayTasks;
            const showIndicator = isToday(date);

            // In hour-focus mode, offset the tasks so the visible window starts at top
            const focusOffset = isHourFocus ? Math.max(0, focusHour - focusPaddingHours) * 60 * SLOT_HEIGHT : 0;

            return (
              <div key={date.toISOString()} className="day-column">
                {/* Day header for multi-day view */}
                {isMultiDay && (
                  <div className={`day-header ${isToday(date) ? 'today' : ''}`}>
                    <span className="day-name">{format(date, 'EEE')}</span>
                    <span className="day-number">{format(date, 'd')}</span>
                  </div>
                )}

                {/* Time slots - clickable area */}
                <div
                  className="day-slots"
                  onClick={(e) => handleSlotClick(date, e)}
                  style={isHourFocus ? { position: 'relative' } : {}}
                >
                  {/* Hour lines */}
                  {hoursToRender.map((hour) => (
                    <div
                      key={hour}
                      className={`hour-slot ${isHourFocus && hour === focusHour ? 'focused-hour' : ''}`}
                      style={{ height: HOUR_HEIGHT }}
                    >
                      {/* Sub-lines: at deep zoom show every 5 min, at medium zoom every 15 min */}
                      {isHourFocus ? (
                        <>
                          {Array.from({ length: 11 }, (_, i) => {
                            const minute = (i + 1) * 5;
                            const isMajor = minute % 15 === 0;
                            return (
                              <div key={i} className={`sub-line ${isMajor ? 'q-major' : 'q-minor'}`} style={{ top: `${(minute / 60) * 100}%` }}>
                                {HOUR_HEIGHT >= 720 && isMajor && (
                                  <span className="sub-line-label">:{minute.toString().padStart(2, '0')}</span>
                                )}
                              </div>
                            );
                          })}
                        </>
                      ) : HOUR_HEIGHT >= 300 ? (
                        /* At 5x+ zoom, show all 4 quarter lines plus extra at 10/20/40/50 */
                        <>
                          {Array.from({ length: 11 }, (_, i) => {
                            const minute = (i + 1) * 5;
                            const isMajor = minute % 15 === 0;
                            const isHalf = minute === 30;
                            return (
                              <div
                                key={i}
                                className={`quarter-line ${isHalf ? 'q2' : isMajor ? 'q1' : ''}`}
                                style={{
                                  top: `${(minute / 60) * 100}%`,
                                  background: isHalf ? 'rgba(255,255,255,0.1)' : isMajor ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
                                }}
                              />
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <div className="quarter-line q1" />
                          <div className="quarter-line q2" />
                          <div className="quarter-line q3" />
                        </>
                      )}
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {showIndicator && (
                    <div
                      ref={timeIndicatorRef}
                      className="current-time-indicator"
                      style={{ top: isHourFocus ? getCurrentTimePosition() - focusOffset : getCurrentTimePosition() }}
                    >
                      <div className="time-indicator-dot" />
                      <div className="time-indicator-line" />
                      {isHourFocus && (
                        <span className="time-indicator-label">{format(currentTime, 'h:mm a')}</span>
                      )}
                    </div>
                  )}

                  {/* Tasks — with overlap column layout */}
                  {(() => {
                    const overlapLayout = computeOverlapLayout(visibleTasks);
                    return visibleTasks.map((task) => {
                    const rawStyle = getTaskStyle(task);
                    // In hour-focus mode, offset top position
                    const taskStyle = isHourFocus ? {
                      ...rawStyle,
                      top: `${parseFloat(rawStyle.top) - focusOffset}px`,
                    } : rawStyle;

                    // Apply overlap column positioning
                    const colInfo = overlapLayout.get(task.id);
                    const COL_GAP = 2; // px gap between side-by-side columns
                    if (colInfo && colInfo.totalColumns > 1) {
                      const pct = 100 / colInfo.totalColumns;
                      taskStyle.left = `calc(${colInfo.column * pct}% + ${COL_GAP}px)`;
                      taskStyle.width = `calc(${pct}% - ${COL_GAP * 2}px)`;
                      taskStyle.right = 'auto';
                    }

                    const isZoomedIn = HOUR_HEIGHT >= 120;
                    const isDeepZoom = HOUR_HEIGHT >= 480;
                    const isUltraZoom = HOUR_HEIGHT >= 1200;
                    const durationCls = getDurationClass(task);
                    const customColor = getEventColor(task);
                    // For custom colors: solid opaque background + darker left accent
                    const colorStyle = customColor ? {
                      ...taskStyle,
                      background: customColor.bg,
                      borderLeftColor: customColor.accent,
                      color: '#fff',
                    } : taskStyle;

                    // Smart text: calculate how much content to show based on actual pixel height
                    const [sH, sM] = (task.startTime || '0:0').split(':').map(Number);
                    const [eH, eM] = (task.endTime || '0:0').split(':').map(Number);
                    const durationMin = Math.max(1, (eH * 60 + eM) - (sH * 60 + sM));
                    const boxHeightPx = durationMin * SLOT_HEIGHT;
                    // Content levels based on pixel height of this specific event:
                    const showTitle = boxHeightPx >= 14;
                    const showFullTitle = boxHeightPx >= 40;
                    const showDescription = boxHeightPx >= 80 && task.description;
                    // Compact single-line mode for events shorter than ~25px
                    const compactMode = boxHeightPx < 25;

                    return (
                      <div
                        key={task.id}
                        className={`calendar-task ${!customColor ? `priority-${task.priority}` : ''} type-${task.type} ${task.completed ? 'completed' : ''} ${isZoomedIn ? 'zoomed' : ''} ${isDeepZoom ? 'deep-zoom' : ''} ${isUltraZoom ? 'ultra-zoom' : ''} ${customColor ? 'custom-color' : ''} ${durationCls} ${compactMode ? 'compact' : ''}`}
                        style={colorStyle}
                        onClick={(e) => handleTaskClick(task, e)}
                        onDoubleClick={(e) => handleTaskDoubleClick(task, e)}
                        title={`${task.title}\n${task.startTime} - ${task.endTime}${task.description ? '\n' + task.description : ''}${view === 'day' ? '\nDouble-click to zoom in' : ''}`}
                      >
                        {compactMode ? (
                          /* Compact: single line with time and truncated title */
                          <div className="task-compact-line">
                            {task.type === 'routine' && (
                              <span
                                className="routine-task-check"
                                onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                              >
                                {task.completed ? <CheckCircle2 size={10} /> : <Circle size={10} />}
                              </span>
                            )}
                            <span className="task-time">{task.startTime}</span>
                            {showTitle && <span className="task-title">{task.title}</span>}
                          </div>
                        ) : (
                          /* Normal: structured layout */
                          <>
                            <div className="task-top-bar">
                              {task.type === 'routine' && (
                                <span
                                  className="routine-task-check"
                                  onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
                                >
                                  {task.completed ? <CheckCircle2 size={isUltraZoom ? 22 : isDeepZoom ? 18 : isZoomedIn ? 16 : 12} /> : <Circle size={isUltraZoom ? 22 : isDeepZoom ? 18 : isZoomedIn ? 16 : 12} />}
                                </span>
                              )}
                              <span className="task-time">{task.startTime} - {task.endTime}</span>
                              <span className="task-icons-right">
                                {task.type === 'routine' && task.reminder && (
                                  <Bell size={isUltraZoom ? 18 : isDeepZoom ? 14 : isZoomedIn ? 12 : 9} className="task-reminder-icon" />
                                )}
                                {task.recurrence && task.recurrence !== 'none' && (
                                  <Repeat size={isUltraZoom ? 18 : isDeepZoom ? 14 : isZoomedIn ? 12 : 10} className="task-recurrence-icon" />
                                )}
                              </span>
                            </div>
                            {showTitle && (
                              <span className={`task-title ${showFullTitle ? 'full' : ''}`}>{task.title}</span>
                            )}
                            {showDescription && (
                              <span className="task-description-preview">{task.description}</span>
                            )}
                          </>
                        )}
                      </div>
                    );
                  });
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render day view
  const renderDayView = () => {
    return renderTimeGrid([currentDate], true);
  };

  // Render week view
  const renderWeekView = () => {
    return renderTimeGrid(weekDays, true);
  };

  // Render month view (mini calendar style with task indicators)
  const renderMonthView = () => {
    return (
      <div className="month-view">
        <div className="month-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="month-days">
          {monthDays.map((day) => {
            const dayTasks = getTasksForDate(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`month-day ${!isCurrentMonth ? 'other-month' : ''} ${today ? 'today' : ''}`}
                onClick={() => {
                  setCurrentDate(day);
                  setView('day');
                }}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-tasks">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      className={`task-indicator priority-${task.priority} type-${task.type}`}
                      title={task.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTaskClick(task, e);
                      }}
                    >
                      <Clock size={8} />
                      <span>{task.startTime}</span>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div className="more-tasks">+{dayTasks.length - 3}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render event modal
  const renderEventModal = () => {
    if (!showEventModal) return null;

    return (
      <div className="event-modal-overlay" onClick={() => setShowEventModal(false)}>
        <div className="event-modal" onClick={(e) => e.stopPropagation()}>
          <div className="event-modal-header">
            <h3>{editingTask ? 'Edit Event' : 'New Event'}</h3>
            <button className="close-btn" onClick={() => setShowEventModal(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="event-modal-body">
            {/* Title */}
            <div className="form-group title-group">
              <label>Title</label>
              <textarea
                className="title-textarea"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                placeholder="Enter event title..."
                autoFocus
                rows={4}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                  }
                }}
              />
            </div>

            {/* Type & Priority */}
            <div className="form-row">
              <div className="form-group">
                <label>Type</label>
                <select
                  value={eventForm.type}
                  onChange={(e) => setEventForm({ ...eventForm, type: e.target.value })}
                >
                  {taskTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Priority</label>
                <select
                  value={eventForm.priority}
                  onChange={(e) => setEventForm({ ...eventForm, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            {/* Color */}
            <div className="form-group">
              <label>Color</label>
              <div className="color-picker-row">
                {EVENT_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`color-swatch ${eventForm.color === c.id ? 'selected' : ''}`}
                    style={{
                      background: c.bg || 'var(--bg-tertiary)',
                      borderColor: c.accent || c.border || 'var(--border-primary)',
                    }}
                    onClick={() => setEventForm({ ...eventForm, color: c.id })}
                    title={c.label}
                  >
                    {c.id === 'default' && <span className="swatch-label">A</span>}
                  </button>
                ))}
              </div>
            </div>

            {/* Date */}
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={eventForm.scheduledDate}
                onChange={(e) => setEventForm({ ...eventForm, scheduledDate: e.target.value })}
              />
            </div>

            {/* Time */}
            <div className="form-row">
              <div className="form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm({ ...eventForm, startTime: e.target.value })}
                  step="60"
                />
              </div>
              <div className="form-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm({ ...eventForm, endTime: e.target.value })}
                  step="60"
                />
              </div>
            </div>

            {/* Recurrence */}
            <div className="form-group">
              <label>Repeat</label>
              <select
                value={eventForm.recurrence}
                onChange={(e) => {
                  const val = e.target.value;
                  setEventForm({ ...eventForm, recurrence: val });
                  if (val === 'custom') {
                    setShowCustomRecurrence(true);
                  } else {
                    setShowCustomRecurrence(false);
                  }
                }}
              >
                {recurrenceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Recurrence */}
            {showCustomRecurrence && (
              <div className="custom-recurrence-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Repeat every</label>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={eventForm.customRecurrence.interval}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          customRecurrence: {
                            ...eventForm.customRecurrence,
                            interval: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <select
                      value={eventForm.customRecurrence.frequency}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          customRecurrence: {
                            ...eventForm.customRecurrence,
                            frequency: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="daily">Day(s)</option>
                      <option value="weekly">Week(s)</option>
                      <option value="monthly">Month(s)</option>
                      <option value="yearly">Year(s)</option>
                    </select>
                  </div>
                </div>

                {/* Days of week for weekly recurrence */}
                {eventForm.customRecurrence.frequency === 'weekly' && (
                  <div className="form-group">
                    <label>On days</label>
                    <div className="days-of-week">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          className={`day-btn ${eventForm.customRecurrence.daysOfWeek.includes(idx) ? 'active' : ''}`}
                          onClick={() => {
                            const days = [...eventForm.customRecurrence.daysOfWeek];
                            if (days.includes(idx)) {
                              days.splice(days.indexOf(idx), 1);
                            } else {
                              days.push(idx);
                            }
                            setEventForm({
                              ...eventForm,
                              customRecurrence: {
                                ...eventForm.customRecurrence,
                                daysOfWeek: days,
                              },
                            });
                          }}
                        >
                          {day.charAt(0)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* End condition */}
                <div className="form-group">
                  <label>Ends</label>
                  <select
                    value={eventForm.customRecurrence.endType}
                    onChange={(e) =>
                      setEventForm({
                        ...eventForm,
                        customRecurrence: {
                          ...eventForm.customRecurrence,
                          endType: e.target.value,
                        },
                      })
                    }
                  >
                    <option value="never">Never</option>
                    <option value="date">On date</option>
                    <option value="count">After occurrences</option>
                  </select>
                </div>

                {eventForm.customRecurrence.endType === 'date' && (
                  <div className="form-group">
                    <label>End date</label>
                    <input
                      type="date"
                      value={eventForm.customRecurrence.endDate}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          customRecurrence: {
                            ...eventForm.customRecurrence,
                            endDate: e.target.value,
                          },
                        })
                      }
                    />
                  </div>
                )}

                {eventForm.customRecurrence.endType === 'count' && (
                  <div className="form-group">
                    <label>Number of occurrences</label>
                    <input
                      type="number"
                      min="1"
                      max="999"
                      value={eventForm.customRecurrence.endCount}
                      onChange={(e) =>
                        setEventForm({
                          ...eventForm,
                          customRecurrence: {
                            ...eventForm.customRecurrence,
                            endCount: parseInt(e.target.value) || 1,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            )}

            {/* Reminder */}
            <div className="form-group reminder-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={eventForm.reminder}
                  onChange={(e) => setEventForm({ ...eventForm, reminder: e.target.checked })}
                />
                <Bell size={16} />
                Reminder
              </label>
              {eventForm.reminder && (
                <select
                  value={eventForm.reminderMinutes}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, reminderMinutes: parseInt(e.target.value) })
                  }
                >
                  <option value={5}>5 minutes before</option>
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                  <option value={120}>2 hours before</option>
                  <option value={1440}>1 day before</option>
                </select>
              )}
            </div>

            {/* Description */}
            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                value={eventForm.description}
                onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                placeholder="Add notes or details..."
                rows={3}
              />
            </div>
          </div>

          <div className="event-modal-footer">
            {editingTask && (
              <button className="delete-btn" onClick={handleDeleteEvent}>
                <Trash2 size={16} />
                Delete
              </button>
            )}
            <div className="footer-right">
              <button className="cancel-btn" onClick={() => setShowEventModal(false)}>
                Cancel
              </button>
              <button className="save-btn" onClick={handleSaveEvent}>
                <Save size={16} />
                {editingTask ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="short-term-calendar">
      {/* Calendar Header */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button className="nav-btn" onClick={navigatePrev}>
            <ChevronLeft size={18} />
          </button>
          <h3 className="calendar-title">{getHeaderText()}</h3>
          <button className="nav-btn" onClick={navigateNext}>
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="calendar-controls">
          <div className="current-time-display">
            <Clock size={14} />
            <span>{format(currentTime, 'h:mm a')}</span>
          </div>
          <button className="today-btn" onClick={goToToday}>
            <CalendarIcon size={14} />
            Today
          </button>
          <button
            className="add-event-btn"
            onClick={() => {
              setEditingTask(null);
              setEventForm({
                title: '',
                description: '',
                type: 'task',
                priority: 'medium',
                color: 'default',
                scheduledDate: format(currentDate, 'yyyy-MM-dd'),
                startTime: '09:00',
                endTime: '10:00',
                recurrence: 'none',
                customRecurrence: {
                  frequency: 'weekly',
                  interval: 1,
                  daysOfWeek: [],
                  endType: 'never',
                  endDate: '',
                  endCount: 10,
                },
                reminder: false,
                reminderMinutes: 15,
              });
              setShowCustomRecurrence(false);
              setShowEventModal(true);
            }}
          >
            <Plus size={14} />
            Add
          </button>
          <div className="view-selector">
            {viewOptions.map((option) => (
              <button
                key={option.id}
                className={`view-btn ${view === option.id ? 'active' : ''}`}
                onClick={() => setView(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {(view === 'day' || view === 'week') && (
            <div className="zoom-controls">
              <button
                className="zoom-btn"
                onClick={() => {
                  const newLevel = Math.max(0, zoomLevel - 1);
                  setZoomLevel(newLevel);
                  // When entering hour-focus, set focus to current hour
                  if (ZOOM_LEVELS[newLevel].hourFocus && !ZOOM_LEVELS[zoomLevel].hourFocus) {
                    setFocusHour(new Date().getHours());
                  }
                }}
                disabled={zoomLevel === 0}
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="zoom-label" title="Ctrl+Scroll to zoom">{ZOOM_LEVELS[zoomLevel].label}</span>
              <button
                className="zoom-btn"
                onClick={() => {
                  const maxLevel = view === 'week' ? 5 : ZOOM_LEVELS.length - 1; // Week view limited to 8x
                  const newLevel = Math.min(maxLevel, zoomLevel + 1);
                  setZoomLevel(newLevel);
                  // When entering hour-focus, set focus to current hour
                  if (ZOOM_LEVELS[newLevel].hourFocus && !ZOOM_LEVELS[zoomLevel].hourFocus) {
                    setFocusHour(new Date().getHours());
                  }
                }}
                disabled={zoomLevel === (view === 'week' ? 5 : ZOOM_LEVELS.length - 1)}
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          )}

          {/* Hour Focus Navigation — only in Day view at deep zoom */}
          {isHourFocus && (
            <div className="hour-focus-controls">
              <button
                className="hour-nav-btn"
                onClick={() => setFocusHour(Math.max(0, focusHour - 1))}
                disabled={focusHour === 0}
                title="Previous hour"
              >
                <ChevronUp size={14} />
              </button>
              <span className="hour-focus-label">
                <Crosshair size={12} />
                {format(setHours(new Date(), focusHour), 'h a')}{focusWindowHours > 1 ? ` — ${format(setHours(new Date(), Math.min(23, focusHour + focusWindowHours - 1)), 'h a')}` : ''}
              </span>
              <button
                className="hour-nav-btn"
                onClick={() => setFocusHour(Math.min(23, focusHour + 1))}
                disabled={focusHour === 23}
                title="Next hour"
              >
                <ChevronDown size={14} />
              </button>
              <button
                className="hour-now-btn"
                onClick={() => setFocusHour(new Date().getHours())}
                title="Jump to current hour"
              >
                Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Routine Progress — collapsed by default, toggle to expand */}
      {routineProgress && isToday(currentDate) && (
        <div className={`routine-progress-banner ${routineBannerOpen ? 'expanded' : 'collapsed'}`}>
          <button
            className="routine-banner-toggle"
            onClick={() => setRoutineBannerOpen(!routineBannerOpen)}
          >
            <Sun size={14} />
            <span>Routine {routineProgress.completed}/{routineProgress.total}</span>
            <div className="routine-mini-bar">
              <div className="routine-mini-bar-fill" style={{ width: `${routineProgress.percentage}%` }} />
            </div>
            {routineBannerOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {routineBannerOpen && (
            <div className="routine-banner-details">
              <div className="routine-banner-right">
                {routineProgress.percentage === 100 ? (
                  <span className="routine-complete-badge">
                    <CheckCircle2 size={14} />
                    All Done!
                  </span>
                ) : routineProgress.currentTask ? (
                  <span className="routine-current-task">
                    <Bell size={12} className="pulse-icon" />
                    Now: {routineProgress.currentTask.title}
                  </span>
                ) : routineProgress.nextTask ? (
                  <span className="routine-next-task">
                    Next: {routineProgress.nextTask.title} at {routineProgress.nextTask.startTime}
                  </span>
                ) : null}
              </div>
              <div className="routine-checklist">
                {todayRoutineTasks.map((task) => (
                  <button
                    key={task.id}
                    className={`routine-check-item ${task.completed ? 'checked' : ''}`}
                    onClick={() => toggleTaskComplete(task.id)}
                    title={task.title}
                  >
                    {task.completed ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    <span>{task.title}</span>
                    <span className="routine-check-time">{task.startTime}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Calendar Body */}
      <div className="calendar-body">
        {view === 'day' && renderDayView()}
        {view === 'week' && renderWeekView()}
        {view === 'month' && renderMonthView()}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot high"></span>
          <span>High</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot medium"></span>
          <span>Medium</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot low"></span>
          <span>Low</span>
        </div>
        <div className="legend-item">
          <span className="legend-line"></span>
          <span>Now</span>
        </div>
        {lastSaveStatus && Date.now() - lastSaveStatus.time < 3000 && (
          <div className={`legend-item save-indicator ${lastSaveStatus.success ? 'success' : 'error'}`}>
            <span>{lastSaveStatus.success ? '✓ Saved' : '✗ Save failed'}</span>
          </div>
        )}
      </div>

      {/* Save Confirmation Toast */}
      {saveConfirmation && (
        <div className="save-confirmation-toast">
          <CheckCircle2 size={16} />
          {saveConfirmation}
        </div>
      )}

      {/* Event Modal */}
      {renderEventModal()}
    </div>
  );
}
