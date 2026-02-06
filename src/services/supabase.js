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
      .order('scheduled_date', { ascending: true });

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

export default supabase;
