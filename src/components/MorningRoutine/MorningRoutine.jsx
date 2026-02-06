import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Sun,
  Plus,
  Trash2,
  GripVertical,
  Clock,
  Save,
  Play,
  CheckCircle2,
  Coffee,
  Dumbbell,
  Book,
  Brain,
  Droplets,
  Salad,
  MessageSquare,
  Music,
  Bed,
  Sparkles,
} from 'lucide-react';
import { format, addMinutes, parse } from 'date-fns';
import './MorningRoutine.css';

// Predefined routine suggestions
const routineSuggestions = [
  { icon: Droplets, title: 'Drink Water', duration: 2, description: 'Start with a glass of water' },
  { icon: Bed, title: 'Make Bed', duration: 3, description: 'Quick win to start the day' },
  { icon: Brain, title: 'Meditation', duration: 10, description: 'Mindfulness practice' },
  { icon: Book, title: 'Read', duration: 15, description: 'Read something inspiring' },
  { icon: Dumbbell, title: 'Exercise', duration: 30, description: 'Morning workout' },
  { icon: Salad, title: 'Healthy Breakfast', duration: 20, description: 'Nutritious morning meal' },
  { icon: MessageSquare, title: 'Journaling', duration: 10, description: 'Write your thoughts' },
  { icon: Coffee, title: 'Morning Coffee/Tea', duration: 10, description: 'Enjoy mindfully' },
  { icon: Music, title: 'Listen to Podcast', duration: 15, description: 'Learn while preparing' },
  { icon: Sparkles, title: 'Skincare', duration: 10, description: 'Self-care routine' },
];

export default function MorningRoutine() {
  const {
    showMorningRoutine,
    setShowMorningRoutine,
    morningRoutine,
    saveMorningRoutine,
    addTask,
    tasks,
    toggleTaskComplete,
  } = useApp();

  const [routineItems, setRoutineItems] = useState([]);
  const [startTime, setStartTime] = useState('06:00');
  const [isEditing, setIsEditing] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load saved routine
  useEffect(() => {
    if (morningRoutine) {
      setRoutineItems(morningRoutine.items || []);
      setStartTime(morningRoutine.startTime || '06:00');
      setIsEditing(false);
    }
  }, [morningRoutine]);

  // Calculate end times for each item
  const calculateTimes = () => {
    let currentTime = parse(startTime, 'HH:mm', new Date());
    return routineItems.map((item) => {
      const itemStartTime = format(currentTime, 'HH:mm');
      currentTime = addMinutes(currentTime, item.duration);
      const itemEndTime = format(currentTime, 'HH:mm');
      return { ...item, startTime: itemStartTime, endTime: itemEndTime };
    });
  };

  const itemsWithTimes = calculateTimes();

  // Get today's routine tasks
  const todayRoutineTasks = tasks.filter(
    (t) =>
      t.type === 'routine' &&
      t.scheduledDate &&
      t.scheduledDate.startsWith(format(new Date(), 'yyyy-MM-dd'))
  );

  if (!showMorningRoutine) return null;

  const handleClose = () => {
    setShowMorningRoutine(false);
  };

  const addRoutineItem = (suggestion = null) => {
    const newItem = suggestion
      ? {
          id: Date.now().toString(),
          title: suggestion.title,
          duration: suggestion.duration,
          description: suggestion.description,
          iconName: suggestion.icon.name,
        }
      : {
          id: Date.now().toString(),
          title: 'New Activity',
          duration: 10,
          description: '',
          iconName: 'Clock',
        };
    setRoutineItems([...routineItems, newItem]);
    setShowSuggestions(false);
  };

  const updateItem = (id, updates) => {
    setRoutineItems(
      routineItems.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const removeItem = (id) => {
    setRoutineItems(routineItems.filter((item) => item.id !== id));
  };

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newItems = [...routineItems];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    setRoutineItems(newItems);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleSave = () => {
    saveMorningRoutine({
      items: routineItems,
      startTime,
    });
    setIsEditing(false);
  };

  const handleStartRoutine = () => {
    // Create tasks for today based on routine
    const today = new Date().toISOString();
    itemsWithTimes.forEach((item) => {
      // Check if task already exists for today
      const existingTask = todayRoutineTasks.find((t) => t.title === item.title);
      if (!existingTask) {
        addTask({
          title: item.title,
          description: item.description,
          type: 'routine',
          priority: 'medium',
          scheduledDate: today,
          startTime: item.startTime,
          endTime: item.endTime,
          recurrence: 'daily',
        });
      }
    });
    handleClose();
  };

  const getTotalDuration = () => {
    return routineItems.reduce((sum, item) => sum + item.duration, 0);
  };

  const getIconComponent = (iconName) => {
    const icons = {
      Droplets,
      Bed,
      Brain,
      Book,
      Dumbbell,
      Salad,
      MessageSquare,
      Coffee,
      Music,
      Sparkles,
      Clock,
      Sun,
    };
    return icons[iconName] || Clock;
  };

  const getEndTime = () => {
    if (routineItems.length === 0) return startTime;
    const start = parse(startTime, 'HH:mm', new Date());
    const end = addMinutes(start, getTotalDuration());
    return format(end, 'h:mm a');
  };

  return (
    <div className="morning-routine-overlay" onClick={handleClose}>
      <div className="morning-routine-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="routine-header">
          <div className="header-title">
            <Sun size={24} />
            <h2>Morning Routine</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Time Settings */}
        <div className="routine-time-settings">
          <div className="time-input-group">
            <label>
              <Clock size={16} />
              Wake Up Time
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={!isEditing}
            />
          </div>
          <div className="routine-summary">
            <span className="summary-item">
              <strong>{routineItems.length}</strong> activities
            </span>
            <span className="summary-item">
              <strong>{getTotalDuration()}</strong> min total
            </span>
            <span className="summary-item">
              Done by <strong>{getEndTime()}</strong>
            </span>
          </div>
        </div>

        {/* Routine Content */}
        <div className="routine-content">
          {isEditing ? (
            <>
              {/* Editable Routine List */}
              <div className="routine-list editable">
                {routineItems.length === 0 ? (
                  <div className="empty-routine">
                    <Sun size={48} />
                    <p>Start building your morning routine</p>
                    <span>Add activities to create your perfect morning</span>
                  </div>
                ) : (
                  itemsWithTimes.map((item, index) => {
                    const IconComponent = getIconComponent(item.iconName);
                    return (
                      <div
                        key={item.id}
                        className={`routine-item ${draggedIndex === index ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="drag-handle">
                          <GripVertical size={16} />
                        </div>
                        <div className="item-icon">
                          <IconComponent size={20} />
                        </div>
                        <div className="item-details">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                            className="item-title-input"
                          />
                          <div className="item-time">
                            {item.startTime} - {item.endTime}
                          </div>
                        </div>
                        <div className="item-duration">
                          <input
                            type="number"
                            value={item.duration}
                            onChange={(e) =>
                              updateItem(item.id, { duration: parseInt(e.target.value) || 1 })
                            }
                            min="1"
                            max="120"
                          />
                          <span>min</span>
                        </div>
                        <button
                          className="remove-btn"
                          onClick={() => removeItem(item.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Activity */}
              <div className="add-activity-section">
                <button
                  className="add-btn"
                  onClick={() => setShowSuggestions(!showSuggestions)}
                >
                  <Plus size={18} />
                  Add Activity
                </button>

                {showSuggestions && (
                  <div className="suggestions-grid">
                    {routineSuggestions.map((suggestion, index) => {
                      const Icon = suggestion.icon;
                      return (
                        <button
                          key={index}
                          className="suggestion-btn"
                          onClick={() => addRoutineItem(suggestion)}
                        >
                          <Icon size={18} />
                          <span>{suggestion.title}</span>
                          <span className="suggestion-duration">{suggestion.duration}m</span>
                        </button>
                      );
                    })}
                    <button
                      className="suggestion-btn custom"
                      onClick={() => addRoutineItem()}
                    >
                      <Plus size={18} />
                      <span>Custom</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* View Mode */
            <div className="routine-list view-mode">
              {itemsWithTimes.map((item) => {
                const IconComponent = getIconComponent(item.iconName);
                const todayTask = todayRoutineTasks.find((t) => t.title === item.title);
                const isCompleted = todayTask?.completed;

                return (
                  <div
                    key={item.id}
                    className={`routine-item view ${isCompleted ? 'completed' : ''}`}
                    onClick={() => todayTask && toggleTaskComplete(todayTask.id)}
                  >
                    <div className="item-time-badge">{item.startTime}</div>
                    <div className="item-icon">
                      <IconComponent size={20} />
                    </div>
                    <div className="item-details">
                      <h4>{item.title}</h4>
                      <span className="item-duration-text">{item.duration} minutes</span>
                    </div>
                    {todayTask && (
                      <div className="item-status">
                        {isCompleted ? (
                          <CheckCircle2 size={20} className="status-done" />
                        ) : (
                          <div className="status-pending" />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="routine-actions">
          {isEditing ? (
            <>
              <button className="action-btn secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </button>
              <button
                className="action-btn primary"
                onClick={handleSave}
                disabled={routineItems.length === 0}
              >
                <Save size={18} />
                Save Routine
              </button>
            </>
          ) : (
            <>
              <button className="action-btn secondary" onClick={() => setIsEditing(true)}>
                Edit Routine
              </button>
              <button
                className="action-btn primary"
                onClick={handleStartRoutine}
                disabled={routineItems.length === 0}
              >
                <Play size={18} />
                Start Today's Routine
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
