import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Target,
  Calendar,
  TrendingUp,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Save,
  BarChart3,
  ListTodo,
  FileText,
  Clock,
  Bell,
  BellOff,
  Volume2,
  Repeat,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { format, parseISO, differenceInDays } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import './DetailModal.css';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef'];

const priorityOptions = [
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#22c55e' },
];

const statusOptions = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'on_hold', label: 'On Hold' },
];

const categoryOptions = [
  'Personal Development',
  'Career',
  'Health & Fitness',
  'Finance',
  'Relationships',
  'Education',
  'Other',
];

export default function DetailModal() {
  const { selectedItem, isDetailModalOpen, closeDetail, updateGoal, updateTask, activeTab } = useApp();
  const [activeSection, setActiveSection] = useState('overview');
  const [editedItem, setEditedItem] = useState(null);
  const [newMilestone, setNewMilestone] = useState('');
  const [newDataPoint, setNewDataPoint] = useState({ date: '', value: '' });

  const isGoal = activeTab === 'goals';

  useEffect(() => {
    if (selectedItem) {
      setEditedItem({ ...selectedItem });
    }
  }, [selectedItem]);

  if (!isDetailModalOpen || !editedItem) return null;

  const handleSave = () => {
    if (isGoal) {
      updateGoal(editedItem.id, editedItem);
    } else {
      updateTask(editedItem.id, editedItem);
    }
    closeDetail();
  };

  const handleChange = (field, value) => {
    setEditedItem((prev) => ({ ...prev, [field]: value }));
  };

  // Milestone handlers
  const addMilestone = () => {
    if (!newMilestone.trim()) return;
    const milestone = {
      id: uuidv4(),
      title: newMilestone,
      completed: false,
      dueDate: editedItem.targetDate,
    };
    setEditedItem((prev) => ({
      ...prev,
      milestones: [...(prev.milestones || []), milestone],
    }));
    setNewMilestone('');
  };

  const toggleMilestone = (milestoneId) => {
    setEditedItem((prev) => ({
      ...prev,
      milestones: prev.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      ),
    }));
  };

  const deleteMilestone = (milestoneId) => {
    setEditedItem((prev) => ({
      ...prev,
      milestones: prev.milestones.filter((m) => m.id !== milestoneId),
    }));
  };

  // Data point handlers
  const addDataPoint = () => {
    if (!newDataPoint.date || !newDataPoint.value) return;
    const dataPoint = {
      date: new Date(newDataPoint.date).toISOString(),
      value: parseFloat(newDataPoint.value),
    };
    setEditedItem((prev) => ({
      ...prev,
      dataPoints: [...(prev.dataPoints || []), dataPoint].sort(
        (a, b) => new Date(a.date) - new Date(b.date)
      ),
    }));
    setNewDataPoint({ date: '', value: '' });
  };

  // Calculate statistics
  const milestoneProgress = editedItem.milestones?.length
    ? Math.round(
        (editedItem.milestones.filter((m) => m.completed).length /
          editedItem.milestones.length) *
          100
      )
    : 0;

  const daysRemaining = editedItem.targetDate
    ? differenceInDays(parseISO(editedItem.targetDate), new Date())
    : 0;

  const chartData = editedItem.dataPoints?.map((dp) => ({
    date: format(parseISO(dp.date), 'MMM d'),
    value: dp.value,
  })) || [];

  // Projected completion data
  const projectionData = [...chartData];
  if (chartData.length >= 2) {
    const lastTwo = chartData.slice(-2);
    const trend = lastTwo[1].value - lastTwo[0].value;
    for (let i = 1; i <= 3; i++) {
      projectionData.push({
        date: `+${i * 2}w`,
        value: Math.min(100, Math.max(0, chartData[chartData.length - 1].value + trend * i)),
        projected: true,
      });
    }
  }

  const pieData = editedItem.milestones?.length
    ? [
        { name: 'Completed', value: editedItem.milestones.filter((m) => m.completed).length },
        { name: 'Remaining', value: editedItem.milestones.filter((m) => !m.completed).length },
      ]
    : [];

  return (
    <div className="modal-overlay" onClick={closeDetail}>
      <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title">
            <Target size={20} className="title-icon" />
            <input
              type="text"
              value={editedItem.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="title-input"
            />
          </div>
          <div className="modal-actions">
            <button className="save-btn" onClick={handleSave}>
              <Save size={16} />
              Save
            </button>
            <button className="close-btn" onClick={closeDetail}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="section-tabs">
          <button
            className={activeSection === 'overview' ? 'active' : ''}
            onClick={() => setActiveSection('overview')}
          >
            <FileText size={16} />
            Overview
          </button>
          <button
            className={activeSection === 'milestones' ? 'active' : ''}
            onClick={() => setActiveSection('milestones')}
          >
            <ListTodo size={16} />
            Milestones
          </button>
          <button
            className={activeSection === 'analytics' ? 'active' : ''}
            onClick={() => setActiveSection('analytics')}
          >
            <BarChart3 size={16} />
            Analytics
          </button>
          <button
            className={activeSection === 'tracking' ? 'active' : ''}
            onClick={() => setActiveSection('tracking')}
          >
            <TrendingUp size={16} />
            Tracking
          </button>
          {!isGoal && (
            <button
              className={activeSection === 'reminders' ? 'active' : ''}
              onClick={() => setActiveSection('reminders')}
            >
              <Bell size={16} />
              Reminders
            </button>
          )}
        </div>

        {/* Modal Content */}
        <div className="modal-content">
          {/* Overview Section */}
          {activeSection === 'overview' && (
            <div className="section overview-section">
              {/* Quick Stats */}
              <div className="quick-stats">
                <div className="stat-card">
                  <span className="stat-label">Progress</span>
                  <span className="stat-value">{editedItem.progress || 0}%</span>
                  <div className="stat-bar">
                    <div
                      className="stat-fill"
                      style={{ width: `${editedItem.progress || 0}%` }}
                    />
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Days Remaining</span>
                  <span className={`stat-value ${daysRemaining < 0 ? 'overdue' : ''}`}>
                    {daysRemaining < 0 ? 'Overdue' : daysRemaining}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-label">Milestones</span>
                  <span className="stat-value">{milestoneProgress}%</span>
                </div>
              </div>

              {/* Description */}
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={editedItem.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Add a description..."
                  rows={3}
                />
              </div>

              {/* Properties Grid */}
              <div className="properties-grid">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={editedItem.category || ''}
                    onChange={(e) => handleChange('category', e.target.value)}
                  >
                    {categoryOptions.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={editedItem.priority || 'medium'}
                    onChange={(e) => handleChange('priority', e.target.value)}
                  >
                    {priorityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    value={editedItem.status || 'not_started'}
                    onChange={(e) => handleChange('status', e.target.value)}
                  >
                    {statusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Target Date</label>
                  <input
                    type="date"
                    value={
                      editedItem.targetDate
                        ? format(parseISO(editedItem.targetDate), 'yyyy-MM-dd')
                        : ''
                    }
                    onChange={(e) =>
                      handleChange('targetDate', new Date(e.target.value).toISOString())
                    }
                  />
                </div>

                <div className="form-group">
                  <label>Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={editedItem.progress || 0}
                    onChange={(e) =>
                      handleChange('progress', parseInt(e.target.value) || 0)
                    }
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  value={editedItem.notes || ''}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Add notes..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {/* Milestones Section */}
          {activeSection === 'milestones' && (
            <div className="section milestones-section">
              <div className="milestone-header">
                <h3>Milestones</h3>
                <span className="milestone-progress">
                  {editedItem.milestones?.filter((m) => m.completed).length || 0} /{' '}
                  {editedItem.milestones?.length || 0} completed
                </span>
              </div>

              {/* Add Milestone */}
              <div className="add-milestone">
                <input
                  type="text"
                  placeholder="Add a milestone..."
                  value={newMilestone}
                  onChange={(e) => setNewMilestone(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && addMilestone()}
                />
                <button onClick={addMilestone}>
                  <Plus size={16} />
                </button>
              </div>

              {/* Milestones List */}
              <div className="milestones-list">
                {editedItem.milestones?.length === 0 && (
                  <div className="empty-milestones">
                    <ListTodo size={32} />
                    <p>No milestones yet</p>
                    <span>Break down your goal into smaller milestones</span>
                  </div>
                )}
                {editedItem.milestones?.map((milestone) => (
                  <div
                    key={milestone.id}
                    className={`milestone-item ${milestone.completed ? 'completed' : ''}`}
                  >
                    <button
                      className="milestone-toggle"
                      onClick={() => toggleMilestone(milestone.id)}
                    >
                      {milestone.completed ? (
                        <CheckCircle2 size={20} />
                      ) : (
                        <Circle size={20} />
                      )}
                    </button>
                    <span className="milestone-title">{milestone.title}</span>
                    <button
                      className="milestone-delete"
                      onClick={() => deleteMilestone(milestone.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Milestone Pie Chart */}
              {pieData.length > 0 && pieData[0].value + pieData[1].value > 0 && (
                <div className="milestone-chart">
                  <h4>Completion Breakdown</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? '#6366f1' : '#374151'}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: '6px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Analytics Section */}
          {activeSection === 'analytics' && (
            <div className="section analytics-section">
              <h3>Progress Over Time</h3>

              {chartData.length < 2 ? (
                <div className="no-data">
                  <BarChart3 size={48} />
                  <p>Not enough data for analytics</p>
                  <span>Add tracking data to see charts and projections</span>
                </div>
              ) : (
                <>
                  {/* Progress Chart */}
                  <div className="chart-container">
                    <h4>Progress Trend</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="date" stroke="#666" fontSize={12} />
                        <YAxis stroke="#666" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            background: '#1a1a1a',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#6366f1"
                          fill="url(#colorProgress)"
                          strokeWidth={2}
                        />
                        <defs>
                          <linearGradient id="colorProgress" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Projection Chart */}
                  <div className="chart-container">
                    <h4>Projected Completion</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={projectionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
                        <XAxis dataKey="date" stroke="#666" fontSize={12} />
                        <YAxis stroke="#666" fontSize={12} domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{
                            background: '#1a1a1a',
                            border: '1px solid #2a2a2a',
                            borderRadius: '6px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#6366f1"
                          strokeWidth={2}
                          dot={{ fill: '#6366f1', r: 4 }}
                          strokeDasharray={(d) => (d.projected ? '5 5' : '0')}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="projection-note">
                      Dashed line shows projected progress based on current trend
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tracking Section */}
          {activeSection === 'tracking' && (
            <div className="section tracking-section">
              <h3>Progress Tracking</h3>

              {/* Add Data Point */}
              <div className="add-datapoint">
                <div className="datapoint-inputs">
                  <input
                    type="date"
                    value={newDataPoint.date}
                    onChange={(e) =>
                      setNewDataPoint((prev) => ({ ...prev, date: e.target.value }))
                    }
                  />
                  <input
                    type="number"
                    placeholder="Progress %"
                    min="0"
                    max="100"
                    value={newDataPoint.value}
                    onChange={(e) =>
                      setNewDataPoint((prev) => ({ ...prev, value: e.target.value }))
                    }
                  />
                </div>
                <button onClick={addDataPoint}>
                  <Plus size={16} />
                  Add Entry
                </button>
              </div>

              {/* Data Points List */}
              <div className="datapoints-list">
                {editedItem.dataPoints?.length === 0 && (
                  <div className="empty-tracking">
                    <TrendingUp size={32} />
                    <p>No tracking data</p>
                    <span>Record your progress to see trends</span>
                  </div>
                )}
                {editedItem.dataPoints
                  ?.slice()
                  .reverse()
                  .map((dp, idx) => (
                    <div key={idx} className="datapoint-item">
                      <Calendar size={14} />
                      <span className="dp-date">
                        {format(parseISO(dp.date), 'MMM d, yyyy')}
                      </span>
                      <span className="dp-value">{dp.value}%</span>
                      <div className="dp-bar">
                        <div className="dp-fill" style={{ width: `${dp.value}%` }} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Reminders Section (Tasks only) */}
          {activeSection === 'reminders' && !isGoal && (
            <div className="section reminders-section">
              <h3>Reminder Settings</h3>

              {/* Master Toggle */}
              <div className="reminder-master-toggle">
                <button
                  className={`toggle-btn ${editedItem.reminderEnabled !== false ? 'enabled' : 'disabled'}`}
                  onClick={() => handleChange('reminderEnabled', editedItem.reminderEnabled === false)}
                >
                  {editedItem.reminderEnabled !== false ? <Bell size={24} /> : <BellOff size={24} />}
                  <span>{editedItem.reminderEnabled !== false ? 'Reminders Enabled' : 'Reminders Disabled'}</span>
                </button>
              </div>

              {editedItem.reminderEnabled !== false && (
                <div className="reminder-settings">
                  {/* When to remind */}
                  <div className="setting-group">
                    <label>
                      <Clock size={16} />
                      Remind me
                    </label>
                    <select
                      value={editedItem.reminderMinutes || 15}
                      onChange={(e) => handleChange('reminderMinutes', parseInt(e.target.value))}
                    >
                      <option value={0}>At start time</option>
                      <option value={5}>5 minutes before</option>
                      <option value={10}>10 minutes before</option>
                      <option value={15}>15 minutes before</option>
                      <option value={30}>30 minutes before</option>
                      <option value={60}>1 hour before</option>
                      <option value={120}>2 hours before</option>
                      <option value={1440}>1 day before</option>
                    </select>
                  </div>

                  {/* Sound */}
                  <div className="setting-group">
                    <label>
                      <Volume2 size={16} />
                      Notification Sound
                    </label>
                    <select
                      value={editedItem.reminderSound || 'default'}
                      onChange={(e) => handleChange('reminderSound', e.target.value)}
                    >
                      <option value="default">Default</option>
                      <option value="gentle">Gentle</option>
                      <option value="alarm">Alarm</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  {/* Repeat until acknowledged */}
                  <div className="setting-group checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={editedItem.reminderRepeat || false}
                        onChange={(e) => handleChange('reminderRepeat', e.target.checked)}
                      />
                      <Repeat size={16} />
                      Repeat until acknowledged
                    </label>
                    <span className="setting-description">
                      Notification will repeat every 5 minutes until you dismiss it
                    </span>
                  </div>

                  {/* Additional reminders */}
                  <div className="additional-reminders">
                    <h4>Additional Reminders</h4>
                    <p className="hint">Add extra reminder times for this task</p>

                    <div className="extra-reminders-list">
                      {(editedItem.extraReminders || []).map((reminder, idx) => (
                        <div key={idx} className="extra-reminder-item">
                          <Clock size={14} />
                          <span>{reminder} minutes before</span>
                          <button
                            onClick={() => {
                              const updated = [...(editedItem.extraReminders || [])];
                              updated.splice(idx, 1);
                              handleChange('extraReminders', updated);
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="add-extra-reminder">
                      <select id="extra-reminder-select" defaultValue="30">
                        <option value="5">5 minutes before</option>
                        <option value="15">15 minutes before</option>
                        <option value="30">30 minutes before</option>
                        <option value="60">1 hour before</option>
                        <option value="120">2 hours before</option>
                      </select>
                      <button
                        onClick={() => {
                          const select = document.getElementById('extra-reminder-select');
                          const value = parseInt(select.value);
                          const current = editedItem.extraReminders || [];
                          if (!current.includes(value)) {
                            handleChange('extraReminders', [...current, value].sort((a, b) => b - a));
                          }
                        }}
                      >
                        <Plus size={14} />
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
