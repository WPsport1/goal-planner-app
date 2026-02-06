import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Bell,
  BellOff,
  Clock,
  Plus,
  Trash2,
  Save,
  Volume2,
  VolumeX,
  Calendar,
  Repeat,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO, isToday, isBefore, addMinutes } from 'date-fns';
import './Reminders.css';

// Reminder types
const reminderTypes = [
  { id: 'task_due', label: 'Task Due', description: 'Notify when tasks are due' },
  { id: 'habit_reminder', label: 'Habit Reminder', description: 'Daily habit check-ins' },
  { id: 'reflection_prompt', label: 'Evening Reflection', description: 'Prompt for daily reflection' },
  { id: 'morning_routine', label: 'Morning Routine', description: 'Start your morning routine' },
];

export default function Reminders() {
  const {
    showReminders,
    setShowReminders,
    reminders,
    saveReminders,
    tasks,
  } = useApp();

  const [settings, setSettings] = useState({
    enabled: true,
    sound: true,
    taskReminders: true,
    taskReminderMinutes: 15,
    habitReminders: true,
    habitReminderTime: '08:00',
    reflectionReminders: true,
    reflectionReminderTime: '20:00',
    morningRoutineReminders: true,
    morningRoutineTime: '06:30',
  });

  const [customReminders, setCustomReminders] = useState([]);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({
    title: '',
    time: '09:00',
    days: ['mon', 'tue', 'wed', 'thu', 'fri'],
    enabled: true,
  });

  // Load saved settings
  useEffect(() => {
    if (reminders) {
      setSettings(reminders.settings || settings);
      setCustomReminders(reminders.custom || []);
    }
  }, [reminders]);

  // Get upcoming tasks for today
  const upcomingTasks = tasks
    .filter((t) => {
      if (!t.scheduledDate || t.completed) return false;
      if (!isToday(parseISO(t.scheduledDate))) return false;
      if (!t.startTime) return false;

      const taskTime = parseISO(`${t.scheduledDate.split('T')[0]}T${t.startTime}`);
      const now = new Date();
      return isBefore(now, taskTime);
    })
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
    .slice(0, 5);

  if (!showReminders) return null;

  const handleClose = () => {
    setShowReminders(false);
  };

  const handleSave = () => {
    saveReminders({
      settings,
      custom: customReminders,
    });
    handleClose();
  };

  const toggleSetting = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const addCustomReminder = () => {
    if (!newReminder.title.trim()) return;

    setCustomReminders((prev) => [
      ...prev,
      { ...newReminder, id: Date.now().toString() },
    ]);
    setNewReminder({
      title: '',
      time: '09:00',
      days: ['mon', 'tue', 'wed', 'thu', 'fri'],
      enabled: true,
    });
    setShowAddReminder(false);
  };

  const removeCustomReminder = (id) => {
    setCustomReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const toggleCustomReminder = (id) => {
    setCustomReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r))
    );
  };

  const toggleDay = (day) => {
    setNewReminder((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const dayLabels = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="reminders-overlay" onClick={handleClose}>
      <div className="reminders-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="reminders-header">
          <div className="header-title">
            <Bell size={24} />
            <h2>Reminders & Notifications</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="reminders-content">
          {/* Master Toggle */}
          <div className="master-toggle">
            <div className="toggle-info">
              {settings.enabled ? <Bell size={20} /> : <BellOff size={20} />}
              <div>
                <h3>Notifications</h3>
                <p>Enable or disable all notifications</p>
              </div>
            </div>
            <button
              className={`toggle-switch ${settings.enabled ? 'on' : 'off'}`}
              onClick={() => toggleSetting('enabled')}
            >
              <span className="toggle-slider" />
            </button>
          </div>

          {settings.enabled && (
            <>
              {/* Sound Toggle */}
              <div className="setting-row">
                <div className="setting-info">
                  {settings.sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  <span>Sound alerts</span>
                </div>
                <button
                  className={`toggle-switch small ${settings.sound ? 'on' : 'off'}`}
                  onClick={() => toggleSetting('sound')}
                >
                  <span className="toggle-slider" />
                </button>
              </div>

              <div className="settings-divider" />

              {/* Reminder Settings */}
              <div className="reminder-settings">
                <h4>Automatic Reminders</h4>

                {/* Task Reminders */}
                <div className="reminder-setting">
                  <div className="setting-header">
                    <div className="setting-info">
                      <Calendar size={18} />
                      <span>Task reminders</span>
                    </div>
                    <button
                      className={`toggle-switch small ${settings.taskReminders ? 'on' : 'off'}`}
                      onClick={() => toggleSetting('taskReminders')}
                    >
                      <span className="toggle-slider" />
                    </button>
                  </div>
                  {settings.taskReminders && (
                    <div className="setting-option">
                      <span>Remind me</span>
                      <select
                        value={settings.taskReminderMinutes}
                        onChange={(e) =>
                          updateSetting('taskReminderMinutes', parseInt(e.target.value))
                        }
                      >
                        <option value={5}>5 min</option>
                        <option value={10}>10 min</option>
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={60}>1 hour</option>
                      </select>
                      <span>before</span>
                    </div>
                  )}
                </div>

                {/* Habit Reminders */}
                <div className="reminder-setting">
                  <div className="setting-header">
                    <div className="setting-info">
                      <Repeat size={18} />
                      <span>Daily habit check-in</span>
                    </div>
                    <button
                      className={`toggle-switch small ${settings.habitReminders ? 'on' : 'off'}`}
                      onClick={() => toggleSetting('habitReminders')}
                    >
                      <span className="toggle-slider" />
                    </button>
                  </div>
                  {settings.habitReminders && (
                    <div className="setting-option">
                      <span>Remind at</span>
                      <input
                        type="time"
                        value={settings.habitReminderTime}
                        onChange={(e) => updateSetting('habitReminderTime', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Morning Routine Reminder */}
                <div className="reminder-setting">
                  <div className="setting-header">
                    <div className="setting-info">
                      <Clock size={18} />
                      <span>Morning routine start</span>
                    </div>
                    <button
                      className={`toggle-switch small ${settings.morningRoutineReminders ? 'on' : 'off'}`}
                      onClick={() => toggleSetting('morningRoutineReminders')}
                    >
                      <span className="toggle-slider" />
                    </button>
                  </div>
                  {settings.morningRoutineReminders && (
                    <div className="setting-option">
                      <span>Remind at</span>
                      <input
                        type="time"
                        value={settings.morningRoutineTime}
                        onChange={(e) => updateSetting('morningRoutineTime', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Evening Reflection */}
                <div className="reminder-setting">
                  <div className="setting-header">
                    <div className="setting-info">
                      <AlertCircle size={18} />
                      <span>Evening reflection</span>
                    </div>
                    <button
                      className={`toggle-switch small ${settings.reflectionReminders ? 'on' : 'off'}`}
                      onClick={() => toggleSetting('reflectionReminders')}
                    >
                      <span className="toggle-slider" />
                    </button>
                  </div>
                  {settings.reflectionReminders && (
                    <div className="setting-option">
                      <span>Remind at</span>
                      <input
                        type="time"
                        value={settings.reflectionReminderTime}
                        onChange={(e) => updateSetting('reflectionReminderTime', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="settings-divider" />

              {/* Custom Reminders */}
              <div className="custom-reminders">
                <div className="section-header">
                  <h4>Custom Reminders</h4>
                  <button
                    className="add-reminder-btn"
                    onClick={() => setShowAddReminder(!showAddReminder)}
                  >
                    <Plus size={16} />
                    Add
                  </button>
                </div>

                {showAddReminder && (
                  <div className="add-reminder-form">
                    <input
                      type="text"
                      placeholder="Reminder title..."
                      value={newReminder.title}
                      onChange={(e) =>
                        setNewReminder({ ...newReminder, title: e.target.value })
                      }
                    />
                    <div className="form-row">
                      <input
                        type="time"
                        value={newReminder.time}
                        onChange={(e) =>
                          setNewReminder({ ...newReminder, time: e.target.value })
                        }
                      />
                      <div className="day-selector">
                        {dayLabels.map((day, index) => (
                          <button
                            key={day}
                            className={`day-btn ${newReminder.days.includes(day) ? 'active' : ''}`}
                            onClick={() => toggleDay(day)}
                          >
                            {dayNames[index]}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="form-actions">
                      <button onClick={() => setShowAddReminder(false)}>Cancel</button>
                      <button className="primary" onClick={addCustomReminder}>
                        Add Reminder
                      </button>
                    </div>
                  </div>
                )}

                {customReminders.length === 0 && !showAddReminder ? (
                  <div className="empty-reminders">
                    <p>No custom reminders yet</p>
                  </div>
                ) : (
                  <div className="custom-reminders-list">
                    {customReminders.map((reminder) => (
                      <div key={reminder.id} className="custom-reminder-item">
                        <button
                          className={`toggle-switch mini ${reminder.enabled ? 'on' : 'off'}`}
                          onClick={() => toggleCustomReminder(reminder.id)}
                        >
                          <span className="toggle-slider" />
                        </button>
                        <div className="reminder-info">
                          <span className="reminder-title">{reminder.title}</span>
                          <span className="reminder-schedule">
                            {reminder.time} • {reminder.days.join(', ')}
                          </span>
                        </div>
                        <button
                          className="remove-btn"
                          onClick={() => removeCustomReminder(reminder.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upcoming Tasks Preview */}
              {upcomingTasks.length > 0 && (
                <>
                  <div className="settings-divider" />
                  <div className="upcoming-section">
                    <h4>Today's Upcoming</h4>
                    <div className="upcoming-list">
                      {upcomingTasks.map((task) => (
                        <div key={task.id} className="upcoming-item">
                          <span className="upcoming-time">{task.startTime}</span>
                          <span className="upcoming-title">{task.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="reminders-actions">
          <button className="action-btn secondary" onClick={handleClose}>
            Cancel
          </button>
          <button className="action-btn primary" onClick={handleSave}>
            <Save size={18} />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
