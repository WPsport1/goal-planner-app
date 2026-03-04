import { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { doesTaskOccurOnDate, createVirtualInstance, isCrossMidnight, createStartSegmentInstance, createContinuationInstance } from '../../utils/recurrence';
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
  Target,
  Search,
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
  const { tasks, goals, addTask, updateTask, deleteTask, openDetail, toggleTaskComplete, lastSaveStatus } = useApp();
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

  // Search & filter state
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTypeFilters, setActiveTypeFilters] = useState([]);

  // Routine progress tracking for today (including recurring routines)
  const todayRoutineTasks = useMemo(() => {
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterday = addDays(today, -1);
    const results = [];
    for (const t of tasks) {
      if (t.type !== 'routine' || !t.scheduledDate) continue;
      const crossMid = isCrossMidnight(t);
      if (t.recurrence && t.recurrence !== 'none') {
        if (doesTaskOccurOnDate(t, today)) {
          results.push(crossMid ? createStartSegmentInstance(t, today) : createVirtualInstance(t, today));
        }
        if (crossMid && doesTaskOccurOnDate(t, yesterday)) {
          results.push(createContinuationInstance(t, today));
        }
      } else {
        if (t.scheduledDate.startsWith(todayStr)) {
          results.push(crossMid ? createStartSegmentInstance(t, today) : t);
        }
        if (crossMid) {
          const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
          if (t.scheduledDate.startsWith(yesterdayStr)) {
            results.push(createContinuationInstance(t, today));
          }
        }
      }
    }
    return results;
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

  // Goal lookup for visual indicators on events
  const goalMap = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g])), [goals]);

  // Filtered tasks for search/filter — does NOT affect todayRoutineTasks
  const filteredTasks = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    const hasTypeFilter = activeTypeFilters.length > 0;
    if (!hasSearch && !hasTypeFilter) return tasks;
    const query = searchQuery.trim().toLowerCase();
    return tasks.filter((task) => {
      if (hasTypeFilter && !activeTypeFilters.includes(task.type)) return false;
      if (hasSearch) {
        const titleMatch = task.title?.toLowerCase().includes(query);
        const descMatch = task.description?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, activeTypeFilters]);

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
    weeklyDays: [],
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
    linkedGoalId: '',
  });
  const [showCustomRecurrence, setShowCustomRecurrence] = useState(false);

  // =========================================================
  // Drag-to-Create & Drag-to-Resize infrastructure
  // =========================================================
  const DRAG_THRESHOLD = 5; // pixels before mousedown becomes a drag

  // Snap minutes to nearest 5-minute increment
  const snapTo5 = (minutes) => Math.round(minutes / 5) * 5;

  // Format minutes (0-1439) as "HH:MM"
  const minutesToTimeStr = (m) => {
    const clamped = Math.max(0, Math.min(1439, m));
    const h = Math.floor(clamped / 60);
    const min = clamped % 60;
    return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  };

  // Convert mouse clientY to total minutes (0-1439), accounting for scroll + hour-focus offset
  const yToMinutes = (clientY, daySlotEl) => {
    const rect = daySlotEl.getBoundingClientRect();
    // Replicate existing handleSlotClick formula exactly
    const y = clientY - rect.top + (calendarRef.current?.scrollTop || 0);
    const focusOff = isHourFocus
      ? Math.max(0, focusHour - focusPaddingHours) * 60 * SLOT_HEIGHT
      : 0;
    const rawMinutes = (y + focusOff) / SLOT_HEIGHT;
    return Math.max(0, Math.min(1439, rawMinutes));
  };

  // Open the create-event modal with pre-filled times
  const openCreateModal = (date, startTime, endTime) => {
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
      weeklyDays: [],
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
      linkedGoalId: '',
    });
    setShowEventModal(true);
  };

  // Drag state — ref avoids re-renders during drag, only dragState triggers renders
  const [dragState, setDragState] = useState({ active: false, type: null });
  const dragRef = useRef({
    active: false,
    type: null,       // 'create' | 'resize' | 'move'
    startY: 0,
    startX: 0,
    startMinutes: 0,
    currentMinutes: 0,
    date: null,
    daySlotEl: null,
    ghostEl: null,
    tooltipEl: null,
    // Resize-specific
    taskId: null,
    taskStartMinutes: 0,
    originalEndMinutes: 0,
    taskEl: null,
    // Move-specific
    moveTask: null,
    moveDuration: 0,
    moveOriginalDate: null,
    moveGrabOffsetMin: 0,
    moveCurrentDate: null,
    moveCurrentStartMin: 0,
    moveTaskEl: null,
    moveTimeGridEl: null,
  });

  // Stable ref wrapper so document listeners always call latest closure
  const handleDragMoveRef = useRef(null);
  const handleDragEndRef = useRef(null);
  const stableDragMove = useRef((e) => handleDragMoveRef.current?.(e)).current;
  const stableDragEnd = useRef((e) => handleDragEndRef.current?.(e)).current;
  const moveWasDraggedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', stableDragMove);
      document.removeEventListener('mouseup', stableDragEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Escape key cancels any active drag
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && dragRef.current.active) {
        e.preventDefault();
        const drag = dragRef.current;
        if (drag.type === 'move' && drag.moveTaskEl) {
          drag.moveTaskEl.style.opacity = '';
          drag.moveTaskEl.style.transition = '';
        }
        if (drag.type === 'resize' && drag.taskEl) {
          drag.taskEl.style.height = '';
          drag.taskEl.style.minHeight = '';
          drag.taskEl.style.transition = '';
        }
        if (drag.ghostEl) { drag.ghostEl.remove(); drag.ghostEl = null; }
        if (drag.tooltipEl) { drag.tooltipEl.remove(); drag.tooltipEl = null; }
        document.removeEventListener('mousemove', stableDragMove);
        document.removeEventListener('mouseup', stableDragEnd);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        setDragState({ active: false, type: null });
        drag.active = false;
        drag.type = null;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Ghost & Tooltip DOM manipulation (no React re-renders) ---
  const createGhostElement = (drag) => {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost-preview';
    drag.daySlotEl.appendChild(ghost);
    drag.ghostEl = ghost;
  };

  const updateGhostElement = (drag) => {
    if (!drag.ghostEl) return;
    const startMin = Math.min(drag.startMinutes, drag.currentMinutes);
    const endMin = Math.max(drag.startMinutes, drag.currentMinutes);
    const focusOff = isHourFocus
      ? Math.max(0, focusHour - focusPaddingHours) * 60 * SLOT_HEIGHT
      : 0;
    const top = startMin * SLOT_HEIGHT - focusOff + GAP_PX;
    const height = Math.max(5 * SLOT_HEIGHT, (endMin - startMin) * SLOT_HEIGHT - GAP_PX * 2);
    drag.ghostEl.style.top = `${top}px`;
    drag.ghostEl.style.height = `${height}px`;
  };

  const createTooltipElement = (drag) => {
    const tooltip = document.createElement('div');
    tooltip.className = 'drag-time-tooltip';
    drag.daySlotEl.appendChild(tooltip);
    drag.tooltipEl = tooltip;
  };

  const updateTooltipElement = (drag) => {
    if (!drag.tooltipEl) return;
    let startMin, endMin;
    if (drag.type === 'create') {
      startMin = Math.min(drag.startMinutes, drag.currentMinutes);
      endMin = Math.max(drag.startMinutes, drag.currentMinutes);
    } else if (drag.type === 'move') {
      startMin = drag.moveCurrentStartMin;
      endMin = drag.moveCurrentStartMin + drag.moveDuration;
    } else {
      startMin = drag.taskStartMinutes;
      endMin = drag.currentMinutes;
    }
    const duration = endMin - startMin;
    drag.tooltipEl.textContent = `${minutesToTimeStr(startMin)} – ${minutesToTimeStr(endMin)} (${duration}min)`;
    const focusOff = isHourFocus
      ? Math.max(0, focusHour - focusPaddingHours) * 60 * SLOT_HEIGHT
      : 0;
    if (drag.type === 'move') {
      // Position tooltip below the ghost in the time-grid coordinate space
      const targetDaySlotEl = findDaySlotUnderDate(drag.moveCurrentDate, drag.moveTimeGridEl);
      if (targetDaySlotEl) {
        const gridRect = drag.moveTimeGridEl.getBoundingClientRect();
        const dayRect = targetDaySlotEl.getBoundingClientRect();
        drag.tooltipEl.style.left = `${dayRect.left - gridRect.left + dayRect.width / 2}px`;
        drag.tooltipEl.style.transform = 'translateX(-50%)';
      }
      drag.tooltipEl.style.top = `${endMin * SLOT_HEIGHT - focusOff + 4}px`;
    } else {
      drag.tooltipEl.style.top = `${endMin * SLOT_HEIGHT - focusOff + 4}px`;
    }
  };

  const updateResizeVisual = (drag) => {
    if (!drag.taskEl) return;
    const duration = drag.currentMinutes - drag.taskStartMinutes;
    const heightPx = Math.max(2, duration * SLOT_HEIGHT - GAP_PX * 2);
    drag.taskEl.style.height = `${heightPx}px`;
    drag.taskEl.style.minHeight = `${heightPx}px`;
    drag.taskEl.style.transition = 'none';
  };

  // --- Move ghost helpers ---
  const findDaySlotUnderDate = (date, timeGridEl) => {
    if (!timeGridEl) return null;
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayCol = timeGridEl.querySelector(`.day-column[data-date="${dateStr}"]`);
    return dayCol ? dayCol.querySelector('.day-slots') : null;
  };

  const findDaySlotUnderCursor = (clientX, clientY, timeGridEl) => {
    const drag = dragRef.current;
    if (drag.ghostEl) drag.ghostEl.style.pointerEvents = 'none';
    if (drag.tooltipEl) drag.tooltipEl.style.pointerEvents = 'none';
    const el = document.elementFromPoint(clientX, clientY);
    if (drag.ghostEl) drag.ghostEl.style.pointerEvents = '';
    if (drag.tooltipEl) drag.tooltipEl.style.pointerEvents = '';
    if (!el) return null;
    const daySlots = el.closest('.day-slots');
    if (daySlots && timeGridEl.contains(daySlots)) return daySlots;
    return null;
  };

  const createMoveGhostElement = (drag) => {
    const ghost = document.createElement('div');
    ghost.className = 'move-ghost-preview';
    ghost.textContent = drag.moveTask.title || '';
    drag.moveTimeGridEl.appendChild(ghost);
    drag.ghostEl = ghost;
  };

  const createMoveTooltipElement = (drag) => {
    const tooltip = document.createElement('div');
    tooltip.className = 'drag-time-tooltip';
    tooltip.style.position = 'absolute';
    drag.moveTimeGridEl.appendChild(tooltip);
    drag.tooltipEl = tooltip;
  };

  const updateMoveGhostElement = (drag) => {
    if (!drag.ghostEl) return;
    const targetDaySlotEl = findDaySlotUnderDate(drag.moveCurrentDate, drag.moveTimeGridEl);
    if (!targetDaySlotEl) return;
    const gridRect = drag.moveTimeGridEl.getBoundingClientRect();
    const daySlotRect = targetDaySlotEl.getBoundingClientRect();
    const left = daySlotRect.left - gridRect.left + 4;
    const width = daySlotRect.width - 8;
    const focusOff = isHourFocus
      ? Math.max(0, focusHour - focusPaddingHours) * 60 * SLOT_HEIGHT
      : 0;
    const top = drag.moveCurrentStartMin * SLOT_HEIGHT - focusOff + GAP_PX;
    const height = Math.max(2, drag.moveDuration * SLOT_HEIGHT - GAP_PX * 2);
    drag.ghostEl.style.left = `${left}px`;
    drag.ghostEl.style.width = `${width}px`;
    drag.ghostEl.style.top = `${top}px`;
    drag.ghostEl.style.height = `${height}px`;
  };

  // --- Core drag handlers ---
  const handleDragMove = (e) => {
    const drag = dragRef.current;
    if (drag.type === 'create') {
      if (!drag.active) {
        if (Math.abs(e.clientY - drag.startY) < DRAG_THRESHOLD) return;
        drag.active = true;
        setDragState({ active: true, type: 'create' });
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        createGhostElement(drag);
        createTooltipElement(drag);
      }
      drag.currentMinutes = snapTo5(yToMinutes(e.clientY, drag.daySlotEl));
      updateGhostElement(drag);
      updateTooltipElement(drag);
    } else if (drag.type === 'resize') {
      if (!drag.active) {
        if (Math.abs(e.clientY - drag.startY) < DRAG_THRESHOLD) return;
        drag.active = true;
        setDragState({ active: true, type: 'resize' });
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        createTooltipElement(drag);
      }
      const minutes = snapTo5(yToMinutes(e.clientY, drag.daySlotEl));
      drag.currentMinutes = Math.max(drag.taskStartMinutes + 5, minutes);
      updateResizeVisual(drag);
      updateTooltipElement(drag);
    } else if (drag.type === 'move') {
      if (!drag.active) {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;
        drag.active = true;
        setDragState({ active: true, type: 'move' });
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        if (drag.moveTaskEl) {
          drag.moveTaskEl.style.opacity = '0.3';
          drag.moveTaskEl.style.transition = 'none';
        }
        createMoveGhostElement(drag);
        createMoveTooltipElement(drag);
      }
      const hoveredDaySlotEl = findDaySlotUnderCursor(e.clientX, e.clientY, drag.moveTimeGridEl);
      if (hoveredDaySlotEl) {
        const dayColumnEl = hoveredDaySlotEl.closest('.day-column');
        const dateStr = dayColumnEl?.getAttribute('data-date');
        if (dateStr) drag.moveCurrentDate = parseISO(dateStr);
        const cursorMinutes = yToMinutes(e.clientY, hoveredDaySlotEl);
        let newStartMin = snapTo5(cursorMinutes - drag.moveGrabOffsetMin);
        newStartMin = Math.max(0, Math.min(1440 - drag.moveDuration, newStartMin));
        drag.moveCurrentStartMin = newStartMin;
      }
      updateMoveGhostElement(drag);
      updateTooltipElement(drag);
    }
  };

  const handleDragEnd = (e) => {
    document.removeEventListener('mousemove', stableDragMove);
    document.removeEventListener('mouseup', stableDragEnd);
    const drag = dragRef.current;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    // Cleanup DOM elements
    if (drag.ghostEl) { drag.ghostEl.remove(); drag.ghostEl = null; }
    if (drag.tooltipEl) { drag.tooltipEl.remove(); drag.tooltipEl = null; }

    if (drag.type === 'create') {
      if (!drag.active) {
        // Below threshold — treat as click → open modal with 1-hour default
        const minutes = snapTo5(yToMinutes(e.clientY, drag.daySlotEl));
        const endMinutes = Math.min(1439, minutes + 60);
        openCreateModal(drag.date, minutesToTimeStr(minutes), minutesToTimeStr(endMinutes));
      } else {
        // Drag completed — open modal with dragged range
        const startMin = Math.min(drag.startMinutes, drag.currentMinutes);
        const endMin = Math.max(drag.startMinutes, drag.currentMinutes);
        if (endMin - startMin >= 5) {
          openCreateModal(drag.date, minutesToTimeStr(startMin), minutesToTimeStr(endMin));
        }
      }
    } else if (drag.type === 'resize') {
      if (drag.active) {
        const newEndTime = minutesToTimeStr(drag.currentMinutes);
        updateTask(drag.taskId, { endTime: newEndTime });
        if (drag.taskEl) {
          drag.taskEl.style.height = '';
          drag.taskEl.style.minHeight = '';
          drag.taskEl.style.transition = '';
        }
      }
    } else if (drag.type === 'move') {
      // Restore original task appearance
      if (drag.moveTaskEl) {
        drag.moveTaskEl.style.opacity = '';
        drag.moveTaskEl.style.transition = '';
      }
      if (drag.active) {
        moveWasDraggedRef.current = true;
        const newStartMin = drag.moveCurrentStartMin;
        const newEndMin = newStartMin + drag.moveDuration;
        const newDateStr = format(drag.moveCurrentDate, 'yyyy-MM-dd');
        const [year, month, day] = newDateStr.split('-').map(Number);
        const startH = Math.floor(newStartMin / 60);
        const startM = newStartMin % 60;
        const localDate = new Date(year, month - 1, day, startH, startM);
        updateTask(drag.taskId, {
          scheduledDate: localDate.toISOString(),
          startTime: minutesToTimeStr(newStartMin),
          endTime: minutesToTimeStr(newEndMin),
        });
      }
    }

    setDragState({ active: false, type: null });
    drag.active = false;
    drag.type = null;
  };

  // Keep stable refs updated every render
  handleDragMoveRef.current = handleDragMove;
  handleDragEndRef.current = handleDragEnd;

  // Mousedown on empty slot → potential drag-to-create
  const handleDaySlotsMouseDown = (date, e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.calendar-task')) return;
    const daySlotEl = e.currentTarget;
    const minutes = snapTo5(yToMinutes(e.clientY, daySlotEl));
    dragRef.current = {
      ...dragRef.current,
      active: false,
      type: 'create',
      startY: e.clientY,
      startMinutes: minutes,
      currentMinutes: minutes,
      date,
      daySlotEl,
      ghostEl: null,
      tooltipEl: null,
    };
    document.addEventListener('mousemove', stableDragMove);
    document.addEventListener('mouseup', stableDragEnd);
  };

  // Mousedown on resize handle → drag-to-resize
  const handleResizeMouseDown = (task, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0) return;
    const taskEl = e.currentTarget.closest('.calendar-task');
    const daySlotEl = taskEl.closest('.day-slots');
    const [sH, sM] = task.startTime.split(':').map(Number);
    const [eH, eM] = task.endTime.split(':').map(Number);
    dragRef.current = {
      ...dragRef.current,
      active: false,
      type: 'resize',
      startY: e.clientY,
      taskId: task._isVirtual ? task._parentId : task.id,
      taskStartMinutes: sH * 60 + sM,
      currentMinutes: eH * 60 + eM,
      originalEndMinutes: eH * 60 + eM,
      daySlotEl,
      taskEl,
      ghostEl: null,
      tooltipEl: null,
    };
    document.addEventListener('mousemove', stableDragMove);
    document.addEventListener('mouseup', stableDragEnd);
  };

  // Mousedown on calendar-task body → potential drag-to-move
  const handleMoveMouseDown = (task, e) => {
    if (e.target.closest('.resize-handle')) return;
    if (e.target.closest('.routine-task-check')) return;
    if (e.button !== 0) return;
    if (task._segment === 'continuation') return;

    e.stopPropagation();

    const taskEl = e.currentTarget;
    const daySlotEl = taskEl.closest('.day-slots');
    const timeGridEl = taskEl.closest('.time-grid');
    const dayColumnEl = taskEl.closest('.day-column');
    const dateStr = dayColumnEl?.getAttribute('data-date');
    const taskDate = dateStr ? parseISO(dateStr) : new Date();

    const [sH, sM] = task.startTime.split(':').map(Number);
    const [eH, eM] = task.endTime.split(':').map(Number);
    const startMin = sH * 60 + sM;
    const endMin = eH * 60 + eM;
    const duration = endMin - startMin;

    const cursorMinutes = yToMinutes(e.clientY, daySlotEl);
    const grabOffset = Math.max(0, cursorMinutes - startMin);

    dragRef.current = {
      ...dragRef.current,
      active: false,
      type: 'move',
      startY: e.clientY,
      startX: e.clientX,
      daySlotEl,
      ghostEl: null,
      tooltipEl: null,
      taskId: task._isVirtual ? task._parentId : task.id,
      moveTask: task,
      moveDuration: duration,
      moveOriginalDate: taskDate,
      moveGrabOffsetMin: grabOffset,
      moveCurrentDate: taskDate,
      moveCurrentStartMin: startMin,
      moveTaskEl: taskEl,
      moveTimeGridEl: timeGridEl,
    };

    document.addEventListener('mousemove', stableDragMove);
    document.addEventListener('mouseup', stableDragEnd);
  };

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

  // Get tasks for a specific date (with recurring task expansion + cross-midnight segments)
  const getTasksForDate = (date) => {
    const results = [];
    const prevDate = addDays(date, -1);
    for (const task of filteredTasks) {
      if (!task.scheduledDate) continue;
      const crossMid = isCrossMidnight(task);

      if (task.recurrence && task.recurrence !== 'none') {
        // Recurring: check if this date matches the pattern
        if (doesTaskOccurOnDate(task, date)) {
          results.push(crossMid
            ? createStartSegmentInstance(task, date)
            : createVirtualInstance(task, date));
        }
        // Cross-midnight continuation: if task occurred yesterday, show morning segment today
        if (crossMid && doesTaskOccurOnDate(task, prevDate)) {
          results.push(createContinuationInstance(task, date));
        }
      } else {
        // Non-recurring: exact date match
        if (isSameDay(parseISO(task.scheduledDate), date)) {
          results.push(crossMid ? createStartSegmentInstance(task, date) : task);
        }
        // Non-recurring cross-midnight: continuation from yesterday
        if (crossMid && isSameDay(parseISO(task.scheduledDate), prevDate)) {
          results.push(createContinuationInstance(task, date));
        }
      }
    }
    return results;
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

  // Handle click on existing task to edit
  const handleTaskClick = (task, e) => {
    e.stopPropagation();
    // Suppress click after a completed drag-to-move
    if (moveWasDraggedRef.current) { moveWasDraggedRef.current = false; return; }
    // For virtual recurring instances, resolve to the parent task
    const actualTask = task._isVirtual
      ? tasks.find(t => t.id === task._parentId) || task
      : task;
    setEditingTask(actualTask);
    setEventForm({
      title: actualTask.title || '',
      description: actualTask.description || '',
      type: actualTask.type || 'task',
      priority: actualTask.priority || 'medium',
      color: actualTask.color || 'default',
      scheduledDate: actualTask.scheduledDate ? format(parseISO(actualTask.scheduledDate), 'yyyy-MM-dd') : '',
      startTime: actualTask.startTime || '09:00',
      endTime: actualTask.endTime || '10:00',
      recurrence: actualTask.recurrence || 'none',
      weeklyDays: actualTask.weeklyDays || [],
      customRecurrence: actualTask.customRecurrence || {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [],
        endType: 'never',
        endDate: '',
        endCount: 10,
      },
      reminder: actualTask.reminder || false,
      reminderMinutes: actualTask.reminderMinutes || 15,
      linkedGoalId: actualTask.linkedGoalId || '',
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
      weeklyDays: eventForm.recurrence === 'weekly' ? (eventForm.weeklyDays || []) : null,
      customRecurrence: eventForm.recurrence === 'custom' ? eventForm.customRecurrence : null,
      reminder: eventForm.reminder,
      reminderMinutes: eventForm.reminderMinutes,
      linkedGoalId: eventForm.linkedGoalId || null,
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
      <div className={`time-grid-container ${isHourFocus ? 'hour-focus-mode' : ''} ${dragState.active ? 'is-dragging' : ''} ${dragState.active && dragState.type === 'move' ? 'is-dragging-move' : ''}`} ref={calendarRef} style={isHourFocus ? { overflow: 'hidden' } : {}}>
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
              <div key={date.toISOString()} className="day-column" data-date={format(date, 'yyyy-MM-dd')}>
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
                  onMouseDown={(e) => handleDaySlotsMouseDown(date, e)}
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
                        className={`calendar-task ${!customColor ? `priority-${task.priority}` : ''} type-${task.type} ${task.completed ? 'completed' : ''} ${isZoomedIn ? 'zoomed' : ''} ${isDeepZoom ? 'deep-zoom' : ''} ${isUltraZoom ? 'ultra-zoom' : ''} ${customColor ? 'custom-color' : ''} ${durationCls} ${compactMode ? 'compact' : ''} ${task._segment === 'start' ? 'segment-start' : ''} ${task._segment === 'continuation' ? 'segment-continuation' : ''}`}
                        style={colorStyle}
                        onMouseDown={(e) => handleMoveMouseDown(task, e)}
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
                            {task.linkedGoalId && goalMap[task.linkedGoalId] && (
                              <Target size={9} className="task-goal-icon" />
                            )}
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
                                {task.linkedGoalId && goalMap[task.linkedGoalId] && (
                                  <Target size={isUltraZoom ? 18 : isDeepZoom ? 14 : isZoomedIn ? 12 : 10} className="task-goal-icon" title={goalMap[task.linkedGoalId].title} />
                                )}
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
                        {/* Resize handle at bottom edge (hidden on cross-midnight segments) */}
                        {!task._segment && (
                          <div
                            className="resize-handle"
                            onMouseDown={(e) => handleResizeMouseDown(task, e)}
                          />
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
                <label>End Time{(() => {
                  if (!eventForm.startTime || !eventForm.endTime) return null;
                  const [sH, sM] = eventForm.startTime.split(':').map(Number);
                  const [eH, eM] = eventForm.endTime.split(':').map(Number);
                  if ((eH * 60 + eM) < (sH * 60 + sM)) {
                    return <span className="next-day-label"> (next day)</span>;
                  }
                  return null;
                })()}</label>
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

            {/* Weekly day-of-week selection */}
            {eventForm.recurrence === 'weekly' && (
              <div className="form-group">
                <label>On days</label>
                <div className="days-of-week">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, idx) => (
                    <button
                      key={day}
                      type="button"
                      className={`day-btn ${eventForm.weeklyDays.includes(idx) ? 'active' : ''}`}
                      onClick={() => {
                        const days = [...eventForm.weeklyDays];
                        if (days.includes(idx)) {
                          days.splice(days.indexOf(idx), 1);
                        } else {
                          days.push(idx);
                        }
                        setEventForm({ ...eventForm, weeklyDays: days });
                      }}
                    >
                      {day.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            {/* Link to Goal */}
            {goals.length > 0 && (
              <div className="form-group">
                <label>
                  <Target size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  Link to Goal
                </label>
                <select
                  value={eventForm.linkedGoalId}
                  onChange={(e) => setEventForm({ ...eventForm, linkedGoalId: e.target.value })}
                >
                  <option value="">None</option>
                  {goals
                    .slice()
                    .sort((a, b) => {
                      const order = { in_progress: 0, not_started: 1, completed: 2, on_hold: 3 };
                      return (order[a.status] ?? 4) - (order[b.status] ?? 4);
                    })
                    .map((goal) => (
                      <option key={goal.id} value={goal.id}>
                        {goal.title} ({goal.status.replace('_', ' ')})
                      </option>
                    ))
                  }
                </select>
              </div>
            )}

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
                weeklyDays: [],
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
                linkedGoalId: '',
              });
              setShowCustomRecurrence(false);
              setShowEventModal(true);
            }}
          >
            <Plus size={14} />
            Add
          </button>
          <button
            className={`search-toggle-btn ${showSearchBar ? 'active' : ''}`}
            onClick={() => setShowSearchBar(!showSearchBar)}
            title="Search & filter events"
          >
            <Search size={14} />
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

      {/* Search & Filter Bar */}
      {showSearchBar && (
        <div className="search-filter-bar">
          <div className="search-input-wrapper">
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button className="search-clear-btn" onClick={() => setSearchQuery('')} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="type-filter-chips">
            {taskTypeOptions.map((opt) => (
              <button
                key={opt.value}
                className={`type-chip ${activeTypeFilters.includes(opt.value) ? 'active' : ''}`}
                onClick={() => setActiveTypeFilters((prev) =>
                  prev.includes(opt.value)
                    ? prev.filter((t) => t !== opt.value)
                    : [...prev, opt.value]
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {(searchQuery || activeTypeFilters.length > 0) && (
            <div className="search-result-info">
              <span className="result-count">
                {filteredTasks.length} event{filteredTasks.length !== 1 ? 's' : ''}
              </span>
              <button className="clear-all-filters-btn" onClick={() => { setSearchQuery(''); setActiveTypeFilters([]); }}>
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

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
