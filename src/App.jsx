import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './components/Layout/MainLayout';
import GoalList from './components/GoalSetting/GoalList';
import TaskList from './components/Planner/TaskList';
import LongTermCalendar from './components/Calendar/LongTermCalendar';
import ShortTermCalendar from './components/Calendar/ShortTermCalendar';
import DetailModal from './components/DetailModal/DetailModal';
import Celebration from './components/Celebration/Celebration';
import DailyReflection from './components/DailyReflection/DailyReflection';
import WeeklySummary from './components/WeeklySummary/WeeklySummary';
import Achievements from './components/Achievements/Achievements';
import RoutineBuilder from './components/RoutineBuilder/RoutineBuilder';
import Reminders from './components/Reminders/Reminders';
import NotificationCenter from './components/NotificationCenter/NotificationCenter';
import NotificationToast from './components/NotificationToast/NotificationToast';
import Journal from './components/Journal/Journal';
import LifeScore from './components/LifeScore/LifeScore';
import WeeklyPlanning from './components/WeeklyPlanning/WeeklyPlanning';
import AuthPage from './components/Auth/AuthPage';
import { Loader2 } from 'lucide-react';
import './App.css';

// Loading screen component
function LoadingScreen() {
  return (
    <div className="loading-screen">
      <Loader2 size={40} className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );
}

// Temporary debug banner — shows storage mode and data counts
function DebugBanner() {
  const { user, isConfigured } = useAuth();
  const { goals, tasks, lastSaveStatus } = useApp();
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;
  const mode = isConfigured && user ? 'Cloud+Local' : 'Local-Only';
  const saveOk = lastSaveStatus?.success ? 'OK' : lastSaveStatus ? 'FAIL' : '—';
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: '#1a1a2e', color: '#0f0', padding: '4px 12px',
      fontSize: '11px', fontFamily: 'monospace', display: 'flex',
      justifyContent: 'space-between', alignItems: 'center',
    }}>
      <span>Mode: {mode} | Goals: {goals.length} | Tasks: {tasks.length} | Save: {saveOk} | Build: v13-overlapCols</span>
      <button onClick={() => setDismissed(true)} style={{ background: 'none', border: 'none', color: '#0f0', cursor: 'pointer', fontSize: '11px' }}>dismiss</button>
    </div>
  );
}

// Main app content (when authenticated)
function AppContent() {
  const { activeTab } = useApp();

  return (
    <>
      <DebugBanner />
      <MainLayout
        leftPanel={activeTab === 'goals' ? <GoalList /> : <TaskList />}
        rightPanel={
          activeTab === 'goals' ? <LongTermCalendar /> : <ShortTermCalendar />
        }
      />
      <DetailModal />
      <Celebration />
      <DailyReflection />
      <WeeklySummary />
      <Achievements />
      <RoutineBuilder type="morning" />
      <RoutineBuilder type="nighttime" />
      <Reminders />
      <NotificationCenter />
      <NotificationToast />
      <Journal />
      <LifeScore />
      <WeeklyPlanning />
    </>
  );
}

// Auth-aware wrapper
function AuthenticatedApp() {
  const { loading } = useAuth();

  // Show loading screen while checking auth
  if (loading) {
    return <LoadingScreen />;
  }

  // Always show the app — localStorage works regardless of auth state.
  // Cloud sync is an optional enhancement when user is logged in.
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
