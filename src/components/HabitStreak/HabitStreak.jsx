import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Flame, Snowflake, TrendingUp, Calendar, Award } from 'lucide-react';
import { format, subDays, isToday, parseISO, startOfDay, isSameDay } from 'date-fns';
import './HabitStreak.css';

export default function HabitStreak({ habit }) {
  const { tasks } = useApp();

  // Calculate streak for this habit
  const streakData = useMemo(() => {
    if (!habit || habit.type !== 'habit') return null;

    // Get all completions of this habit (by title match for recurring habits)
    const habitCompletions = tasks
      .filter((t) =>
        t.title === habit.title &&
        t.type === 'habit' &&
        t.completed
      )
      .map((t) => startOfDay(parseISO(t.scheduledDate || t.createdAt)))
      .sort((a, b) => b - a); // Sort descending (most recent first)

    if (habitCompletions.length === 0) {
      return { currentStreak: 0, longestStreak: 0, totalCompletions: 0, lastSevenDays: [] };
    }

    // Calculate current streak
    let currentStreak = 0;
    let checkDate = startOfDay(new Date());

    // If today isn't completed, start checking from yesterday
    const todayCompleted = habitCompletions.some((d) => isSameDay(d, checkDate));
    if (!todayCompleted) {
      checkDate = subDays(checkDate, 1);
    }

    for (let i = 0; i < 365; i++) {
      const hasCompletion = habitCompletions.some((d) => isSameDay(d, checkDate));
      if (hasCompletion) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    const sortedAsc = [...habitCompletions].sort((a, b) => a - b);
    for (const date of sortedAsc) {
      if (prevDate === null) {
        tempStreak = 1;
      } else {
        const daysDiff = Math.round((date - prevDate) / (1000 * 60 * 60 * 24));
        if (daysDiff === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
      prevDate = date;
    }

    // Last 7 days status
    const lastSevenDays = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const completed = habitCompletions.some((d) => isSameDay(d, startOfDay(day)));
      lastSevenDays.push({
        date: day,
        completed,
        isToday: isToday(day),
      });
    }

    return {
      currentStreak,
      longestStreak,
      totalCompletions: habitCompletions.length,
      lastSevenDays,
      todayCompleted,
    };
  }, [habit, tasks]);

  if (!streakData) return null;

  const { currentStreak, longestStreak, totalCompletions, lastSevenDays, todayCompleted } = streakData;

  // Determine streak status and styling
  const getStreakClass = () => {
    if (currentStreak >= 30) return 'streak-legendary';
    if (currentStreak >= 14) return 'streak-fire';
    if (currentStreak >= 7) return 'streak-hot';
    if (currentStreak >= 3) return 'streak-warm';
    return 'streak-start';
  };

  const getStreakMessage = () => {
    if (currentStreak >= 30) return '🏆 Legendary!';
    if (currentStreak >= 14) return '🔥 On Fire!';
    if (currentStreak >= 7) return '💪 One Week!';
    if (currentStreak >= 3) return '✨ Building!';
    if (currentStreak > 0) return '🌱 Started!';
    return 'Start today!';
  };

  return (
    <div className={`habit-streak ${getStreakClass()}`}>
      {/* Main Streak Display */}
      <div className="streak-main">
        <div className="streak-icon">
          {currentStreak > 0 ? (
            <Flame size={24} className="flame-icon" />
          ) : (
            <Snowflake size={24} className="cold-icon" />
          )}
        </div>
        <div className="streak-count">
          <span className="count-number">{currentStreak}</span>
          <span className="count-label">day streak</span>
        </div>
        <div className="streak-message">{getStreakMessage()}</div>
      </div>

      {/* Last 7 Days Grid */}
      <div className="streak-calendar">
        <div className="calendar-label">Last 7 days</div>
        <div className="calendar-grid">
          {lastSevenDays.map((day, index) => (
            <div
              key={index}
              className={`calendar-day ${day.completed ? 'completed' : ''} ${day.isToday ? 'today' : ''}`}
              title={format(day.date, 'EEEE, MMM d')}
            >
              <span className="day-letter">{format(day.date, 'EEEEE')}</span>
              <div className="day-indicator">
                {day.completed ? '✓' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="streak-stats">
        <div className="stat-item">
          <Award size={14} />
          <span className="stat-value">{longestStreak}</span>
          <span className="stat-label">Best</span>
        </div>
        <div className="stat-item">
          <Calendar size={14} />
          <span className="stat-value">{totalCompletions}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-item">
          <TrendingUp size={14} />
          <span className="stat-value">
            {totalCompletions > 0
              ? Math.round((currentStreak / longestStreak) * 100) || 0
              : 0}%
          </span>
          <span className="stat-label">Of Best</span>
        </div>
      </div>

      {/* Today Status */}
      {!todayCompleted && currentStreak > 0 && (
        <div className="streak-warning">
          ⚠️ Complete today to keep your streak!
        </div>
      )}
    </div>
  );
}

// Mini version for task list display
export function HabitStreakMini({ streak, completed }) {
  if (streak === undefined) return null;

  return (
    <div className={`streak-mini ${completed ? 'done' : ''}`}>
      <Flame size={12} className={streak > 0 ? 'active' : ''} />
      <span>{streak}</span>
    </div>
  );
}
