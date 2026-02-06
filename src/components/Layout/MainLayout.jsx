import { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import {
  Target,
  CalendarDays,
  Maximize2,
  Minimize2,
  User,
  LogOut,
  Settings,
  Cloud,
  CloudOff,
  ChevronDown,
  Keyboard,
  Sun,
  Moon,
  List,
  Calendar,
  BookOpen,
  Sparkles,
  BarChart3,
  Trophy,
  Sunrise,
  Bell,
} from 'lucide-react';
import './MainLayout.css';

export default function MainLayout({ leftPanel, rightPanel }) {
  const {
    activeTab,
    setActiveTab,
    leftPanelFullscreen,
    rightPanelFullscreen,
    toggleLeftFullscreen,
    toggleRightFullscreen,
    exitFullscreen,
    setShowReflection,
    setShowWeeklySummary,
    setShowAchievements,
    setShowMorningRoutine,
    setShowReminders,
  } = useApp();

  const { user, signOut, isConfigured } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobilePanel, setMobilePanel] = useState('list'); // 'list' or 'calendar'
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const menuRef = useRef(null);

  // Track screen size
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Don't trigger shortcuts when typing in inputs
      if (
        event.target.tagName === 'INPUT' ||
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable
      ) {
        return;
      }

      // Ctrl/Cmd + 1: Switch to Goals tab
      if ((event.ctrlKey || event.metaKey) && event.key === '1') {
        event.preventDefault();
        setActiveTab('goals');
      }

      // Ctrl/Cmd + 2: Switch to Planner tab
      if ((event.ctrlKey || event.metaKey) && event.key === '2') {
        event.preventDefault();
        setActiveTab('planner');
      }

      // Escape: Exit fullscreen
      if (event.key === 'Escape' && (leftPanelFullscreen || rightPanelFullscreen)) {
        exitFullscreen();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setActiveTab, leftPanelFullscreen, rightPanelFullscreen, exitFullscreen]);

  const getLayoutClass = () => {
    if (isMobile) return 'layout-mobile';
    if (leftPanelFullscreen) return 'layout-left-fullscreen';
    if (rightPanelFullscreen) return 'layout-right-fullscreen';
    return 'layout-split';
  };

  const handleSignOut = async () => {
    await signOut();
    setShowUserMenu(false);
  };

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'U';
  };

  const showLeftPanel = isMobile ? mobilePanel === 'list' : !rightPanelFullscreen;
  const showRightPanel = isMobile ? mobilePanel === 'calendar' : !leftPanelFullscreen;

  return (
    <div className="main-layout">
      {/* Top Navigation */}
      <header className="main-header">
        <div className="header-brand">
          <Target className="brand-icon" />
          <h1>Goal Planner</h1>
        </div>
        <nav className="header-nav">
          <button
            className={`nav-tab ${activeTab === 'goals' ? 'active' : ''}`}
            onClick={() => setActiveTab('goals')}
            title="Goals (Ctrl+1)"
          >
            <Target size={18} />
            <span>Goal Setting</span>
          </button>
          <button
            className={`nav-tab ${activeTab === 'planner' ? 'active' : ''}`}
            onClick={() => setActiveTab('planner')}
            title="Planner (Ctrl+2)"
          >
            <CalendarDays size={18} />
            <span>Planner</span>
          </button>
        </nav>
        <div className="header-actions">
          {(leftPanelFullscreen || rightPanelFullscreen) && !isMobile && (
            <button className="fullscreen-exit-btn" onClick={exitFullscreen}>
              <Minimize2 size={18} />
              <span>Exit Fullscreen</span>
            </button>
          )}

          {/* Weekly Summary Button */}
          <button
            className="header-action-btn"
            onClick={() => setShowWeeklySummary(true)}
            title="Weekly Summary"
          >
            <BarChart3 size={18} />
          </button>

          {/* Achievements Button */}
          <button
            className="header-action-btn achievements"
            onClick={() => setShowAchievements(true)}
            title="Achievements"
          >
            <Trophy size={18} />
          </button>

          {/* Morning Routine Button */}
          <button
            className="header-action-btn morning"
            onClick={() => setShowMorningRoutine(true)}
            title="Morning Routine"
          >
            <Sunrise size={18} />
          </button>

          {/* Reminders Button */}
          <button
            className="header-action-btn reminders"
            onClick={() => setShowReminders(true)}
            title="Reminders"
          >
            <Bell size={18} />
          </button>

          {/* Daily Reflection Button */}
          <button
            className="header-action-btn reflection"
            onClick={() => setShowReflection(true)}
            title="Daily Reflection"
          >
            <Sparkles size={18} />
          </button>

          {/* Theme Toggle */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* Sync Status Indicator */}
          <div className={`sync-status ${isConfigured ? 'connected' : 'local'}`} title={isConfigured ? 'Cloud sync enabled' : 'Local storage only'}>
            {isConfigured ? <Cloud size={16} /> : <CloudOff size={16} />}
          </div>

          {/* User Menu */}
          <div className="user-menu-container" ref={menuRef}>
            <button
              className="user-menu-trigger"
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <div className="user-avatar">
                {getUserInitials()}
              </div>
              <ChevronDown size={14} className={showUserMenu ? 'rotated' : ''} />
            </button>

            {showUserMenu && (
              <div className="user-menu">
                <div className="user-menu-header">
                  <div className="user-avatar large">
                    {getUserInitials()}
                  </div>
                  <div className="user-info">
                    {user?.user_metadata?.full_name && (
                      <span className="user-name">{user.user_metadata.full_name}</span>
                    )}
                    <span className="user-email">{user?.email || 'Local User'}</span>
                  </div>
                </div>

                <div className="user-menu-divider" />

                {/* Weekly Summary in Menu */}
                <button className="user-menu-item" onClick={() => { setShowWeeklySummary(true); setShowUserMenu(false); }}>
                  <BarChart3 size={16} />
                  <span>Weekly Summary</span>
                </button>

                {/* Achievements in Menu */}
                <button className="user-menu-item" onClick={() => { setShowAchievements(true); setShowUserMenu(false); }}>
                  <Trophy size={16} />
                  <span>Achievements</span>
                </button>

                {/* Morning Routine in Menu */}
                <button className="user-menu-item" onClick={() => { setShowMorningRoutine(true); setShowUserMenu(false); }}>
                  <Sunrise size={16} />
                  <span>Morning Routine</span>
                </button>

                {/* Reminders in Menu */}
                <button className="user-menu-item" onClick={() => { setShowReminders(true); setShowUserMenu(false); }}>
                  <Bell size={16} />
                  <span>Reminders</span>
                </button>

                {/* Daily Reflection in Menu */}
                <button className="user-menu-item" onClick={() => { setShowReflection(true); setShowUserMenu(false); }}>
                  <BookOpen size={16} />
                  <span>Daily Reflection</span>
                </button>

                <div className="user-menu-divider" />

                {/* Theme Toggle in Menu */}
                <button className="user-menu-item" onClick={toggleTheme}>
                  {isDark ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{isDark ? 'Light Mode' : 'Dark Mode'}</span>
                </button>

                <div className="user-menu-divider" />

                <div className="user-menu-section">
                  <span className="section-label">Keyboard Shortcuts</span>
                  <div className="shortcut-list">
                    <div className="shortcut-item">
                      <span>Goals Tab</span>
                      <kbd>Ctrl+1</kbd>
                    </div>
                    <div className="shortcut-item">
                      <span>Planner Tab</span>
                      <kbd>Ctrl+2</kbd>
                    </div>
                    <div className="shortcut-item">
                      <span>Exit Fullscreen</span>
                      <kbd>Esc</kbd>
                    </div>
                  </div>
                </div>

                <div className="user-menu-divider" />

                <button className="user-menu-item" onClick={handleSignOut}>
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Panel Toggle */}
      {isMobile && (
        <div className="mobile-panel-toggle">
          <button
            className={`mobile-toggle-btn ${mobilePanel === 'list' ? 'active' : ''}`}
            onClick={() => setMobilePanel('list')}
          >
            <List size={16} />
            <span>{activeTab === 'goals' ? 'Goals' : 'Tasks'}</span>
          </button>
          <button
            className={`mobile-toggle-btn ${mobilePanel === 'calendar' ? 'active' : ''}`}
            onClick={() => setMobilePanel('calendar')}
          >
            <Calendar size={16} />
            <span>Calendar</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className={`main-content ${getLayoutClass()}`}>
        {/* Left Panel */}
        {showLeftPanel && (
          <section
            className={`panel left-panel ${leftPanelFullscreen ? 'fullscreen' : ''}`}
          >
            {!isMobile && (
              <div className="panel-header">
                <h2>{activeTab === 'goals' ? 'Goals' : 'Tasks'}</h2>
                <button
                  className="fullscreen-toggle"
                  onClick={toggleLeftFullscreen}
                  title={leftPanelFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {leftPanelFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            )}
            <div className="panel-content">{leftPanel}</div>
          </section>
        )}

        {/* Divider (desktop only) */}
        {!isMobile && !leftPanelFullscreen && !rightPanelFullscreen && (
          <div className="panel-divider" />
        )}

        {/* Right Panel */}
        {showRightPanel && (
          <section
            className={`panel right-panel ${rightPanelFullscreen ? 'fullscreen' : ''}`}
          >
            {!isMobile && (
              <div className="panel-header">
                <h2>{activeTab === 'goals' ? 'Long-Term Calendar' : 'Short-Term Calendar'}</h2>
                <button
                  className="fullscreen-toggle"
                  onClick={toggleRightFullscreen}
                  title={rightPanelFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                >
                  {rightPanelFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            )}
            <div className="panel-content">{rightPanel}</div>
          </section>
        )}
      </main>
    </div>
  );
}
