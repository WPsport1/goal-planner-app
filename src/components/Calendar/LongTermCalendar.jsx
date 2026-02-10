import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  addQuarters,
  addYears,
  isSameMonth,
  isSameDay,
  isToday,
  startOfQuarter,
  endOfQuarter,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  eachQuarterOfInterval,
  parseISO,
} from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Target,
  X,
  ZoomIn,
} from 'lucide-react';
import './LongTermCalendar.css';

const viewOptions = [
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'semi-annual', label: '6 Months' },
  { id: 'year', label: 'Year' },
];

export default function LongTermCalendar() {
  const { goals, openDetail } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month');

  // Day detail modal state
  const [selectedDay, setSelectedDay] = useState(null);
  const [showDayModal, setShowDayModal] = useState(false);

  // Navigation handlers
  const navigatePrev = () => {
    switch (view) {
      case 'month':
        setCurrentDate(addMonths(currentDate, -1));
        break;
      case 'quarter':
        setCurrentDate(addQuarters(currentDate, -1));
        break;
      case 'semi-annual':
        setCurrentDate(addMonths(currentDate, -6));
        break;
      case 'year':
        setCurrentDate(addYears(currentDate, -1));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'quarter':
        setCurrentDate(addQuarters(currentDate, 1));
        break;
      case 'semi-annual':
        setCurrentDate(addMonths(currentDate, 6));
        break;
      case 'year':
        setCurrentDate(addYears(currentDate, 1));
        break;
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get goals for a specific date
  const getGoalsForDate = (date) => {
    return goals.filter((goal) => {
      const targetDate = parseISO(goal.targetDate);
      return isSameDay(targetDate, date);
    });
  };

  // Get goals for a specific month
  const getGoalsForMonth = (monthDate) => {
    return goals.filter((goal) => {
      const targetDate = parseISO(goal.targetDate);
      return isSameMonth(targetDate, monthDate);
    });
  };

  // Get header text based on view
  const getHeaderText = () => {
    switch (view) {
      case 'month':
        return format(currentDate, 'MMMM yyyy');
      case 'quarter':
        const quarter = Math.ceil((currentDate.getMonth() + 1) / 3);
        return `Q${quarter} ${format(currentDate, 'yyyy')}`;
      case 'semi-annual':
        const half = currentDate.getMonth() < 6 ? 'H1' : 'H2';
        return `${half} ${format(currentDate, 'yyyy')}`;
      case 'year':
        return format(currentDate, 'yyyy');
    }
  };

  // Handle day click to show zoomed view
  const handleDayClick = (day, dayGoals) => {
    setSelectedDay({ date: day, goals: dayGoals });
    setShowDayModal(true);
  };

  // Handle month click in quarter/semi/year views
  const handleMonthClick = (monthDate) => {
    setCurrentDate(monthDate);
    setView('month');
  };

  // Truncate text for small displays
  const truncateText = (text, maxLength) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Render month view with fixed cell sizes
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;

    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }

    return (
      <div className="calendar-month-view">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="weekday">
              {d}
            </div>
          ))}
        </div>
        <div className="calendar-days">
          {days.map((day, idx) => {
            const dayGoals = getGoalsForDate(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const today = isToday(day);

            return (
              <div
                key={idx}
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${today ? 'today' : ''} ${dayGoals.length > 0 ? 'has-goals' : ''}`}
                onClick={() => handleDayClick(day, dayGoals)}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-goals">
                  {dayGoals.slice(0, 2).map((goal) => (
                    <div
                      key={goal.id}
                      className={`goal-chip priority-${goal.priority}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(goal);
                      }}
                      title={goal.title}
                    >
                      <span className="goal-text">{truncateText(goal.title, 12)}</span>
                    </div>
                  ))}
                  {dayGoals.length > 2 && (
                    <div className="more-goals">+{dayGoals.length - 2}</div>
                  )}
                </div>
                {dayGoals.length > 0 && (
                  <button className="zoom-btn" title="View all goals">
                    <ZoomIn size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render quarter view (3 months) - compact with click to zoom
  const renderQuarterView = () => {
    const quarterStart = startOfQuarter(currentDate);
    const quarterEnd = endOfQuarter(quarterStart);
    const months = eachMonthOfInterval({ start: quarterStart, end: quarterEnd });

    return (
      <div className="calendar-quarter-view">
        {months.map((month) => {
          const monthGoals = getGoalsForMonth(month);
          const isCurrentMonth = isSameMonth(month, new Date());

          return (
            <div
              key={month.toISOString()}
              className={`quarter-month ${isCurrentMonth ? 'current' : ''}`}
              onClick={() => handleMonthClick(month)}
            >
              <div className="quarter-month-header">
                <h4>{format(month, 'MMMM')}</h4>
                <span className="goal-count">{monthGoals.length} goals</span>
              </div>
              <div className="month-goals-compact">
                {monthGoals.slice(0, 4).map((goal) => (
                  <div
                    key={goal.id}
                    className={`goal-bar-compact priority-${goal.priority}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(goal);
                    }}
                    title={goal.title}
                  >
                    <Target size={10} />
                    <span className="goal-title">{truncateText(goal.title, 20)}</span>
                    <span className="goal-date">{format(parseISO(goal.targetDate), 'd')}</span>
                  </div>
                ))}
                {monthGoals.length > 4 && (
                  <div className="more-goals-compact">
                    +{monthGoals.length - 4} more goals
                  </div>
                )}
                {monthGoals.length === 0 && (
                  <div className="no-goals">No goals</div>
                )}
              </div>
              <div className="click-hint">Click to view month</div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render semi-annual view (6 months) - more compact
  const renderSemiAnnualView = () => {
    const halfStart = currentDate.getMonth() < 6
      ? startOfYear(currentDate)
      : addMonths(startOfYear(currentDate), 6);
    const halfEnd = addMonths(halfStart, 5);
    const months = eachMonthOfInterval({ start: halfStart, end: endOfMonth(halfEnd) });

    return (
      <div className="calendar-semi-annual-view">
        {months.map((month) => {
          const monthGoals = getGoalsForMonth(month);
          const isCurrentMonth = isSameMonth(month, new Date());

          return (
            <div
              key={month.toISOString()}
              className={`semi-month ${isCurrentMonth ? 'current' : ''}`}
              onClick={() => handleMonthClick(month)}
            >
              <div className="semi-month-header">
                <span className="month-name">{format(month, 'MMM')}</span>
                <span className="goal-count">{monthGoals.length}</span>
              </div>
              <div className="semi-month-goals">
                {monthGoals.slice(0, 3).map((goal) => (
                  <div
                    key={goal.id}
                    className={`goal-dot priority-${goal.priority}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetail(goal);
                    }}
                    title={goal.title}
                  />
                ))}
                {monthGoals.length > 3 && (
                  <span className="more">+{monthGoals.length - 3}</span>
                )}
              </div>
              <div className="semi-goals-preview">
                {monthGoals.slice(0, 2).map((goal) => (
                  <div key={goal.id} className="goal-preview" title={goal.title}>
                    {truncateText(goal.title, 10)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render year view (12 months) - most compact
  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
      <div className="calendar-year-view">
        {months.map((month) => {
          const monthGoals = getGoalsForMonth(month);
          const isCurrentMonth = isSameMonth(month, new Date());

          return (
            <div
              key={month.toISOString()}
              className={`year-month ${isCurrentMonth ? 'current' : ''}`}
              onClick={() => handleMonthClick(month)}
            >
              <div className="year-month-header">
                <span>{format(month, 'MMM')}</span>
              </div>
              <div className="year-month-body">
                <div className="goal-indicators">
                  {monthGoals.slice(0, 6).map((goal) => (
                    <div
                      key={goal.id}
                      className={`goal-indicator priority-${goal.priority}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        openDetail(goal);
                      }}
                      title={goal.title}
                    />
                  ))}
                </div>
                {monthGoals.length > 0 && (
                  <span className="goal-count">{monthGoals.length}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render day detail modal
  const renderDayModal = () => {
    if (!showDayModal || !selectedDay) return null;

    return (
      <div className="day-modal-overlay" onClick={() => setShowDayModal(false)}>
        <div className="day-modal" onClick={(e) => e.stopPropagation()}>
          <div className="day-modal-header">
            <div className="header-info">
              <h3>{format(selectedDay.date, 'EEEE')}</h3>
              <span className="date-full">{format(selectedDay.date, 'MMMM d, yyyy')}</span>
            </div>
            <button className="close-btn" onClick={() => setShowDayModal(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="day-modal-body">
            {selectedDay.goals.length === 0 ? (
              <div className="no-goals-message">
                <Target size={48} />
                <p>No goals due on this day</p>
              </div>
            ) : (
              <div className="goals-list">
                <h4>{selectedDay.goals.length} Goal{selectedDay.goals.length !== 1 ? 's' : ''} Due</h4>
                {selectedDay.goals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`goal-card priority-${goal.priority}`}
                    onClick={() => {
                      setShowDayModal(false);
                      openDetail(goal);
                    }}
                  >
                    <div className="goal-card-header">
                      <Target size={16} />
                      <h5>{goal.title}</h5>
                    </div>
                    {goal.description && (
                      <p className="goal-description">{goal.description}</p>
                    )}
                    <div className="goal-card-footer">
                      <span className={`priority-badge ${goal.priority}`}>
                        {goal.priority}
                      </span>
                      <span className="status-badge">{goal.status}</span>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${goal.progress || 0}%` }}
                        />
                      </div>
                      <span className="progress-text">{goal.progress || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="long-term-calendar">
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
        {view === 'month' && renderMonthView()}
        {view === 'quarter' && renderQuarterView()}
        {view === 'semi-annual' && renderSemiAnnualView()}
        {view === 'year' && renderYearView()}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <span className="legend-dot high"></span>
          <span>High Priority</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot medium"></span>
          <span>Medium Priority</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot low"></span>
          <span>Low Priority</span>
        </div>
        <div className="legend-hint">
          <ZoomIn size={12} />
          <span>Click to zoom</span>
        </div>
      </div>

      {/* Day Detail Modal */}
      {renderDayModal()}
    </div>
  );
}
