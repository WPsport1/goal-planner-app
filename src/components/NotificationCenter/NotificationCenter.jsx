import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Bell,
  BellOff,
  BellRing,
  Clock,
  Volume2,
  VolumeX,
  Vibrate,
  Smartphone,
  Monitor,
  Check,
  AlertTriangle,
  Settings,
  TestTube,
  Trash2,
  Plus,
  Sun,
  Moon,
  Sparkles,
  Repeat,
  Calendar,
  ChevronRight,
  Shield,
  Zap,
} from 'lucide-react';
import {
  isNotificationSupported,
  getPermissionStatus,
  requestPermission,
  initializeNotifications,
  showLocalNotification,
  playNotificationSound,
  getScheduledNotifications,
  clearScheduledNotifications,
  createMorningRoutineReminder,
  createNightRoutineReminder,
  createReflectionReminder,
} from '../../services/notifications';
import {
  isFirebaseConfigured,
  initializeFirebase,
  getFCMToken,
  onForegroundMessage,
} from '../../services/firebase';
import './NotificationCenter.css';

export default function NotificationCenter() {
  const {
    showNotificationCenter,
    setShowNotificationCenter,
    notificationSettings,
    saveNotificationSettings,
    tasks,
  } = useApp();

  const [permissionStatus, setPermissionStatus] = useState('default');
  const [isSupported, setIsSupported] = useState(true);
  const [activeTab, setActiveTab] = useState('settings');
  const [testingSound, setTestingSound] = useState(false);
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);
  const [fcmToken, setFcmToken] = useState(null);
  const [settingUpFirebase, setSettingUpFirebase] = useState(false);

  // Custom reminder form state
  const [customReminders, setCustomReminders] = useState([]);
  const [newReminder, setNewReminder] = useState({
    title: '',
    message: '',
    time: '09:00',
    date: new Date().toISOString().split('T')[0],
    recurring: false,
    recurrenceType: 'daily',
    sound: 'default',
  });
  const [editingReminderId, setEditingReminderId] = useState(null);

  // Default settings
  const [settings, setSettings] = useState({
    enabled: true,
    sound: true,
    soundVolume: 70,
    soundType: 'default',
    vibrate: true,
    vibrationPattern: 'default',
    persistentAlerts: true,
    snoozeEnabled: true,
    snoozeDuration: 10, // minutes

    // Task reminders
    taskReminders: true,
    taskReminderMinutes: 15,

    // Habit reminders
    habitReminders: true,
    habitReminderTime: '08:00',

    // Routine reminders
    morningRoutineReminder: true,
    morningRoutineTime: '06:30',
    nightRoutineReminder: true,
    nightRoutineTime: '21:00',

    // Reflection reminders
    reflectionReminder: true,
    reflectionReminderTime: '20:00',

    // Streak protection
    streakProtection: true,
    streakProtectionTime: '20:00',

    // Quiet hours
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',

    // Escalation
    escalationEnabled: true,
    escalationAfterMinutes: 5,
    escalationSound: 'urgent',
  });

  // Load saved settings
  useEffect(() => {
    if (notificationSettings) {
      setSettings({ ...settings, ...notificationSettings });
    }
  }, [notificationSettings]);

  // Load custom reminders from localStorage
  useEffect(() => {
    const savedReminders = localStorage.getItem('customReminders');
    if (savedReminders) {
      setCustomReminders(JSON.parse(savedReminders));
    }
  }, []);

  // Check support and permission on mount
  useEffect(() => {
    setIsSupported(isNotificationSupported());
    setPermissionStatus(getPermissionStatus());
    setFirebaseEnabled(isFirebaseConfigured());

    // Check for existing FCM token
    const savedToken = localStorage.getItem('fcmToken');
    if (savedToken) {
      setFcmToken(savedToken);
    }
  }, []);

  // Set up foreground message listener
  useEffect(() => {
    if (firebaseEnabled && fcmToken) {
      const unsubscribe = onForegroundMessage((payload) => {
        console.log('Foreground message:', payload);
        // Show as local notification
        showLocalNotification(payload.notification?.title || 'Goal Planner', {
          body: payload.notification?.body,
          data: payload.data,
        });
        if (settings.sound) {
          playNotificationSound(settings.soundType);
        }
      });
      return () => unsubscribe && unsubscribe();
    }
  }, [firebaseEnabled, fcmToken, settings.sound, settings.soundType]);

  // Get scheduled notifications
  const scheduledNotifications = getScheduledNotifications();

  if (!showNotificationCenter) return null;

  const handleClose = () => {
    setShowNotificationCenter(false);
  };

  const handleRequestPermission = async () => {
    setSettingUpFirebase(true);

    try {
      const result = await requestPermission();
      setPermissionStatus(result.permission || getPermissionStatus());

      if (result.success) {
        // Initialize the notification system
        await initializeNotifications();

        // If Firebase is configured, get FCM token for push notifications
        if (isFirebaseConfigured()) {
          initializeFirebase();
          const tokenResult = await getFCMToken();
          if (tokenResult.success) {
            setFcmToken(tokenResult.token);
            setFirebaseEnabled(true);
          }
        }
      }
    } finally {
      setSettingUpFirebase(false);
    }
  };

  const handleSaveSettings = () => {
    saveNotificationSettings(settings);

    // Set up scheduled notifications based on settings
    if (settings.enabled && permissionStatus === 'granted') {
      clearScheduledNotifications(); // Clear existing

      if (settings.morningRoutineReminder) {
        createMorningRoutineReminder(settings.morningRoutineTime);
      }

      if (settings.nightRoutineReminder) {
        createNightRoutineReminder(settings.nightRoutineTime);
      }

      if (settings.reflectionReminder) {
        createReflectionReminder(settings.reflectionReminderTime);
      }
    }

    handleClose();
  };

  const handleTestNotification = () => {
    showLocalNotification('🧪 Test Notification', {
      body: 'This is how your notifications will look and sound!',
      requireInteraction: settings.persistentAlerts,
    });

    if (settings.sound) {
      setTestingSound(true);
      playNotificationSound(settings.soundType);
      setTimeout(() => setTestingSound(false), 2000);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // Custom reminder functions
  const saveCustomReminders = (reminders) => {
    setCustomReminders(reminders);
    localStorage.setItem('customReminders', JSON.stringify(reminders));
  };

  const handleAddReminder = () => {
    if (!newReminder.title.trim()) return;

    const reminder = {
      id: Date.now().toString(),
      ...newReminder,
      createdAt: new Date().toISOString(),
    };

    const updated = [...customReminders, reminder];
    saveCustomReminders(updated);

    // Schedule the notification
    const triggerDate = new Date(`${newReminder.date}T${newReminder.time}`);
    if (triggerDate > new Date()) {
      import('../../services/notifications').then(({ scheduleNotification }) => {
        scheduleNotification({
          title: newReminder.title,
          body: newReminder.message,
          triggerAt: triggerDate.toISOString(),
          sound: true,
          soundType: newReminder.sound,
          recurring: newReminder.recurring,
          recurrenceType: newReminder.recurrenceType,
          customReminderId: reminder.id,
        });
      });
    }

    // Reset form
    setNewReminder({
      title: '',
      message: '',
      time: '09:00',
      date: new Date().toISOString().split('T')[0],
      recurring: false,
      recurrenceType: 'daily',
      sound: 'default',
    });
  };

  const handleEditReminder = (reminder) => {
    setEditingReminderId(reminder.id);
    setNewReminder({
      title: reminder.title,
      message: reminder.message || '',
      time: reminder.time,
      date: reminder.date,
      recurring: reminder.recurring || false,
      recurrenceType: reminder.recurrenceType || 'daily',
      sound: reminder.sound || 'default',
    });
  };

  const handleUpdateReminder = () => {
    if (!newReminder.title.trim() || !editingReminderId) return;

    const updated = customReminders.map((r) =>
      r.id === editingReminderId
        ? { ...r, ...newReminder, updatedAt: new Date().toISOString() }
        : r
    );
    saveCustomReminders(updated);

    setEditingReminderId(null);
    setNewReminder({
      title: '',
      message: '',
      time: '09:00',
      date: new Date().toISOString().split('T')[0],
      recurring: false,
      recurrenceType: 'daily',
      sound: 'default',
    });
  };

  const handleDeleteReminder = (id) => {
    const updated = customReminders.filter((r) => r.id !== id);
    saveCustomReminders(updated);

    // Remove from scheduled notifications
    import('../../services/notifications').then(({ removeScheduledNotification }) => {
      removeScheduledNotification(id);
    });
  };

  const cancelEdit = () => {
    setEditingReminderId(null);
    setNewReminder({
      title: '',
      message: '',
      time: '09:00',
      date: new Date().toISOString().split('T')[0],
      recurring: false,
      recurrenceType: 'daily',
      sound: 'default',
    });
  };

  const renderPermissionSection = () => {
    if (!isSupported) {
      return (
        <div className="permission-banner error">
          <AlertTriangle size={24} />
          <div>
            <h4>Notifications Not Supported</h4>
            <p>Your browser or device doesn't support push notifications. Try using Chrome, Firefox, or Edge on desktop, or install the app on your phone.</p>
          </div>
        </div>
      );
    }

    if (permissionStatus === 'denied') {
      return (
        <div className="permission-banner error">
          <BellOff size={24} />
          <div>
            <h4>Notifications Blocked</h4>
            <p>You've blocked notifications. To enable them, click the lock icon in your browser's address bar and change the notification setting.</p>
          </div>
        </div>
      );
    }

    if (permissionStatus === 'default') {
      return (
        <div className="permission-banner warning">
          <Bell size={24} />
          <div>
            <h4>Enable Notifications</h4>
            <p>Allow notifications to receive reminders for tasks, habits, and routines - even when the app is closed.</p>
          </div>
          <button className="enable-btn" onClick={handleRequestPermission} disabled={settingUpFirebase}>
            <BellRing size={18} />
            {settingUpFirebase ? 'Setting up...' : 'Enable Now'}
          </button>
        </div>
      );
    }

    return (
      <div className="permission-banner success">
        <Check size={24} />
        <div>
          <h4>Notifications Enabled</h4>
          <p>You'll receive alerts for your tasks, habits, and routines.</p>
          {firebaseEnabled && fcmToken && (
            <span className="firebase-status">
              <Zap size={12} /> Push notifications active (works when app is closed)
            </span>
          )}
          {!firebaseEnabled && (
            <span className="firebase-status warning">
              <AlertTriangle size={12} /> Local only - configure Firebase for background push
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="notification-center-overlay" onClick={handleClose}>
      <div className="notification-center-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="nc-header">
          <div className="header-title">
            <BellRing size={24} />
            <h2>Notification Center</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Permission Status */}
        {renderPermissionSection()}

        {/* Tabs */}
        <div className="nc-tabs">
          <button
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            className={`tab-btn ${activeTab === 'custom' ? 'active' : ''}`}
            onClick={() => setActiveTab('custom')}
          >
            <Plus size={16} />
            Custom
          </button>
          <button
            className={`tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            <Calendar size={16} />
            Scheduled
          </button>
        </div>

        {/* Content */}
        <div className="nc-content">
          {activeTab === 'settings' && (
            <div className="settings-content">
              {/* Master Toggle */}
              <div className="setting-section">
                <div className="setting-row master">
                  <div className="setting-info">
                    <Bell size={20} />
                    <div>
                      <h4>All Notifications</h4>
                      <p>Master toggle for all alerts</p>
                    </div>
                  </div>
                  <button
                    className={`toggle-switch ${settings.enabled ? 'on' : 'off'}`}
                    onClick={() => updateSetting('enabled', !settings.enabled)}
                  >
                    <span className="toggle-slider" />
                  </button>
                </div>
              </div>

              {settings.enabled && (
                <>
                  {/* Sound & Vibration */}
                  <div className="setting-section">
                    <h3>
                      <Volume2 size={18} />
                      Sound & Vibration
                    </h3>

                    <div className="setting-row">
                      <div className="setting-info">
                        <span>Sound Alerts</span>
                      </div>
                      <button
                        className={`toggle-switch small ${settings.sound ? 'on' : 'off'}`}
                        onClick={() => updateSetting('sound', !settings.sound)}
                      >
                        <span className="toggle-slider" />
                      </button>
                    </div>

                    {settings.sound && (
                      <>
                        <div className="setting-row">
                          <div className="setting-info">
                            <span>Sound Type</span>
                          </div>
                          <select
                            value={settings.soundType}
                            onChange={(e) => updateSetting('soundType', e.target.value)}
                          >
                            <option value="default">Default</option>
                            <option value="gentle">Gentle</option>
                            <option value="alarm">Alarm</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>

                        <div className="setting-row">
                          <div className="setting-info">
                            <span>Volume</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={settings.soundVolume}
                            onChange={(e) => updateSetting('soundVolume', parseInt(e.target.value))}
                          />
                          <span className="range-value">{settings.soundVolume}%</span>
                        </div>
                      </>
                    )}

                    <div className="setting-row">
                      <div className="setting-info">
                        <span>Vibration</span>
                      </div>
                      <button
                        className={`toggle-switch small ${settings.vibrate ? 'on' : 'off'}`}
                        onClick={() => updateSetting('vibrate', !settings.vibrate)}
                      >
                        <span className="toggle-slider" />
                      </button>
                    </div>

                    <div className="setting-row">
                      <div className="setting-info">
                        <span>Persistent Alerts</span>
                        <small>Stay visible until dismissed</small>
                      </div>
                      <button
                        className={`toggle-switch small ${settings.persistentAlerts ? 'on' : 'off'}`}
                        onClick={() => updateSetting('persistentAlerts', !settings.persistentAlerts)}
                      >
                        <span className="toggle-slider" />
                      </button>
                    </div>
                  </div>

                  {/* Snooze Settings */}
                  <div className="setting-section">
                    <h3>
                      <Clock size={18} />
                      Snooze Options
                    </h3>

                    <div className="setting-row">
                      <div className="setting-info">
                        <span>Enable Snooze</span>
                      </div>
                      <button
                        className={`toggle-switch small ${settings.snoozeEnabled ? 'on' : 'off'}`}
                        onClick={() => updateSetting('snoozeEnabled', !settings.snoozeEnabled)}
                      >
                        <span className="toggle-slider" />
                      </button>
                    </div>

                    {settings.snoozeEnabled && (
                      <div className="setting-row">
                        <div className="setting-info">
                          <span>Snooze Duration</span>
                        </div>
                        <select
                          value={settings.snoozeDuration}
                          onChange={(e) => updateSetting('snoozeDuration', parseInt(e.target.value))}
                        >
                          <option value={5}>5 minutes</option>
                          <option value={10}>10 minutes</option>
                          <option value={15}>15 minutes</option>
                          <option value={30}>30 minutes</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Escalation */}
                  <div className="setting-section">
                    <h3>
                      <Zap size={18} />
                      Escalation (Can't-Miss Mode)
                    </h3>

                    <div className="setting-row">
                      <div className="setting-info">
                        <span>Escalate if not acknowledged</span>
                        <small>Louder alerts if you don't respond</small>
                      </div>
                      <button
                        className={`toggle-switch small ${settings.escalationEnabled ? 'on' : 'off'}`}
                        onClick={() => updateSetting('escalationEnabled', !settings.escalationEnabled)}
                      >
                        <span className="toggle-slider" />
                      </button>
                    </div>

                    {settings.escalationEnabled && (
                      <div className="setting-row">
                        <div className="setting-info">
                          <span>Escalate after</span>
                        </div>
                        <select
                          value={settings.escalationAfterMinutes}
                          onChange={(e) => updateSetting('escalationAfterMinutes', parseInt(e.target.value))}
                        >
                          <option value={2}>2 minutes</option>
                          <option value={5}>5 minutes</option>
                          <option value={10}>10 minutes</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Reminder Types */}
                  <div className="setting-section">
                    <h3>
                      <BellRing size={18} />
                      Reminder Types
                    </h3>

                    {/* Morning Routine */}
                    <div className="reminder-setting">
                      <div className="setting-row">
                        <div className="setting-info">
                          <Sun size={18} />
                          <span>Morning Routine</span>
                        </div>
                        <button
                          className={`toggle-switch small ${settings.morningRoutineReminder ? 'on' : 'off'}`}
                          onClick={() => updateSetting('morningRoutineReminder', !settings.morningRoutineReminder)}
                        >
                          <span className="toggle-slider" />
                        </button>
                      </div>
                      {settings.morningRoutineReminder && (
                        <div className="sub-setting">
                          <span>Remind at</span>
                          <input
                            type="time"
                            value={settings.morningRoutineTime}
                            onChange={(e) => updateSetting('morningRoutineTime', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Night Routine */}
                    <div className="reminder-setting">
                      <div className="setting-row">
                        <div className="setting-info">
                          <Moon size={18} />
                          <span>Nighttime Routine</span>
                        </div>
                        <button
                          className={`toggle-switch small ${settings.nightRoutineReminder ? 'on' : 'off'}`}
                          onClick={() => updateSetting('nightRoutineReminder', !settings.nightRoutineReminder)}
                        >
                          <span className="toggle-slider" />
                        </button>
                      </div>
                      {settings.nightRoutineReminder && (
                        <div className="sub-setting">
                          <span>Remind at</span>
                          <input
                            type="time"
                            value={settings.nightRoutineTime}
                            onChange={(e) => updateSetting('nightRoutineTime', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Daily Reflection */}
                    <div className="reminder-setting">
                      <div className="setting-row">
                        <div className="setting-info">
                          <Sparkles size={18} />
                          <span>Evening Reflection</span>
                        </div>
                        <button
                          className={`toggle-switch small ${settings.reflectionReminder ? 'on' : 'off'}`}
                          onClick={() => updateSetting('reflectionReminder', !settings.reflectionReminder)}
                        >
                          <span className="toggle-slider" />
                        </button>
                      </div>
                      {settings.reflectionReminder && (
                        <div className="sub-setting">
                          <span>Remind at</span>
                          <input
                            type="time"
                            value={settings.reflectionReminderTime}
                            onChange={(e) => updateSetting('reflectionReminderTime', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Task Reminders */}
                    <div className="reminder-setting">
                      <div className="setting-row">
                        <div className="setting-info">
                          <Calendar size={18} />
                          <span>Task Reminders</span>
                        </div>
                        <button
                          className={`toggle-switch small ${settings.taskReminders ? 'on' : 'off'}`}
                          onClick={() => updateSetting('taskReminders', !settings.taskReminders)}
                        >
                          <span className="toggle-slider" />
                        </button>
                      </div>
                      {settings.taskReminders && (
                        <div className="sub-setting">
                          <span>Remind</span>
                          <select
                            value={settings.taskReminderMinutes}
                            onChange={(e) => updateSetting('taskReminderMinutes', parseInt(e.target.value))}
                          >
                            <option value={5}>5 min before</option>
                            <option value={10}>10 min before</option>
                            <option value={15}>15 min before</option>
                            <option value={30}>30 min before</option>
                            <option value={60}>1 hour before</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Habit Reminders */}
                    <div className="reminder-setting">
                      <div className="setting-row">
                        <div className="setting-info">
                          <Repeat size={18} />
                          <span>Habit Check-in</span>
                        </div>
                        <button
                          className={`toggle-switch small ${settings.habitReminders ? 'on' : 'off'}`}
                          onClick={() => updateSetting('habitReminders', !settings.habitReminders)}
                        >
                          <span className="toggle-slider" />
                        </button>
                      </div>
                      {settings.habitReminders && (
                        <div className="sub-setting">
                          <span>Remind at</span>
                          <input
                            type="time"
                            value={settings.habitReminderTime}
                            onChange={(e) => updateSetting('habitReminderTime', e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Streak Protection */}
                    <div className="reminder-setting">
                      <div className="setting-row">
                        <div className="setting-info">
                          <Shield size={18} />
                          <span>Streak Protection</span>
                          <small>Alert if habits not done by evening</small>
                        </div>
                        <button
                          className={`toggle-switch small ${settings.streakProtection ? 'on' : 'off'}`}
                          onClick={() => updateSetting('streakProtection', !settings.streakProtection)}
                        >
                          <span className="toggle-slider" />
                        </button>
                      </div>
                      {settings.streakProtection && (
                        <div className="sub-setting">
                          <span>Check at</span>
                          <input
                            type="time"
                            value={settings.streakProtectionTime}
                            onChange={(e) => updateSetting('streakProtectionTime', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quiet Hours */}
                  <div className="setting-section">
                    <h3>
                      <Moon size={18} />
                      Quiet Hours
                    </h3>

                    <div className="setting-row">
                      <div className="setting-info">
                        <span>Enable Quiet Hours</span>
                        <small>No notifications during sleep</small>
                      </div>
                      <button
                        className={`toggle-switch small ${settings.quietHoursEnabled ? 'on' : 'off'}`}
                        onClick={() => updateSetting('quietHoursEnabled', !settings.quietHoursEnabled)}
                      >
                        <span className="toggle-slider" />
                      </button>
                    </div>

                    {settings.quietHoursEnabled && (
                      <div className="quiet-hours-times">
                        <div className="time-input">
                          <label>Start</label>
                          <input
                            type="time"
                            value={settings.quietHoursStart}
                            onChange={(e) => updateSetting('quietHoursStart', e.target.value)}
                          />
                        </div>
                        <span className="time-separator">to</span>
                        <div className="time-input">
                          <label>End</label>
                          <input
                            type="time"
                            value={settings.quietHoursEnd}
                            onChange={(e) => updateSetting('quietHoursEnd', e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Notification */}
                  <div className="test-section">
                    <button
                      className="test-btn"
                      onClick={handleTestNotification}
                      disabled={permissionStatus !== 'granted'}
                    >
                      <TestTube size={18} />
                      {testingSound ? 'Playing...' : 'Test Notification'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="custom-content">
              {/* Add/Edit Reminder Form */}
              <div className="custom-reminder-form">
                <h3>{editingReminderId ? 'Edit Reminder' : 'Create Custom Reminder'}</h3>

                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Take medication, Call mom..."
                    value={newReminder.title}
                    onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Message (optional)</label>
                  <input
                    type="text"
                    placeholder="Additional details..."
                    value={newReminder.message}
                    onChange={(e) => setNewReminder({ ...newReminder, message: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input
                      type="date"
                      value={newReminder.date}
                      onChange={(e) => setNewReminder({ ...newReminder, date: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Time</label>
                    <input
                      type="time"
                      value={newReminder.time}
                      onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Sound</label>
                  <select
                    value={newReminder.sound}
                    onChange={(e) => setNewReminder({ ...newReminder, sound: e.target.value })}
                  >
                    <option value="default">Default</option>
                    <option value="gentle">Gentle</option>
                    <option value="alarm">Alarm</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-group checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={newReminder.recurring}
                      onChange={(e) => setNewReminder({ ...newReminder, recurring: e.target.checked })}
                    />
                    <Repeat size={16} />
                    Recurring reminder
                  </label>
                </div>

                {newReminder.recurring && (
                  <div className="form-group">
                    <label>Repeat</label>
                    <select
                      value={newReminder.recurrenceType}
                      onChange={(e) => setNewReminder({ ...newReminder, recurrenceType: e.target.value })}
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="weekdays">Weekdays only</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                )}

                <div className="form-actions">
                  {editingReminderId && (
                    <button className="cancel-btn" onClick={cancelEdit}>
                      Cancel
                    </button>
                  )}
                  <button
                    className="save-btn"
                    onClick={editingReminderId ? handleUpdateReminder : handleAddReminder}
                    disabled={!newReminder.title.trim()}
                  >
                    <Plus size={16} />
                    {editingReminderId ? 'Update Reminder' : 'Add Reminder'}
                  </button>
                </div>
              </div>

              {/* Custom Reminders List */}
              <div className="custom-reminders-list">
                <h4>Your Custom Reminders ({customReminders.length})</h4>

                {customReminders.length === 0 ? (
                  <div className="empty-reminders">
                    <Bell size={32} />
                    <p>No custom reminders yet</p>
                    <span>Create your first reminder above</span>
                  </div>
                ) : (
                  customReminders.map((reminder) => (
                    <div key={reminder.id} className="custom-reminder-item">
                      <div className="reminder-info">
                        <h5>{reminder.title}</h5>
                        {reminder.message && <p>{reminder.message}</p>}
                        <div className="reminder-meta">
                          <span>
                            <Clock size={12} />
                            {reminder.time}
                          </span>
                          <span>
                            <Calendar size={12} />
                            {new Date(reminder.date).toLocaleDateString()}
                          </span>
                          {reminder.recurring && (
                            <span className="recurring-badge">
                              <Repeat size={12} />
                              {reminder.recurrenceType}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="reminder-actions">
                        <button onClick={() => handleEditReminder(reminder)} title="Edit">
                          <Settings size={14} />
                        </button>
                        <button onClick={() => handleDeleteReminder(reminder.id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="schedule-content">
              {scheduledNotifications.length === 0 ? (
                <div className="empty-schedule">
                  <Bell size={48} />
                  <p>No scheduled notifications</p>
                  <span>Notifications will appear here when scheduled</span>
                </div>
              ) : (
                <div className="scheduled-list">
                  {scheduledNotifications.map((notification) => (
                    <div key={notification.id} className="scheduled-item">
                      <div className="scheduled-info">
                        <h4>{notification.title}</h4>
                        <p>{notification.body}</p>
                        <span className="scheduled-time">
                          {new Date(notification.triggerAt).toLocaleString()}
                        </span>
                      </div>
                      {notification.recurring && (
                        <span className="recurring-badge">
                          <Repeat size={12} />
                          {notification.recurrenceType}
                        </span>
                      )}
                    </div>
                  ))}

                  <button
                    className="clear-all-btn"
                    onClick={clearScheduledNotifications}
                  >
                    <Trash2 size={16} />
                    Clear All
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="nc-actions">
          <button className="action-btn secondary" onClick={handleClose}>
            Cancel
          </button>
          <button className="action-btn primary" onClick={handleSaveSettings}>
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
