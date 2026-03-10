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
import DataManagement from './components/DataManagement/DataManagement';
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
      <NotificationCenter />
      <NotificationToast />
      <Journal />
      <LifeScore />
      <WeeklyPlanning />
      <DataManagement />
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
