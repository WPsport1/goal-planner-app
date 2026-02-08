import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  BookOpen,
  Plus,
  Calendar,
  Clock,
  Smile,
  Meh,
  Frown,
  Heart,
  Zap,
  Brain,
  Target,
  Sun,
  Moon,
  Cloud,
  CloudRain,
  Sparkles,
  Tag,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Trash2,
  Save,
  Image,
  Mic,
  MoreVertical,
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, subMonths, addMonths } from 'date-fns';
import './Journal.css';

const moodOptions = [
  { value: 5, label: 'Amazing', icon: Sparkles, color: '#22c55e' },
  { value: 4, label: 'Good', icon: Smile, color: '#84cc16' },
  { value: 3, label: 'Okay', icon: Meh, color: '#f59e0b' },
  { value: 2, label: 'Low', icon: Frown, color: '#f97316' },
  { value: 1, label: 'Rough', icon: CloudRain, color: '#ef4444' },
];

const energyOptions = [
  { value: 5, label: 'Energized', icon: Zap },
  { value: 4, label: 'Good', icon: Sun },
  { value: 3, label: 'Normal', icon: Cloud },
  { value: 2, label: 'Tired', icon: Moon },
  { value: 1, label: 'Exhausted', icon: CloudRain },
];

const promptSuggestions = [
  "What am I grateful for today?",
  "What's one thing I learned today?",
  "What challenged me today?",
  "What made me smile today?",
  "How did I grow today?",
  "What's on my mind right now?",
  "What do I want to remember about today?",
  "How am I feeling about my goals?",
];

const tagOptions = [
  'gratitude', 'reflection', 'goals', 'learning', 'health',
  'relationships', 'work', 'creativity', 'mindfulness', 'challenges'
];

export default function Journal() {
  const { showJournal, setShowJournal } = useApp();

  const [entries, setEntries] = useState([]);
  const [activeView, setActiveView] = useState('write'); // write, entries, calendar
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTag, setFilterTag] = useState('all');
  const [editingEntry, setEditingEntry] = useState(null);

  // New entry form state
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    mood: 4,
    energy: 3,
    tags: [],
    gratitude: ['', '', ''],
    date: format(new Date(), 'yyyy-MM-dd'),
    time: format(new Date(), 'HH:mm'),
  });

  // Load entries from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('journalEntries');
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  // Save entries to localStorage
  const saveEntries = (updatedEntries) => {
    setEntries(updatedEntries);
    localStorage.setItem('journalEntries', JSON.stringify(updatedEntries));
  };

  if (!showJournal) return null;

  const handleClose = () => {
    setShowJournal(false);
    setEditingEntry(null);
  };

  const handleSaveEntry = () => {
    if (!newEntry.content.trim() && !newEntry.title.trim()) return;

    const entry = {
      id: editingEntry?.id || Date.now().toString(),
      ...newEntry,
      gratitude: newEntry.gratitude.filter(g => g.trim()),
      createdAt: editingEntry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updated;
    if (editingEntry) {
      updated = entries.map(e => e.id === editingEntry.id ? entry : e);
    } else {
      updated = [entry, ...entries];
    }

    saveEntries(updated);
    resetForm();
    setActiveView('entries');
  };

  const handleDeleteEntry = (id) => {
    if (confirm('Delete this journal entry?')) {
      const updated = entries.filter(e => e.id !== id);
      saveEntries(updated);
    }
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setNewEntry({
      title: entry.title || '',
      content: entry.content || '',
      mood: entry.mood || 4,
      energy: entry.energy || 3,
      tags: entry.tags || [],
      gratitude: entry.gratitude?.length ? [...entry.gratitude, '', ''].slice(0, 3) : ['', '', ''],
      date: entry.date || format(new Date(), 'yyyy-MM-dd'),
      time: entry.time || format(new Date(), 'HH:mm'),
    });
    setActiveView('write');
  };

  const resetForm = () => {
    setNewEntry({
      title: '',
      content: '',
      mood: 4,
      energy: 3,
      tags: [],
      gratitude: ['', '', ''],
      date: format(new Date(), 'yyyy-MM-dd'),
      time: format(new Date(), 'HH:mm'),
    });
    setEditingEntry(null);
  };

  const toggleTag = (tag) => {
    setNewEntry(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const updateGratitude = (index, value) => {
    setNewEntry(prev => {
      const updated = [...prev.gratitude];
      updated[index] = value;
      return { ...prev, gratitude: updated };
    });
  };

  const usePrompt = (prompt) => {
    setNewEntry(prev => ({
      ...prev,
      content: prev.content ? `${prev.content}\n\n${prompt}\n` : `${prompt}\n`
    }));
  };

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.content?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = filterTag === 'all' || entry.tags?.includes(filterTag);
    return matchesSearch && matchesTag;
  });

  // Get entries for selected date
  const entriesForDate = (date) => {
    return entries.filter(entry =>
      entry.date === format(date, 'yyyy-MM-dd')
    );
  };

  // Calendar days
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get mood color for a date
  const getMoodForDate = (date) => {
    const dayEntries = entriesForDate(date);
    if (dayEntries.length === 0) return null;
    const avgMood = dayEntries.reduce((sum, e) => sum + (e.mood || 3), 0) / dayEntries.length;
    return moodOptions.find(m => m.value === Math.round(avgMood))?.color || '#6b7280';
  };

  const renderMoodSelector = () => (
    <div className="mood-selector">
      <label>How are you feeling?</label>
      <div className="mood-options">
        {moodOptions.map(mood => {
          const Icon = mood.icon;
          return (
            <button
              key={mood.value}
              className={`mood-btn ${newEntry.mood === mood.value ? 'selected' : ''}`}
              onClick={() => setNewEntry({ ...newEntry, mood: mood.value })}
              style={{ '--mood-color': mood.color }}
            >
              <Icon size={24} />
              <span>{mood.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderEnergySelector = () => (
    <div className="energy-selector">
      <label>Energy level</label>
      <div className="energy-options">
        {energyOptions.map(energy => {
          const Icon = energy.icon;
          return (
            <button
              key={energy.value}
              className={`energy-btn ${newEntry.energy === energy.value ? 'selected' : ''}`}
              onClick={() => setNewEntry({ ...newEntry, energy: energy.value })}
            >
              <Icon size={18} />
              <span>{energy.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="journal-overlay" onClick={handleClose}>
      <div className="journal-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="journal-header">
          <div className="header-title">
            <BookOpen size={24} />
            <h2>Journal</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="journal-tabs">
          <button
            className={`tab-btn ${activeView === 'write' ? 'active' : ''}`}
            onClick={() => { setActiveView('write'); resetForm(); }}
          >
            <Edit3 size={16} />
            Write
          </button>
          <button
            className={`tab-btn ${activeView === 'entries' ? 'active' : ''}`}
            onClick={() => setActiveView('entries')}
          >
            <BookOpen size={16} />
            Entries ({entries.length})
          </button>
          <button
            className={`tab-btn ${activeView === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveView('calendar')}
          >
            <Calendar size={16} />
            Calendar
          </button>
        </div>

        {/* Content */}
        <div className="journal-content">
          {/* Write View */}
          {activeView === 'write' && (
            <div className="write-view">
              {/* Date and Time */}
              <div className="entry-datetime">
                <div className="datetime-input">
                  <Calendar size={16} />
                  <input
                    type="date"
                    value={newEntry.date}
                    onChange={(e) => setNewEntry({ ...newEntry, date: e.target.value })}
                  />
                </div>
                <div className="datetime-input">
                  <Clock size={16} />
                  <input
                    type="time"
                    value={newEntry.time}
                    onChange={(e) => setNewEntry({ ...newEntry, time: e.target.value })}
                  />
                </div>
              </div>

              {/* Mood and Energy */}
              <div className="mood-energy-section">
                {renderMoodSelector()}
                {renderEnergySelector()}
              </div>

              {/* Title */}
              <input
                type="text"
                className="entry-title-input"
                placeholder="Entry title (optional)"
                value={newEntry.title}
                onChange={(e) => setNewEntry({ ...newEntry, title: e.target.value })}
              />

              {/* Writing Prompts */}
              <div className="prompts-section">
                <label>Need inspiration?</label>
                <div className="prompts-list">
                  {promptSuggestions.slice(0, 4).map((prompt, idx) => (
                    <button
                      key={idx}
                      className="prompt-btn"
                      onClick={() => usePrompt(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Main Content */}
              <textarea
                className="entry-content-input"
                placeholder="What's on your mind today?"
                value={newEntry.content}
                onChange={(e) => setNewEntry({ ...newEntry, content: e.target.value })}
                rows={8}
              />

              {/* Gratitude Section */}
              <div className="gratitude-section">
                <label>
                  <Heart size={16} />
                  Today I'm grateful for...
                </label>
                <div className="gratitude-inputs">
                  {newEntry.gratitude.map((item, idx) => (
                    <input
                      key={idx}
                      type="text"
                      placeholder={`${idx + 1}. `}
                      value={item}
                      onChange={(e) => updateGratitude(idx, e.target.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div className="tags-section">
                <label>
                  <Tag size={16} />
                  Tags
                </label>
                <div className="tags-list">
                  {tagOptions.map(tag => (
                    <button
                      key={tag}
                      className={`tag-btn ${newEntry.tags.includes(tag) ? 'selected' : ''}`}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Button */}
              <div className="write-actions">
                {editingEntry && (
                  <button className="cancel-btn" onClick={resetForm}>
                    Cancel Edit
                  </button>
                )}
                <button className="save-entry-btn" onClick={handleSaveEntry}>
                  <Save size={18} />
                  {editingEntry ? 'Update Entry' : 'Save Entry'}
                </button>
              </div>
            </div>
          )}

          {/* Entries View */}
          {activeView === 'entries' && (
            <div className="entries-view">
              {/* Search and Filter */}
              <div className="entries-controls">
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Search entries..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div className="filter-box">
                  <Filter size={16} />
                  <select
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                  >
                    <option value="all">All Tags</option>
                    {tagOptions.map(tag => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Entries List */}
              {filteredEntries.length === 0 ? (
                <div className="empty-entries">
                  <BookOpen size={48} />
                  <h3>No entries yet</h3>
                  <p>Start writing to capture your thoughts and reflections</p>
                  <button onClick={() => setActiveView('write')}>
                    <Plus size={16} />
                    Write First Entry
                  </button>
                </div>
              ) : (
                <div className="entries-list">
                  {filteredEntries.map(entry => {
                    const MoodIcon = moodOptions.find(m => m.value === entry.mood)?.icon || Meh;
                    const moodColor = moodOptions.find(m => m.value === entry.mood)?.color || '#6b7280';

                    return (
                      <div key={entry.id} className="entry-card">
                        <div className="entry-card-header">
                          <div className="entry-date">
                            <Calendar size={14} />
                            {format(parseISO(entry.date), 'MMM d, yyyy')}
                            <span className="entry-time">{entry.time}</span>
                          </div>
                          <div className="entry-mood" style={{ color: moodColor }}>
                            <MoodIcon size={18} />
                          </div>
                        </div>

                        {entry.title && (
                          <h3 className="entry-card-title">{entry.title}</h3>
                        )}

                        <p className="entry-card-content">
                          {entry.content?.substring(0, 200)}
                          {entry.content?.length > 200 && '...'}
                        </p>

                        {entry.gratitude?.length > 0 && entry.gratitude[0] && (
                          <div className="entry-gratitude-preview">
                            <Heart size={12} />
                            {entry.gratitude.filter(g => g).join(', ')}
                          </div>
                        )}

                        {entry.tags?.length > 0 && (
                          <div className="entry-tags">
                            {entry.tags.map(tag => (
                              <span key={tag} className="entry-tag">{tag}</span>
                            ))}
                          </div>
                        )}

                        <div className="entry-card-actions">
                          <button onClick={() => handleEditEntry(entry)}>
                            <Edit3 size={14} />
                            Edit
                          </button>
                          <button onClick={() => handleDeleteEntry(entry.id)}>
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Calendar View */}
          {activeView === 'calendar' && (
            <div className="calendar-view">
              {/* Month Navigation */}
              <div className="calendar-nav">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft size={20} />
                </button>
                <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight size={20} />
                </button>
              </div>

              {/* Calendar Grid */}
              <div className="calendar-grid">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="calendar-header-cell">{day}</div>
                ))}

                {/* Empty cells for days before month start */}
                {Array.from({ length: monthStart.getDay() }).map((_, idx) => (
                  <div key={`empty-${idx}`} className="calendar-cell empty" />
                ))}

                {/* Calendar days */}
                {calendarDays.map(day => {
                  const dayEntries = entriesForDate(day);
                  const moodColor = getMoodForDate(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const isToday = isSameDay(day, new Date());

                  return (
                    <div
                      key={day.toISOString()}
                      className={`calendar-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${dayEntries.length > 0 ? 'has-entry' : ''}`}
                      onClick={() => setSelectedDate(day)}
                      style={moodColor ? { '--day-mood-color': moodColor } : {}}
                    >
                      <span className="day-number">{format(day, 'd')}</span>
                      {dayEntries.length > 0 && (
                        <span className="entry-indicator" style={{ background: moodColor }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Selected Date Entries */}
              <div className="selected-date-entries">
                <h4>
                  <Calendar size={16} />
                  {format(selectedDate, 'EEEE, MMMM d, yyyy')}
                </h4>

                {entriesForDate(selectedDate).length === 0 ? (
                  <div className="no-entries-day">
                    <p>No entries for this day</p>
                    <button onClick={() => {
                      setNewEntry(prev => ({ ...prev, date: format(selectedDate, 'yyyy-MM-dd') }));
                      setActiveView('write');
                    }}>
                      <Plus size={14} />
                      Add Entry
                    </button>
                  </div>
                ) : (
                  entriesForDate(selectedDate).map(entry => (
                    <div key={entry.id} className="day-entry-preview" onClick={() => handleEditEntry(entry)}>
                      <div className="entry-time-badge">{entry.time}</div>
                      <div className="entry-preview-content">
                        <h5>{entry.title || 'Untitled Entry'}</h5>
                        <p>{entry.content?.substring(0, 100)}...</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
