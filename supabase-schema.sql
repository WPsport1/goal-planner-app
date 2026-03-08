-- ==============================================
-- GOAL PLANNER APP — Complete Supabase Schema
-- Run this ONCE in Supabase SQL Editor
-- ==============================================

-- Goals Table
CREATE TABLE IF NOT EXISTS goals (
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

-- Tasks Table (includes all app fields)
CREATE TABLE IF NOT EXISTS tasks (
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
  weekly_days JSONB DEFAULT NULL,
  custom_recurrence JSONB DEFAULT NULL,
  color TEXT DEFAULT 'default',
  completed BOOLEAN DEFAULT FALSE,
  completed_dates JSONB DEFAULT '[]',
  reminder BOOLEAN DEFAULT FALSE,
  reminder_minutes INTEGER DEFAULT 15,
  linked_goal_id UUID,
  data_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reflections Table
CREATE TABLE IF NOT EXISTS reflections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  date TIMESTAMPTZ DEFAULT NOW(),
  mood INTEGER DEFAULT 3,
  rating INTEGER DEFAULT 3,
  gratitude TEXT,
  wins TEXT,
  improvements TEXT,
  tomorrow_focus TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal Entries Table
CREATE TABLE IF NOT EXISTS journal_entries (
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
CREATE TABLE IF NOT EXISTS life_scores (
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
CREATE TABLE IF NOT EXISTS weekly_plans (
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

-- Routines Table
CREATE TABLE IF NOT EXISTS routines (
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

-- ==============================================
-- Enable Row Level Security on ALL tables
-- ==============================================
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE life_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE routines ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- RLS Policies — users can only access their own data
-- ==============================================

-- Goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE USING (auth.uid() = user_id);

-- Tasks
CREATE POLICY "Users can view own tasks" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tasks" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- Reflections
CREATE POLICY "Users can view own reflections" ON reflections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reflections" ON reflections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reflections" ON reflections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reflections" ON reflections FOR DELETE USING (auth.uid() = user_id);

-- Journal Entries
CREATE POLICY "Users can view own journal entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journal entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);

-- Life Scores
CREATE POLICY "Users can view own life scores" ON life_scores FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own life scores" ON life_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own life scores" ON life_scores FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own life scores" ON life_scores FOR DELETE USING (auth.uid() = user_id);

-- Weekly Plans
CREATE POLICY "Users can view own weekly plans" ON weekly_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own weekly plans" ON weekly_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own weekly plans" ON weekly_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own weekly plans" ON weekly_plans FOR DELETE USING (auth.uid() = user_id);

-- Routines
CREATE POLICY "Users can view own routines" ON routines FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own routines" ON routines FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own routines" ON routines FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own routines" ON routines FOR DELETE USING (auth.uid() = user_id);
