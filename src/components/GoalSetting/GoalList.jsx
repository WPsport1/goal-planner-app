import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Plus,
  GripVertical,
  ChevronRight,
  Target,
  Trash2,
  Edit3,
  Filter,
  SortAsc,
  SortDesc,
  Search,
} from 'lucide-react';
import './GoalList.css';

const priorityColors = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#22c55e',
};

const statusLabels = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed: 'Completed',
  on_hold: 'On Hold',
};

export default function GoalList() {
  const { goals, addGoal, deleteGoal, openDetail, reorderGoals } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('priority'); // priority, date, progress, name
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    description: '',
    category: 'Personal Development',
    priority: 'medium',
    targetDate: '',
  });
  const [draggedItem, setDraggedItem] = useState(null);

  // Get unique categories from goals
  const categories = ['all', ...new Set(goals.map((g) => g.category))];
  const statuses = ['all', 'not_started', 'in_progress', 'completed', 'on_hold'];

  // Filter and sort goals
  const filteredGoals = goals
    .filter((goal) => {
      const matchesSearch =
        goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        filterCategory === 'all' || goal.category === filterCategory;
      const matchesStatus =
        filterStatus === 'all' || goal.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
          break;
        case 'date':
          comparison = new Date(a.targetDate) - new Date(b.targetDate);
          break;
        case 'progress':
          comparison = b.progress - a.progress;
          break;
        case 'name':
          comparison = a.title.localeCompare(b.title);
          break;
        default:
          comparison = 0;
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newGoal.title.trim()) return;

    addGoal({
      ...newGoal,
      status: 'not_started',
      targetDate: newGoal.targetDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    });

    setNewGoal({
      title: '',
      description: '',
      category: 'Personal Development',
      priority: 'medium',
      targetDate: '',
    });
    setShowAddForm(false);
  };

  // Drag and drop handlers
  const handleDragStart = (e, goal) => {
    setDraggedItem(goal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, goal) => {
    e.preventDefault();
    if (draggedItem && draggedItem.id !== goal.id) {
      const newGoals = [...goals];
      const draggedIndex = newGoals.findIndex((g) => g.id === draggedItem.id);
      const targetIndex = newGoals.findIndex((g) => g.id === goal.id);
      newGoals.splice(draggedIndex, 1);
      newGoals.splice(targetIndex, 0, draggedItem);
      reorderGoals(newGoals);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const toggleSortOrder = () => {
    setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  };

  return (
    <div className="goal-list">
      {/* Search and Controls */}
      <div className="goal-list-controls">
        <div className="search-bar">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search goals..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="control-row">
          <div className="filter-group">
            <Filter size={14} />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All Categories' : cat}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Status' : statusLabels[status]}
                </option>
              ))}
            </select>
          </div>

          <div className="sort-group">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="priority">Priority</option>
              <option value="date">Target Date</option>
              <option value="progress">Progress</option>
              <option value="name">Name</option>
            </select>
            <button className="sort-order-btn" onClick={toggleSortOrder}>
              {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Add Goal Button/Form */}
      {showAddForm ? (
        <form className="add-goal-form" onSubmit={handleAddGoal}>
          <input
            type="text"
            placeholder="Goal title..."
            value={newGoal.title}
            onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={newGoal.description}
            onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
          />
          <div className="form-row">
            <select
              value={newGoal.category}
              onChange={(e) => setNewGoal({ ...newGoal, category: e.target.value })}
            >
              <option value="Personal Development">Personal Development</option>
              <option value="Career">Career</option>
              <option value="Health & Fitness">Health & Fitness</option>
              <option value="Finance">Finance</option>
              <option value="Relationships">Relationships</option>
              <option value="Education">Education</option>
              <option value="Other">Other</option>
            </select>
            <select
              value={newGoal.priority}
              onChange={(e) => setNewGoal({ ...newGoal, priority: e.target.value })}
            >
              <option value="high">High Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="low">Low Priority</option>
            </select>
          </div>
          <div className="form-row">
            <input
              type="date"
              value={newGoal.targetDate}
              onChange={(e) => setNewGoal({ ...newGoal, targetDate: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
            <button type="submit" className="primary">
              Add Goal
            </button>
          </div>
        </form>
      ) : (
        <button className="add-goal-btn" onClick={() => setShowAddForm(true)}>
          <Plus size={18} />
          <span>Add New Goal</span>
        </button>
      )}

      {/* Goals List */}
      <div className="goals-container">
        {filteredGoals.length === 0 ? (
          <div className="empty-state">
            <Target size={48} />
            <p>No goals found</p>
            <span>Add your first goal to get started</span>
          </div>
        ) : (
          filteredGoals.map((goal) => (
            <div
              key={goal.id}
              className={`goal-card ${draggedItem?.id === goal.id ? 'dragging' : ''}`}
              draggable
              onDragStart={(e) => handleDragStart(e, goal)}
              onDragOver={(e) => handleDragOver(e, goal)}
              onDragEnd={handleDragEnd}
            >
              <div className="goal-drag-handle">
                <GripVertical size={16} />
              </div>

              <div
                className="goal-priority-indicator"
                style={{ backgroundColor: priorityColors[goal.priority] }}
              />

              <div className="goal-content" onClick={() => openDetail(goal)}>
                <div className="goal-header">
                  <h3>{goal.title}</h3>
                  <span className={`goal-status status-${goal.status}`}>
                    {statusLabels[goal.status]}
                  </span>
                </div>

                {goal.description && (
                  <p className="goal-description">{goal.description}</p>
                )}

                <div className="goal-meta">
                  <span className="goal-category">{goal.category}</span>
                  <span className="goal-date">
                    Target: {new Date(goal.targetDate).toLocaleDateString()}
                  </span>
                </div>

                <div className="goal-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="progress-text">{goal.progress}%</span>
                </div>
              </div>

              <div className="goal-actions">
                <button
                  className="action-btn edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    openDetail(goal);
                  }}
                  title="Edit"
                >
                  <Edit3 size={14} />
                </button>
                <button
                  className="action-btn delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('Delete this goal?')) deleteGoal(goal.id);
                  }}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
                <ChevronRight size={16} className="chevron" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
