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

  // Render month view
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
                className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${today ? 'today' : ''}`}
              >
                <span className="day-number">{format(day, 'd')}</span>
                <div className="day-goals">
                  {dayGoals.slice(0, 3).map((goal) => (
                    <div
                      key={goal.id}
                      className={`goal-chip priority-${goal.priority}`}
                      onClick={() => openDetail(goal)}
                      title={goal.title}
                    >
                      <Target size={10} />
                      <span>{goal.title}</span>
                    </div>
                  ))}
                  {dayGoals.length > 3 && (
                    <div className="more-goals">+{dayGoals.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Render quarter view (3 months)
  const renderQuarterView = () => {
    const quarterStart = startOfQuarter(currentDate);
    const quarterEnd = endOfQuarter(quarterStart);
    const months = eachMonthOfInterval({ start: quarterStart, end: quarterEnd });

    return (
      <div className="calendar-quarter-view">
        {months.map((month) => (
          <div key={month.toISOString()} className="quarter-month">
            <h4>{format(month, 'MMMM')}</h4>
            <div className="month-goals">
              {getGoalsForMonth(month).map((goal) => (
                <div
                  key={goal.id}
                  className={`goal-bar priority-${goal.priority}`}
                  onClick={() => openDetail(goal)}
                >
                  <Target size={12} />
                  <span className="goal-title">{goal.title}</span>
                  <span className="goal-date">
                    {format(parseISO(goal.targetDate), 'MMM d')}
                  </span>
                  <div className="goal-progress-mini">
                    <div
                      className="progress-fill"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                </div>
              ))}
              {getGoalsForMonth(month).length === 0 && (
                <div className="no-goals">No goals this month</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render semi-annual view (6 months)
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
          return (
            <div key={month.toISOString()} className="semi-month">
              <div className="semi-month-header">
                <span className="month-name">{format(month, 'MMM')}</span>
                <span className="goal-count">{monthGoals.length}</span>
              </div>
              <div className="semi-month-goals">
                {monthGoals.slice(0, 2).map((goal) => (
                  <div
                    key={goal.id}
                    className={`goal-dot priority-${goal.priority}`}
                    onClick={() => openDetail(goal)}
                    title={goal.title}
                  />
                ))}
                {monthGoals.length > 2 && (
                  <span className="more">+{monthGoals.length - 2}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render year view (12 months)
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
            >
              <div className="year-month-header">
                <span>{format(month, 'MMM')}</span>
              </div>
              <div className="year-month-body">
                <div className="goal-indicators">
                  {monthGoals.slice(0, 4).map((goal) => (
                    <div
                      key={goal.id}
                      className={`goal-indicator priority-${goal.priority}`}
                      onClick={() => openDetail(goal)}
                      title={goal.title}
                    />
                  ))}
                </div>
                {monthGoals.length > 0 && (
                  <span className="goal-count">{monthGoals.length} goals</span>
                )}
              </div>
            </div>
          );
        })}
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
      </div>
    </div>
  );
}
