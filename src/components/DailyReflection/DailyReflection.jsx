import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Sun,
  Moon,
  Star,
  Heart,
  TrendingUp,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Save,
  Sparkles,
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import './DailyReflection.css';

const moodOptions = [
  { value: 1, emoji: '😫', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Meh' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

export default function DailyReflection() {
  const {
    showReflection,
    setShowReflection,
    reflections,
    addReflection,
    updateReflection,
    tasks,
    goals,
  } = useApp();

  const [step, setStep] = useState(1);
  const [reflection, setReflection] = useState({
    date: new Date().toISOString(),
    mood: 3,
    rating: 7,
    gratitude: '',
    wins: '',
    improvements: '',
    tomorrowFocus: '',
  });

  // Check if today's reflection already exists
  const todayReflection = reflections?.find((r) =>
    isToday(parseISO(r.date))
  );

  useEffect(() => {
    if (todayReflection) {
      setReflection(todayReflection);
    }
  }, [todayReflection]);

  // Calculate daily stats
  const todayTasks = tasks.filter((t) => {
    if (!t.scheduledDate) return false;
    return isToday(parseISO(t.scheduledDate));
  });
  const completedToday = todayTasks.filter((t) => t.completed).length;
  const totalToday = todayTasks.length;
  const completionRate = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  // Get habits completed today
  const habitsToday = todayTasks.filter((t) => t.type === 'habit');
  const habitsCompleted = habitsToday.filter((t) => t.completed).length;

  if (!showReflection) return null;

  const handleClose = () => {
    setShowReflection(false);
    setStep(1);
  };

  const handleSave = () => {
    if (todayReflection) {
      updateReflection(todayReflection.id, reflection);
    } else {
      addReflection(reflection);
    }
    handleClose();
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, 4));
  const prevStep = () => setStep((s) => Math.max(s - 1, 1));

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="reflection-step">
            <div className="step-header">
              <Moon size={24} className="step-icon" />
              <h3>How was your day?</h3>
              <p>Take a moment to reflect on today</p>
            </div>

            {/* Daily Summary */}
            <div className="daily-summary">
              <div className="summary-stat">
                <span className="stat-number">{completedToday}</span>
                <span className="stat-label">Tasks Done</span>
              </div>
              <div className="summary-stat">
                <span className="stat-number">{completionRate}%</span>
                <span className="stat-label">Completion</span>
              </div>
              <div className="summary-stat">
                <span className="stat-number">{habitsCompleted}/{habitsToday.length}</span>
                <span className="stat-label">Habits</span>
              </div>
            </div>

            {/* Mood Selector */}
            <div className="mood-section">
              <label>How are you feeling?</label>
              <div className="mood-options">
                {moodOptions.map((option) => (
                  <button
                    key={option.value}
                    className={`mood-btn ${reflection.mood === option.value ? 'selected' : ''}`}
                    onClick={() => setReflection({ ...reflection, mood: option.value })}
                  >
                    <span className="mood-emoji">{option.emoji}</span>
                    <span className="mood-label">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Day Rating */}
            <div className="rating-section">
              <label>Rate your day (1-10)</label>
              <div className="rating-slider">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={reflection.rating}
                  onChange={(e) => setReflection({ ...reflection, rating: parseInt(e.target.value) })}
                />
                <div className="rating-value">
                  <span className="rating-number">{reflection.rating}</span>
                  <span className="rating-max">/10</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="reflection-step">
            <div className="step-header">
              <Heart size={24} className="step-icon gratitude" />
              <h3>Gratitude</h3>
              <p>What are you grateful for today?</p>
            </div>

            <div className="text-input-section">
              <textarea
                placeholder="I'm grateful for..."
                value={reflection.gratitude}
                onChange={(e) => setReflection({ ...reflection, gratitude: e.target.value })}
                rows={4}
              />
              <div className="input-hint">
                <Sparkles size={14} />
                <span>Gratitude rewires your brain for positivity</span>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="reflection-step">
            <div className="step-header">
              <TrendingUp size={24} className="step-icon wins" />
              <h3>Wins & Growth</h3>
              <p>Celebrate progress, identify opportunities</p>
            </div>

            <div className="text-input-section">
              <label>What went well today? (Wins)</label>
              <textarea
                placeholder="Today I accomplished..."
                value={reflection.wins}
                onChange={(e) => setReflection({ ...reflection, wins: e.target.value })}
                rows={3}
              />
            </div>

            <div className="text-input-section">
              <label>What could be improved?</label>
              <textarea
                placeholder="Next time I could..."
                value={reflection.improvements}
                onChange={(e) => setReflection({ ...reflection, improvements: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="reflection-step">
            <div className="step-header">
              <Sun size={24} className="step-icon tomorrow" />
              <h3>Tomorrow's Focus</h3>
              <p>Set your intention for tomorrow</p>
            </div>

            <div className="text-input-section">
              <label>What's your ONE priority for tomorrow?</label>
              <textarea
                placeholder="Tomorrow, my main focus will be..."
                value={reflection.tomorrowFocus}
                onChange={(e) => setReflection({ ...reflection, tomorrowFocus: e.target.value })}
                rows={3}
              />
              <div className="input-hint">
                <Star size={14} />
                <span>Focus on what matters most</span>
              </div>
            </div>

            {/* Summary Preview */}
            <div className="reflection-preview">
              <h4>Your Reflection</h4>
              <div className="preview-item">
                <span className="preview-label">Mood:</span>
                <span>{moodOptions.find(m => m.value === reflection.mood)?.emoji} {moodOptions.find(m => m.value === reflection.mood)?.label}</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Day Rating:</span>
                <span>{reflection.rating}/10</span>
              </div>
              {reflection.gratitude && (
                <div className="preview-item">
                  <span className="preview-label">Grateful for:</span>
                  <span>{reflection.gratitude.slice(0, 50)}{reflection.gratitude.length > 50 ? '...' : ''}</span>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="reflection-overlay" onClick={handleClose}>
      <div className="reflection-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="reflection-header">
          <div className="reflection-date">
            <Moon size={18} />
            <span>Evening Reflection</span>
            <span className="date-text">{format(new Date(), 'EEEE, MMMM d')}</span>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="step-progress">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`step-dot ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}
              onClick={() => setStep(s)}
            />
          ))}
        </div>

        {/* Content */}
        <div className="reflection-content">
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="reflection-nav">
          {step > 1 ? (
            <button className="nav-btn prev" onClick={prevStep}>
              <ChevronLeft size={18} />
              Back
            </button>
          ) : (
            <button className="nav-btn skip" onClick={handleClose}>
              Skip
            </button>
          )}

          {step < 4 ? (
            <button className="nav-btn next" onClick={nextStep}>
              Next
              <ChevronRight size={18} />
            </button>
          ) : (
            <button className="nav-btn save" onClick={handleSave}>
              <Save size={18} />
              Save Reflection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
