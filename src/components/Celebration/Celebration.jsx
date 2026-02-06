import { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Trophy, Star, Flame, Sparkles, X } from 'lucide-react';
import './Celebration.css';

// Confetti particle component
const ConfettiParticle = ({ style }) => (
  <div className="confetti-particle" style={style} />
);

export default function Celebration() {
  const { celebration, clearCelebration } = useApp();
  const [particles, setParticles] = useState([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (celebration) {
      setIsVisible(true);

      // Generate confetti particles
      const newParticles = [];
      const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6'];

      for (let i = 0; i < 50; i++) {
        newParticles.push({
          id: i,
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 2 + Math.random() * 2,
          color: colors[Math.floor(Math.random() * colors.length)],
          size: 8 + Math.random() * 8,
          rotation: Math.random() * 360,
        });
      }
      setParticles(newParticles);

      // Auto-dismiss after 4 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [celebration]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      clearCelebration();
      setParticles([]);
    }, 300);
  };

  if (!celebration) return null;

  const getIcon = () => {
    switch (celebration.type) {
      case 'streak':
        return <Flame size={48} className="celebration-icon flame" />;
      case 'goal_complete':
        return <Trophy size={48} className="celebration-icon trophy" />;
      case 'milestone':
        return <Star size={48} className="celebration-icon star" />;
      case 'habit_complete':
        return <Sparkles size={48} className="celebration-icon sparkles" />;
      default:
        return <Star size={48} className="celebration-icon star" />;
    }
  };

  const getMessage = () => {
    switch (celebration.type) {
      case 'streak':
        return {
          title: `🔥 ${celebration.streak} Day Streak!`,
          subtitle: celebration.message || "You're on fire! Keep it going!",
        };
      case 'goal_complete':
        return {
          title: '🏆 Goal Achieved!',
          subtitle: celebration.message || 'Congratulations on reaching your goal!',
        };
      case 'milestone':
        return {
          title: '⭐ Milestone Reached!',
          subtitle: celebration.message || "You're making great progress!",
        };
      case 'habit_complete':
        return {
          title: '✨ Habit Complete!',
          subtitle: celebration.message || 'Great job staying consistent!',
        };
      case 'task_complete':
        return {
          title: '✅ Task Done!',
          subtitle: celebration.message || 'One step closer to your goals!',
        };
      default:
        return {
          title: '🎉 Well Done!',
          subtitle: celebration.message || 'Keep up the great work!',
        };
    }
  };

  const { title, subtitle } = getMessage();

  return (
    <div className={`celebration-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
      {/* Confetti */}
      <div className="confetti-container">
        {particles.map((particle) => (
          <ConfettiParticle
            key={particle.id}
            style={{
              left: `${particle.left}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
              backgroundColor: particle.color,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              transform: `rotate(${particle.rotation}deg)`,
            }}
          />
        ))}
      </div>

      {/* Celebration Card */}
      <div className="celebration-card" onClick={(e) => e.stopPropagation()}>
        <button className="celebration-close" onClick={handleClose}>
          <X size={20} />
        </button>

        <div className="celebration-icon-container">
          {getIcon()}
        </div>

        <h2 className="celebration-title">{title}</h2>
        <p className="celebration-subtitle">{subtitle}</p>

        {celebration.streak && celebration.streak >= 7 && (
          <div className="streak-badge">
            <Flame size={16} />
            <span>{celebration.streak} days strong!</span>
          </div>
        )}

        <button className="celebration-btn" onClick={handleClose}>
          Awesome!
        </button>
      </div>
    </div>
  );
}
