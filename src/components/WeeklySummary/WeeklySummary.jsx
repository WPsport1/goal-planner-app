import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Calendar,
  TrendingUp,
  TrendingDown,
  Target,
  CheckCircle2,
  Flame,
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Smile,
  Frown,
  Meh,
  Star,
  Zap,
} from 'lucide-react';
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isWithinInterval,
  parseISO,
  subWeeks,
  addWeeks,
  isSameDay,
} from 'date-fns';
import './WeeklySummary.css';

export default function WeeklySummary() {
  const {
    showWeeklySummary,
    setShowWeeklySummary,
    tasks,
    goals,
    reflections,
    calculateHabitStreak,
  } = useApp();

  const [weekOffset, setWeekOffset] = useState(0);

  // Calculate the week range
  const currentDate = weekOffset === 0 ? new Date() : addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Get tasks for this week
  const weekTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.scheduledDate) return false;
      const taskDate = parseISO(task.scheduledDate);
      return isWithinInterval(taskDate, { start: weekStart, end: weekEnd });
    });
  }, [tasks, weekStart, weekEnd]);

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = weekTasks.filter((t) => t.completed).length;
    const total = weekTasks.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // By type
    const byType = {
      task: { completed: 0, total: 0 },
      habit: { completed: 0, total: 0 },
      appointment: { completed: 0, total: 0 },
      routine: { completed: 0, total: 0 },
    };

    weekTasks.forEach((t) => {
      if (byType[t.type]) {
        byType[t.type].total++;
        if (t.completed) byType[t.type].completed++;
      }
    });

    // By day
    const byDay = weekDays.map((day) => {
      const dayTasks = weekTasks.filter((t) => isSameDay(parseISO(t.scheduledDate), day));
      const dayCompleted = dayTasks.filter((t) => t.completed).length;
      return {
        date: day,
        total: dayTasks.length,
        completed: dayCompleted,
        rate: dayTasks.length > 0 ? Math.round((dayCompleted / dayTasks.length) * 100) : 0,
      };
    });

    // Habits
    const habits = weekTasks.filter((t) => t.type === 'habit');
    const uniqueHabits = [...new Set(habits.map((h) => h.title))];

    // Previous week comparison
    const prevWeekStart = subWeeks(weekStart, 1);
    const prevWeekEnd = subWeeks(weekEnd, 1);
    const prevWeekTasks = tasks.filter((task) => {
      if (!task.scheduledDate) return false;
      const taskDate = parseISO(task.scheduledDate);
      return isWithinInterval(taskDate, { start: prevWeekStart, end: prevWeekEnd });
    });
    const prevCompleted = prevWeekTasks.filter((t) => t.completed).length;
    const prevTotal = prevWeekTasks.length;
    const prevRate = prevTotal > 0 ? Math.round((prevCompleted / prevTotal) * 100) : 0;
    const trend = completionRate - prevRate;

    return {
      completed,
      total,
      completionRate,
      byType,
      byDay,
      uniqueHabits,
      trend,
      prevRate,
    };
  }, [weekTasks, weekDays, tasks, weekStart, weekEnd]);

  // Get reflections for this week
  const weekReflections = useMemo(() => {
    return reflections.filter((r) => {
      const refDate = parseISO(r.date);
      return isWithinInterval(refDate, { start: weekStart, end: weekEnd });
    });
  }, [reflections, weekStart, weekEnd]);

  // Calculate average mood and rating
  const moodStats = useMemo(() => {
    if (weekReflections.length === 0) return { avgMood: 0, avgRating: 0 };
    const avgMood = Math.round(
      weekReflections.reduce((sum, r) => sum + (r.mood || 3), 0) / weekReflections.length
    );
    const avgRating = (
      weekReflections.reduce((sum, r) => sum + (r.rating || 5), 0) / weekReflections.length
    ).toFixed(1);
    return { avgMood, avgRating };
  }, [weekReflections]);

  if (!showWeeklySummary) return null;

  const handleClose = () => {
    setShowWeeklySummary(false);
    setWeekOffset(0);
  };

  const getMoodEmoji = (mood) => {
    const moods = ['😫', '😕', '😐', '🙂', '😄'];
    return moods[Math.max(0, Math.min(4, mood - 1))] || '😐';
  };

  const getMoodIcon = (mood) => {
    if (mood >= 4) return <Smile className="mood-icon positive" />;
    if (mood <= 2) return <Frown className="mood-icon negative" />;
    return <Meh className="mood-icon neutral" />;
  };

  return (
    <div className="weekly-summary-overlay" onClick={handleClose}>
      <div className="weekly-summary-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="summary-header">
          <div className="header-title">
            <BarChart3 size={24} />
            <h2>Weekly Summary</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Week Navigation */}
        <div className="week-navigation">
          <button
            className="nav-arrow"
            onClick={() => setWeekOffset((prev) => prev - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="week-range">
            <Calendar size={16} />
            <span>
              {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
            </span>
            {weekOffset === 0 && <span className="current-badge">This Week</span>}
          </div>
          <button
            className="nav-arrow"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            disabled={weekOffset >= 0}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Main Stats */}
        <div className="summary-content">
          {/* Overview Cards */}
          <div className="stats-grid">
            <div className="stat-card primary">
              <div className="stat-icon">
                <CheckCircle2 size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">{stats.completed}/{stats.total}</span>
                <span className="stat-label">Tasks Completed</span>
              </div>
              <div className="stat-rate">{stats.completionRate}%</div>
            </div>

            <div className={`stat-card trend ${stats.trend >= 0 ? 'positive' : 'negative'}`}>
              <div className="stat-icon">
                {stats.trend >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
              </div>
              <div className="stat-info">
                <span className="stat-value">
                  {stats.trend >= 0 ? '+' : ''}{stats.trend}%
                </span>
                <span className="stat-label">vs Last Week</span>
              </div>
              <div className="stat-rate prev">{stats.prevRate}% prev</div>
            </div>

            <div className="stat-card habits">
              <div className="stat-icon">
                <Flame size={24} />
              </div>
              <div className="stat-info">
                <span className="stat-value">
                  {stats.byType.habit.completed}/{stats.byType.habit.total}
                </span>
                <span className="stat-label">Habits Done</span>
              </div>
              <div className="stat-rate">
                {stats.byType.habit.total > 0
                  ? Math.round((stats.byType.habit.completed / stats.byType.habit.total) * 100)
                  : 0}%
              </div>
            </div>

            <div className="stat-card mood">
              <div className="stat-icon">
                {getMoodIcon(moodStats.avgMood)}
              </div>
              <div className="stat-info">
                <span className="stat-value">{getMoodEmoji(moodStats.avgMood)}</span>
                <span className="stat-label">Avg Mood</span>
              </div>
              <div className="stat-rate">{moodStats.avgRating}/10 rating</div>
            </div>
          </div>

          {/* Daily Breakdown Chart */}
          <div className="daily-chart-section">
            <h3>
              <Calendar size={18} />
              Daily Breakdown
            </h3>
            <div className="daily-chart">
              {stats.byDay.map((day, index) => (
                <div key={index} className="day-bar">
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{ height: `${day.rate}%` }}
                    />
                    <div
                      className="bar-empty"
                      style={{ height: `${100 - day.rate}%` }}
                    />
                  </div>
                  <span className="day-label">{format(day.date, 'EEE')}</span>
                  <span className="day-count">{day.completed}/{day.total}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Type Breakdown */}
          <div className="type-breakdown-section">
            <h3>
              <Target size={18} />
              By Category
            </h3>
            <div className="type-grid">
              {Object.entries(stats.byType).map(([type, data]) => (
                <div key={type} className={`type-item type-${type}`}>
                  <span className="type-name">{type.charAt(0).toUpperCase() + type.slice(1)}s</span>
                  <div className="type-progress">
                    <div
                      className="type-progress-fill"
                      style={{
                        width: `${data.total > 0 ? (data.completed / data.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="type-count">
                    {data.completed}/{data.total}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Habit Streaks */}
          {stats.uniqueHabits.length > 0 && (
            <div className="habits-section">
              <h3>
                <Flame size={18} />
                Active Habit Streaks
              </h3>
              <div className="habits-list">
                {stats.uniqueHabits.map((habit) => {
                  const streak = calculateHabitStreak(habit);
                  return (
                    <div key={habit} className="habit-item">
                      <span className="habit-name">{habit}</span>
                      <div className="habit-streak">
                        <Flame size={14} className={streak > 0 ? 'active' : ''} />
                        <span>{streak} day{streak !== 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reflections Summary */}
          {weekReflections.length > 0 && (
            <div className="reflections-section">
              <h3>
                <Star size={18} />
                Week's Reflections
              </h3>
              <div className="reflections-summary">
                <div className="reflection-stat">
                  <span className="ref-label">Reflections logged</span>
                  <span className="ref-value">{weekReflections.length}/7 days</span>
                </div>
                <div className="reflection-stat">
                  <span className="ref-label">Average day rating</span>
                  <span className="ref-value">{moodStats.avgRating}/10</span>
                </div>
              </div>
            </div>
          )}

          {/* Motivational Message */}
          <div className="motivational-section">
            <Zap size={20} />
            {stats.completionRate >= 80 ? (
              <p>Outstanding week! You crushed it with {stats.completionRate}% completion. Keep this momentum going!</p>
            ) : stats.completionRate >= 60 ? (
              <p>Good progress this week! You completed {stats.completed} tasks. Small wins add up to big results!</p>
            ) : stats.completionRate >= 40 ? (
              <p>You showed up {weekReflections.length} days this week. Progress isn't always linear - keep going!</p>
            ) : (
              <p>Every step forward counts. Next week is a fresh start with new opportunities!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
