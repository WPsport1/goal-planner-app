import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Sun,
  Moon,
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
  Copy,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Bath,
  Pill,
  Heart,
  PenTool,
  Tv,
  Wind,
} from 'lucide-react';
import { format, addMinutes, parse, getDay, getWeekOfMonth } from 'date-fns';
import './RoutineBuilder.css';

// Days of the week
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKS = ['A', 'B', 'C', 'D'];

// Morning routine suggestions
const morningSuggestions = [
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

// Nighttime routine suggestions
const nighttimeSuggestions = [
  { icon: Smartphone, title: 'Digital Sunset', duration: 5, description: 'Put away devices' },
  { icon: Bath, title: 'Shower/Bath', duration: 15, description: 'Relaxing wash' },
  { icon: Sparkles, title: 'Skincare', duration: 10, description: 'Nighttime skincare' },
  { icon: PenTool, title: 'Plan Tomorrow', duration: 10, description: 'Set intentions' },
  { icon: Book, title: 'Read', duration: 20, description: 'Wind down with a book' },
  { icon: MessageSquare, title: 'Gratitude Journal', duration: 5, description: 'Write 3 gratitudes' },
  { icon: Brain, title: 'Meditation', duration: 10, description: 'Calm the mind' },
  { icon: Wind, title: 'Breathing Exercises', duration: 5, description: 'Deep relaxation' },
  { icon: Pill, title: 'Supplements/Meds', duration: 2, description: 'Take vitamins' },
  { icon: Bed, title: 'Prepare Bed', duration: 3, description: 'Fluff pillows, adjust temp' },
];

export default function RoutineBuilder({ type = 'morning' }) {
  const {
    showMorningRoutine,
    setShowMorningRoutine,
    showNightRoutine,
    setShowNightRoutine,
    routines,
    saveRoutine,
    addTask,
    tasks,
    toggleTaskComplete,
  } = useApp();

  const isOpen = type === 'morning' ? showMorningRoutine : showNightRoutine;
  const setIsOpen = type === 'morning' ? setShowMorningRoutine : setShowNightRoutine;
  const suggestions = type === 'morning' ? morningSuggestions : nighttimeSuggestions;
  const defaultTime = type === 'morning' ? '06:00' : '21:00';
  const timeLabel = type === 'morning' ? 'Wake Up Time' : 'Wind Down Time';

  // Current selection state
  const [selectedDay, setSelectedDay] = useState(DAYS[getDay(new Date())]);
  const [selectedWeek, setSelectedWeek] = useState(WEEKS[Math.min(getWeekOfMonth(new Date()) - 1, 3)]);

  // Editing state
  const [routineItems, setRoutineItems] = useState([]);
  const [startTime, setStartTime] = useState(defaultTime);
  const [isEditing, setIsEditing] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [copyFromVisible, setCopyFromVisible] = useState(false);

  // Get the routine key for current selection
  const routineKey = `${type}_${selectedDay}_${selectedWeek}`;

  // Load saved routine for current day/week selection
  useEffect(() => {
    if (routines && routines[routineKey]) {
      setRoutineItems(routines[routineKey].items || []);
      setStartTime(routines[routineKey].startTime || defaultTime);
      setIsEditing(false);
    } else {
      // No routine for this day/week - start fresh or check for a template
      setRoutineItems([]);
      setStartTime(defaultTime);
      setIsEditing(true);
    }
  }, [routines, routineKey, defaultTime]);

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
      t.routineType === type &&
      t.scheduledDate &&
      t.scheduledDate.startsWith(format(new Date(), 'yyyy-MM-dd'))
  );

  // Check if this is today's routine
  const isToday = selectedDay === DAYS[getDay(new Date())] &&
                  selectedWeek === WEEKS[Math.min(getWeekOfMonth(new Date()) - 1, 3)];

  // Get all available routines to copy from
  const availableRoutines = useMemo(() => {
    if (!routines) return [];
    return Object.keys(routines)
      .filter(key => key.startsWith(`${type}_`) && key !== routineKey && routines[key].items?.length > 0)
      .map(key => {
        const [, day, week] = key.split('_');
        return {
          key,
          day,
          week,
          label: `${DAY_LABELS[DAYS.indexOf(day)]} - Week ${week}`,
          itemCount: routines[key].items.length,
        };
      });
  }, [routines, type, routineKey]);

  if (!isOpen) return null;

  const handleClose = () => {
    setIsOpen(false);
    setCopyFromVisible(false);
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
    saveRoutine(routineKey, {
      items: routineItems,
      startTime,
      type,
      day: selectedDay,
      week: selectedWeek,
    });
    setIsEditing(false);
  };

  const handleCopyFrom = (sourceKey) => {
    if (routines && routines[sourceKey]) {
      setRoutineItems([...routines[sourceKey].items]);
      setStartTime(routines[sourceKey].startTime);
    }
    setCopyFromVisible(false);
    setIsEditing(true);
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
          routineType: type,
          priority: 'medium',
          scheduledDate: today,
          startTime: item.startTime,
          endTime: item.endTime,
          recurrence: 'none', // Routines are day-specific, not recurring
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
      Droplets, Bed, Brain, Book, Dumbbell, Salad, MessageSquare, Coffee,
      Music, Sparkles, Clock, Sun, Moon, Smartphone, Bath, Pill, Heart,
      PenTool, Tv, Wind,
    };
    return icons[iconName] || Clock;
  };

  const getEndTime = () => {
    if (routineItems.length === 0) return startTime;
    const start = parse(startTime, 'HH:mm', new Date());
    const end = addMinutes(start, getTotalDuration());
    return format(end, 'h:mm a');
  };

  const Icon = type === 'morning' ? Sun : Moon;
  const headerGradient = type === 'morning'
    ? 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)'
    : 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';

  return (
    <div className="routine-builder-overlay" onClick={handleClose}>
      <div className="routine-builder-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="routine-header" style={{ background: headerGradient }}>
          <div className="header-title">
            <Icon size={24} />
            <h2>{type === 'morning' ? 'Morning' : 'Nighttime'} Routine</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Day/Week Selector */}
        <div className="routine-selector">
          {/* Week Selector */}
          <div className="week-selector">
            <span className="selector-label">Week:</span>
            <div className="week-buttons">
              {WEEKS.map((week) => (
                <button
                  key={week}
                  className={`week-btn ${selectedWeek === week ? 'active' : ''}`}
                  onClick={() => setSelectedWeek(week)}
                >
                  {week}
                </button>
              ))}
            </div>
          </div>

          {/* Day Selector */}
          <div className="day-selector">
            <span className="selector-label">Day:</span>
            <div className="day-buttons">
              {DAYS.map((day, index) => {
                const hasRoutine = routines && routines[`${type}_${day}_${selectedWeek}`]?.items?.length > 0;
                return (
                  <button
                    key={day}
                    className={`day-btn ${selectedDay === day ? 'active' : ''} ${hasRoutine ? 'has-routine' : ''}`}
                    onClick={() => setSelectedDay(day)}
                  >
                    {DAY_LABELS[index]}
                    {hasRoutine && <span className="routine-dot" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Current Selection Label */}
          <div className="current-selection">
            <span className="selection-label">
              {DAY_LABELS[DAYS.indexOf(selectedDay)]} - Week {selectedWeek}
              {isToday && <span className="today-badge">Today</span>}
            </span>
          </div>
        </div>

        {/* Time Settings */}
        <div className="routine-time-settings">
          <div className="time-input-group">
            <label>
              <Clock size={16} />
              {timeLabel}
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
              {/* Copy From Button */}
              {availableRoutines.length > 0 && routineItems.length === 0 && (
                <div className="copy-from-section">
                  <button
                    className="copy-from-btn"
                    onClick={() => setCopyFromVisible(!copyFromVisible)}
                  >
                    <Copy size={16} />
                    Copy from another day
                  </button>
                  {copyFromVisible && (
                    <div className="copy-from-list">
                      {availableRoutines.map((routine) => (
                        <button
                          key={routine.key}
                          className="copy-option"
                          onClick={() => handleCopyFrom(routine.key)}
                        >
                          <span>{routine.label}</span>
                          <span className="item-count">{routine.itemCount} items</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Editable Routine List */}
              <div className="routine-list editable">
                {routineItems.length === 0 ? (
                  <div className="empty-routine">
                    <Icon size={48} />
                    <p>Build your {type} routine for {DAY_LABELS[DAYS.indexOf(selectedDay)]} (Week {selectedWeek})</p>
                    <span>Add activities or copy from another day</span>
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
                    {suggestions.map((suggestion, index) => {
                      const SugIcon = suggestion.icon;
                      return (
                        <button
                          key={index}
                          className="suggestion-btn"
                          onClick={() => addRoutineItem(suggestion)}
                        >
                          <SugIcon size={18} />
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
              {itemsWithTimes.length === 0 ? (
                <div className="empty-routine">
                  <Icon size={48} />
                  <p>No routine set for {DAY_LABELS[DAYS.indexOf(selectedDay)]} (Week {selectedWeek})</p>
                  <button className="create-btn" onClick={() => setIsEditing(true)}>
                    Create Routine
                  </button>
                </div>
              ) : (
                itemsWithTimes.map((item) => {
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
                      {isToday && todayTask && (
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
                })
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="routine-actions">
          {isEditing ? (
            <>
              <button className="action-btn secondary" onClick={() => {
                // Reload from saved
                if (routines && routines[routineKey]) {
                  setRoutineItems(routines[routineKey].items || []);
                  setStartTime(routines[routineKey].startTime || defaultTime);
                }
                setIsEditing(false);
              }}>
                Cancel
              </button>
              <button
                className="action-btn primary"
                onClick={handleSave}
                style={{ background: headerGradient }}
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
              {isToday && routineItems.length > 0 && (
                <button
                  className="action-btn primary"
                  onClick={handleStartRoutine}
                  style={{ background: headerGradient }}
                >
                  <Play size={18} />
                  Start Today's Routine
                </button>
              )}
            </>
          )}
        </div>

        {/* Stats Footer */}
        <div className="routine-stats">
          <span>
            {Object.keys(routines || {}).filter(k => k.startsWith(`${type}_`) && routines[k]?.items?.length > 0).length} / 28 routines configured
          </span>
        </div>
      </div>
    </div>
  );
}
