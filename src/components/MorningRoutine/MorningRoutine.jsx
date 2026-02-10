import { useState, useEffect } from 'react';
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
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format, addMinutes, addDays, parse, startOfWeek, isSameDay } from 'date-fns';
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

// Week variants
const weekVariants = ['A', 'B', 'C', 'D'];
const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export default function MorningRoutine() {
  const {
    showMorningRoutine,
    setShowMorningRoutine,
    morningRoutine,
    saveMorningRoutine,
    routines,
    saveRoutine,
    addTask,
    tasks,
    toggleTaskComplete,
  } = useApp();

  const [routineItems, setRoutineItems] = useState([]);
  const [startTime, setStartTime] = useState('06:00');
  const [isEditing, setIsEditing] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCopyOptions, setShowCopyOptions] = useState(false);

  // Week variant and day selection
  const [selectedWeekVariant, setSelectedWeekVariant] = useState('A');
  const [selectedDay, setSelectedDay] = useState('monday');
  const [routineType, setRoutineType] = useState('morning'); // 'morning' or 'nighttime'

  // Get the routine key
  const getRoutineKey = () => `${routineType}_${selectedDay}_${selectedWeekVariant}`;

  // Load saved routine based on selection
  useEffect(() => {
    const key = getRoutineKey();
    const savedRoutine = routines?.[key];

    if (savedRoutine) {
      setRoutineItems(savedRoutine.items || []);
      setStartTime(savedRoutine.startTime || (routineType === 'morning' ? '06:00' : '21:00'));
      setIsEditing(false);
    } else if (morningRoutine && routineType === 'morning') {
      // Fall back to legacy routine
      setRoutineItems(morningRoutine.items || []);
      setStartTime(morningRoutine.startTime || '06:00');
      setIsEditing(false);
    } else {
      setRoutineItems([]);
      setStartTime(routineType === 'morning' ? '06:00' : '21:00');
      setIsEditing(true);
    }
  }, [routines, morningRoutine, selectedWeekVariant, selectedDay, routineType]);

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
    const key = getRoutineKey();
    const routineData = {
      items: routineItems,
      startTime,
      type: routineType,
      dayOfWeek: selectedDay,
      weekVariant: selectedWeekVariant,
    };

    // Save to new unified system
    saveRoutine(key, routineData);

    // Also save to legacy system for backwards compatibility
    if (routineType === 'morning' && selectedDay === 'monday' && selectedWeekVariant === 'A') {
      saveMorningRoutine({ items: routineItems, startTime });
    }

    setIsEditing(false);
  };

  // Copy single activity to calendar
  const copyActivityToCalendar = (item, targetDate) => {
    const itemWithTime = itemsWithTimes.find(i => i.id === item.id);
    addTask({
      title: item.title,
      description: item.description,
      type: 'routine',
      priority: 'medium',
      scheduledDate: targetDate.toISOString(),
      startTime: itemWithTime?.startTime || '09:00',
      endTime: itemWithTime?.endTime || '09:30',
      recurrence: 'none',
    });
  };

  // Copy entire routine to a specific date
  const copyRoutineToDate = (targetDate) => {
    itemsWithTimes.forEach((item) => {
      // Check if task already exists for that date
      const existingTask = tasks.find(
        (t) =>
          t.title === item.title &&
          t.type === 'routine' &&
          t.scheduledDate &&
          isSameDay(new Date(t.scheduledDate), targetDate)
      );

      if (!existingTask) {
        addTask({
          title: item.title,
          description: item.description,
          type: 'routine',
          priority: 'medium',
          scheduledDate: targetDate.toISOString(),
          startTime: item.startTime,
          endTime: item.endTime,
          recurrence: 'none',
        });
      }
    });
  };

  // Copy entire week's routine to calendar
  const copyWeekRoutineToCalendar = () => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday

    daysOfWeek.forEach((day, dayIndex) => {
      const targetDate = addDays(weekStart, dayIndex);
      const dayKey = `${routineType}_${day}_${selectedWeekVariant}`;
      const dayRoutine = routines?.[dayKey];

      if (dayRoutine && dayRoutine.items && dayRoutine.items.length > 0) {
        // Calculate times for this day's routine
        let currentTime = parse(dayRoutine.startTime || '06:00', 'HH:mm', new Date());

        dayRoutine.items.forEach((item) => {
          const itemStartTime = format(currentTime, 'HH:mm');
          currentTime = addMinutes(currentTime, item.duration);
          const itemEndTime = format(currentTime, 'HH:mm');

          // Check if already exists
          const existingTask = tasks.find(
            (t) =>
              t.title === item.title &&
              t.type === 'routine' &&
              t.scheduledDate &&
              isSameDay(new Date(t.scheduledDate), targetDate)
          );

          if (!existingTask) {
            addTask({
              title: item.title,
              description: item.description,
              type: 'routine',
              priority: 'medium',
              scheduledDate: targetDate.toISOString(),
              startTime: itemStartTime,
              endTime: itemEndTime,
              recurrence: 'none',
            });
          }
        });
      }
    });

    setShowCopyOptions(false);
  };

  const handleStartRoutine = () => {
    copyRoutineToDate(new Date());
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
      Moon,
    };
    return icons[iconName] || Clock;
  };

  const getEndTime = () => {
    if (routineItems.length === 0) return startTime;
    const start = parse(startTime, 'HH:mm', new Date());
    const end = addMinutes(start, getTotalDuration());
    return format(end, 'h:mm a');
  };

  // Get upcoming days for copy options
  const getUpcomingDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(new Date(), i));
    }
    return days;
  };

  return (
    <div className="morning-routine-overlay" onClick={handleClose}>
      <div className="morning-routine-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="routine-header">
          <div className="header-title">
            {routineType === 'morning' ? <Sun size={24} /> : <Moon size={24} />}
            <h2>{routineType === 'morning' ? 'Morning' : 'Nighttime'} Routine</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Routine Type Toggle */}
        <div className="routine-type-toggle">
          <button
            className={`type-btn ${routineType === 'morning' ? 'active' : ''}`}
            onClick={() => setRoutineType('morning')}
          >
            <Sun size={16} />
            Morning
          </button>
          <button
            className={`type-btn ${routineType === 'nighttime' ? 'active' : ''}`}
            onClick={() => setRoutineType('nighttime')}
          >
            <Moon size={16} />
            Nighttime
          </button>
        </div>

        {/* Day & Week Selection */}
        <div className="routine-selection">
          <div className="day-selector">
            <label>Day</label>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
            >
              {daysOfWeek.map((day) => (
                <option key={day} value={day}>
                  {day.charAt(0).toUpperCase() + day.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="week-selector">
            <label>Week Variant</label>
            <div className="week-buttons">
              {weekVariants.map((variant) => (
                <button
                  key={variant}
                  className={`week-btn ${selectedWeekVariant === variant ? 'active' : ''}`}
                  onClick={() => setSelectedWeekVariant(variant)}
                >
                  {variant}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time Settings */}
        <div className="routine-time-settings">
          <div className="time-input-group">
            <label>
              <Clock size={16} />
              {routineType === 'morning' ? 'Wake Up Time' : 'Start Time'}
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
                    {routineType === 'morning' ? <Sun size={48} /> : <Moon size={48} />}
                    <p>Start building your {routineType} routine</p>
                    <span>Add activities to create your perfect {routineType}</span>
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
                  >
                    <div className="item-time-badge">{item.startTime}</div>
                    <div className="item-icon">
                      <IconComponent size={20} />
                    </div>
                    <div className="item-details">
                      <h4>{item.title}</h4>
                      <span className="item-duration-text">{item.duration} minutes</span>
                    </div>
                    <div className="item-actions">
                      {todayTask && (
                        <button
                          className="complete-btn"
                          onClick={() => toggleTaskComplete(todayTask.id)}
                        >
                          {isCompleted ? (
                            <CheckCircle2 size={20} className="status-done" />
                          ) : (
                            <div className="status-pending" />
                          )}
                        </button>
                      )}
                      <button
                        className="copy-single-btn"
                        onClick={() => setShowCopyOptions(item.id)}
                        title="Copy to calendar"
                      >
                        <Copy size={16} />
                      </button>
                    </div>

                    {/* Copy options dropdown for single item */}
                    {showCopyOptions === item.id && (
                      <div className="copy-dropdown">
                        <div className="copy-dropdown-header">
                          <span>Copy to:</span>
                          <button onClick={() => setShowCopyOptions(false)}>
                            <X size={14} />
                          </button>
                        </div>
                        <div className="copy-options-list">
                          {getUpcomingDays().map((date) => (
                            <button
                              key={date.toISOString()}
                              className="copy-option"
                              onClick={() => {
                                copyActivityToCalendar(item, date);
                                setShowCopyOptions(false);
                              }}
                            >
                              {format(date, 'EEE, MMM d')}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Copy to Calendar Section */}
        {!isEditing && routineItems.length > 0 && (
          <div className="copy-to-calendar-section">
            <button
              className="copy-section-toggle"
              onClick={() => setShowCopyOptions(showCopyOptions === 'full' ? false : 'full')}
            >
              <Calendar size={18} />
              Copy to Calendar
              {showCopyOptions === 'full' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showCopyOptions === 'full' && (
              <div className="copy-full-options">
                <div className="copy-option-group">
                  <h4>Copy Today's Routine to:</h4>
                  <div className="copy-day-grid">
                    {getUpcomingDays().map((date) => (
                      <button
                        key={date.toISOString()}
                        className="copy-day-btn"
                        onClick={() => {
                          copyRoutineToDate(date);
                          setShowCopyOptions(false);
                        }}
                      >
                        <span className="day-name">{format(date, 'EEE')}</span>
                        <span className="day-date">{format(date, 'd')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="copy-option-group">
                  <h4>Copy Entire Week (Variant {selectedWeekVariant}):</h4>
                  <button
                    className="copy-week-btn"
                    onClick={copyWeekRoutineToCalendar}
                  >
                    <Calendar size={18} />
                    Copy All {routineType === 'morning' ? 'Morning' : 'Nighttime'} Routines for Week {selectedWeekVariant}
                  </button>
                  <p className="copy-hint">
                    This will copy all saved {routineType} routines from Week {selectedWeekVariant} (Mon-Sun) to this week's calendar.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

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
