import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  GripVertical,
  ChevronRight,
  CheckSquare,
  Square,
  Trash2,
  Edit3,
  Filter,
  SortAsc,
  SortDesc,
  Search,
  Clock,
  Repeat,
  Calendar,
  ListTodo,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { format, parseISO, isToday, isTomorrow, isThisWeek } from 'date-fns';
import './TaskList.css';

const priorityColors = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const typeLabels = {
  task: 'Task',
  appointment: 'Appointment',
  habit: 'Habit',
  routine: 'Routine',
};

const typeIcons = {
  task: ListTodo,
  appointment: Calendar,
  habit: Repeat,
  routine: Clock,
};

const recurrenceOptions = [
  { value: 'none', label: 'No Repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const reminderOptions = [
  { value: 0, label: 'At start time' },
  { value: 5, label: '5 minutes before' },
  { value: 10, label: '10 minutes before' },
  { value: 15, label: '15 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
];

export default function TaskList() {
  const { tasks, goals, addTask, deleteTask, toggleTaskComplete, openDetail, reorderTasks, lastSaveStatus } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('time'); // time, priority, type, name
  const [sortOrder, setSortOrder] = useState('asc');
  const [filterType, setFilterType] = useState('all');
  const [filterDate, setFilterDate] = useState('all'); // all, today, tomorrow, week
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    type: 'task',
    priority: 'medium',
    scheduledDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    endTime: '09:30',
    recurrence: 'none',
    linkedGoalId: '',
    // Reminder settings
    reminderEnabled: true,
    reminderMinutes: 15,
    reminderSound: 'default',
    reminderRepeat: false,
  });
  const [draggedItem, setDraggedItem] = useState(null);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const [saveToast, setSaveToast] = useState(null);

  // Filter and sort tasks
  const filteredTasks = tasks
    .filter((task) => {
      const matchesSearch =
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || task.type === filterType;

      let matchesDate = true;
      if (filterDate !== 'all' && task.scheduledDate) {
        const taskDate = parseISO(task.scheduledDate);
        switch (filterDate) {
          case 'today':
            matchesDate = isToday(taskDate);
            break;
          case 'tomorrow':
            matchesDate = isTomorrow(taskDate);
            break;
          case 'week':
            matchesDate = isThisWeek(taskDate);
            break;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'time':
          const timeA = a.startTime || '00:00';
          const timeB = b.startTime || '00:00';
          comparison = timeA.localeCompare(timeB);
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Group tasks by completion status
  const pendingTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    // Build scheduledDate as local time to avoid UTC timezone issues
    const [year, month, day] = newTask.scheduledDate.split('-').map(Number);
    const [startH, startM] = (newTask.startTime || '09:00').split(':').map(Number);
    const localDate = new Date(year, month - 1, day, startH, startM);

    await addTask({
      ...newTask,
      scheduledDate: localDate.toISOString(),
    });

    // Show save confirmation
    setSaveToast('Task saved!');
    setTimeout(() => setSaveToast(null), 2500);

    setNewTask({
      title: '',
      description: '',
      type: 'task',
      priority: 'medium',
      scheduledDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: '09:00',
      endTime: '09:30',
      recurrence: 'none',
      linkedGoalId: '',
      reminderEnabled: true,
      reminderMinutes: 15,
      reminderSound: 'default',
      reminderRepeat: false,
    });
    setShowAddForm(false);
    setShowReminderOptions(false);
  };

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedItem(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, task) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== task.id) {
      const newTasks = [...tasks];
      const draggedIndex = newTasks.findIndex((t) => t.id === draggedItem.id);
      const targetIndex = newTasks.findIndex((t) => t.id === task.id);
      newTasks.splice(draggedIndex, 1);
      newTasks.splice(targetIndex, 0, draggedItem);
      reorderTasks(newTasks);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const getDateLabel = (dateString) => {
    if (!dateString) return '';
    const date = parseISO(dateString);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEE, MMM d');
  };

  const renderTaskCard = (task) => {
    const TypeIcon = typeIcons[task.type] || ListTodo;

    return (
      <div
        key={task.id}
        className={`task-card ${task.completed ? 'completed' : ''} ${draggedItem?.id === task.id ? 'dragging' : ''}`}
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragOver={(e) => handleDragOver(e, task)}
        onDragEnd={handleDragEnd}
      >
        <div className="task-drag-handle">
          <GripVertical size={16} />
        </div>

        <button
          className="task-checkbox"
          onClick={() => toggleTaskComplete(task.id)}
        >
          {task.completed ? (
            <CheckSquare size={20} className="checked" />
          ) : (
            <Square size={20} />
          )}
        </button>

        <div
          className="task-priority-indicator"
          style={{ backgroundColor: priorityColors[task.priority] }}
        />

        <div className="task-content" onClick={() => openDetail(task)}>
          <div className="task-header">
            <h3>{task.title}</h3>
            <span className={`task-type type-${task.type}`}>
              <TypeIcon size={12} />
              {typeLabels[task.type]}
            </span>
          </div>

          <div className="task-meta">
            <span className="task-time">
              <Clock size={12} />
              {task.startTime} - {task.endTime}
            </span>
            <span className="task-date">
              <Calendar size={12} />
              {getDateLabel(task.scheduledDate)}
            </span>
            {task.recurrence !== 'none' && (
              <span className="task-recurrence">
                <Repeat size={12} />
                {task.recurrence}
              </span>
            )}
            {task.reminderEnabled !== false && (
              <span className="task-reminder-indicator">
                <Bell size={10} />
                {task.reminderMinutes ? `${task.reminderMinutes}m` : 'On'}
              </span>
            )}
          </div>

          {task.linkedGoalId && (
            <div className="task-linked-goal">
              Linked to: {goals.find((g) => g.id === task.linkedGoalId)?.title || 'Goal'}
            </div>
          )}
        </div>

        <div className="task-actions">
          <button
            className="action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              openDetail(task);
            }}
            title="Edit"
          >
            <Edit3 size={14} />
          </button>
          <button
            className="action-btn delete"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm('Delete this task?')) deleteTask(task.id);
            }}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <ChevronRight size={16} className="chevron" />
        </div>
      </div>
    );
  };

  return (
    <div className="task-list">
      {/* Search and Controls */}
      <div className="task-list-controls">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="control-row">
          <div className="filter-group">
            <Filter size={14} />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="task">Tasks</option>
              <option value="appointment">Appointments</option>
              <option value="habit">Habits</option>
              <option value="routine">Routines</option>
            </select>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
              <option value="week">This Week</option>
            </select>
          </div>

          <div className="sort-group">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="time">Time</option>
              <option value="priority">Priority</option>
              <option value="type">Type</option>
              <option value="name">Name</option>
            </select>
            <button className="sort-order-btn" onClick={toggleSortOrder}>
              {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Add Task Button/Form */}
      {showAddForm ? (
        <form className="add-task-form" onSubmit={handleAddTask}>
          <input
            type="text"
            placeholder="Task title..."
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            autoFocus
          />

          <div className="form-row">
            <select
              value={newTask.type}
              onChange={(e) => setNewTask({ ...newTask, type: e.target.value })}
            >
              <option value="task">Task</option>
              <option value="appointment">Appointment</option>
              <option value="habit">Habit</option>
              <option value="routine">Routine</option>
            </select>
            <select
              value={newTask.priority}
              onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>

          <div className="form-row">
            <input
              type="date"
              value={newTask.scheduledDate}
              onChange={(e) => setNewTask({ ...newTask, scheduledDate: e.target.value })}
            />
            <input
              type="time"
              value={newTask.startTime}
              onChange={(e) => setNewTask({ ...newTask, startTime: e.target.value })}
              step="900"
            />
            <input
              type="time"
              value={newTask.endTime}
              onChange={(e) => setNewTask({ ...newTask, endTime: e.target.value })}
              step="900"
            />
          </div>

          <div className="form-row">
            <select
              value={newTask.recurrence}
              onChange={(e) => setNewTask({ ...newTask, recurrence: e.target.value })}
            >
              {recurrenceOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={newTask.linkedGoalId}
              onChange={(e) => setNewTask({ ...newTask, linkedGoalId: e.target.value })}
            >
              <option value="">Link to Goal (optional)</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>

          {/* Reminder Settings Section */}
          <div className="reminder-section">
            <button
              type="button"
              className={`reminder-toggle ${newTask.reminderEnabled ? 'enabled' : 'disabled'}`}
              onClick={() => setNewTask({ ...newTask, reminderEnabled: !newTask.reminderEnabled })}
            >
              {newTask.reminderEnabled ? <Bell size={16} /> : <BellOff size={16} />}
              <span>{newTask.reminderEnabled ? 'Reminder On' : 'Reminder Off'}</span>
              <button
                type="button"
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReminderOptions(!showReminderOptions);
                }}
              >
                {showReminderOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </button>

            {showReminderOptions && newTask.reminderEnabled && (
              <div className="reminder-options">
                <div className="reminder-option">
                  <label>Remind me</label>
                  <select
                    value={newTask.reminderMinutes}
                    onChange={(e) => setNewTask({ ...newTask, reminderMinutes: parseInt(e.target.value) })}
                  >
                    {reminderOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="reminder-option">
                  <label>Sound</label>
                  <select
                    value={newTask.reminderSound}
                    onChange={(e) => setNewTask({ ...newTask, reminderSound: e.target.value })}
                  >
                    <option value="default">Default</option>
                    <option value="gentle">Gentle</option>
                    <option value="alarm">Alarm</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="reminder-option checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={newTask.reminderRepeat}
                      onChange={(e) => setNewTask({ ...newTask, reminderRepeat: e.target.checked })}
                    />
                    Repeat until acknowledged
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Add Task
            </button>
          </div>
        </form>
      ) : (
        <button className="add-task-btn" onClick={() => setShowAddForm(true)}>
          <Plus size={18} />
          <span>Add New Task</span>
        </button>
      )}

      {/* Tasks Container */}
      <div className="tasks-container">
        {filteredTasks.length === 0 ? (
          <div className="empty-state">
            <ListTodo size={48} />
            <p>No tasks found</p>
            <span>Add your first task to get started</span>
          </div>
        ) : (
          <>
            {/* Pending Tasks */}
            {pendingTasks.length > 0 && (
              <div className="task-section">
                <h4 className="section-title">
                  <span>Pending</span>
                  <span className="count">{pendingTasks.length}</span>
                </h4>
                {pendingTasks.map(renderTaskCard)}
              </div>
            )}

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="task-section completed-section">
                <h4 className="section-title">
                  <span>Completed</span>
                  <span className="count">{completedTasks.length}</span>
                </h4>
                {completedTasks.map(renderTaskCard)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Save status indicator */}
      {lastSaveStatus && Date.now() - lastSaveStatus.time < 3000 && (
        <div className={`task-save-indicator ${lastSaveStatus.success ? 'success' : 'error'}`}>
          {lastSaveStatus.success ? <CheckCircle2 size={12} /> : null}
          {lastSaveStatus.success ? 'Saved' : 'Save failed'}
        </div>
      )}

      {/* Save Toast */}
      {saveToast && (
        <div className="save-confirmation-toast">
          <CheckCircle2 size={16} />
          {saveToast}
        </div>
      )}
    </div>
  );
}
