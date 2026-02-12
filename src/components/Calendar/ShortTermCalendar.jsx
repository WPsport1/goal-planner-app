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
const ZOOM_LEVELS = [
  { label: '1x', hourHeight: 60 },
  { label: '1.5x', hourHeight: 90 },
  { label: '2x', hourHeight: 120 },
  { label: '3x', hourHeight: 180 },
  { label: '4x', hourHeight: 240 },
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

export default function ShortTermCalendar() {
  const { tasks, addTask, updateTask, deleteTask, openDetail, toggleTaskComplete } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('day');
  const [currentTime, setCurrentTime] = useState(new Date());
  const calendarRef = useRef(null);
  const timeIndicatorRef = useRef(null);

  // Zoom state (default to 2x for Day view so entries are readable)
  const [zoomLevel, setZoomLevel] = useState(2);
  const HOUR_HEIGHT = (view === 'day' || view === 'week') ? ZOOM_LEVELS[zoomLevel].hourHeight : 60;
  const SLOT_HEIGHT = HOUR_HEIGHT / 60; // px per minute

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
  const getTaskStyle = (task) => {
    if (!task.startTime || !task.endTime) return {};

    const [startHour, startMinute] = task.startTime.split(':').map(Number);
    const [endHour, endMinute] = task.endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    const duration = Math.max(15, endMinutes - startMinutes); // Minimum 15 min display

    return {
      top: `${startMinutes * SLOT_HEIGHT}px`,
      height: `${duration * SLOT_HEIGHT - 2}px`,
    };
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

  // Save event (create or update)
  const handleSaveEvent = () => {
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
      scheduledDate: localDate.toISOString(),
      startTime: eventForm.startTime,
      endTime: eventForm.endTime,
      recurrence: eventForm.recurrence,
      customRecurrence: eventForm.recurrence === 'custom' ? eventForm.customRecurrence : null,
      reminder: eventForm.reminder,
      reminderMinutes: eventForm.reminderMinutes,
    };

    if (editingTask) {
      updateTask(editingTask.id, eventData);
    } else {
      addTask(eventData);
    }

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

  // Render time grid with tasks
  const renderTimeGrid = (dates, showTimeColumn = true) => {
    const isMultiDay = dates.length > 1;

    return (
      <div className="time-grid-container" ref={calendarRef}>
        <div className={`time-grid ${isMultiDay ? 'multi-day' : 'single-day'}`} style={{ minHeight: `${24 * HOUR_HEIGHT}px` }}>
          {/* Time labels column */}
          {showTimeColumn && (
            <div className="time-labels">
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="time-label"
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
            const showIndicator = isToday(date);

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
                >
                  {/* Hour lines */}
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div
                      key={hour}
                      className="hour-slot"
                      style={{ height: HOUR_HEIGHT }}
                    >
                      {/* 15-minute sub-lines */}
                      <div className="quarter-line q1" />
                      <div className="quarter-line q2" />
                      <div className="quarter-line q3" />
                    </div>
                  ))}

                  {/* Current time indicator */}
                  {showIndicator && (
                    <div
                      ref={timeIndicatorRef}
                      className="current-time-indicator"
                      style={{ top: getCurrentTimePosition() }}
                    >
                      <div className="time-indicator-dot" />
                      <div className="time-indicator-line" />
                    </div>
                  )}

                  {/* Tasks */}
                  {dayTasks.map((task) => {
                    const taskStyle = getTaskStyle(task);
                    const isZoomedIn = HOUR_HEIGHT >= 120;
                    return (
                      <div
                        key={task.id}
                        className={`calendar-task priority-${task.priority} type-${task.type} ${task.completed ? 'completed' : ''} ${isZoomedIn ? 'zoomed' : ''}`}
                        style={taskStyle}
                        onClick={(e) => handleTaskClick(task, e)}
                        title={`${task.title} (${task.startTime} - ${task.endTime})`}
                      >
                        {task.type === 'routine' && (
                          <span
                            className="routine-task-check"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskComplete(task.id);
                            }}
                          >
                            {task.completed ? <CheckCircle2 size={isZoomedIn ? 14 : 12} /> : <Circle size={isZoomedIn ? 14 : 12} />}
                          </span>
                        )}
                        <span className="task-time">{task.startTime} - {task.endTime}</span>
                        <span className="task-title">{task.title}</span>
                        {isZoomedIn && task.description && (
                          <span className="task-description-preview">{task.description}</span>
                        )}
                        {task.type === 'routine' && task.reminder && (
                          <Bell size={isZoomedIn ? 11 : 9} className="task-reminder-icon" />
                        )}
                        {task.recurrence && task.recurrence !== 'none' && (
                          <Repeat size={isZoomedIn ? 12 : 10} className="task-recurrence-icon" />
                        )}
                      </div>
                    );
                  })}
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
                rows={2}
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
                onClick={() => setZoomLevel(Math.max(0, zoomLevel - 1))}
                disabled={zoomLevel === 0}
                title="Zoom out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="zoom-label">{ZOOM_LEVELS[zoomLevel].label}</span>
              <button
                className="zoom-btn"
                onClick={() => setZoomLevel(Math.min(ZOOM_LEVELS.length - 1, zoomLevel + 1))}
                disabled={zoomLevel === ZOOM_LEVELS.length - 1}
                title="Zoom in"
              >
                <ZoomIn size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Routine Progress Banner */}
      {routineProgress && isToday(currentDate) && (
        <div className="routine-progress-banner">
          <div className="routine-banner-left">
            <Sun size={16} />
            <span className="routine-banner-title">Routine Progress</span>
            <span className="routine-banner-count">
              {routineProgress.completed}/{routineProgress.total} done
            </span>
          </div>
          <div className="routine-progress-bar-container">
            <div
              className="routine-progress-bar-fill"
              style={{ width: `${routineProgress.percentage}%` }}
            />
          </div>
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
      </div>

      {/* Event Modal */}
      {renderEventModal()}
    </div>
  );
}
