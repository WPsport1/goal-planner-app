import { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured, authService } from '../services/supabase';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // If Supabase isn't configured, use local-only mode
      setLoading(false);
      return;
    }

    // Safety timeout: never block the app for more than 3 seconds waiting for auth
    const authTimeout = setTimeout(() => {
      console.warn('[Auth] Supabase auth check timed out after 3s — proceeding without auth');
      setLoading(false);
    }, 3000);

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        setUser(user);
      } catch (err) {
        console.error('Error getting session:', err);
        setError(err.message);
      } finally {
        clearTimeout(authTimeout);
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_OUT') {
          setError(null);
        }
      }
    );

    return () => {
      clearTimeout(authTimeout);
      subscription?.unsubscribe();
    };
  }, []);

  // Sign up with email and password
  const signUp = async (email, password, fullName = '') => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Cloud storage is not configured. Please set up Supabase credentials.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      // Check if email confirmation is required
      if (data?.user && !data?.session) {
        return {
          success: true,
          message: 'Please check your email to confirm your account.',
          requiresConfirmation: true
        };
      }

      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Cloud storage is not configured. Please set up Supabase credentials.');
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out
  const signOut = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        setUser(null);
        return { success: true };
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      setUser(null);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Cloud storage is not configured.');
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      return { success: true, message: 'Password reset email sent!' };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Update password
  const updatePassword = async (newPassword) => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Cloud storage is not configured.');
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return { success: true, message: 'Password updated successfully!' };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Clear error
  const clearError = () => setError(null);

  const value = {
    // State
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isConfigured: isSupabaseConfigured,

    // Actions
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
