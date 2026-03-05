import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
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
import { isToday, parseISO, startOfDay, subDays, isSameDay, format } from 'date-fns';
import { parseVirtualId } from '../utils/recurrence';

// ============================================
// BULLETPROOF localStorage helpers
// ============================================
const safeLocalGet = (key, fallback = null) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    const parsed = JSON.parse(raw);
    // For arrays, validate type
    if (fallback !== null && Array.isArray(fallback)) {
      return Array.isArray(parsed) ? parsed : fallback;
    }
    return parsed;
  } catch (err) {
    console.error(`[Storage] Error reading "${key}":`, err);
    return fallback;
  }
};

const safeLocalSet = (key, value) => {
  try {
    const json = JSON.stringify(value);
    localStorage.setItem(key, json);
    // Verify the write succeeded by reading it back
    const verify = localStorage.getItem(key);
    if (verify !== json) {
      console.error(`[Storage] Write verification FAILED for "${key}"`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[Storage] Error writing "${key}":`, err);
    return false;
  }
};

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

  // Save status for visual feedback
  const [lastSaveStatus, setLastSaveStatus] = useState(null); // { time, success, key }
  const dataLoadedRef = useRef(false); // Track whether initial load has completed

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

  // Data Management state
  const [showDataManagement, setShowDataManagement] = useState(false);

  // Load data on mount — localStorage is ALWAYS the source of truth.
  // Supabase cloud sync is a background enhancement, never blocks or overwrites local data.
  useEffect(() => {
    const loadData = async () => {
      console.log('[AppContext] loadData starting — localStorage-first mode');
      setIsLoading(true);
      setSyncError(null);

      try {
        // =============================================
        // STEP 1: Always load from localStorage ONLY.
        // This is the single source of truth.
        // =============================================
        const savedGoals = safeLocalGet('goals', null);
        const savedTasks = safeLocalGet('tasks', null);
        const savedReflections = safeLocalGet('reflections', []);

        console.log('[AppContext] localStorage — goals:', savedGoals?.length ?? 'null', 'tasks:', savedTasks?.length ?? 'null');

        if (savedGoals !== null && Array.isArray(savedGoals)) {
          setGoals(savedGoals);
        } else {
          // First time user — create sample data and save it immediately
          console.log('[AppContext] No saved goals — creating sample data');
          const sample = createSampleData();
          setGoals(sample.goals);
          safeLocalSet('goals', sample.goals);
        }

        if (savedTasks !== null && Array.isArray(savedTasks)) {
          setTasks(savedTasks);
        } else {
          console.log('[AppContext] No saved tasks — creating sample data');
          const sample = createSampleData();
          setTasks(sample.tasks);
          safeLocalSet('tasks', sample.tasks);
        }

        if (Array.isArray(savedReflections)) {
          setReflections(savedReflections);
        }
      } catch (err) {
        console.error('[AppContext] Error loading data:', err);
        setSyncError(err.message);
      } finally {
        dataLoadedRef.current = true;
        setIsLoading(false);
        console.log('[AppContext] loadData complete, dataLoadedRef=true');
      }

      // =============================================
      // STEP 2: Cloud pull (non-blocking, fills gaps)
      // Runs AFTER localStorage load, won't block UI
      // =============================================
      if (isConfigured && user) {
        console.log('[CloudSync] Pulling cloud data to fill gaps...');
        try {
          const goalsResult = await goalService.getAll(user.id);
          if (goalsResult.data && goalsResult.data.length > 0) {
            const cloudGoals = goalsResult.data.map(transformGoalFromDB);
            setGoals(prev => {
              if (prev.length === 0) {
                safeLocalSet('goals', cloudGoals);
                return cloudGoals;
              }
              const mergeMap = new Map();
              prev.forEach(g => mergeMap.set(g.id, g));
              cloudGoals.forEach(g => { if (!mergeMap.has(g.id)) mergeMap.set(g.id, g); });
              const merged = Array.from(mergeMap.values());
              safeLocalSet('goals', merged);
              return merged;
            });
          }

          const tasksResult = await taskService.getAll(user.id);
          if (tasksResult.data && tasksResult.data.length > 0) {
            const cloudTasks = tasksResult.data.map(transformTaskFromDB);
            setTasks(prev => {
              if (prev.length === 0) {
                safeLocalSet('tasks', cloudTasks);
                return cloudTasks;
              }
              const mergeMap = new Map();
              prev.forEach(t => mergeMap.set(t.id, t));
              cloudTasks.forEach(t => { if (!mergeMap.has(t.id)) mergeMap.set(t.id, t); });
              const merged = Array.from(mergeMap.values());
              safeLocalSet('tasks', merged);
              return merged;
            });
          }

          const reflResult = await reflectionService.getAll(user.id);
          if (reflResult.data && reflResult.data.length > 0) {
            const cloudReflections = reflResult.data.map(transformReflectionFromDB);
            setReflections(prev => {
              const mergeMap = new Map();
              prev.forEach(r => mergeMap.set(r.id, r));
              cloudReflections.forEach(r => { if (!mergeMap.has(r.id)) mergeMap.set(r.id, r); });
              const merged = Array.from(mergeMap.values());
              safeLocalSet('reflections', merged);
              return merged;
            });
          }

          const journalResult = await journalService.getAll(user.id);
          if (journalResult.data && journalResult.data.length > 0) {
            const cloudJournal = journalResult.data.map(transformJournalFromDB);
            setJournalEntries(prev => {
              const mergeMap = new Map();
              prev.forEach(e => mergeMap.set(e.id, e));
              cloudJournal.forEach(e => { if (!mergeMap.has(e.id)) mergeMap.set(e.id, e); });
              const merged = Array.from(mergeMap.values());
              localStorage.setItem('journalEntries', JSON.stringify(merged));
              return merged;
            });
          }

          const routinesResult = await routineService.getAll(user.id);
          if (routinesResult.data && routinesResult.data.length > 0) {
            const cloudRoutines = {};
            routinesResult.data.forEach(r => {
              cloudRoutines[r.routine_key] = transformRoutineFromDB(r);
            });
            setRoutines(prev => {
              const merged = { ...cloudRoutines, ...prev }; // local overrides cloud
              localStorage.setItem('routines', JSON.stringify(merged));
              return merged;
            });
          }

          console.log('[CloudSync] Cloud pull complete');
        } catch (err) {
          console.error('[CloudSync] Pull failed (non-blocking):', err);
          // Don't set syncError — this is a background operation
        }
      }
    };

    loadData();
  }, []); // No dependencies — load once on mount, period.

  // =============================================
  // AUTO-SAVE to localStorage (backup, always runs)
  // Only saves AFTER initial data load is complete
  // =============================================
  useEffect(() => {
    if (!isLoading && dataLoadedRef.current) {
      const ok = safeLocalSet('goals', goals);
      if (ok) {
        console.log('[AutoSave] Goals saved:', goals.length, 'items');
      }
    }
  }, [goals, isLoading]);

  useEffect(() => {
    if (!isLoading && dataLoadedRef.current) {
      const ok = safeLocalSet('tasks', tasks);
      if (ok) {
        console.log('[AutoSave] Tasks saved:', tasks.length, 'items');
        setLastSaveStatus({ time: Date.now(), success: true, key: 'tasks' });
      } else {
        setLastSaveStatus({ time: Date.now(), success: false, key: 'tasks' });
      }
    }
  }, [tasks, isLoading]);

  useEffect(() => {
    if (!isLoading && dataLoadedRef.current) {
      safeLocalSet('reflections', reflections);
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
    weekly_days: task.weeklyDays || null,
    completed: task.completed,
    completed_dates: task.completedDates || [],
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
    weeklyDays: dbTask.weekly_days || [],
    completed: dbTask.completed,
    completedDates: dbTask.completed_dates || [],
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

  // Calculate habit streak (supports both recurring completedDates and legacy completed flag)
  const calculateHabitStreak = useCallback((habitTitle) => {
    const allDates = [];

    for (const t of tasks) {
      if (t.title !== habitTitle || t.type !== 'habit') continue;

      if (t.recurrence && t.recurrence !== 'none' && Array.isArray(t.completedDates)) {
        // Recurring habit: each entry in completedDates is a completed date
        for (const dateStr of t.completedDates) {
          allDates.push(startOfDay(new Date(dateStr + 'T00:00:00')));
        }
      } else if (t.completed) {
        // Non-recurring: legacy behavior
        allDates.push(startOfDay(parseISO(t.scheduledDate || t.createdAt)));
      }
    }

    // Deduplicate by date
    const uniqueTimes = [...new Set(allDates.map(d => d.getTime()))];
    const habitCompletions = uniqueTimes.map(t => new Date(t)).sort((a, b) => b - a);

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

    // Optimistic update + immediate localStorage save
    setGoals((prev) => {
      const updated = [...prev, newGoal];
      saveGoalsToLocalStorage(updated);
      return updated;
    });

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

    // Optimistic update + immediate localStorage save
    setGoals((prev) => {
      const updated = prev.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal));
      saveGoalsToLocalStorage(updated);
      return updated;
    });

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
    // Optimistic update + immediate localStorage save
    setGoals((prev) => {
      const updated = prev.filter((goal) => goal.id !== id);
      saveGoalsToLocalStorage(updated);
      return updated;
    });

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
    saveGoalsToLocalStorage(newOrder);
  };

  // Helper: immediately persist tasks to localStorage with verification
  const saveTasksToLocalStorage = (updatedTasks) => {
    const ok = safeLocalSet('tasks', updatedTasks);
    console.log('[DirectSave] Tasks saved immediately:', updatedTasks.length, 'items, success:', ok);
    if (ok) {
      setLastSaveStatus({ time: Date.now(), success: true, key: 'tasks' });
    } else {
      setLastSaveStatus({ time: Date.now(), success: false, key: 'tasks' });
    }
    return ok;
  };

  // Helper: immediately persist goals to localStorage with verification
  const saveGoalsToLocalStorage = (updatedGoals) => {
    const ok = safeLocalSet('goals', updatedGoals);
    console.log('[DirectSave] Goals saved immediately:', updatedGoals.length, 'items, success:', ok);
    return ok;
  };

  // Task CRUD operations
  const addTask = async (task) => {
    const newTask = {
      id: uuidv4(),
      createdAt: new Date().toISOString(),
      dataPoints: [],
      completed: false,
      completedDates: [],
      ...task,
    };

    // Optimistic update + immediate localStorage save
    setTasks((prev) => {
      const updated = [...prev, newTask];
      saveTasksToLocalStorage(updated);
      return updated;
    });

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

  // Recalculate a goal's progress based on its linked tasks
  const recalcGoalProgress = (goalId, taskList) => {
    if (!goalId) return;
    const linked = taskList.filter((t) => t.linkedGoalId === goalId);
    if (linked.length === 0) return;
    const completedCount = linked.filter((t) => t.completed).length;
    const newProgress = Math.round((completedCount / linked.length) * 100);
    const goal = goals.find((g) => g.id === goalId);
    if (goal && goal.progress !== newProgress) {
      updateGoal(goalId, { progress: newProgress });
    }
  };

  const updateTask = async (id, updates) => {
    const oldTask = tasks.find((t) => t.id === id);

    // Optimistic update + immediate localStorage save
    setTasks((prev) => {
      const updated = prev.map((task) => (task.id === id ? { ...task, ...updates } : task));
      saveTasksToLocalStorage(updated);
      return updated;
    });

    // Recalculate goal progress if linkedGoalId changed
    const newLinkedGoalId = updates.linkedGoalId !== undefined ? updates.linkedGoalId : oldTask?.linkedGoalId;
    if (oldTask?.linkedGoalId && oldTask.linkedGoalId !== newLinkedGoalId) {
      const tasksWithoutOld = tasks.filter((t) => t.id !== id);
      recalcGoalProgress(oldTask.linkedGoalId, tasksWithoutOld);
    }
    if (newLinkedGoalId) {
      const updatedTasks = tasks.map((t) => t.id === id ? { ...t, ...updates } : t);
      recalcGoalProgress(newLinkedGoalId, updatedTasks);
    }

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
    const deletedTask = tasks.find((t) => t.id === id);

    // Optimistic update + immediate localStorage save
    setTasks((prev) => {
      const updated = prev.filter((task) => task.id !== id);
      saveTasksToLocalStorage(updated);
      return updated;
    });

    // Recalculate goal progress if deleted task was linked
    if (deletedTask?.linkedGoalId) {
      const remainingTasks = tasks.filter((t) => t.id !== id);
      recalcGoalProgress(deletedTask.linkedGoalId, remainingTasks);
    }

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
    // Detect virtual recurring instance IDs (format: parentId_YYYY-MM-DD)
    const parsed = parseVirtualId(id);
    const realId = parsed ? parsed.parentId : id;
    const instanceDate = parsed ? parsed.dateStr : null;

    const task = tasks.find((t) => t.id === realId);
    if (!task) return;

    // RECURRING TASK: toggle date in completedDates
    if (instanceDate && task.recurrence && task.recurrence !== 'none') {
      const completedDates = Array.isArray(task.completedDates)
        ? [...task.completedDates]
        : [];
      const idx = completedDates.indexOf(instanceDate);
      const wasCompleted = idx !== -1;

      if (wasCompleted) {
        completedDates.splice(idx, 1);
      } else {
        completedDates.push(instanceDate);
      }

      setTasks((prev) => {
        const updated = prev.map((t) =>
          t.id === realId ? { ...t, completedDates } : t
        );
        saveTasksToLocalStorage(updated);
        return updated;
      });

      if (!wasCompleted) {
        if (task.type === 'habit') {
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
          triggerCelebration('task_complete', { message: task.title });
        }
      }

      if (isConfigured && user) {
        try {
          setIsSyncing(true);
          const result = await taskService.update(realId, { completed_dates: completedDates });
          if (result.error) throw new Error(result.error);
        } catch (err) {
          console.error('Error syncing recurring task toggle:', err);
          setSyncError(err.message);
        } finally {
          setIsSyncing(false);
        }
      }
      return;
    }

    // NON-RECURRING TASK: original behavior
    const newCompleted = !task.completed;

    setTasks((prev) => {
      const updated = prev.map((t) =>
        t.id === id ? { ...t, completed: newCompleted } : t
      );
      saveTasksToLocalStorage(updated);
      return updated;
    });

    if (newCompleted) {
      if (task.type === 'habit') {
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
        triggerCelebration('task_complete', { message: task.title });
      }
    }

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

    // Recalc linked goal progress
    if (task.linkedGoalId) {
      const updatedTasks = tasks.map((t) => t.id === id ? { ...t, completed: newCompleted } : t);
      recalcGoalProgress(task.linkedGoalId, updatedTasks);
    }
  };

  const reorderTasks = (newOrder) => {
    setTasks(newOrder);
    saveTasksToLocalStorage(newOrder);
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

  // ============================================
  // MERGE HELPER — combines local + cloud arrays by ID
  // ============================================
  const mergeArrayById = (localArr, cloudArr) => {
    const map = new Map();
    localArr.forEach(item => map.set(item.id, item));
    cloudArr.forEach(item => {
      if (!map.has(item.id)) map.set(item.id, item);
    });
    return Array.from(map.values());
  };

  // ============================================
  // DATA EXPORT — gather all data into JSON
  // ============================================
  const exportAllData = useCallback(() => {
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      appVersion: 'v21-dataExportBackup',
      data: {
        goals,
        tasks,
        reflections,
        routines,
        journalEntries,
        lifeScoreData,
        weeklyPlanningData,
        notificationSettings,
        reminders,
        morningRoutine,
      }
    };
  }, [goals, tasks, reflections, routines, journalEntries, lifeScoreData, weeklyPlanningData, notificationSettings, reminders, morningRoutine]);

  // ============================================
  // DATA IMPORT — validate + restore from JSON
  // ============================================
  const importAllData = useCallback((importData) => {
    const d = importData?.data;
    if (!d || typeof d !== 'object') {
      throw new Error('Invalid backup format — missing data object');
    }

    console.log('[Import] Restoring data from backup dated:', importData.exportDate);

    if (Array.isArray(d.goals)) {
      setGoals(d.goals);
      safeLocalSet('goals', d.goals);
    }
    if (Array.isArray(d.tasks)) {
      setTasks(d.tasks);
      safeLocalSet('tasks', d.tasks);
    }
    if (Array.isArray(d.reflections)) {
      setReflections(d.reflections);
      safeLocalSet('reflections', d.reflections);
    }
    if (d.routines && typeof d.routines === 'object') {
      setRoutines(d.routines);
      localStorage.setItem('routines', JSON.stringify(d.routines));
    }
    if (Array.isArray(d.journalEntries)) {
      setJournalEntries(d.journalEntries);
      localStorage.setItem('journalEntries', JSON.stringify(d.journalEntries));
    }
    if (d.lifeScoreData !== undefined) {
      setLifeScoreData(d.lifeScoreData);
      localStorage.setItem('lifeScoreData', JSON.stringify(d.lifeScoreData));
    }
    if (d.weeklyPlanningData !== undefined) {
      setWeeklyPlanningData(d.weeklyPlanningData);
      localStorage.setItem('weeklyPlanningData', JSON.stringify(d.weeklyPlanningData));
    }
    if (d.notificationSettings) {
      setNotificationSettings(d.notificationSettings);
      localStorage.setItem('notificationSettings', JSON.stringify(d.notificationSettings));
    }
    if (d.reminders) {
      setReminders(d.reminders);
      localStorage.setItem('reminders', JSON.stringify(d.reminders));
    }
    if (d.morningRoutine) {
      setMorningRoutine(d.morningRoutine);
      localStorage.setItem('morningRoutine', JSON.stringify(d.morningRoutine));
    }

    console.log('[Import] Data restored successfully');
  }, []);

  // ============================================
  // CLOUD SYNC — pull all data from Supabase
  // ============================================
  const syncFromCloud = useCallback(async () => {
    if (!isConfigured || !user) {
      throw new Error('Cloud sync not available — not authenticated');
    }

    console.log('[CloudSync] Starting full pull from cloud...');
    setIsSyncing(true);
    setSyncError(null);
    const results = { pulled: 0, errors: [] };

    try {
      // Pull goals
      const goalsResult = await goalService.getAll(user.id);
      if (goalsResult.error) {
        results.errors.push('Goals: ' + goalsResult.error);
      } else if (goalsResult.data && goalsResult.data.length > 0) {
        const cloudGoals = goalsResult.data.map(transformGoalFromDB);
        const merged = mergeArrayById(goals, cloudGoals);
        setGoals(merged);
        safeLocalSet('goals', merged);
        results.pulled += cloudGoals.length;
      }

      // Pull tasks
      const tasksResult = await taskService.getAll(user.id);
      if (tasksResult.error) {
        results.errors.push('Tasks: ' + tasksResult.error);
      } else if (tasksResult.data && tasksResult.data.length > 0) {
        const cloudTasks = tasksResult.data.map(transformTaskFromDB);
        const merged = mergeArrayById(tasks, cloudTasks);
        setTasks(merged);
        safeLocalSet('tasks', merged);
        results.pulled += cloudTasks.length;
      }

      // Pull reflections
      const reflResult = await reflectionService.getAll(user.id);
      if (reflResult.error) {
        results.errors.push('Reflections: ' + reflResult.error);
      } else if (reflResult.data && reflResult.data.length > 0) {
        const cloudReflections = reflResult.data.map(transformReflectionFromDB);
        const merged = mergeArrayById(reflections, cloudReflections);
        setReflections(merged);
        safeLocalSet('reflections', merged);
        results.pulled += cloudReflections.length;
      }

      // Pull journal entries
      const journalResult = await journalService.getAll(user.id);
      if (journalResult.error) {
        results.errors.push('Journal: ' + journalResult.error);
      } else if (journalResult.data && journalResult.data.length > 0) {
        const cloudJournal = journalResult.data.map(transformJournalFromDB);
        const merged = mergeArrayById(journalEntries, cloudJournal);
        setJournalEntries(merged);
        localStorage.setItem('journalEntries', JSON.stringify(merged));
        results.pulled += cloudJournal.length;
      }

      // Pull routines
      const routinesResult = await routineService.getAll(user.id);
      if (routinesResult.error) {
        results.errors.push('Routines: ' + routinesResult.error);
      } else if (routinesResult.data && routinesResult.data.length > 0) {
        const cloudRoutines = {};
        routinesResult.data.forEach(r => {
          cloudRoutines[r.routine_key] = transformRoutineFromDB(r);
        });
        const merged = { ...cloudRoutines, ...routines }; // local overrides cloud
        setRoutines(merged);
        localStorage.setItem('routines', JSON.stringify(merged));
        results.pulled += routinesResult.data.length;
      }

      // Pull life scores
      const lifeResult = await lifeScoreService.getAll(user.id);
      if (lifeResult.error) {
        results.errors.push('Life Scores: ' + lifeResult.error);
      } else if (lifeResult.data && lifeResult.data.length > 0 && !lifeScoreData) {
        const latestScore = transformLifeScoreFromDB(lifeResult.data[0]);
        const cloudData = { current: latestScore, history: lifeResult.data.map(transformLifeScoreFromDB) };
        setLifeScoreData(cloudData);
        localStorage.setItem('lifeScoreData', JSON.stringify(cloudData));
        results.pulled += lifeResult.data.length;
      }

      // Pull weekly plans
      const weeklyResult = await weeklyPlanService.getAll(user.id);
      if (weeklyResult.error) {
        results.errors.push('Weekly Plans: ' + weeklyResult.error);
      } else if (weeklyResult.data && weeklyResult.data.length > 0 && !weeklyPlanningData) {
        const cloudPlans = weeklyResult.data.map(transformWeeklyPlanFromDB);
        setWeeklyPlanningData(cloudPlans);
        localStorage.setItem('weeklyPlanningData', JSON.stringify(cloudPlans));
        results.pulled += cloudPlans.length;
      }

      console.log('[CloudSync] Pull complete. Items pulled:', results.pulled, 'Errors:', results.errors.length);
    } catch (err) {
      console.error('[CloudSync] Pull failed:', err);
      setSyncError(err.message);
      results.errors.push(err.message);
    } finally {
      setIsSyncing(false);
    }

    return results;
  }, [isConfigured, user, goals, tasks, reflections, journalEntries, routines, lifeScoreData, weeklyPlanningData]);

  // ============================================
  // CLOUD SYNC — push all local data to Supabase
  // ============================================
  const pushAllToCloud = useCallback(async () => {
    if (!isConfigured || !user) {
      throw new Error('Cloud sync not available — not authenticated');
    }

    console.log('[CloudSync] Starting full push to cloud...');
    setIsSyncing(true);
    setSyncError(null);
    const results = { pushed: 0, errors: [] };

    try {
      // Push goals
      for (const goal of goals) {
        try {
          const dbGoal = transformGoalToDB(goal);
          // Try update first, create if not found
          const updateResult = await goalService.update(goal.id, dbGoal);
          if (updateResult.error) {
            const createResult = await goalService.create(dbGoal, user.id);
            if (createResult.error) results.errors.push('Goal ' + goal.title + ': ' + createResult.error);
            else results.pushed++;
          } else {
            results.pushed++;
          }
        } catch (err) {
          results.errors.push('Goal ' + goal.title + ': ' + err.message);
        }
      }

      // Push tasks
      for (const task of tasks) {
        try {
          const dbTask = transformTaskToDB(task);
          const updateResult = await taskService.update(task.id, dbTask);
          if (updateResult.error) {
            const createResult = await taskService.create(dbTask, user.id);
            if (createResult.error) results.errors.push('Task ' + task.title + ': ' + createResult.error);
            else results.pushed++;
          } else {
            results.pushed++;
          }
        } catch (err) {
          results.errors.push('Task ' + task.title + ': ' + err.message);
        }
      }

      // Push reflections
      for (const refl of reflections) {
        try {
          const dbRefl = transformReflectionToDB(refl);
          const updateResult = await reflectionService.update(refl.id, dbRefl);
          if (updateResult.error) {
            const createResult = await reflectionService.create(dbRefl, user.id);
            if (createResult.error) results.errors.push('Reflection: ' + createResult.error);
            else results.pushed++;
          } else {
            results.pushed++;
          }
        } catch (err) {
          results.errors.push('Reflection: ' + err.message);
        }
      }

      // Push journal entries
      for (const entry of journalEntries) {
        try {
          const dbEntry = transformJournalToDB(entry);
          const updateResult = await journalService.update(entry.id, dbEntry);
          if (updateResult.error) {
            const createResult = await journalService.create(dbEntry, user.id);
            if (createResult.error) results.errors.push('Journal: ' + createResult.error);
            else results.pushed++;
          } else {
            results.pushed++;
          }
        } catch (err) {
          results.errors.push('Journal: ' + err.message);
        }
      }

      // Push routines
      for (const [key, routine] of Object.entries(routines)) {
        try {
          await routineService.upsert({
            routineKey: key,
            routineType: routine.type || 'morning',
            dayOfWeek: routine.dayOfWeek,
            weekVariant: routine.weekVariant,
            items: routine.items || [],
          }, user.id);
          results.pushed++;
        } catch (err) {
          results.errors.push('Routine ' + key + ': ' + err.message);
        }
      }

      console.log('[CloudSync] Push complete. Items pushed:', results.pushed, 'Errors:', results.errors.length);
    } catch (err) {
      console.error('[CloudSync] Push failed:', err);
      setSyncError(err.message);
      results.errors.push(err.message);
    } finally {
      setIsSyncing(false);
    }

    return results;
  }, [isConfigured, user, goals, tasks, reflections, journalEntries, routines]);

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
    lastSaveStatus,

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

    // Data Management
    showDataManagement,
    setShowDataManagement,
    exportAllData,
    importAllData,
    syncFromCloud,
    pushAllToCloud,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
