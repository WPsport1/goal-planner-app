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
  ChevronDown,
  ChevronUp,
  Smartphone,
  Bath,
  Pill,
  Heart,
  PenTool,
  Tv,
  Wind,
  Calendar,
  Bell,
  Layers,
  CopyPlus,
  AlertCircle,
  Circle,
} from 'lucide-react';
import { format, addMinutes, addDays, parse, getDay, getWeekOfMonth, startOfWeek, isSameDay } from 'date-fns';
import { createTaskReminder } from '../../services/notifications';
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
    notificationSettings,
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

  // Copy feature state
  const [showCopyOptions, setShowCopyOptions] = useState(false); // Calendar copy per-item or 'full' for section
  const [showCopyToRoutine, setShowCopyToRoutine] = useState(null); // Item ID
  const [showCopyEntireRoutine, setShowCopyEntireRoutine] = useState(false);
  const [copySuccess, setCopySuccess] = useState(null);
  const [batchCopyMode, setBatchCopyMode] = useState(false);
  const [batchCopyTargets, setBatchCopyTargets] = useState([]);
  const [batchCopyItem, setBatchCopyItem] = useState(null);

  // Get the routine key for current selection
  const routineKey = `${type}_${selectedDay}_${selectedWeek}`;

  // Load saved routine for current day/week selection
  useEffect(() => {
    if (routines && routines[routineKey]) {
      setRoutineItems(routines[routineKey].items || []);
      setStartTime(routines[routineKey].startTime || defaultTime);
      setIsEditing(false);
    } else {
      setRoutineItems([]);
      setStartTime(defaultTime);
      setIsEditing(true);
    }
  }, [routines, routineKey, defaultTime]);

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

  // ====== COPY ACTIVITY TO ANOTHER ROUTINE ======
  const copyActivityToRoutine = (item, targetType, targetDay, targetVariant) => {
    const targetKey = `${targetType}_${targetDay}_${targetVariant}`;
    const targetRoutine = routines?.[targetKey] || { items: [], startTime: targetType === 'morning' ? '06:00' : '21:00' };

    const alreadyExists = (targetRoutine.items || []).some(
      (existing) => existing.title === item.title
    );

    if (alreadyExists) {
      setCopySuccess(`"${item.title}" already exists in that routine`);
      return;
    }

    const newItem = { ...item, id: Date.now().toString() };
    delete newItem.startTime;
    delete newItem.endTime;

    saveRoutine(targetKey, {
      ...targetRoutine,
      items: [...(targetRoutine.items || []), newItem],
      type: targetType,
      dayOfWeek: targetDay,
      weekVariant: targetVariant,
    });

    setShowCopyToRoutine(null);
    setCopySuccess(`"${item.title}" copied to ${targetType} - ${targetDay.charAt(0).toUpperCase() + targetDay.slice(1)} (${targetVariant})`);
  };

  // ====== BATCH COPY ACTIVITY ======
  const handleBatchCopyActivity = () => {
    if (!batchCopyItem || batchCopyTargets.length === 0) return;

    let copiedCount = 0;
    let skippedCount = 0;

    batchCopyTargets.forEach((target) => {
      const targetKey = `${target.type}_${target.day}_${target.variant}`;
      const targetRoutine = routines?.[targetKey] || { items: [], startTime: target.type === 'morning' ? '06:00' : '21:00' };

      const alreadyExists = (targetRoutine.items || []).some(
        (existing) => existing.title === batchCopyItem.title
      );

      if (alreadyExists) {
        skippedCount++;
        return;
      }

      const newItem = { ...batchCopyItem, id: (Date.now() + copiedCount).toString() };
      delete newItem.startTime;
      delete newItem.endTime;

      saveRoutine(targetKey, {
        ...targetRoutine,
        items: [...(targetRoutine.items || []), newItem],
        type: target.type,
        dayOfWeek: target.day,
        weekVariant: target.variant,
      });

      copiedCount++;
    });

    const itemTitle = batchCopyItem.title;
    setBatchCopyMode(false);
    setBatchCopyTargets([]);
    setBatchCopyItem(null);
    setCopySuccess(`"${itemTitle}" copied to ${copiedCount} routine(s)${skippedCount > 0 ? `, ${skippedCount} skipped (duplicates)` : ''}`);
  };

  const toggleBatchTarget = (targetType, day, variant) => {
    const exists = batchCopyTargets.find(
      (t) => t.type === targetType && t.day === day && t.variant === variant
    );
    if (exists) {
      setBatchCopyTargets(batchCopyTargets.filter(
        (t) => !(t.type === targetType && t.day === day && t.variant === variant)
      ));
    } else {
      setBatchCopyTargets([...batchCopyTargets, { type: targetType, day, variant }]);
    }
  };

  const isBatchTarget = (targetType, day, variant) => {
    return batchCopyTargets.some(
      (t) => t.type === targetType && t.day === day && t.variant === variant
    );
  };

  const enterBatchCopyMode = (item) => {
    setBatchCopyItem(item);
    setBatchCopyMode(true);
    setBatchCopyTargets([]);
    setShowCopyToRoutine(null);
  };

  const selectAllDaysForWeek = (targetType, variant) => {
    const targets = DAYS
      .filter((day) => !(targetType === type && variant === selectedWeek && day === selectedDay))
      .map((day) => ({ type: targetType, day, variant }));
    setBatchCopyTargets(targets);
  };

  // ====== COPY ENTIRE ROUTINE TO ANOTHER SLOT ======
  const copyEntireRoutineToSlot = (targetType, targetDay, targetVariant) => {
    const targetKey = `${targetType}_${targetDay}_${targetVariant}`;
    const copiedItems = routineItems.map((item, index) => {
      const newItem = { ...item, id: (Date.now() + index).toString() };
      delete newItem.startTime;
      delete newItem.endTime;
      return newItem;
    });

    saveRoutine(targetKey, {
      items: copiedItems,
      startTime,
      type: targetType,
      dayOfWeek: targetDay,
      weekVariant: targetVariant,
    });

    setCopySuccess(`Entire routine copied to ${targetType} - ${targetDay.charAt(0).toUpperCase() + targetDay.slice(1)} (${targetVariant})`);
    setShowCopyEntireRoutine(false);
  };

  const copyRoutineToAllDays = (targetType, targetVariant) => {
    let copiedCount = 0;
    DAYS.forEach((day) => {
      if (targetType === type && targetVariant === selectedWeek && day === selectedDay) return;

      const targetKey = `${targetType}_${day}_${targetVariant}`;
      const copiedItems = routineItems.map((item, index) => {
        const newItem = { ...item, id: (Date.now() + copiedCount * 100 + index).toString() };
        delete newItem.startTime;
        delete newItem.endTime;
        return newItem;
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

  // ====== COPY TO CALENDAR WITH NOTIFICATIONS ======
  const copyActivityToCalendar = (item, targetDate, enableNotification = true) => {
    const itemWithTime = itemsWithTimes.find(i => i.id === item.id);
    const dateStr = format(targetDate, 'yyyy-MM-dd');

    const alreadyExists = tasks.some(
      (t) => t.title === item.title && t.type === 'routine' && t.scheduledDate && t.scheduledDate.startsWith(dateStr)
    );

    if (alreadyExists) {
      setCopySuccess(`"${item.title}" already exists on ${format(targetDate, 'MMM d')}`);
      return;
    }

    const taskData = {
      title: item.title,
      description: item.description,
      type: 'routine',
      routineType: type,
      priority: 'medium',
      scheduledDate: targetDate.toISOString(),
      startTime: itemWithTime?.startTime || '09:00',
      endTime: itemWithTime?.endTime || '09:30',
      recurrence: 'none',
      reminder: enableNotification,
      reminderMinutes: notificationSettings?.taskReminderMinutes || 5,
    };

    addTask(taskData);

    if (enableNotification) {
      createTaskReminder(
        { ...taskData, id: 'temp-' + Date.now(), scheduledDate: targetDate.toISOString() },
        notificationSettings?.taskReminderMinutes || 5
      );
    }

    setCopySuccess(`"${item.title}" added to ${format(targetDate, 'EEE, MMM d')} with notifications`);
  };

  const copyRoutineToDate = (targetDate, enableNotifications = true) => {
    let copiedCount = 0;
    let skippedCount = 0;

    itemsWithTimes.forEach((item) => {
      const existingTask = tasks.find(
        (t) => t.title === item.title && t.type === 'routine' && t.scheduledDate && isSameDay(new Date(t.scheduledDate), targetDate)
      );

      if (existingTask) { skippedCount++; return; }

      const taskData = {
        title: item.title,
        description: item.description,
        type: 'routine',
        routineType: type,
        priority: 'medium',
        scheduledDate: targetDate.toISOString(),
        startTime: item.startTime,
        endTime: item.endTime,
        recurrence: 'none',
        reminder: enableNotifications,
        reminderMinutes: notificationSettings?.taskReminderMinutes || 5,
      };

      addTask(taskData);

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

  const copyWeekRoutineToCalendar = (enableNotifications = true) => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 }); // Sunday
    let totalCopied = 0;

    DAYS.forEach((day, dayIndex) => {
      const targetDate = addDays(weekStart, dayIndex);
      const dayKey = `${type}_${day}_${selectedWeek}`;
      const dayRoutine = routines?.[dayKey];

      if (dayRoutine && dayRoutine.items && dayRoutine.items.length > 0) {
        let currentTime = parse(dayRoutine.startTime || defaultTime, 'HH:mm', new Date());

        dayRoutine.items.forEach((item) => {
          const itemStartTime = format(currentTime, 'HH:mm');
          currentTime = addMinutes(currentTime, item.duration);
          const itemEndTime = format(currentTime, 'HH:mm');

          const existingTask = tasks.find(
            (t) => t.title === item.title && t.type === 'routine' && t.scheduledDate && isSameDay(new Date(t.scheduledDate), targetDate)
          );

          if (!existingTask) {
            const taskData = {
              title: item.title,
              description: item.description,
              type: 'routine',
              routineType: type,
              priority: 'medium',
              scheduledDate: targetDate.toISOString(),
              startTime: itemStartTime,
              endTime: itemEndTime,
              recurrence: 'none',
              reminder: enableNotifications,
              reminderMinutes: notificationSettings?.taskReminderMinutes || 5,
            };

            addTask(taskData);

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

  const getUpcomingDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push(addDays(new Date(), i));
    }
    return days;
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

        {/* Success Toast */}
        {copySuccess && (
          <div className="copy-success-toast">
            <CheckCircle2 size={16} />
            <span>{copySuccess}</span>
          </div>
        )}

        {/* Day/Week Selector */}
        <div className="routine-selector">
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

        {/* Batch Copy Mode Banner */}
        {batchCopyMode && batchCopyItem && (
          <div className="batch-copy-banner">
            <div className="batch-copy-banner-info">
              <CopyPlus size={16} />
              <span>Select routines to copy "<strong>{batchCopyItem.title}</strong>" to:</span>
            </div>
            <div className="batch-copy-quick-select">
              <span className="quick-select-label">Quick select:</span>
              {WEEKS.map((variant) => (
                <button key={variant} className="quick-select-btn" onClick={() => selectAllDaysForWeek(type, variant)}>
                  All Week {variant}
                </button>
              ))}
              <button className="quick-select-btn" onClick={() => selectAllDaysForWeek(type === 'morning' ? 'nighttime' : 'morning', selectedWeek)}>
                All {type === 'morning' ? 'Nighttime' : 'Morning'} ({selectedWeek})
              </button>
            </div>
            <div className="batch-target-grid">
              {['morning', 'nighttime'].map((bType) => (
                <div key={bType} className="batch-type-section">
                  <h5>{bType === 'morning' ? 'Morning' : 'Nighttime'}</h5>
                  {WEEKS.map((variant) => (
                    <div key={variant} className="batch-variant-row">
                      <span className="batch-variant-label">Wk {variant}</span>
                      <div className="batch-day-buttons">
                        {DAYS.map((day) => {
                          const isCurrent = bType === type && variant === selectedWeek && day === selectedDay;
                          const isSelected = isBatchTarget(bType, day, variant);
                          return (
                            <button
                              key={`${bType}-${variant}-${day}`}
                              className={`batch-day-btn ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                              onClick={() => !isCurrent && toggleBatchTarget(bType, day, variant)}
                              disabled={isCurrent}
                              title={isCurrent ? 'Current routine' : `${bType} - ${day} (${variant})`}
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
              <button className="batch-confirm-btn" onClick={handleBatchCopyActivity} disabled={batchCopyTargets.length === 0}>
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
              {/* Copy From Button */}
              {availableRoutines.length > 0 && routineItems.length === 0 && (
                <div className="copy-from-section">
                  <button className="copy-from-btn" onClick={() => setCopyFromVisible(!copyFromVisible)}>
                    <Copy size={16} />
                    Copy from another day
                  </button>
                  {copyFromVisible && (
                    <div className="copy-from-list">
                      {availableRoutines.map((routine) => (
                        <button key={routine.key} className="copy-option" onClick={() => handleCopyFrom(routine.key)}>
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
                        <div className="drag-handle"><GripVertical size={16} /></div>
                        <div className="item-icon"><IconComponent size={20} /></div>
                        <div className="item-details">
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => updateItem(item.id, { title: e.target.value })}
                            className="item-title-input"
                          />
                          <div className="item-time">{item.startTime} - {item.endTime}</div>
                        </div>
                        <div className="item-duration">
                          <input
                            type="number"
                            value={item.duration}
                            onChange={(e) => updateItem(item.id, { duration: parseInt(e.target.value) || 1 })}
                            min="1"
                            max="120"
                          />
                          <span>min</span>
                        </div>
                        <button className="remove-btn" onClick={() => removeItem(item.id)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Add Activity */}
              <div className="add-activity-section">
                <button className="add-btn" onClick={() => setShowSuggestions(!showSuggestions)}>
                  <Plus size={18} />
                  Add Activity
                </button>

                {showSuggestions && (
                  <div className="suggestions-grid">
                    {suggestions.map((suggestion, index) => {
                      const SugIcon = suggestion.icon;
                      return (
                        <button key={index} className="suggestion-btn" onClick={() => addRoutineItem(suggestion)}>
                          <SugIcon size={18} />
                          <span>{suggestion.title}</span>
                          <span className="suggestion-duration">{suggestion.duration}m</span>
                        </button>
                      );
                    })}
                    <button className="suggestion-btn custom" onClick={() => addRoutineItem()}>
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
                    <div key={item.id} className={`routine-item view ${isCompleted ? 'completed' : ''}`}>
                      <div className="item-time-badge">{item.startTime}</div>
                      <div className="item-icon"><IconComponent size={20} /></div>
                      <div className="item-details">
                        <h4>{item.title}</h4>
                        <span className="item-duration-text">{item.duration} minutes</span>
                      </div>
                      <div className="item-actions">
                        {isToday && todayTask && (
                          <button className="action-icon-btn" onClick={() => toggleTaskComplete(todayTask.id)} title="Toggle complete">
                            {isCompleted ? <CheckCircle2 size={18} className="status-done" /> : <Circle size={18} />}
                          </button>
                        )}
                        <button
                          className="action-icon-btn"
                          onClick={() => setShowCopyOptions(showCopyOptions === item.id ? false : item.id)}
                          title="Copy to calendar"
                        >
                          <Calendar size={16} />
                        </button>
                        <button
                          className="action-icon-btn"
                          onClick={() => setShowCopyToRoutine(showCopyToRoutine === item.id ? false : item.id)}
                          title="Copy to another routine"
                        >
                          <Layers size={16} />
                        </button>
                        <button
                          className="action-icon-btn batch-trigger"
                          onClick={() => enterBatchCopyMode(item)}
                          title="Copy to multiple routines"
                        >
                          <CopyPlus size={16} />
                        </button>
                      </div>

                      {/* Copy to calendar dropdown */}
                      {showCopyOptions === item.id && (
                        <div className="copy-dropdown">
                          <div className="copy-dropdown-header">
                            <span>Copy to Calendar:</span>
                            <button onClick={() => setShowCopyOptions(false)}><X size={14} /></button>
                          </div>
                          <div className="copy-options-list">
                            {getUpcomingDays().map((date) => (
                              <button
                                key={date.toISOString()}
                                className="copy-date-option"
                                onClick={() => { copyActivityToCalendar(item, date, true); setShowCopyOptions(false); }}
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
                        <div className="copy-dropdown routine-copy-dropdown">
                          <div className="copy-dropdown-header">
                            <span>Copy to Routine:</span>
                            <button onClick={() => setShowCopyToRoutine(null)}><X size={14} /></button>
                          </div>
                          <div className="copy-routine-options">
                            <div className="quick-copy-section">
                              <h5>Quick Copy</h5>
                              <button
                                className="quick-copy-btn"
                                onClick={() => copyActivityToRoutine(item, type === 'morning' ? 'nighttime' : 'morning', selectedDay, selectedWeek)}
                              >
                                {type === 'morning' ? <Moon size={14} /> : <Sun size={14} />}
                                {type === 'morning' ? 'Nighttime' : 'Morning'} - {selectedDay.charAt(0).toUpperCase() + selectedDay.slice(1)} ({selectedWeek})
                              </button>
                            </div>
                            <div className="quick-copy-section">
                              <h5>Other Days (Week {selectedWeek})</h5>
                              <div className="day-copy-grid">
                                {DAYS.filter(d => d !== selectedDay).map(day => (
                                  <button key={day} className="day-copy-btn" onClick={() => copyActivityToRoutine(item, type, day, selectedWeek)}>
                                    {DAY_LABELS[DAYS.indexOf(day)]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="quick-copy-section">
                              <h5>Other Weeks ({selectedDay})</h5>
                              <div className="week-copy-grid">
                                {WEEKS.filter(v => v !== selectedWeek).map(variant => (
                                  <button key={variant} className="variant-copy-btn" onClick={() => copyActivityToRoutine(item, type, selectedDay, variant)}>
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
                })
              )}
            </div>
          )}
        </div>

        {/* Copy Entire Routine Section */}
        {!isEditing && routineItems.length > 0 && (
          <div className="copy-entire-section">
            <button className="copy-section-toggle" onClick={() => setShowCopyEntireRoutine(!showCopyEntireRoutine)}>
              <Copy size={18} />
              Copy Entire Routine to Another Slot
              {showCopyEntireRoutine ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showCopyEntireRoutine && (
              <div className="copy-entire-options">
                <div className="copy-info-banner">
                  <AlertCircle size={16} />
                  <span>This will overwrite the target routine with all {routineItems.length} activities.</span>
                </div>

                <div className="copy-option-group">
                  <h4>Copy to Specific Day:</h4>
                  {['morning', 'nighttime'].map((cType) => (
                    <div key={cType} className="copy-type-block">
                      <span className="copy-type-label">
                        {cType === 'morning' ? <Sun size={14} /> : <Moon size={14} />}
                        {cType.charAt(0).toUpperCase() + cType.slice(1)}
                      </span>
                      {WEEKS.map((variant) => (
                        <div key={variant} className="copy-variant-row">
                          <span className="variant-label">Wk {variant}</span>
                          <div className="copy-day-pills">
                            {DAYS.map((day) => {
                              const isCurrent = cType === type && variant === selectedWeek && day === selectedDay;
                              return (
                                <button
                                  key={`${cType}-${variant}-${day}`}
                                  className={`copy-day-pill ${isCurrent ? 'current' : ''}`}
                                  onClick={() => !isCurrent && copyEntireRoutineToSlot(cType, day, variant)}
                                  disabled={isCurrent}
                                >
                                  {DAY_LABELS[DAYS.indexOf(day)].slice(0, 2)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                <div className="copy-option-group">
                  <h4>Copy to All Days of a Week:</h4>
                  <div className="copy-all-days-grid">
                    {['morning', 'nighttime'].map((cType) =>
                      WEEKS.map((variant) => (
                        <button
                          key={`all-${cType}-${variant}`}
                          className="copy-all-days-btn"
                          onClick={() => copyRoutineToAllDays(cType, variant)}
                        >
                          {cType === 'morning' ? <Sun size={14} /> : <Moon size={14} />}
                          Week {variant}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Copy to Calendar Section */}
        {!isEditing && routineItems.length > 0 && (
          <div className="copy-calendar-section">
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
                  <span>Activities will appear on your Short-Term Calendar with notifications, timers, and the red time indicator.</span>
                </div>

                <div className="copy-option-group">
                  <h4>Copy This Routine to:</h4>
                  <div className="copy-day-grid">
                    {getUpcomingDays().map((date) => (
                      <button
                        key={date.toISOString()}
                        className="copy-cal-day-btn"
                        onClick={() => { copyRoutineToDate(date, true); setShowCopyOptions(false); }}
                      >
                        <span className="cal-day-name">{format(date, 'EEE')}</span>
                        <span className="cal-day-date">{format(date, 'd')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="copy-option-group">
                  <h4>Copy Entire Week (Variant {selectedWeek}):</h4>
                  <button className="copy-week-btn" onClick={() => copyWeekRoutineToCalendar(true)} style={{ background: headerGradient }}>
                    <Calendar size={18} />
                    Copy All {type === 'morning' ? 'Morning' : 'Nighttime'} Routines for Week {selectedWeek}
                  </button>
                  <p className="copy-hint">
                    Copies all saved {type} routines from Week {selectedWeek} (Sun-Sat) to this week's calendar with notifications.
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
              <button className="action-btn secondary" onClick={() => {
                if (routines && routines[routineKey]) {
                  setRoutineItems(routines[routineKey].items || []);
                  setStartTime(routines[routineKey].startTime || defaultTime);
                }
                setIsEditing(false);
              }}>
                Cancel
              </button>
              <button className="action-btn primary" onClick={handleSave} style={{ background: headerGradient }}>
                <Save size={18} />
                Save Routine
              </button>
            </>
          ) : (
            <>
              <button className="action-btn secondary" onClick={() => setIsEditing(true)}>
                Edit Routine
              </button>
              {routineItems.length > 0 && (
                <button className="action-btn primary" onClick={handleStartRoutine} style={{ background: headerGradient }}>
                  <Play size={18} />
                  <Bell size={14} />
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
