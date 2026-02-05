import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from './AuthContext';
import { goalService, taskService, isSupabaseConfigured } from '../services/supabase';

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

  // Current view state
  const [activeTab, setActiveTab] = useState('goals'); // 'goals' or 'planner'
  const [selectedItem, setSelectedItem] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [leftPanelFullscreen, setLeftPanelFullscreen] = useState(false);
  const [rightPanelFullscreen, setRightPanelFullscreen] = useState(false);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setSyncError(null);

      try {
        // If using cloud sync with authenticated user
        if (isConfigured && user) {
          // Load from Supabase
          const [goalsResult, tasksResult] = await Promise.all([
            goalService.getAll(user.id),
            taskService.getAll(user.id),
          ]);

          if (goalsResult.error) throw new Error(goalsResult.error);
          if (tasksResult.error) throw new Error(tasksResult.error);

          // If user has no data, create sample data
          if (goalsResult.data.length === 0 && tasksResult.data.length === 0) {
            const sample = createSampleData();
            setGoals(sample.goals);
            setTasks(sample.tasks);
          } else {
            // Transform from database format to app format
            setGoals(goalsResult.data.map(transformGoalFromDB));
            setTasks(tasksResult.data.map(transformTaskFromDB));
          }
        } else {
          // Load from localStorage (local-only mode)
          const savedGoals = localStorage.getItem('goals');
          const savedTasks = localStorage.getItem('tasks');

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
        }
      } catch (err) {
        console.error('Error loading data:', err);
        setSyncError(err.message);
        // Fall back to localStorage
        const savedGoals = localStorage.getItem('goals');
        const savedTasks = localStorage.getItem('tasks');
        if (savedGoals) setGoals(JSON.parse(savedGoals));
        if (savedTasks) setTasks(JSON.parse(savedTasks));
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
    // Optimistic update
    setGoals((prev) =>
      prev.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal))
    );

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

  const value = {
    // State
    goals,
    tasks,
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
