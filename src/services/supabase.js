import { createClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CONFIGURATION
// ============================================
// To enable cloud storage:
// 1. Go to https://supabase.com and create a free account
// 2. Create a new project
// 3. Go to Settings > API
// 4. Copy your Project URL and anon/public key
// 5. Replace the values below

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Create Supabase client (or null if not configured)
export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// ============================================
// DATABASE SCHEMA (run in Supabase SQL Editor)
// ============================================
/*
-- Goals Table
CREATE TABLE goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Personal Development',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'not_started',
  target_date TIMESTAMPTZ,
  progress INTEGER DEFAULT 0,
  notes TEXT,
  milestones JSONB DEFAULT '[]',
  data_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tasks Table
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'task',
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  scheduled_date TIMESTAMPTZ,
  start_time TEXT,
  end_time TEXT,
  recurrence TEXT DEFAULT 'none',
  completed BOOLEAN DEFAULT FALSE,
  linked_goal_id UUID REFERENCES goals(id) ON DELETE SET NULL,
  data_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies (users can only access their own data)
CREATE POLICY "Users can view own goals" ON goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals" ON goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals" ON goals
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own goals" ON goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own tasks" ON tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tasks" ON tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks" ON tasks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks" ON tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- PHASE 3 TABLES
-- ============================================

-- Journal Entries Table
CREATE TABLE journal_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date TIMESTAMPTZ DEFAULT NOW(),
  content TEXT,
  mood INTEGER DEFAULT 3,
  energy INTEGER DEFAULT 3,
  gratitude TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Life Scores Table
CREATE TABLE life_scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date TIMESTAMPTZ DEFAULT NOW(),
  health INTEGER DEFAULT 5,
  relationships INTEGER DEFAULT 5,
  mindset INTEGER DEFAULT 5,
  career INTEGER DEFAULT 5,
  social INTEGER DEFAULT 5,
  finance INTEGER DEFAULT 5,
  spirituality INTEGER DEFAULT 5,
  purpose INTEGER DEFAULT 5,
  overall_score DECIMAL(3,1),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly Plans Table
CREATE TABLE weekly_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  week_start DATE NOT NULL,
  reflections JSONB DEFAULT '{}',
  priorities TEXT[] DEFAULT '{}',
  weekly_goals JSONB DEFAULT '[]',
  daily_tasks JSONB DEFAULT '{}',
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Routines Table (for morning/nighttime routines)
CREATE TABLE routines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  routine_key TEXT NOT NULL,
  routine_type TEXT NOT NULL,
  day_of_week TEXT,
  week_variant TEXT,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, routine_key)
);

-- Enable Row Level Security for Phase 3 tables
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

-- Journal Entries Policies
CREATE POLICY "Users can view own journal entries" ON journal_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal entries" ON journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal entries" ON journal_entries
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal entries" ON journal_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Life Scores Policies
CREATE POLICY "Users can view own life scores" ON life_scores
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own life scores" ON life_scores
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own life scores" ON life_scores
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own life scores" ON life_scores
  FOR DELETE USING (auth.uid() = user_id);

-- Weekly Plans Policies
CREATE POLICY "Users can view own weekly plans" ON weekly_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly plans" ON weekly_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly plans" ON weekly_plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly plans" ON weekly_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Routines Policies
CREATE POLICY "Users can view own routines" ON routines
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON routines
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON routines
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON routines
  FOR DELETE USING (auth.uid() = user_id);
*/

// ============================================
// GOAL OPERATIONS
// ============================================

export const goalService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  async create(goal, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('goals')
      .insert({
        ...goal,
        user_id: userId,
        milestones: goal.milestones || [],
        data_points: goal.dataPoints || [],
      })
      .select()
      .single();

    return { data, error };
  },

  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('goals')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('goals')
      .delete()
      .eq('id', id);

    return { error };
  },
};

// ============================================
// TASK OPERATIONS
// ============================================

export const taskService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return { data, error };
  },

  async create(task, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        ...task,
        user_id: userId,
        data_points: task.dataPoints || [],
      })
      .select()
      .single();

    return { data, error };
  },

  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    return { error };
  },

  async toggleComplete(id, completed) {
    return this.update(id, { completed });
  },
};

// ============================================
// REFLECTION OPERATIONS
// ============================================

export const reflectionService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('reflections')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    return { data, error };
  },

  async create(reflection, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('reflections')
      .insert({
        user_id: userId,
        date: reflection.date,
        mood: reflection.mood,
        rating: reflection.rating,
        gratitude: reflection.gratitude,
        wins: reflection.wins,
        improvements: reflection.improvements,
        tomorrow_focus: reflection.tomorrowFocus,
      })
      .select()
      .single();

    return { data, error };
  },

  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('reflections')
      .update({
        mood: updates.mood,
        rating: updates.rating,
        gratitude: updates.gratitude,
        wins: updates.wins,
        improvements: updates.improvements,
        tomorrow_focus: updates.tomorrowFocus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('reflections')
      .delete()
      .eq('id', id);

    return { error };
  },
};

// ============================================
// AUTH OPERATIONS
// ============================================

export const authService = {
  async signUp(email, password) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    return await supabase.auth.signUp({ email, password });
  },

  async signIn(email, password) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    return await supabase.auth.signInWithPassword({ email, password });
  },

  async signOut() {
    if (!supabase) return { error: 'Supabase not configured' };

    return await supabase.auth.signOut();
  },

  async getUser() {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    return await supabase.auth.getUser();
  },

  onAuthStateChange(callback) {
    if (!supabase) return { data: { subscription: null } };

    return supabase.auth.onAuthStateChange(callback);
  },
};

// ============================================
// JOURNAL OPERATIONS
// ============================================

export const journalService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    return { data, error };
  },

  async create(entry, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('journal_entries')
      .insert({
        user_id: userId,
        date: entry.date || new Date().toISOString(),
        content: entry.content,
        mood: entry.mood,
        energy: entry.energy,
        gratitude: entry.gratitude || [],
        tags: entry.tags || [],
      })
      .select()
      .single();

    return { data, error };
  },

  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('journal_entries')
      .update({
        content: updates.content,
        mood: updates.mood,
        energy: updates.energy,
        gratitude: updates.gratitude,
        tags: updates.tags,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', id);

    return { error };
  },
};

// ============================================
// LIFE SCORE OPERATIONS
// ============================================

export const lifeScoreService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('life_scores')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    return { data, error };
  },

  async getLatest(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('life_scores')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single();

    return { data, error };
  },

  async create(score, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('life_scores')
      .insert({
        user_id: userId,
        date: score.date || new Date().toISOString(),
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
      })
      .select()
      .single();

    return { data, error };
  },

  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('life_scores')
      .update({
        health: updates.health,
        relationships: updates.relationships,
        mindset: updates.mindset,
        career: updates.career,
        social: updates.social,
        finance: updates.finance,
        spirituality: updates.spirituality,
        purpose: updates.purpose,
        overall_score: updates.overallScore,
        notes: updates.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('life_scores')
      .delete()
      .eq('id', id);

    return { error };
  },
};

// ============================================
// WEEKLY PLANNING OPERATIONS
// ============================================

export const weeklyPlanService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', userId)
      .order('week_start', { ascending: false });

    return { data, error };
  },

  async getByWeek(userId, weekStart) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('weekly_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .single();

    return { data, error };
  },

  async create(plan, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('weekly_plans')
      .insert({
        user_id: userId,
        week_start: plan.weekStart,
        reflections: plan.reflections || {},
        priorities: plan.priorities || [],
        weekly_goals: plan.weeklyGoals || [],
        daily_tasks: plan.dailyTasks || {},
        completed: plan.completed || false,
      })
      .select()
      .single();

    return { data, error };
  },

  async update(id, updates) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('weekly_plans')
      .update({
        reflections: updates.reflections,
        priorities: updates.priorities,
        weekly_goals: updates.weeklyGoals,
        daily_tasks: updates.dailyTasks,
        completed: updates.completed,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('weekly_plans')
      .delete()
      .eq('id', id);

    return { error };
  },
};

// ============================================
// ROUTINES OPERATIONS
// ============================================

export const routineService = {
  async getAll(userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', userId);

    return { data, error };
  },

  async getByKey(userId, routineKey) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('routines')
      .select('*')
      .eq('user_id', userId)
      .eq('routine_key', routineKey)
      .single();

    return { data, error };
  },

  async upsert(routine, userId) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { data, error } = await supabase
      .from('routines')
      .upsert({
        user_id: userId,
        routine_key: routine.routineKey,
        routine_type: routine.routineType,
        day_of_week: routine.dayOfWeek,
        week_variant: routine.weekVariant,
        items: routine.items || [],
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,routine_key',
      })
      .select()
      .single();

    return { data, error };
  },

  async delete(id) {
    if (!supabase) return { data: null, error: 'Supabase not configured' };

    const { error } = await supabase
      .from('routines')
      .delete()
      .eq('id', id);

    return { error };
  },
};

export default supabase;
