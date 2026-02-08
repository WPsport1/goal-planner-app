import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import {
  goalService,
  taskService,
  reflectionService,
  journalService,
  lifeScoreService,
  weeklyPlanService,
  routineService,
  isSupabaseConfigured
} from '../services/supabase';
import { isToday, parseISO, startOfDay, subDays, isSameDay } from 'date-fns';

const AppContext = createContext();

export function useApp() {
  return useContext(AppContext);
}

// Initial sample data for new users
const createSampleData = () => ({
  goals: [
    {
      id: uuidv4(),
      title: 'Learn Spanish',
      description: 'Achieve conversational fluency in Spanish',
      category: 'Personal Development',
      priority: 'high',
      status: 'in_progress',
      targetDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
      createdAt: new Date().toISOString(),
      milestones: [
        { id: uuidv4(), title: 'Complete basics course', completed: true, dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() },
        { id: uuidv4(), title: 'Hold 5-minute conversation', completed: false, dueDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      progress: 35,
      notes: '',
      dataPoints: [
        { date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), value: 0 },
        { date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), value: 15 },
        { date: new Date().toISOString(), value: 35 },
      ],
    },
  ],
  tasks: [
    {
      id: uuidv4(),
      title: 'Spanish lesson - Duolingo',
      type: 'habit',
      description: 'Complete daily Duolingo lesson',
      priority: 'medium',
      status: 'pending',
      linkedGoalId: null,
      scheduledDate: new Date().toISOString(),
      startTime: '09:00',
      endTime: '09:30',
      recurrence: 'daily',
      completed: false,
      dataPoints: [],
    },
  ],
  reflections: [],
});

export function AppProvider({ children }) {
  const { user, isConfigured } = useAuth();

  // Loading and sync states
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // State for goals (long-term)
  const [goals, setGoals] = useState([]);

  // State for tasks/appointments/habits (short-term)
  const [tasks, setTasks] = useState([]);

  // State for daily reflections
  const [reflections, setReflections] = useState([]);

  // Current view state
  const [activeTab, setActiveTab] = useState('goals'); // 'goals' or 'planner'
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [leftPanelFullscreen, setLeftPanelFullscreen] = useState(false);
  const [rightPanelFullscreen, setRightPanelFullscreen] = useState(false);

  // Celebration state
  const [celebration, setCelebration] = useState(null);

  // Daily reflection modal state
  const [showReflection, setShowReflection] = useState(false);

  // Weekly summary modal state
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);

  // Achievements modal state
  const [showAchievements, setShowAchievements] = useState(false);

  // Morning routine state
  const [showMorningRoutine, setShowMorningRoutine] = useState(false);
  const [morningRoutine, setMorningRoutine] = useState(null); // Legacy - keeping for backwards compatibility

  // Nighttime routine state
  const [showNightRoutine, setShowNightRoutine] = useState(false);

  // Unified routines state (supports 28 morning + 28 nighttime variations)
  // Key format: "{type}_{day}_{week}" e.g. "morning_monday_A", "nighttime_friday_C"
  const [routines, setRoutines] = useState({});

  // Reminders state (legacy)
  const [showReminders, setShowReminders] = useState(false);
  const [reminders, setReminders] = useState(null);

  // Notification Center state
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(null);

  // Journal state
  const [showJournal, setShowJournal] = useState(false);
  const [journalEntries, setJournalEntries] = useState([]);

  // Life Score state
  const [showLifeScore, setShowLifeScore] = useState(false);
  const [lifeScoreData, setLifeScoreData] = useState(null);

  // Weekly Planning state
  const [showWeeklyPlanning, setShowWeeklyPlanning] = useState(false);
  const [weeklyPlanningData, setWeeklyPlanningData] = useState(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setSyncError(null);

      try {
        // If using cloud sync with authenticated user
        if (isConfigured && user) {
          // Load from Supabase - core data
          const [goalsResult, tasksResult, reflectionsResult] = await Promise.all([
            goalService.getAll(user.id),
            taskService.getAll(user.id),
            reflectionService.getAll(user.id),
          ]);

          if (goalsResult.error) throw new Error(goalsResult.error);
          if (tasksResult.error) throw new Error(tasksResult.error);
          // Don't throw on reflection error - table might not exist yet
          if (reflectionsResult.error) {
            console.warn('Reflections not loaded:', reflectionsResult.error);
          }

          // If user has no data, create sample data
          if (goalsResult.data.length === 0 && tasksResult.data.length === 0) {
            const sample = createSampleData();
            setGoals(sample.goals);
            setTasks(sample.tasks);
            setReflections(sample.reflections);
          } else {
            // Transform from database format to app format
            setGoals(goalsResult.data.map(transformGoalFromDB));
            setTasks(tasksResult.data.map(transformTaskFromDB));
            // Load reflections if available
            if (reflectionsResult.data) {
              setReflections(reflectionsResult.data.map(transformReflectionFromDB));
            }
          }

          // Load Phase 3 data (don't fail if tables don't exist yet)
          try {
            const [journalResult, lifeScoreResult, weeklyPlanResult, routinesResult] = await Promise.all([
              journalService.getAll(user.id),
              lifeScoreService.getAll(user.id),
              weeklyPlanService.getAll(user.id),
              routineService.getAll(user.id),
            ]);

            if (journalResult.data) {
              setJournalEntries(journalResult.data.map(transformJournalFromDB));
            }
            if (lifeScoreResult.data && lifeScoreResult.data.length > 0) {
              setLifeScoreData({
                current: transformLifeScoreFromDB(lifeScoreResult.data[0]),
                history: lifeScoreResult.data.map(transformLifeScoreFromDB),
              });
            }
            if (weeklyPlanResult.data) {
              setWeeklyPlanningData(weeklyPlanResult.data.map(transformWeeklyPlanFromDB));
            }
            if (routinesResult.data) {
              const routinesObj = {};
              routinesResult.data.forEach((r) => {
                routinesObj[r.routine_key] = transformRoutineFromDB(r);
              });
              setRoutines(routinesObj);
            }
          } catch (phase3Err) {
            console.warn('Phase 3 data not loaded (tables may not exist yet):', phase3Err);
          }
        } else {
          // Load from localStorage (local-only mode)
          const savedGoals = localStorage.getItem('goals');
          const savedTasks = localStorage.getItem('tasks');
          const savedReflections = localStorage.getItem('reflections');

          if (savedGoals) {
            setGoals(JSON.parse(savedGoals));
          } else {
            const sample = createSampleData();
            setGoals(sample.goals);
          }

          if (savedTasks) {
            setTasks(JSON.parse(savedTasks));
          } else {
            const sample = createSampleData();
            setTasks(sample.tasks);
          }

          if (savedReflections) {
            setReflections(JSON.parse(savedReflections));
          }
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setSyncError(err.message);
        // Fall back to localStorage
        const savedGoals = localStorage.getItem('goals');
        const savedTasks = localStorage.getItem('tasks');
        const savedReflections = localStorage.getItem('reflections');
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedTasks) setTasks(JSON.parse(savedTasks));
        if (savedReflections) setReflections(JSON.parse(savedReflections));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, isConfigured]);

  // Save to localStorage as backup (always)
  useEffect(() => {
    if (!isLoading && goals.length > 0) {
      localStorage.setItem('goals', JSON.stringify(goals));
    }
  }, [goals, isLoading]);

  useEffect(() => {
    if (!isLoading && tasks.length > 0) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }, [tasks, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('reflections', JSON.stringify(reflections));
    }
  }, [reflections, isLoading]);

  // Load morning routine from localStorage (legacy support)
  useEffect(() => {
    const savedRoutine = localStorage.getItem('morningRoutine');
    if (savedRoutine) {
      setMorningRoutine(JSON.parse(savedRoutine));
    }
  }, []);

  // Load all routines from localStorage (new unified system)
  useEffect(() => {
    const savedRoutines = localStorage.getItem('routines');
    if (savedRoutines) {
      setRoutines(JSON.parse(savedRoutines));
    }
  }, []);

  // Load reminders from localStorage
  useEffect(() => {
    const savedReminders = localStorage.getItem('reminders');
    if (savedReminders) {
      setReminders(JSON.parse(savedReminders));
    }
  }, []);

  // Load notification settings from localStorage
  useEffect(() => {
    const savedNotificationSettings = localStorage.getItem('notificationSettings');
    if (savedNotificationSettings) {
      setNotificationSettings(JSON.parse(savedNotificationSettings));
    }
  }, []);

  // Load journal entries from localStorage
  useEffect(() => {
    const savedJournalEntries = localStorage.getItem('journalEntries');
    if (savedJournalEntries) {
      setJournalEntries(JSON.parse(savedJournalEntries));
    }
  }, []);

  // Load life score data from localStorage
  useEffect(() => {
    const savedLifeScoreData = localStorage.getItem('lifeScoreData');
    if (savedLifeScoreData) {
      setLifeScoreData(JSON.parse(savedLifeScoreData));
    }
  }, []);

  // Load weekly planning data from localStorage
  useEffect(() => {
    const savedWeeklyPlanningData = localStorage.getItem('weeklyPlanningData');
    if (savedWeeklyPlanningData) {
      setWeeklyPlanningData(JSON.parse(savedWeeklyPlanningData));
    }
  }, []);

  // Check for evening reflection prompt (after 7 PM)
  useEffect(() => {
    const checkReflectionTime = () => {
      const now = new Date();
      const hour = now.getHours();
      const todayReflection = reflections.find((r) => isToday(parseISO(r.date)));

      // Show prompt between 7 PM and 10 PM if no reflection today
      if (hour >= 19 && hour < 22 && !todayReflection && !isLoading) {
        const lastPromptDismissed = localStorage.getItem('reflectionPromptDismissed');
        if (lastPromptDismissed !== new Date().toDateString()) {
          // Could auto-show here, but we'll let user trigger it
        }
      }
    };

    const timer = setInterval(checkReflectionTime, 60000); // Check every minute
    checkReflectionTime();

    return () => clearInterval(timer);
  }, [reflections, isLoading]);

  // Transform functions for database
  const transformGoalToDB = (goal) => ({
    id: goal.id,
    title: goal.title,
    description: goal.description,
    category: goal.category,
    priority: goal.priority,
    status: goal.status,
    target_date: goal.targetDate,
    progress: goal.progress,
    notes: goal.notes,
    milestones: goal.milestones,
    data_points: goal.dataPoints,
  });

  const transformGoalFromDB = (dbGoal) => ({
    id: dbGoal.id,
    title: dbGoal.title,
    description: dbGoal.description,
    category: dbGoal.category,
    priority: dbGoal.priority,
    status: dbGoal.status,
    targetDate: dbGoal.target_date,
    createdAt: dbGoal.created_at,
    progress: dbGoal.progress,
    notes: dbGoal.notes,
    milestones: dbGoal.milestones || [],
    dataPoints: dbGoal.data_points || [],
  });

  const transformTaskToDB = (task) => ({
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    status: task.status,
    scheduled_date: task.scheduledDate,
    start_time: task.startTime,
    end_time: task.endTime,
    recurrence: task.recurrence,
    completed: task.completed,
    linked_goal_id: task.linkedGoalId,
    data_points: task.dataPoints,
  });

  const transformTaskFromDB = (dbTask) => ({
    id: dbTask.id,
    title: dbTask.title,
    description: dbTask.description,
    type: dbTask.type,
    priority: dbTask.priority,
    status: dbTask.status,
    scheduledDate: dbTask.scheduled_date,
    startTime: dbTask.start_time,
    endTime: dbTask.end_time,
    recurrence: dbTask.recurrence,
    completed: dbTask.completed,
    linkedGoalId: dbTask.linked_goal_id,
    createdAt: dbTask.created_at,
    dataPoints: dbTask.data_points || [],
  });

  // Reflection transform functions
  const transformReflectionToDB = (reflection) => ({
    date: reflection.date,
    mood: reflection.mood,
    rating: reflection.rating,
    gratitude: reflection.gratitude,
    wins: reflection.wins,
    improvements: reflection.improvements,
    tomorrow_focus: reflection.tomorrowFocus,
  });

  const transformReflectionFromDB = (dbReflection) => ({
    id: dbReflection.id,
    date: dbReflection.date,
    mood: dbReflection.mood,
    rating: dbReflection.rating,
    gratitude: dbReflection.gratitude,
    wins: dbReflection.wins,
    improvements: dbReflection.improvements,
    tomorrowFocus: dbReflection.tomorrow_focus,
    createdAt: dbReflection.created_at,
  });

  // Phase 3 transform functions
  const transformJournalToDB = (entry) => ({
    date: entry.date,
    content: entry.content,
    mood: entry.mood,
    energy: entry.energy,
    gratitude: entry.gratitude || [],
    tags: entry.tags || [],
  });

  const transformJournalFromDB = (dbEntry) => ({
    id: dbEntry.id,
    date: dbEntry.date,
    content: dbEntry.content,
    mood: dbEntry.mood,
    energy: dbEntry.energy,
    gratitude: dbEntry.gratitude || [],
    tags: dbEntry.tags || [],
    createdAt: dbEntry.created_at,
  });

  const transformLifeScoreToDB = (score) => ({
    date: score.date,
    health: score.health,
    relationships: score.relationships,
    mindset: score.mindset,
    career: score.career,
    social: score.social,
    finance: score.finance,
    spirituality: score.spirituality,
    purpose: score.purpose,
    overall_score: score.overallScore,
    notes: score.notes,
  });

  const transformLifeScoreFromDB = (dbScore) => ({
    id: dbScore.id,
    date: dbScore.date,
    health: dbScore.health,
    relationships: dbScore.relationships,
    mindset: dbScore.mindset,
    career: dbScore.career,
    social: dbScore.social,
    finance: dbScore.finance,
    spirituality: dbScore.spirituality,
    purpose: dbScore.purpose,
    overallScore: dbScore.overall_score,
    notes: dbScore.notes,
    createdAt: dbScore.created_at,
  });

  const transformWeeklyPlanToDB = (plan) => ({
    week_start: plan.weekStart,
    reflections: plan.reflections || {},
    priorities: plan.priorities || [],
    weekly_goals: plan.weeklyGoals || [],
    daily_tasks: plan.dailyTasks || {},
    completed: plan.completed || false,
  });

  const transformWeeklyPlanFromDB = (dbPlan) => ({
    id: dbPlan.id,
    weekStart: dbPlan.week_start,
    reflections: dbPlan.reflections || {},
    priorities: dbPlan.priorities || [],
    weeklyGoals: dbPlan.weekly_goals || [],
    dailyTasks: dbPlan.daily_tasks || {},
    completed: dbPlan.completed,
    createdAt: dbPlan.created_at,
  });

  const transformRoutineToDB = (routine, key) => ({
    routine_key: key,
    routine_type: routine.type || 'morning',
    day_of_week: routine.dayOfWeek,
    week_variant: routine.weekVariant,
    items: routine.items || [],
  });

  const transformRoutineFromDB = (dbRoutine) => ({
    id: dbRoutine.id,
    type: dbRoutine.routine_type,
    dayOfWeek: dbRoutine.day_of_week,
    weekVariant: dbRoutine.week_variant,
    items: dbRoutine.items || [],
    createdAt: dbRoutine.created_at,
  });

  // Calculate habit streak
  const calculateHabitStreak = useCallback((habitTitle) => {
    const habitCompletions = tasks
      .filter((t) => t.title === habitTitle && t.type === 'habit' && t.completed)
      .map((t) => startOfDay(parseISO(t.scheduledDate || t.createdAt)))
      .sort((a, b) => b - a);

    if (habitCompletions.length === 0) return 0;

    let streak = 0;
    let checkDate = startOfDay(new Date());
    const todayCompleted = habitCompletions.some((d) => isSameDay(d, checkDate));

    if (!todayCompleted) {
      checkDate = subDays(checkDate, 1);
    }

    for (let i = 0; i < 365; i++) {
      const hasCompletion = habitCompletions.some((d) => isSameDay(d, checkDate));
      if (hasCompletion) {
        streak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    return streak;
  }, [tasks]);

  // Trigger celebration
  const triggerCelebration = useCallback((type, data = {}) => {
    setCelebration({ type, ...data });
  }, []);

  const clearCelebration = useCallback(() => {
    setCelebration(null);
  }, []);

  // Goal CRUD operations
  const addGoal = async (goal) => {
    const newGoal = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      milestones: [],
      progress: 0,
      dataPoints: [],
      ...goal,
    };

    // Optimistic update
    setGoals((prev) => [...prev, newGoal]);

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await goalService.create(transformGoalToDB(newGoal), user.id);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing goal:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }

    return newGoal;
  };

  const updateGoal = async (id, updates) => {
    const oldGoal = goals.find((g) => g.id === id);

    // Optimistic update
    setGoals((prev) =>
      prev.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal))
    );

    // Check for goal completion celebration
    if (updates.status === 'completed' && oldGoal?.status !== 'completed') {
      triggerCelebration('goal_complete', { message: `You completed: ${oldGoal?.title}!` });
    }

    // Check for milestone completion
    if (updates.milestones && oldGoal?.milestones) {
      const oldCompleted = oldGoal.milestones.filter((m) => m.completed).length;
      const newCompleted = updates.milestones.filter((m) => m.completed).length;
      if (newCompleted > oldCompleted) {
        triggerCelebration('milestone', { message: 'Milestone achieved!' });
      }
    }

    // Sync to cloud
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await goalService.update(id, transformGoalToDB(updates));
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing goal update:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const deleteGoal = async (id) => {
    // Optimistic update
    setGoals((prev) => prev.filter((goal) => goal.id !== id));

    // Sync to cloud
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await goalService.delete(id);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing goal delete:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const reorderGoals = (newOrder) => {
    setGoals(newOrder);
  };

  // Task CRUD operations
  const addTask = async (task) => {
    const newTask = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      dataPoints: [],
      completed: false,
      ...task,
    };

    // Optimistic update
    setTasks((prev) => [...prev, newTask]);

    // Sync to cloud
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await taskService.create(transformTaskToDB(newTask), user.id);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing task:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }

    return newTask;
  };

  const updateTask = async (id, updates) => {
    // Optimistic update
    setTasks((prev) =>
      prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
    );

    // Sync to cloud
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await taskService.update(id, transformTaskToDB(updates));
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing task update:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const deleteTask = async (id) => {
    // Optimistic update
    setTasks((prev) => prev.filter((task) => task.id !== id));

    // Sync to cloud
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await taskService.delete(id);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing task delete:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const toggleTaskComplete = async (id) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const newCompleted = !task.completed;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id ? { ...t, completed: newCompleted } : t
      )
    );

    // Trigger celebrations
    if (newCompleted) {
      if (task.type === 'habit') {
        // Calculate streak after completion
        setTimeout(() => {
          const streak = calculateHabitStreak(task.title);
          if (streak > 0 && (streak === 7 || streak === 14 || streak === 30 || streak === 100 || streak % 50 === 0)) {
            triggerCelebration('streak', { streak, message: `Amazing! ${streak} day streak on "${task.title}"!` });
          } else if (streak === 1) {
            triggerCelebration('habit_complete', { message: 'Great start! Day 1 complete!' });
          } else {
            triggerCelebration('habit_complete', { streak, message: `${streak} day streak! Keep going!` });
          }
        }, 100);
      } else {
        // Regular task completion - show subtle celebration
        triggerCelebration('task_complete', { message: task.title });
      }
    }

    // Sync to cloud
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await taskService.toggleComplete(id, newCompleted);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing task toggle:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const reorderTasks = (newOrder) => {
    setTasks(newOrder);
  };

  // Reflection CRUD operations
  const addReflection = async (reflection) => {
    const newReflection = {
      id: uuidv4(),
      ...reflection,
      date: new Date().toISOString(),
    };

    // Optimistic update
    setReflections((prev) => [...prev, newReflection]);
    triggerCelebration('milestone', { message: 'Reflection saved! Great job taking time to reflect.' });

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await reflectionService.create(transformReflectionToDB(newReflection), user.id);
        if (result.error) throw new Error(result.error);
        // Update with cloud-generated ID if different
        if (result.data && result.data.id !== newReflection.id) {
          setReflections((prev) =>
            prev.map((r) => (r.id === newReflection.id ? { ...r, id: result.data.id } : r))
          );
        }
      } catch (err) {
        console.error('Error syncing reflection:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }

    return newReflection;
  };

  const updateReflection = async (id, updates) => {
    // Optimistic update
    setReflections((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await reflectionService.update(id, transformReflectionToDB(updates));
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing reflection update:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Modal controls
  const openDetail = (item) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const closeDetail = () => {
    setSelectedItem(null);
    setIsDetailModalOpen(false);
  };

  // Panel fullscreen toggles
  const toggleLeftFullscreen = () => {
    setLeftPanelFullscreen((prev) => !prev);
    if (!leftPanelFullscreen) setRightPanelFullscreen(false);
  };

  const toggleRightFullscreen = () => {
    setRightPanelFullscreen((prev) => !prev);
    if (!rightPanelFullscreen) setLeftPanelFullscreen(false);
  };

  const exitFullscreen = () => {
    setLeftPanelFullscreen(false);
    setRightPanelFullscreen(false);
  };

  // Clear sync error
  const clearSyncError = () => setSyncError(null);

  // Save morning routine (legacy)
  const saveMorningRoutine = (routine) => {
    setMorningRoutine(routine);
    localStorage.setItem('morningRoutine', JSON.stringify(routine));
  };

  // Save a single routine by key (new unified system)
  // Key format: "{type}_{day}_{week}" e.g. "morning_monday_A"
  const saveRoutine = async (key, routine) => {
    // Optimistic update
    setRoutines((prev) => {
      const updated = { ...prev, [key]: routine };
      localStorage.setItem('routines', JSON.stringify(updated));
      return updated;
    });

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await routineService.upsert({
          routineKey: key,
          routineType: routine.type || 'morning',
          dayOfWeek: routine.dayOfWeek,
          weekVariant: routine.weekVariant,
          items: routine.items || [],
        }, user.id);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing routine:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Save reminders settings
  const saveReminders = (reminderSettings) => {
    setReminders(reminderSettings);
    localStorage.setItem('reminders', JSON.stringify(reminderSettings));
  };

  // Save notification settings
  const saveNotificationSettings = (settings) => {
    setNotificationSettings(settings);
    localStorage.setItem('notificationSettings', JSON.stringify(settings));
  };

  // Journal operations
  const addJournalEntry = async (entry) => {
    const newEntry = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      date: new Date().toISOString(),
      ...entry,
    };

    // Optimistic update
    setJournalEntries((prev) => {
      const updated = [...prev, newEntry];
      localStorage.setItem('journalEntries', JSON.stringify(updated));
      return updated;
    });

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await journalService.create(transformJournalToDB(newEntry), user.id);
        if (result.error) throw new Error(result.error);
        // Update with cloud-generated ID if different
        if (result.data && result.data.id !== newEntry.id) {
          setJournalEntries((prev) =>
            prev.map((e) => (e.id === newEntry.id ? { ...e, id: result.data.id } : e))
          );
        }
      } catch (err) {
        console.error('Error syncing journal entry:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }

    return newEntry;
  };

  const updateJournalEntry = async (id, updates) => {
    // Optimistic update
    setJournalEntries((prev) => {
      const updated = prev.map((entry) =>
        entry.id === id ? { ...entry, ...updates } : entry
      );
      localStorage.setItem('journalEntries', JSON.stringify(updated));
      return updated;
    });

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await journalService.update(id, transformJournalToDB(updates));
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing journal update:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const deleteJournalEntry = async (id) => {
    // Optimistic update
    setJournalEntries((prev) => {
      const updated = prev.filter((entry) => entry.id !== id);
      localStorage.setItem('journalEntries', JSON.stringify(updated));
      return updated;
    });

    // Sync to cloud if available
    if (isConfigured && user) {
      try {
        setIsSyncing(true);
        const result = await journalService.delete(id);
        if (result.error) throw new Error(result.error);
      } catch (err) {
        console.error('Error syncing journal delete:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Life Score operations
  const saveLifeScoreData = async (data) => {
    // Optimistic update
    setLifeScoreData(data);
    localStorage.setItem('lifeScoreData', JSON.stringify(data));

    // Sync to cloud if available
    if (isConfigured && user && data.current) {
      try {
        setIsSyncing(true);
        // Check if we're updating an existing score or creating new
        if (data.current.id) {
          const result = await lifeScoreService.update(data.current.id, transformLifeScoreToDB(data.current));
          if (result.error) throw new Error(result.error);
        } else {
          const result = await lifeScoreService.create(transformLifeScoreToDB(data.current), user.id);
          if (result.error) throw new Error(result.error);
          // Update with cloud-generated ID
          if (result.data) {
            setLifeScoreData((prev) => ({
              ...prev,
              current: { ...prev.current, id: result.data.id },
            }));
          }
        }
      } catch (err) {
        console.error('Error syncing life score:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Weekly Planning operations
  const saveWeeklyPlanningData = async (data) => {
    // Optimistic update
    setWeeklyPlanningData(data);
    localStorage.setItem('weeklyPlanningData', JSON.stringify(data));

    // Sync to cloud if available - sync the most recent plan
    if (isConfigured && user && Array.isArray(data) && data.length > 0) {
      const latestPlan = data[data.length - 1];
      try {
        setIsSyncing(true);
        if (latestPlan.id) {
          const result = await weeklyPlanService.update(latestPlan.id, transformWeeklyPlanToDB(latestPlan));
          if (result.error) throw new Error(result.error);
        } else {
          const result = await weeklyPlanService.create(transformWeeklyPlanToDB(latestPlan), user.id);
          if (result.error) throw new Error(result.error);
          // Update with cloud-generated ID
          if (result.data) {
            setWeeklyPlanningData((prev) =>
              prev.map((p, i) => (i === prev.length - 1 ? { ...p, id: result.data.id } : p))
            );
          }
        }
      } catch (err) {
        console.error('Error syncing weekly plan:', err);
        setSyncError(err.message);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  // Get tasks linked to a specific goal
  const getTasksForGoal = (goalId) => {
    return tasks.filter((task) => task.linkedGoalId === goalId);
  };

  // Create a task linked to a goal
  const createTaskForGoal = async (goalId, taskData) => {
    const goal = goals.find((g) => g.id === goalId);
    const newTask = await addTask({
      ...taskData,
      linkedGoalId: goalId,
      title: taskData.title || `Task for: ${goal?.title || 'Goal'}`,
      type: taskData.type || 'task',
      priority: taskData.priority || goal?.priority || 'medium',
      scheduledDate: taskData.scheduledDate || new Date().toISOString(),
    });
    return newTask;
  };

  const value = {
    // State
    goals,
    tasks,
    reflections,
    activeTab,
    selectedItem,
    isDetailModalOpen,
    leftPanelFullscreen,
    rightPanelFullscreen,

    // Loading states
    isLoading,
    isSyncing,
    syncError,
    clearSyncError,

    // Tab navigation
    setActiveTab,

    // Goal operations
    addGoal,
    updateGoal,
    deleteGoal,
    reorderGoals,

    // Task operations
    addTask,
    updateTask,
    deleteTask,
    toggleTaskComplete,
    reorderTasks,

    // Reflection operations
    addReflection,
    updateReflection,
    showReflection,
    setShowReflection,

    // Weekly Summary
    showWeeklySummary,
    setShowWeeklySummary,

    // Achievements
    showAchievements,
    setShowAchievements,

    // Morning Routine (legacy + new)
    showMorningRoutine,
    setShowMorningRoutine,
    morningRoutine,
    saveMorningRoutine,

    // Night Routine
    showNightRoutine,
    setShowNightRoutine,

    // Unified Routines (28 morning + 28 nighttime variations)
    routines,
    saveRoutine,

    // Reminders (legacy)
    showReminders,
    setShowReminders,
    reminders,
    saveReminders,

    // Notification Center
    showNotificationCenter,
    setShowNotificationCenter,
    notificationSettings,
    saveNotificationSettings,

    // Journal
    showJournal,
    setShowJournal,
    journalEntries,
    addJournalEntry,
    updateJournalEntry,
    deleteJournalEntry,

    // Life Score
    showLifeScore,
    setShowLifeScore,
    lifeScoreData,
    saveLifeScoreData,

    // Weekly Planning
    showWeeklyPlanning,
    setShowWeeklyPlanning,
    weeklyPlanningData,
    saveWeeklyPlanningData,

    // Goal-Task connection
    getTasksForGoal,
    createTaskForGoal,

    // Celebration
    celebration,
    triggerCelebration,
    clearCelebration,

    // Streak calculation
    calculateHabitStreak,

    // Modal operations
    openDetail,
    closeDetail,

    // Fullscreen operations
    toggleLeftFullscreen,
    toggleRightFullscreen,
    exitFullscreen,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
