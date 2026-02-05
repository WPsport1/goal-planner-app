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
} from 'lucide-react';
import './ShortTermCalendar.css';

const viewOptions = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
];

// Generate time slots for 24 hours in 15-minute increments
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      slots.push({
        hour,
        minute,
        label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        displayLabel: minute === 0 ? format(setHours(setMinutes(new Date(), minute), hour), 'h a') : '',
      });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();
const SLOT_HEIGHT = 20; // Height per 15-min slot in pixels

export default function ShortTermCalendar() {
  const { tasks, openDetail } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('day');
  const [currentTime, setCurrentTime] = useState(new Date());
  const calendarRef = useRef(null);
  const timeIndicatorRef = useRef(null);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Scroll to current time on mount and when view changes
  useEffect(() => {
    if (timeIndicatorRef.current && calendarRef.current) {
      const indicatorTop = timeIndicatorRef.current.offsetTop;
      calendarRef.current.scrollTop = indicatorTop - 200; // Scroll to show time indicator with some padding
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

  // Calculate task position and height based on time
  const getTaskStyle = (task) => {
    if (!task.startTime || !task.endTime) return {};

    const [startHour, startMinute] = task.startTime.split(':').map(Number);
    const [endHour, endMinute] = task.endTime.split(':').map(Number);

    const startSlot = startHour * 4 + Math.floor(startMinute / 15);
    const endSlot = endHour * 4 + Math.floor(endMinute / 15);
    const duration = Math.max(1, endSlot - startSlot);

    return {
      top: `${startSlot * SLOT_HEIGHT}px`,
      height: `${duration * SLOT_HEIGHT - 2}px`,
    };
  };

  // Calculate current time indicator position
  const getCurrentTimePosition = () => {
    const hours = currentTime.getHours();
    const minutes = currentTime.getMinutes();
    const totalMinutes = hours * 60 + minutes;
    return (totalMinutes / 15) * SLOT_HEIGHT;
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

  // Render time grid with tasks
  const renderTimeGrid = (dates, showTimeColumn = true) => {
    const isMultiDay = dates.length > 1;

    return (
      <div className="time-grid-container" ref={calendarRef}>
        <div className={`time-grid ${isMultiDay ? 'multi-day' : 'single-day'}`}>
          {/* Time labels column */}
          {showTimeColumn && (
            <div className="time-labels">
              {TIME_SLOTS.map((slot, idx) => (
                <div
                  key={idx}
                  className="time-label"
                  style={{ height: SLOT_HEIGHT }}
                >
                  {slot.displayLabel}
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

                {/* Time slots */}
                <div className="day-slots">
                  {TIME_SLOTS.map((slot, idx) => (
                    <div
                      key={idx}
                      className={`time-slot ${slot.minute === 0 ? 'hour-start' : ''}`}
                      style={{ height: SLOT_HEIGHT }}
                    />
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
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`calendar-task priority-${task.priority} ${task.completed ? 'completed' : ''}`}
                      style={getTaskStyle(task)}
                      onClick={() => openDetail(task)}
                      title={`${task.title} (${task.startTime} - ${task.endTime})`}
                    >
                      <span className="task-time">{task.startTime}</span>
                      <span className="task-title">{task.title}</span>
                    </div>
                  ))}
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
                      className={`task-indicator priority-${task.priority}`}
                      title={task.title}
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
        </div>
      </div>

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
    </div>
  );
}
