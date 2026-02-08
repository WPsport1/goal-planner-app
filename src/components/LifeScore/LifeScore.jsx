import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  X,
  Activity,
  Heart,
  Brain,
  Briefcase,
  Users,
  Wallet,
  Sparkles,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Plus,
  Edit3,
  Save,
  RotateCcw,
  Info,
  Calendar,
} from 'lucide-react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { format, subDays } from 'date-fns';
import './LifeScore.css';

const defaultLifeAreas = [
  { id: 'health', name: 'Health & Fitness', icon: Activity, color: '#22c55e', score: 5 },
  { id: 'relationships', name: 'Relationships', icon: Heart, color: '#ec4899', score: 5 },
  { id: 'mindset', name: 'Mindset & Growth', icon: Brain, color: '#8b5cf6', score: 5 },
  { id: 'career', name: 'Career & Work', icon: Briefcase, color: '#3b82f6', score: 5 },
  { id: 'social', name: 'Social & Fun', icon: Users, color: '#f59e0b', score: 5 },
  { id: 'finance', name: 'Finance', icon: Wallet, color: '#10b981', score: 5 },
  { id: 'spirituality', name: 'Spirituality', icon: Sparkles, color: '#a855f7', score: 5 },
  { id: 'purpose', name: 'Purpose & Meaning', icon: Target, color: '#ef4444', score: 5 },
];

export default function LifeScore() {
  const { showLifeScore, setShowLifeScore } = useApp();

  const [lifeAreas, setLifeAreas] = useState(defaultLifeAreas);
  const [scoreHistory, setScoreHistory] = useState([]);
  const [activeView, setActiveView] = useState('overview'); // overview, details, history
  const [selectedArea, setSelectedArea] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [notes, setNotes] = useState({});

  // Load data from localStorage
  useEffect(() => {
    const savedAreas = localStorage.getItem('lifeAreas');
    const savedHistory = localStorage.getItem('lifeScoreHistory');
    const savedNotes = localStorage.getItem('lifeAreaNotes');

    if (savedAreas) setLifeAreas(JSON.parse(savedAreas));
    if (savedHistory) setScoreHistory(JSON.parse(savedHistory));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
  }, []);

  // Save data
  const saveData = (areas = lifeAreas) => {
    localStorage.setItem('lifeAreas', JSON.stringify(areas));
    localStorage.setItem('lifeAreaNotes', JSON.stringify(notes));
  };

  const saveHistory = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayEntry = scoreHistory.find(h => h.date === today);

    const newEntry = {
      date: today,
      scores: lifeAreas.reduce((acc, area) => ({ ...acc, [area.id]: area.score }), {}),
      overall: calculateOverallScore(),
    };

    let updated;
    if (todayEntry) {
      updated = scoreHistory.map(h => h.date === today ? newEntry : h);
    } else {
      updated = [...scoreHistory, newEntry].slice(-90); // Keep last 90 days
    }

    setScoreHistory(updated);
    localStorage.setItem('lifeScoreHistory', JSON.stringify(updated));
  };

  if (!showLifeScore) return null;

  const handleClose = () => {
    setShowLifeScore(false);
    setSelectedArea(null);
    setIsEditing(false);
  };

  const calculateOverallScore = () => {
    const sum = lifeAreas.reduce((acc, area) => acc + area.score, 0);
    return Math.round((sum / lifeAreas.length) * 10) / 10;
  };

  const updateScore = (areaId, newScore) => {
    const updated = lifeAreas.map(area =>
      area.id === areaId ? { ...area, score: newScore } : area
    );
    setLifeAreas(updated);
  };

  const handleSaveScores = () => {
    saveData();
    saveHistory();
    setIsEditing(false);
  };

  const updateNote = (areaId, note) => {
    setNotes(prev => ({ ...prev, [areaId]: note }));
  };

  // Get trend for an area
  const getAreaTrend = (areaId) => {
    if (scoreHistory.length < 2) return 0;
    const recent = scoreHistory.slice(-7);
    if (recent.length < 2) return 0;

    const latest = recent[recent.length - 1].scores[areaId] || 5;
    const previous = recent[0].scores[areaId] || 5;
    return latest - previous;
  };

  // Prepare radar chart data
  const radarData = lifeAreas.map(area => ({
    area: area.name.split(' ')[0],
    score: area.score,
    fullMark: 10,
  }));

  // Prepare history chart data
  const historyChartData = scoreHistory.slice(-30).map(entry => ({
    date: format(new Date(entry.date), 'MMM d'),
    overall: entry.overall,
    ...entry.scores,
  }));

  const overallScore = calculateOverallScore();
  const scoreCategory = overallScore >= 8 ? 'Thriving' :
    overallScore >= 6 ? 'Growing' :
      overallScore >= 4 ? 'Developing' : 'Needs Attention';

  const renderScoreSlider = (area) => {
    const Icon = area.icon;
    const trend = getAreaTrend(area.id);

    return (
      <div key={area.id} className="score-item">
        <div className="score-header">
          <div className="score-label" style={{ color: area.color }}>
            <Icon size={18} />
            <span>{area.name}</span>
          </div>
          <div className="score-value-container">
            {trend !== 0 && (
              <span className={`trend-indicator ${trend > 0 ? 'up' : 'down'}`}>
                {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              </span>
            )}
            <span className="score-value" style={{ color: area.color }}>
              {area.score}/10
            </span>
          </div>
        </div>

        {isEditing ? (
          <div className="score-slider-container">
            <input
              type="range"
              min="1"
              max="10"
              value={area.score}
              onChange={(e) => updateScore(area.id, parseInt(e.target.value))}
              className="score-slider"
              style={{ '--slider-color': area.color }}
            />
            <div className="slider-labels">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        ) : (
          <div className="score-bar-container">
            <div
              className="score-bar"
              style={{
                width: `${area.score * 10}%`,
                background: area.color,
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="lifescore-overlay" onClick={handleClose}>
      <div className="lifescore-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lifescore-header">
          <div className="header-title">
            <Activity size={24} />
            <h2>Life Score Dashboard</h2>
          </div>
          <button className="close-btn" onClick={handleClose}>
            <X size={20} />
          </button>
        </div>

        {/* Overall Score */}
        <div className="overall-score-section">
          <div className="overall-score-card">
            <div className="overall-score-circle">
              <svg viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="var(--border-primary)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#scoreGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${overallScore * 28.27} 282.7`}
                  transform="rotate(-90 50 50)"
                />
                <defs>
                  <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#ec4899" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="score-text">
                <span className="score-number">{overallScore}</span>
                <span className="score-max">/10</span>
              </div>
            </div>
            <div className="score-info">
              <h3>{scoreCategory}</h3>
              <p>Your overall life balance score</p>
              <div className="last-updated">
                <Calendar size={14} />
                Last updated: {scoreHistory.length > 0
                  ? format(new Date(scoreHistory[scoreHistory.length - 1].date), 'MMM d, yyyy')
                  : 'Not yet'}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="lifescore-tabs">
          <button
            className={`tab-btn ${activeView === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveView('overview')}
          >
            <Target size={16} />
            Scores
          </button>
          <button
            className={`tab-btn ${activeView === 'wheel' ? 'active' : ''}`}
            onClick={() => setActiveView('wheel')}
          >
            <Activity size={16} />
            Wheel
          </button>
          <button
            className={`tab-btn ${activeView === 'history' ? 'active' : ''}`}
            onClick={() => setActiveView('history')}
          >
            <TrendingUp size={16} />
            History
          </button>
        </div>

        {/* Content */}
        <div className="lifescore-content">
          {/* Overview / Scores View */}
          {activeView === 'overview' && (
            <div className="scores-view">
              <div className="scores-header">
                <h3>Life Areas</h3>
                {isEditing ? (
                  <button className="save-btn" onClick={handleSaveScores}>
                    <Save size={16} />
                    Save
                  </button>
                ) : (
                  <button className="edit-btn" onClick={() => setIsEditing(true)}>
                    <Edit3 size={16} />
                    Update Scores
                  </button>
                )}
              </div>

              <div className="scores-list">
                {lifeAreas.map(renderScoreSlider)}
              </div>

              {isEditing && (
                <div className="editing-tip">
                  <Info size={14} />
                  <span>Rate each area from 1 (needs work) to 10 (thriving)</span>
                </div>
              )}
            </div>
          )}

          {/* Wheel View */}
          {activeView === 'wheel' && (
            <div className="wheel-view">
              <div className="radar-chart-container">
                <ResponsiveContainer width="100%" height={350}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="var(--border-primary)" />
                    <PolarAngleAxis
                      dataKey="area"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 10]}
                      tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                      axisLine={false}
                    />
                    <Radar
                      name="Life Score"
                      dataKey="score"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="wheel-legend">
                {lifeAreas.map(area => {
                  const Icon = area.icon;
                  return (
                    <div key={area.id} className="legend-item" style={{ '--area-color': area.color }}>
                      <Icon size={14} />
                      <span>{area.name.split(' ')[0]}</span>
                      <span className="legend-score">{area.score}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History View */}
          {activeView === 'history' && (
            <div className="history-view">
              {scoreHistory.length < 2 ? (
                <div className="no-history">
                  <TrendingUp size={48} />
                  <h3>Not enough data yet</h3>
                  <p>Update your scores over time to see trends</p>
                </div>
              ) : (
                <>
                  <div className="history-chart">
                    <h4>Overall Score Trend</h4>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={historyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-primary)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          axisLine={{ stroke: 'var(--border-primary)' }}
                        />
                        <YAxis
                          domain={[0, 10]}
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          axisLine={{ stroke: 'var(--border-primary)' }}
                        />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)',
                            borderRadius: '8px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="overall"
                          stroke="#8b5cf6"
                          strokeWidth={2}
                          dot={{ fill: '#8b5cf6', r: 4 }}
                          activeDot={{ r: 6 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="area-trends">
                    <h4>Area Trends (Last 7 days)</h4>
                    <div className="trends-grid">
                      {lifeAreas.map(area => {
                        const trend = getAreaTrend(area.id);
                        const Icon = area.icon;
                        return (
                          <div key={area.id} className="trend-item">
                            <div className="trend-area" style={{ color: area.color }}>
                              <Icon size={16} />
                              <span>{area.name.split(' ')[0]}</span>
                            </div>
                            <div className={`trend-value ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral'}`}>
                              {trend > 0 ? <TrendingUp size={14} /> : trend < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
                              <span>{trend > 0 ? '+' : ''}{trend.toFixed(1)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Action Button */}
        {!isEditing && activeView === 'overview' && (
          <div className="lifescore-actions">
            <button className="update-btn" onClick={() => setIsEditing(true)}>
              <RotateCcw size={18} />
              Update My Scores
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
