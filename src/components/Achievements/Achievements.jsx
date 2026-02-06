import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Trophy,
  Lock,
  Flame,
  Target,
  CheckCircle2,
  Calendar,
  Star,
  Zap,
  Award,
  Crown,
  Rocket,
  Heart,
  Sun,
  Moon,
  Sparkles,
  Medal,
  TrendingUp,
} from 'lucide-react';
import { parseISO, isToday, differenceInDays, startOfWeek, endOfWeek, isWithinInterval, isSameDay } from 'date-fns';
import './Achievements.css';

// Define all achievements
const achievementDefinitions = [
  // Streak Achievements
  {
    id: 'streak_3',
    name: 'Getting Started',
    description: 'Complete a habit for 3 days in a row',
    icon: Flame,
    category: 'streaks',
    tier: 'bronze',
    requirement: (stats) => stats.longestStreak >= 3,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day habit streak',
    icon: Flame,
    category: 'streaks',
    tier: 'silver',
    requirement: (stats) => stats.longestStreak >= 7,
  },
  {
    id: 'streak_14',
    name: 'Habit Builder',
    description: 'Maintain a 14-day habit streak',
    icon: Flame,
    category: 'streaks',
    tier: 'gold',
    requirement: (stats) => stats.longestStreak >= 14,
  },
  {
    id: 'streak_30',
    name: 'Unstoppable',
    description: 'Maintain a 30-day habit streak',
    icon: Crown,
    category: 'streaks',
    tier: 'platinum',
    requirement: (stats) => stats.longestStreak >= 30,
  },

  // Task Completion Achievements
  {
    id: 'tasks_10',
    name: 'First Steps',
    description: 'Complete 10 tasks',
    icon: CheckCircle2,
    category: 'tasks',
    tier: 'bronze',
    requirement: (stats) => stats.totalTasksCompleted >= 10,
  },
  {
    id: 'tasks_50',
    name: 'Getting Things Done',
    description: 'Complete 50 tasks',
    icon: CheckCircle2,
    category: 'tasks',
    tier: 'silver',
    requirement: (stats) => stats.totalTasksCompleted >= 50,
  },
  {
    id: 'tasks_100',
    name: 'Centurion',
    description: 'Complete 100 tasks',
    icon: Medal,
    category: 'tasks',
    tier: 'gold',
    requirement: (stats) => stats.totalTasksCompleted >= 100,
  },
  {
    id: 'tasks_500',
    name: 'Productivity Master',
    description: 'Complete 500 tasks',
    icon: Trophy,
    category: 'tasks',
    tier: 'platinum',
    requirement: (stats) => stats.totalTasksCompleted >= 500,
  },

  // Goal Achievements
  {
    id: 'goal_1',
    name: 'Dream Setter',
    description: 'Create your first goal',
    icon: Target,
    category: 'goals',
    tier: 'bronze',
    requirement: (stats) => stats.totalGoals >= 1,
  },
  {
    id: 'goal_complete_1',
    name: 'Goal Getter',
    description: 'Complete your first goal',
    icon: Star,
    category: 'goals',
    tier: 'silver',
    requirement: (stats) => stats.goalsCompleted >= 1,
  },
  {
    id: 'goal_complete_5',
    name: 'Achiever',
    description: 'Complete 5 goals',
    icon: Award,
    category: 'goals',
    tier: 'gold',
    requirement: (stats) => stats.goalsCompleted >= 5,
  },
  {
    id: 'goal_complete_10',
    name: 'Life Transformer',
    description: 'Complete 10 goals',
    icon: Rocket,
    category: 'goals',
    tier: 'platinum',
    requirement: (stats) => stats.goalsCompleted >= 10,
  },

  // Reflection Achievements
  {
    id: 'reflect_1',
    name: 'Self-Aware',
    description: 'Complete your first daily reflection',
    icon: Moon,
    category: 'reflection',
    tier: 'bronze',
    requirement: (stats) => stats.totalReflections >= 1,
  },
  {
    id: 'reflect_7',
    name: 'Weekly Reflector',
    description: 'Complete 7 daily reflections',
    icon: Moon,
    category: 'reflection',
    tier: 'silver',
    requirement: (stats) => stats.totalReflections >= 7,
  },
  {
    id: 'reflect_30',
    name: 'Mindful Month',
    description: 'Complete 30 daily reflections',
    icon: Sparkles,
    category: 'reflection',
    tier: 'gold',
    requirement: (stats) => stats.totalReflections >= 30,
  },

  // Special Achievements
  {
    id: 'perfect_day',
    name: 'Perfect Day',
    description: 'Complete all tasks scheduled for a day',
    icon: Sun,
    category: 'special',
    tier: 'silver',
    requirement: (stats) => stats.perfectDays >= 1,
  },
  {
    id: 'perfect_week',
    name: 'Flawless Week',
    description: 'Complete all tasks for an entire week',
    icon: Crown,
    category: 'special',
    tier: 'gold',
    requirement: (stats) => stats.perfectWeeks >= 1,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Complete a morning routine habit 7 times',
    icon: Sun,
    category: 'special',
    tier: 'silver',
    requirement: (stats) => stats.morningRoutineCompletions >= 7,
  },
  {
    id: 'consistency',
    name: 'Consistent',
    description: 'Use the app for 7 consecutive days',
    icon: TrendingUp,
    category: 'special',
    tier: 'silver',
    requirement: (stats) => stats.consecutiveActiveDays >= 7,
  },
];

const tierColors = {
  bronze: { bg: '#CD7F32', text: '#8B4513' },
  silver: { bg: '#C0C0C0', text: '#696969' },
  gold: { bg: '#FFD700', text: '#B8860B' },
  platinum: { bg: '#E5E4E2', text: '#4a5568' },
};

const categoryLabels = {
  streaks: 'Habit Streaks',
  tasks: 'Task Completion',
  goals: 'Goal Achievement',
  reflection: 'Self-Reflection',
  special: 'Special',
};

export default function Achievements() {
  const {
    showAchievements,
    setShowAchievements,
    tasks,
    goals,
    reflections,
    calculateHabitStreak,
  } = useApp();

  const [filter, setFilter] = useState('all');

  // Calculate all stats needed for achievements
  const stats = useMemo(() => {
    // Total tasks completed
    const totalTasksCompleted = tasks.filter((t) => t.completed).length;

    // Goals stats
    const totalGoals = goals.length;
    const goalsCompleted = goals.filter((g) => g.status === 'completed').length;

    // Reflections
    const totalReflections = reflections.length;

    // Calculate longest streak across all habits
    const habits = tasks.filter((t) => t.type === 'habit');
    const uniqueHabits = [...new Set(habits.map((h) => h.title))];
    let longestStreak = 0;
    uniqueHabits.forEach((habit) => {
      const streak = calculateHabitStreak(habit);
      if (streak > longestStreak) longestStreak = streak;
    });

    // Perfect days - check each day that has tasks
    const tasksByDate = {};
    tasks.forEach((t) => {
      if (t.scheduledDate) {
        const dateKey = t.scheduledDate.split('T')[0];
        if (!tasksByDate[dateKey]) tasksByDate[dateKey] = { total: 0, completed: 0 };
        tasksByDate[dateKey].total++;
        if (t.completed) tasksByDate[dateKey].completed++;
      }
    });
    const perfectDays = Object.values(tasksByDate).filter(
      (d) => d.total > 0 && d.completed === d.total
    ).length;

    // Perfect weeks - simplified check
    let perfectWeeks = 0;
    // This would need more complex logic for full implementation

    // Morning routine completions (tasks before 10am marked as routine/habit)
    const morningRoutineCompletions = tasks.filter(
      (t) =>
        t.completed &&
        (t.type === 'habit' || t.type === 'routine') &&
        t.startTime &&
        t.startTime < '10:00'
    ).length;

    // Consecutive active days (simplified)
    let consecutiveActiveDays = 0;
    const sortedDates = [
      ...new Set(
        tasks
          .filter((t) => t.completed && t.scheduledDate)
          .map((t) => t.scheduledDate.split('T')[0])
      ),
    ].sort().reverse();

    if (sortedDates.length > 0) {
      consecutiveActiveDays = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        const diff = differenceInDays(parseISO(sortedDates[i - 1]), parseISO(sortedDates[i]));
        if (diff === 1) {
          consecutiveActiveDays++;
        } else {
          break;
        }
      }
    }

    return {
      totalTasksCompleted,
      totalGoals,
      goalsCompleted,
      totalReflections,
      longestStreak,
      perfectDays,
      perfectWeeks,
      morningRoutineCompletions,
      consecutiveActiveDays,
    };
  }, [tasks, goals, reflections, calculateHabitStreak]);

  // Determine which achievements are unlocked
  const achievements = useMemo(() => {
    return achievementDefinitions.map((achievement) => ({
      ...achievement,
      unlocked: achievement.requirement(stats),
    }));
  }, [stats]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const totalCount = achievements.length;

  const filteredAchievements =
    filter === 'all'
      ? achievements
      : filter === 'unlocked'
      ? achievements.filter((a) => a.unlocked)
      : achievements.filter((a) => a.category === filter);

  if (!showAchievements) return null;

  const handleClose = () => {
    setShowAchievements(false);
  };

  return (
    <div className="achievements-overlay" onClick={handleClose}>
      <div className="achievements-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="achievements-header">
          <div className="header-title">
            <Trophy size={24} />
            <h2>Achievements</h2>
          </div>
          <div className="header-progress">
            <span className="progress-text">
              {unlockedCount}/{totalCount} Unlocked
            </span>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(unlockedCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="achievement-filters">
          <button
            className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filter === 'unlocked' ? 'active' : ''}`}
            onClick={() => setFilter('unlocked')}
          >
            Unlocked
          </button>
          <button
            className={`filter-btn ${filter === 'streaks' ? 'active' : ''}`}
            onClick={() => setFilter('streaks')}
          >
            Streaks
          </button>
          <button
            className={`filter-btn ${filter === 'tasks' ? 'active' : ''}`}
            onClick={() => setFilter('tasks')}
          >
            Tasks
          </button>
          <button
            className={`filter-btn ${filter === 'goals' ? 'active' : ''}`}
            onClick={() => setFilter('goals')}
          >
            Goals
          </button>
        </div>

        {/* Achievements Grid */}
        <div className="achievements-content">
          <div className="achievements-grid">
            {filteredAchievements.map((achievement) => {
              const Icon = achievement.icon;
              const tierStyle = tierColors[achievement.tier];

              return (
                <div
                  key={achievement.id}
                  className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'} tier-${achievement.tier}`}
                >
                  <div
                    className="achievement-icon"
                    style={{
                      background: achievement.unlocked
                        ? `linear-gradient(135deg, ${tierStyle.bg} 0%, ${tierStyle.text} 100%)`
                        : 'var(--bg-tertiary)',
                    }}
                  >
                    {achievement.unlocked ? (
                      <Icon size={24} color="white" />
                    ) : (
                      <Lock size={24} />
                    )}
                  </div>
                  <div className="achievement-info">
                    <h3>{achievement.name}</h3>
                    <p>{achievement.description}</p>
                    <span className={`tier-badge tier-${achievement.tier}`}>
                      {achievement.tier}
                    </span>
                  </div>
                  {achievement.unlocked && (
                    <div className="unlocked-badge">
                      <CheckCircle2 size={16} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredAchievements.length === 0 && (
            <div className="empty-achievements">
              <Lock size={48} />
              <p>No achievements in this category yet</p>
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="stats-summary">
          <div className="stat-item">
            <span className="stat-value">{stats.totalTasksCompleted}</span>
            <span className="stat-label">Tasks Done</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.longestStreak}</span>
            <span className="stat-label">Best Streak</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.goalsCompleted}</span>
            <span className="stat-label">Goals Achieved</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{stats.perfectDays}</span>
            <span className="stat-label">Perfect Days</span>
          </div>
        </div>
      </div>
    </div>
  );
}
