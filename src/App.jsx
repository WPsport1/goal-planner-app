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

// Main app content (when authenticated)
function AppContent() {
  const { activeTab } = useApp();

  return (
    <>
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
    </>
  );
}

// Auth-aware wrapper
function AuthenticatedApp() {
  const { user, loading, isConfigured } = useAuth();

  // Show loading screen while checking auth
  if (loading) {
    return <LoadingScreen />;
  }

  // If Supabase is configured but user isn't logged in, show auth page
  if (isConfigured && !user) {
    return <AuthPage />;
  }

  // Otherwise show the app (either logged in, or using local-only mode)
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
