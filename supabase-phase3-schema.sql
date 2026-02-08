-- ============================================
-- PHASE 3 TABLES - Run this in Supabase SQL Editor
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
