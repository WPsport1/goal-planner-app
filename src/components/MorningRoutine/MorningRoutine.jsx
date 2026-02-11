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
  Bell,
  ArrowRight,
  Layers,
  CopyPlus,
  Check,
  AlertCircle,
} from 'lucide-react';
import { format, addMinutes, addDays, parse, startOfWeek, isSameDay } from 'date-fns';
import { createTaskReminder } from '../../services/notifications';
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
    notificationSettings,
  } = useApp();

  const [routineItems, setRoutineItems] = useState([]);
  const [startTime, setStartTime] = useState('06:00');
  const [isEditing, setIsEditing] = useState(true);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCopyOptions, setShowCopyOptions] = useState(false);
  const [showCopyToRoutine, setShowCopyToRoutine] = useState(null); // Item ID being copied to routine
  const [showCopyEntireRoutine, setShowCopyEntireRoutine] = useState(false); // Show copy entire routine panel
  const [copySuccess, setCopySuccess] = useState(null); // Success feedback message
  const [batchCopyMode, setBatchCopyMode] = useState(false); // For selecting multiple target routines
  const [batchCopyTargets, setBatchCopyTargets] = useState([]); // Selected targets for batch copy
  const [batchCopyItem, setBatchCopyItem] = useState(null); // Activity being batch-copied

  // Week variant and day selection
  const [selectedWeekVariant, setSelectedWeekVariant] = useState('A');
  const [selectedDay, setSelectedDay] = useState('monday');
  const [routineType, setRoutineType] = useState('morning'); // 'morning' or 'nighttime'

  // Get the routine key
  const getRoutineKey = (type = routineType, day = selectedDay, variant = selectedWeekVariant) =>
    `${type}_${day}_${variant}`;

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

  // Auto-clear success message
  useEffect(() => {
    if (copySuccess) {
      const timer = setTimeout(() => setCopySuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [copySuccess]);

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
    setBatchCopyMode(false);
    setBatchCopyTargets([]);
    setBatchCopyItem(null);
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

  // Copy activity to another routine
  const copyActivityToRoutine = (item, targetType, targetDay, targetVariant) => {
    const targetKey = getRoutineKey(targetType, targetDay, targetVariant);
    const targetRoutine = routines?.[targetKey] || { items: [], startTime: targetType === 'morning' ? '06:00' : '21:00' };

    // Check if activity already exists in target routine
    const alreadyExists = (targetRoutine.items || []).some(
      (existing) => existing.title === item.title
    );

    if (alreadyExists) {
      setCopySuccess(`"${item.title}" already exists in that routine`);
      return;
    }

    // Create new item with new ID
    const newItem = {
      ...item,
      id: Date.now().toString(),
    };

    // Remove calculated times (they'll be recalculated)
    delete newItem.startTime;
    delete newItem.endTime;

    const updatedItems = [...(targetRoutine.items || []), newItem];

    saveRoutine(targetKey, {
      ...targetRoutine,
      items: updatedItems,
      type: targetType,
      dayOfWeek: targetDay,
      weekVariant: targetVariant,
    });

    setShowCopyToRoutine(null);
    setCopySuccess(`"${item.title}" copied to ${targetType} - ${targetDay.charAt(0).toUpperCase() + targetDay.slice(1)} (${targetVariant})`);
  };

  // Batch copy activity to multiple routines at once
  const handleBatchCopyActivity = () => {
    if (!batchCopyItem || batchCopyTargets.length === 0) return;

    let copiedCount = 0;
    let skippedCount = 0;

    batchCopyTargets.forEach((target) => {
      const targetKey = getRoutineKey(target.type, target.day, target.variant);
      const targetRoutine = routines?.[targetKey] || { items: [], startTime: target.type === 'morning' ? '06:00' : '21:00' };

      // Check duplicate
      const alreadyExists = (targetRoutine.items || []).some(
        (existing) => existing.title === batchCopyItem.title
      );

      if (alreadyExists) {
        skippedCount++;
        return;
      }

      const newItem = {
        ...batchCopyItem,
        id: (Date.now() + copiedCount).toString(),
      };
      delete newItem.startTime;
      delete newItem.endTime;

      const updatedItems = [...(targetRoutine.items || []), newItem];
      saveRoutine(targetKey, {
        ...targetRoutine,
        items: updatedItems,
        type: target.type,
        dayOfWeek: target.day,
        weekVariant: target.variant,
      });

      copiedCount++;
    });

    setBatchCopyMode(false);
    setBatchCopyTargets([]);
    setBatchCopyItem(null);
    setCopySuccess(`"${batchCopyItem.title}" copied to ${copiedCount} routine(s)${skippedCount > 0 ? `, ${skippedCount} skipped (duplicates)` : ''}`);
  };

  // Toggle a batch copy target
  const toggleBatchTarget = (type, day, variant) => {
    const key = `${type}_${day}_${variant}`;
    const exists = batchCopyTargets.find(
      (t) => t.type === type && t.day === day && t.variant === variant
    );

    if (exists) {
      setBatchCopyTargets(batchCopyTargets.filter(
        (t) => !(t.type === type && t.day === day && t.variant === variant)
      ));
    } else {
      setBatchCopyTargets([...batchCopyTargets, { type, day, variant }]);
    }
  };

  // Copy entire routine to another routine slot
  const copyEntireRoutineToSlot = (targetType, targetDay, targetVariant) => {
    const targetKey = getRoutineKey(targetType, targetDay, targetVariant);

    const copiedItems = routineItems.map((item, index) => ({
      ...item,
      id: (Date.now() + index).toString(),
    }));

    // Remove any calculated times
    copiedItems.forEach((item) => {
      delete item.startTime;
      delete item.endTime;
    });

    saveRoutine(targetKey, {
      items: copiedItems,
      startTime: startTime,
      type: targetType,
      dayOfWeek: targetDay,
      weekVariant: targetVariant,
    });

    setCopySuccess(`Entire routine copied to ${targetType} - ${targetDay.charAt(0).toUpperCase() + targetDay.slice(1)} (${targetVariant})`);
    setShowCopyEntireRoutine(false);
  };

  // Copy entire routine to all days of a week variant
  const copyRoutineToAllDays = (targetType, targetVariant) => {
    let copiedCount = 0;

    daysOfWeek.forEach((day) => {
      // Skip current day if same type and variant
      if (targetType === routineType && targetVariant === selectedWeekVariant && day === selectedDay) {
        return;
      }

      const targetKey = getRoutineKey(targetType, day, targetVariant);

      const copiedItems = routineItems.map((item, index) => ({
        ...item,
        id: (Date.now() + copiedCount * 100 + index).toString(),
      }));

      copiedItems.forEach((item) => {
        delete item.startTime;
        delete item.endTime;
      });

      saveRoutine(targetKey, {
        items: copiedItems,
        startTime,
        type: targetType,
        dayOfWeek: day,
        weekVariant: targetVariant,
      });

      copiedCount++;
    });

    setCopySuccess(`Routine copied to ${copiedCount} days in Week ${targetVariant} (${targetType})`);
    setShowCopyEntireRoutine(false);
  };

  // Copy single activity to calendar with notifications
  const copyActivityToCalendar = (item, targetDate, enableNotification = true) => {
    const itemWithTime = itemsWithTimes.find(i => i.id === item.id);
    const dateStr = format(targetDate, 'yyyy-MM-dd');

    // Check if already exists
    const alreadyExists = tasks.some(
      (t) =>
        t.title === item.title &&
        t.type === 'routine' &&
        t.scheduledDate &&
        t.scheduledDate.startsWith(dateStr)
    );

    if (alreadyExists) {
      setCopySuccess(`"${item.title}" already exists on ${format(targetDate, 'MMM d')}`);
      return;
    }

    const taskData = {
      title: item.title,
      description: item.description,
      type: 'routine',
      priority: 'medium',
      scheduledDate: targetDate.toISOString(),
      startTime: itemWithTime?.startTime || '09:00',
      endTime: itemWithTime?.endTime || '09:30',
      recurrence: 'none',
      reminder: enableNotification,
      reminderMinutes: notificationSettings?.taskReminderMinutes || 5,
    };

    addTask(taskData);

    // Schedule notification if enabled
    if (enableNotification) {
      createTaskReminder(
        { ...taskData, id: 'temp-' + Date.now(), scheduledDate: targetDate.toISOString() },
        notificationSettings?.taskReminderMinutes || 5
      );
    }

    setCopySuccess(`"${item.title}" added to ${format(targetDate, 'EEE, MMM d')} with notifications`);
  };

  // Copy entire routine to a specific date with notifications
  const copyRoutineToDate = (targetDate, enableNotifications = true) => {
    let copiedCount = 0;
    let skippedCount = 0;

    itemsWithTimes.forEach((item) => {
      // Check if task already exists for that date
      const existingTask = tasks.find(
        (t) =>
          t.title === item.title &&
          t.type === 'routine' &&
          t.scheduledDate &&
          isSameDay(new Date(t.scheduledDate), targetDate)
      );

      if (existingTask) {
        skippedCount++;
        return;
      }

      const taskData = {
        title: item.title,
        description: item.description,
        type: 'routine',
        priority: 'medium',
        scheduledDate: targetDate.toISOString(),
        startTime: item.startTime,
        endTime: item.endTime,
        recurrence: 'none',
        reminder: enableNotifications,
        reminderMinutes: notificationSettings?.taskReminderMinutes || 5,
      };

      addTask(taskData);

      // Schedule notification for each task
      if (enableNotifications) {
        createTaskReminder(
          { ...taskData, id: 'temp-' + Date.now() + copiedCount, scheduledDate: targetDate.toISOString() },
          notificationSettings?.taskReminderMinutes || 5
        );
      }

      copiedCount++;
    });

    setCopySuccess(
      `${copiedCount} activities added to ${format(targetDate, 'EEE, MMM d')}${skippedCount > 0 ? ` (${skippedCount} already existed)` : ''}`
    );
  };

  // Copy entire week's routine to calendar with notifications
  const copyWeekRoutineToCalendar = (enableNotifications = true) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    let totalCopied = 0;

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
            const taskData = {
              title: item.title,
              description: item.description,
              type: 'routine',
              priority: 'medium',
              scheduledDate: targetDate.toISOString(),
              startTime: itemStartTime,
              endTime: itemEndTime,
              recurrence: 'none',
              reminder: enableNotifications,
              reminderMinutes: notificationSettings?.taskReminderMinutes || 5,
            };

            addTask(taskData);

            // Schedule notification
            if (enableNotifications) {
              createTaskReminder(
                { ...taskData, id: 'temp-' + Date.now() + totalCopied, scheduledDate: targetDate.toISOString() },
                notificationSettings?.taskReminderMinutes || 5
              );
            }

            totalCopied++;
          }
        });
      }
    });

    setShowCopyOptions(false);
    setCopySuccess(`${totalCopied} activities copied to this week's calendar with notifications`);
  };

  const handleStartRoutine = () => {
    copyRoutineToDate(new Date(), true);
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

  // Check if a target is in batch list
  const isBatchTarget = (type, day, variant) => {
    return batchCopyTargets.some(
      (t) => t.type === type && t.day === day && t.variant === variant
    );
  };

  // Enter batch copy mode for an activity
  const enterBatchCopyMode = (item) => {
    setBatchCopyItem(item);
    setBatchCopyMode(true);
    setBatchCopyTargets([]);
    setShowCopyToRoutine(null);
  };

  // Quick select helpers for batch copy
  const selectAllDaysForWeek = (type, variant) => {
    const targets = daysOfWeek
      .filter((day) => !(type === routineType && variant === selectedWeekVariant && day === selectedDay))
      .map((day) => ({ type, day, variant }));

    setBatchCopyTargets(targets);
  };

  const selectAllWeeksForDay = (type, day) => {
    const targets = weekVariants
      .filter((variant) => !(type === routineType && variant === selectedWeekVariant && day === selectedDay))
      .map((variant) => ({ type, day, variant }));

    setBatchCopyTargets(targets);
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

        {/* Success Toast */}
        {copySuccess && (
          <div className="copy-success-toast">
            <CheckCircle2 size={16} />
            <span>{copySuccess}</span>
          </div>
        )}

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

        {/* Batch Copy Mode Banner */}
        {batchCopyMode && batchCopyItem && (
          <div className="batch-copy-banner">
            <div className="batch-copy-banner-info">
              <CopyPlus size={16} />
              <span>Select routines to copy "<strong>{batchCopyItem.title}</strong>" to:</span>
            </div>
            <div className="batch-copy-quick-select">
              <span className="quick-select-label">Quick select:</span>
              {weekVariants.map((variant) => (
                <button
                  key={variant}
                  className="quick-select-btn"
                  onClick={() => selectAllDaysForWeek(routineType, variant)}
                >
                  All Week {variant}
                </button>
              ))}
              <button
                className="quick-select-btn"
                onClick={() => selectAllDaysForWeek(routineType === 'morning' ? 'nighttime' : 'morning', selectedWeekVariant)}
              >
                All {routineType === 'morning' ? 'Nighttime' : 'Morning'} ({selectedWeekVariant})
              </button>
            </div>
            <div className="batch-target-grid">
              {['morning', 'nighttime'].map((type) => (
                <div key={type} className="batch-type-section">
                  <h5>{type === 'morning' ? '☀️ Morning' : '🌙 Nighttime'}</h5>
                  {weekVariants.map((variant) => (
                    <div key={variant} className="batch-variant-row">
                      <span className="batch-variant-label">Week {variant}</span>
                      <div className="batch-day-buttons">
                        {daysOfWeek.map((day) => {
                          const isCurrent = type === routineType && variant === selectedWeekVariant && day === selectedDay;
                          const isSelected = isBatchTarget(type, day, variant);
                          return (
                            <button
                              key={`${type}-${variant}-${day}`}
                              className={`batch-day-btn ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                              onClick={() => !isCurrent && toggleBatchTarget(type, day, variant)}
                              disabled={isCurrent}
                              title={isCurrent ? 'Current routine' : `${type} - ${day} (${variant})`}
                            >
                              {day.slice(0, 2)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="batch-copy-actions">
              <span className="batch-count">{batchCopyTargets.length} routine(s) selected</span>
              <button className="batch-cancel-btn" onClick={() => { setBatchCopyMode(false); setBatchCopyTargets([]); setBatchCopyItem(null); }}>
                Cancel
              </button>
              <button
                className="batch-confirm-btn"
                onClick={handleBatchCopyActivity}
                disabled={batchCopyTargets.length === 0}
              >
                <CopyPlus size={14} />
                Copy to {batchCopyTargets.length} Routine(s)
              </button>
            </div>
          </div>
        )}

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
                      {/* Copy to Calendar */}
                      <button
                        className="copy-single-btn"
                        onClick={() => setShowCopyOptions(showCopyOptions === item.id ? false : item.id)}
                        title="Copy to calendar"
                      >
                        <Calendar size={16} />
                      </button>
                      {/* Copy to Another Routine */}
                      <button
                        className="copy-single-btn"
                        onClick={() => setShowCopyToRoutine(showCopyToRoutine === item.id ? false : item.id)}
                        title="Copy to another routine"
                      >
                        <Layers size={16} />
                      </button>
                      {/* Batch Copy to Multiple Routines */}
                      <button
                        className="copy-single-btn batch-copy-trigger"
                        onClick={() => enterBatchCopyMode(item)}
                        title="Copy to multiple routines at once"
                      >
                        <CopyPlus size={16} />
                      </button>
                    </div>

                    {/* Copy to calendar dropdown */}
                    {showCopyOptions === item.id && (
                      <div className="copy-dropdown">
                        <div className="copy-dropdown-header">
                          <span>Copy to Calendar:</span>
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
                                copyActivityToCalendar(item, date, true);
                                setShowCopyOptions(false);
                              }}
                            >
                              <Calendar size={14} />
                              {format(date, 'EEE, MMM d')}
                              <Bell size={12} className="notification-icon" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Copy to another routine dropdown */}
                    {showCopyToRoutine === item.id && (
                      <div className="copy-dropdown routine-copy">
                        <div className="copy-dropdown-header">
                          <span>Copy to Routine:</span>
                          <button onClick={() => setShowCopyToRoutine(null)}>
                            <X size={14} />
                          </button>
                        </div>
                        <div className="copy-routine-options">
                          {/* Quick copy to same day other type */}
                          <div className="quick-copy-section">
                            <h5>Quick Copy</h5>
                            <button
                              className="quick-copy-btn"
                              onClick={() => copyActivityToRoutine(
                                item,
                                routineType === 'morning' ? 'nighttime' : 'morning',
                                selectedDay,
                                selectedWeekVariant
                              )}
                            >
                              {routineType === 'morning' ? <Moon size={14} /> : <Sun size={14} />}
                              {routineType === 'morning' ? 'Nighttime' : 'Morning'} - {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} ({selectedWeekVariant})
                            </button>
                          </div>

                          {/* Copy to all days of current week */}
                          <div className="quick-copy-section">
                            <h5>Copy to All Days (Week {selectedWeekVariant})</h5>
                            <div className="day-copy-grid">
                              {daysOfWeek.filter(d => d !== selectedDay).map(day => (
                                <button
                                  key={day}
                                  className="day-copy-btn"
                                  onClick={() => copyActivityToRoutine(item, routineType, day, selectedWeekVariant)}
                                >
                                  {day.slice(0, 3)}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Copy to other week variants */}
                          <div className="quick-copy-section">
                            <h5>Copy to Other Weeks ({selectedDay})</h5>
                            <div className="week-copy-grid">
                              {weekVariants.filter(v => v !== selectedWeekVariant).map(variant => (
                                <button
                                  key={variant}
                                  className="variant-copy-btn"
                                  onClick={() => copyActivityToRoutine(item, routineType, selectedDay, variant)}
                                >
                                  Week {variant}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Copy Entire Routine Section */}
        {!isEditing && routineItems.length > 0 && (
          <div className="copy-entire-routine-section">
            <button
              className="copy-section-toggle"
              onClick={() => setShowCopyEntireRoutine(!showCopyEntireRoutine)}
            >
              <Copy size={18} />
              Copy Entire Routine to Another Slot
              {showCopyEntireRoutine ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showCopyEntireRoutine && (
              <div className="copy-entire-options">
                <div className="copy-info-banner">
                  <AlertCircle size={16} />
                  <span>This will overwrite the target routine with all {routineItems.length} activities from the current routine.</span>
                </div>

                {/* Copy to specific slot */}
                <div className="copy-option-group">
                  <h4>Copy to Specific Day:</h4>
                  <div className="copy-entire-type-tabs">
                    {['morning', 'nighttime'].map((type) => (
                      <div key={type} className="copy-entire-type-block">
                        <span className="copy-type-label">
                          {type === 'morning' ? <Sun size={14} /> : <Moon size={14} />}
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </span>
                        {weekVariants.map((variant) => (
                          <div key={variant} className="copy-variant-row">
                            <span className="variant-label">Wk {variant}</span>
                            <div className="copy-day-pills">
                              {daysOfWeek.map((day) => {
                                const isCurrent = type === routineType && variant === selectedWeekVariant && day === selectedDay;
                                return (
                                  <button
                                    key={`${type}-${variant}-${day}`}
                                    className={`copy-day-pill ${isCurrent ? 'current' : ''}`}
                                    onClick={() => !isCurrent && copyEntireRoutineToSlot(type, day, variant)}
                                    disabled={isCurrent}
                                    title={isCurrent ? 'Current routine' : `Copy to ${type} - ${day} (${variant})`}
                                  >
                                    {day.slice(0, 2)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Copy to all days of a week */}
                <div className="copy-option-group">
                  <h4>Copy to All Days of a Week:</h4>
                  <div className="copy-all-days-grid">
                    {['morning', 'nighttime'].map((type) => (
                      weekVariants.map((variant) => {
                        const isCurrent = type === routineType && variant === selectedWeekVariant;
                        return (
                          <button
                            key={`all-${type}-${variant}`}
                            className={`copy-all-days-btn ${isCurrent ? 'current-week' : ''}`}
                            onClick={() => copyRoutineToAllDays(type, variant)}
                          >
                            {type === 'morning' ? <Sun size={14} /> : <Moon size={14} />}
                            Week {variant}
                            {isCurrent && <span className="current-tag">current</span>}
                          </button>
                        );
                      })
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Copy to Calendar Section */}
        {!isEditing && routineItems.length > 0 && (
          <div className="copy-to-calendar-section">
            <button
              className="copy-section-toggle calendar-toggle"
              onClick={() => setShowCopyOptions(showCopyOptions === 'full' ? false : 'full')}
            >
              <Calendar size={18} />
              Copy to Short-Term Calendar
              <Bell size={14} className="notification-indicator" />
              {showCopyOptions === 'full' ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showCopyOptions === 'full' && (
              <div className="copy-full-options">
                <div className="copy-info-banner">
                  <Bell size={16} />
                  <span>Activities will appear on your Short-Term Calendar with notifications, timers, and the red time indicator so you can follow along throughout the day.</span>
                </div>

                <div className="copy-option-group">
                  <h4>Copy This Routine to:</h4>
                  <div className="copy-day-grid">
                    {getUpcomingDays().map((date) => (
                      <button
                        key={date.toISOString()}
                        className="copy-day-btn"
                        onClick={() => {
                          copyRoutineToDate(date, true);
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
                    onClick={() => copyWeekRoutineToCalendar(true)}
                  >
                    <Calendar size={18} />
                    Copy All {routineType === 'morning' ? 'Morning' : 'Nighttime'} Routines for Week {selectedWeekVariant}
                  </button>
                  <p className="copy-hint">
                    This will copy all saved {routineType} routines from Week {selectedWeekVariant} (Mon-Sun) to this week's calendar with notifications, timers, and alerts so you can follow along.
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
                <Bell size={14} />
                Start Today's Routine
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
