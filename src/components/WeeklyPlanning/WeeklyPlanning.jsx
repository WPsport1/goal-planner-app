import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Calendar,
  Target,
  CheckCircle2,
  Circle,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Brain,
  ListTodo,
  Clock,
  Star,
  Zap,
  Heart,
  Trophy,
  ChevronRight,
  Plus,
  Check,
  AlertCircle,
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, addDays, isSameDay } from 'date-fns';
import './WeeklyPlanning.css';

const STEPS = [
  { id: 'reflect', title: 'Reflect', icon: Brain, description: 'Review last week' },
  { id: 'priorities', title: 'Priorities', icon: Star, description: 'Set focus areas' },
  { id: 'goals', title: 'Goals', icon: Target, description: 'Weekly goals' },
  { id: 'schedule', title: 'Schedule', icon: Calendar, description: 'Plan your days' },
  { id: 'complete', title: 'Complete', icon: Trophy, description: 'Ready to go!' },
];

const reflectionQuestions = [
  { id: 'wins', question: "What were your biggest wins last week?", placeholder: "List your accomplishments..." },
  { id: 'challenges', question: "What challenges did you face?", placeholder: "What was difficult..." },
  { id: 'lessons', question: "What did you learn?", placeholder: "Key takeaways..." },
  { id: 'gratitude', question: "What are you grateful for?", placeholder: "Things you appreciate..." },
];

const priorityAreas = [
  { id: 'health', name: 'Health & Fitness', icon: Heart, color: '#22c55e' },
  { id: 'work', name: 'Work & Career', icon: Zap, color: '#3b82f6' },
  { id: 'relationships', name: 'Relationships', icon: Heart, color: '#ec4899' },
  { id: 'growth', name: 'Personal Growth', icon: Brain, color: '#8b5cf6' },
  { id: 'finance', name: 'Finance', icon: Star, color: '#f59e0b' },
  { id: 'fun', name: 'Fun & Recreation', icon: Sparkles, color: '#06b6d4' },
];

export default function WeeklyPlanning() {
  const { showWeeklyPlanning, setShowWeeklyPlanning, goals, tasks, addTask } = useApp();

  const [currentStep, setCurrentStep] = useState(0);
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [weekEnd, setWeekEnd] = useState(endOfWeek(new Date(), { weekStartsOn: 1 }));

  // Step data
  const [reflections, setReflections] = useState({
    wins: '',
    challenges: '',
    lessons: '',
    gratitude: '',
  });
  const [selectedPriorities, setSelectedPriorities] = useState([]);
  const [weeklyGoals, setWeeklyGoals] = useState([
    { id: '1', text: '', completed: false },
    { id: '2', text: '', completed: false },
    { id: '3', text: '', completed: false },
  ]);
  const [dailyPlan, setDailyPlan] = useState({});
  const [newDailyTask, setNewDailyTask] = useState({});

  // Load saved planning data
  useEffect(() => {
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const saved = localStorage.getItem(`weeklyPlan_${weekKey}`);
    if (saved) {
      const data = JSON.parse(saved);
      setReflections(data.reflections || {});
      setSelectedPriorities(data.priorities || []);
      setWeeklyGoals(data.weeklyGoals || []);
      setDailyPlan(data.dailyPlan || {});
    }
  }, [weekStart]);

  if (!showWeeklyPlanning) return null;

  const handleClose = () => {
    setShowWeeklyPlanning(false);
    setCurrentStep(0);
  };

  const savePlanData = () => {
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const data = {
      reflections,
      priorities: selectedPriorities,
      weeklyGoals,
      dailyPlan,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`weeklyPlan_${weekKey}`, JSON.stringify(data));
  };

  const nextStep = () => {
    savePlanData();
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const togglePriority = (id) => {
    setSelectedPriorities(prev =>
      prev.includes(id)
        ? prev.filter(p => p !== id)
        : prev.length < 3 ? [...prev, id] : prev
    );
  };

  const updateWeeklyGoal = (id, text) => {
    setWeeklyGoals(prev =>
      prev.map(g => g.id === id ? { ...g, text } : g)
    );
  };

  const addWeeklyGoal = () => {
    setWeeklyGoals(prev => [
      ...prev,
      { id: Date.now().toString(), text: '', completed: false }
    ]);
  };

  const removeWeeklyGoal = (id) => {
    setWeeklyGoals(prev => prev.filter(g => g.id !== id));
  };

  const getDayTasks = (date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    return dailyPlan[dateKey] || [];
  };

  const addDayTask = (date, task) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setDailyPlan(prev => ({
      ...prev,
      [dateKey]: [...(prev[dateKey] || []), { id: Date.now().toString(), text: task, completed: false }]
    }));
    setNewDailyTask(prev => ({ ...prev, [dateKey]: '' }));
  };

  const toggleDayTask = (date, taskId) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setDailyPlan(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      )
    }));
  };

  const removeDayTask = (date, taskId) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setDailyPlan(prev => ({
      ...prev,
      [dateKey]: prev[dateKey].filter(t => t.id !== taskId)
    }));
  };

  const finishPlanning = () => {
    savePlanData();

    // Create actual tasks from daily plan
    Object.entries(dailyPlan).forEach(([dateKey, dayTasks]) => {
      dayTasks.forEach(task => {
        if (task.text && !task.addedToApp) {
          addTask({
            title: task.text,
            description: '',
            type: 'task',
            priority: 'medium',
            scheduledDate: new Date(dateKey).toISOString(),
            startTime: '09:00',
            endTime: '09:30',
            recurrence: 'none',
            linkedGoalId: '',
            fromWeeklyPlan: true,
          });
        }
      });
    });

    handleClose();
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const renderStepContent = () => {
    switch (STEPS[currentStep].id) {
      case 'reflect':
        return (
          <div className="step-content reflect-step">
            <div className="step-intro">
              <h3>Reflect on Last Week</h3>
              <p>Taking a moment to reflect helps you learn and grow. Answer these questions honestly.</p>
            </div>

            <div className="reflection-questions">
              {reflectionQuestions.map(q => (
                <div key={q.id} className="reflection-question">
                  <label>{q.question}</label>
                  <textarea
                    placeholder={q.placeholder}
                    value={reflections[q.id] || ''}
                    onChange={(e) => setReflections(prev => ({ ...prev, [q.id]: e.target.value }))}
                    rows={3}
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'priorities':
        return (
          <div className="step-content priorities-step">
            <div className="step-intro">
              <h3>Choose Your Focus Areas</h3>
              <p>Select up to 3 areas to focus on this week. Less is more!</p>
            </div>

            <div className="priority-grid">
              {priorityAreas.map(area => {
                const Icon = area.icon;
                const isSelected = selectedPriorities.includes(area.id);
                return (
                  <button
                    key={area.id}
                    className={`priority-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => togglePriority(area.id)}
                    style={{ '--priority-color': area.color }}
                  >
                    <Icon size={24} />
                    <span>{area.name}</span>
                    {isSelected && <Check size={16} className="check-icon" />}
                  </button>
                );
              })}
            </div>

            <div className="priority-count">
              {selectedPriorities.length}/3 areas selected
            </div>
          </div>
        );

      case 'goals':
        return (
          <div className="step-content goals-step">
            <div className="step-intro">
              <h3>Set Your Weekly Goals</h3>
              <p>What do you want to accomplish this week? Be specific and realistic.</p>
            </div>

            <div className="weekly-goals-list">
              {weeklyGoals.map((goal, idx) => (
                <div key={goal.id} className="weekly-goal-input">
                  <span className="goal-number">{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`Goal ${idx + 1}...`}
                    value={goal.text}
                    onChange={(e) => updateWeeklyGoal(goal.id, e.target.value)}
                  />
                  {weeklyGoals.length > 1 && (
                    <button
                      className="remove-goal-btn"
                      onClick={() => removeWeeklyGoal(goal.id)}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}

              {weeklyGoals.length < 5 && (
                <button className="add-goal-btn" onClick={addWeeklyGoal}>
                  <Plus size={16} />
                  Add Another Goal
                </button>
              )}
            </div>

            {/* Link to existing goals */}
            {goals.length > 0 && (
              <div className="existing-goals">
                <h4>Your Active Goals</h4>
                <p className="hint">Consider these when planning your week:</p>
                <div className="goals-preview">
                  {goals.slice(0, 3).map(goal => (
                    <div key={goal.id} className="goal-preview-item">
                      <Target size={14} />
                      <span>{goal.title}</span>
                      <span className="goal-progress">{goal.progress || 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'schedule':
        return (
          <div className="step-content schedule-step">
            <div className="step-intro">
              <h3>Plan Your Days</h3>
              <p>Break down your weekly goals into daily tasks. What will you do each day?</p>
            </div>

            <div className="week-days-grid">
              {weekDays.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayTasks = getDayTasks(day);
                const isToday = isSameDay(day, new Date());

                return (
                  <div key={dateKey} className={`day-column ${isToday ? 'today' : ''}`}>
                    <div className="day-header">
                      <span className="day-name">{format(day, 'EEE')}</span>
                      <span className="day-date">{format(day, 'MMM d')}</span>
                    </div>

                    <div className="day-tasks">
                      {dayTasks.map(task => (
                        <div key={task.id} className={`day-task ${task.completed ? 'completed' : ''}`}>
                          <button onClick={() => toggleDayTask(day, task.id)}>
                            {task.completed ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                          </button>
                          <span>{task.text}</span>
                          <button
                            className="remove-task"
                            onClick={() => removeDayTask(day, task.id)}
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}

                      <div className="add-day-task">
                        <input
                          type="text"
                          placeholder="Add task..."
                          value={newDailyTask[dateKey] || ''}
                          onChange={(e) => setNewDailyTask(prev => ({ ...prev, [dateKey]: e.target.value }))}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && newDailyTask[dateKey]?.trim()) {
                              addDayTask(day, newDailyTask[dateKey]);
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            if (newDailyTask[dateKey]?.trim()) {
                              addDayTask(day, newDailyTask[dateKey]);
                            }
                          }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className="step-content complete-step">
            <div className="complete-celebration">
              <div className="trophy-icon">
                <Trophy size={64} />
              </div>
              <h3>You're All Set!</h3>
              <p>Your week is planned and ready. Here's your summary:</p>
            </div>

            <div className="planning-summary">
              <div className="summary-section">
                <h4>
                  <Star size={16} />
                  Focus Areas
                </h4>
                <div className="summary-items">
                  {selectedPriorities.map(id => {
                    const area = priorityAreas.find(a => a.id === id);
                    if (!area) return null;
                    const Icon = area.icon;
                    return (
                      <span key={id} className="summary-tag" style={{ color: area.color }}>
                        <Icon size={14} />
                        {area.name}
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="summary-section">
                <h4>
                  <Target size={16} />
                  Weekly Goals ({weeklyGoals.filter(g => g.text).length})
                </h4>
                <ul className="summary-goals">
                  {weeklyGoals.filter(g => g.text).map(goal => (
                    <li key={goal.id}>{goal.text}</li>
                  ))}
                </ul>
              </div>

              <div className="summary-section">
                <h4>
                  <ListTodo size={16} />
                  Planned Tasks
                </h4>
                <div className="tasks-summary">
                  {Object.entries(dailyPlan).reduce((total, [, tasks]) => total + tasks.length, 0)} tasks across {Object.keys(dailyPlan).filter(k => dailyPlan[k].length > 0).length} days
                </div>
              </div>
            </div>

            <div className="completion-actions">
              <button className="finish-btn" onClick={finishPlanning}>
                <Sparkles size={18} />
                Start My Week
              </button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="weekly-planning-overlay" onClick={handleClose}>
      <div className="weekly-planning-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="planning-header">
          <div className="header-title">
            <Calendar size={24} />
            <div>
              <h2>Weekly Planning</h2>
              <span className="week-range">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </span>
            </div>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="planning-steps">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;

            return (
              <div
                key={step.id}
                className={`step-indicator ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
              >
                <div className="step-icon">
                  {isCompleted ? <Check size={16} /> : <Icon size={16} />}
                </div>
                <span className="step-title">{step.title}</span>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="planning-content">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="planning-navigation">
          <button
            className="nav-btn prev"
            onClick={prevStep}
            disabled={currentStep === 0}
          >
            <ArrowLeft size={18} />
            Back
          </button>

          {currentStep < STEPS.length - 1 ? (
            <button className="nav-btn next" onClick={nextStep}>
              Continue
              <ArrowRight size={18} />
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
