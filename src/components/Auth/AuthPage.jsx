import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Target,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowRight,
  CloudOff,
} from 'lucide-react';
import './AuthPage.css';

export default function AuthPage() {
  const { signIn, signUp, resetPassword, loading, error, clearError, isConfigured } = useAuth();

  const [mode, setMode] = useState('login'); // login, signup, forgot
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [message, setMessage] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const validateForm = () => {
    const errors = {};

    // Email validation
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Please enter a valid email';
    }

    // Password validation (not needed for forgot password)
    if (mode !== 'forgot') {
      if (!formData.password) {
        errors.password = 'Password is required';
      } else if (formData.password.length < 6) {
        errors.password = 'Password must be at least 6 characters';
      }
    }

    // Confirm password (only for signup)
    if (mode === 'signup') {
      if (!formData.confirmPassword) {
        errors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field error when user types
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: null }));
    }
    clearError();
    setMessage(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);

    if (!validateForm()) return;

    let result;

    switch (mode) {
      case 'login':
        result = await signIn(formData.email, formData.password);
        if (!result.success) {
          // Error is handled by AuthContext
        }
        break;

      case 'signup':
        result = await signUp(formData.email, formData.password, formData.fullName);
        if (result.success) {
          if (result.requiresConfirmation) {
            setMessage({
              type: 'success',
              text: result.message,
            });
            setMode('login');
          }
        }
        break;

      case 'forgot':
        result = await resetPassword(formData.email);
        if (result.success) {
          setMessage({
            type: 'success',
            text: result.message,
          });
          setMode('login');
        }
        break;
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setFormErrors({});
    setMessage(null);
    clearError();
    // Keep email when switching modes
    setFormData((prev) => ({
      ...prev,
      password: '',
      confirmPassword: '',
    }));
  };

  // Show configuration message if Supabase isn't set up
  if (!isConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <div className="auth-logo">
              <Target size={40} />
            </div>
            <h1>Goal Planner</h1>
            <p>Cloud Storage Not Configured</p>
          </div>

          <div className="config-message">
            <CloudOff size={48} />
            <h2>Setup Required</h2>
            <p>
              To use cloud sync and multi-device access, you need to configure Supabase.
            </p>
            <div className="setup-steps">
              <h3>Quick Setup:</h3>
              <ol>
                <li>Go to <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a> and create a free account</li>
                <li>Create a new project</li>
                <li>Go to <strong>Settings → API</strong></li>
                <li>Copy your <strong>Project URL</strong> and <strong>anon key</strong></li>
                <li>Create a <code>.env</code> file in the project root:
                  <pre>
{`VITE_SUPABASE_URL=your-url
VITE_SUPABASE_ANON_KEY=your-key`}
                  </pre>
                </li>
                <li>Restart the dev server</li>
              </ol>
            </div>
            <p className="local-note">
              <strong>Want to use locally without cloud?</strong><br/>
              The app currently works with local storage. Your data is saved on this device only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        {/* Header */}
        <div className="auth-header">
          <div className="auth-logo">
            <Target size={40} />
          </div>
          <h1>Goal Planner</h1>
          <p>
            {mode === 'login' && 'Welcome back! Sign in to continue'}
            {mode === 'signup' && 'Create your account to get started'}
            {mode === 'forgot' && 'Reset your password'}
          </p>
        </div>

        {/* Messages */}
        {(error || message) && (
          <div className={`auth-message ${message?.type || 'error'}`}>
            {message?.type === 'success' ? (
              <CheckCircle size={18} />
            ) : (
              <AlertCircle size={18} />
            )}
            <span>{message?.text || error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {/* Full Name (signup only) */}
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <div className="input-wrapper">
                <User size={18} className="input-icon" />
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  autoComplete="name"
                />
              </div>
            </div>
          )}

          {/* Email */}
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                autoComplete="email"
                className={formErrors.email ? 'error' : ''}
              />
            </div>
            {formErrors.email && (
              <span className="field-error">{formErrors.email}</span>
            )}
          </div>

          {/* Password (not for forgot) */}
          {mode !== 'forgot' && (
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className={formErrors.password ? 'error' : ''}
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {formErrors.password && (
                <span className="field-error">{formErrors.password}</span>
              )}
            </div>
          )}

          {/* Confirm Password (signup only) */}
          {mode === 'signup' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={18} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="confirmPassword"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={formErrors.confirmPassword ? 'error' : ''}
                />
              </div>
              {formErrors.confirmPassword && (
                <span className="field-error">{formErrors.confirmPassword}</span>
              )}
            </div>
          )}

          {/* Forgot Password Link */}
          {mode === 'login' && (
            <div className="forgot-link">
              <button type="button" onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            </div>
          )}

          {/* Submit Button */}
          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? (
              <Loader2 size={20} className="spinner" />
            ) : (
              <>
                {mode === 'login' && 'Sign In'}
                {mode === 'signup' && 'Create Account'}
                {mode === 'forgot' && 'Send Reset Link'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        {/* Mode Switch */}
        <div className="auth-footer">
          {mode === 'login' && (
            <p>
              Don't have an account?{' '}
              <button type="button" onClick={() => switchMode('signup')}>
                Sign up
              </button>
            </p>
          )}
          {mode === 'signup' && (
            <p>
              Already have an account?{' '}
              <button type="button" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </p>
          )}
          {mode === 'forgot' && (
            <p>
              Remember your password?{' '}
              <button type="button" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>

      {/* Background decoration */}
      <div className="auth-bg">
        <div className="bg-circle bg-circle-1" />
        <div className="bg-circle bg-circle-2" />
        <div className="bg-circle bg-circle-3" />
      </div>
    </div>
  );
}
