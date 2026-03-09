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
      console.log('[Auth] Supabase not configured — local-only mode');
      setLoading(false);
      return;
    }

    console.log('[Auth] Supabase configured — checking session...');

    // Safety timeout: never block the app for more than 3 seconds waiting for auth
    const authTimeout = setTimeout(() => {
      console.warn('[Auth] Supabase auth check timed out after 3s — proceeding without auth');
      setLoading(false);
    }, 3000);

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.warn('[Auth] getUser error:', error.message);
          // Don't throw for "no session" type errors
          if (error.message !== 'Auth session missing!' &&
              !error.message.includes('not authenticated')) {
            throw error;
          }
        } else {
          console.log('[Auth] Existing session found for:', user?.email);
          setUser(user);
        }
      } catch (err) {
        console.error('[Auth] Error getting session:', err);
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
        console.log('[Auth] Auth state changed:', event, session?.user?.email || 'no user');
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

      console.log('[Auth] Signing up:', email);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      console.log('[Auth] SignUp response — user:', !!data?.user, 'session:', !!data?.session);

      // Check if email confirmation is required
      if (data?.user && !data?.session) {
        return {
          success: true,
          message: 'Account created! Please check your email to confirm your account, then sign in.',
          requiresConfirmation: true
        };
      }

      // Auto-confirmed — user is now signed in
      if (data?.user && data?.session) {
        console.log('[Auth] Auto-confirmed sign up — user is now signed in');
        setUser(data.user);
        return { success: true, user: data.user, autoSignedIn: true };
      }

      return { success: true, user: data.user };
    } catch (err) {
      console.error('[Auth] SignUp error:', err.message);
      setError(err.message);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Resend confirmation email
  const resendConfirmation = async (email) => {
    setLoading(true);
    setError(null);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Cloud storage is not configured.');
      }

      console.log('[Auth] Resending confirmation to:', email);

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;

      return { success: true, message: 'Confirmation email resent! Check your inbox.' };
    } catch (err) {
      console.error('[Auth] Resend error:', err.message);
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

      console.log('[Auth] Signing in:', email);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Auth] SignIn error:', error.message);
        // Provide friendlier error messages
        if (error.message === 'Email not confirmed') {
          throw new Error('Your email is not confirmed yet. Please check your inbox for a confirmation link, or click "Resend confirmation email" below.');
        }
        if (error.message === 'Invalid login credentials') {
          throw new Error('Invalid email or password. Please try again, or create a new account.');
        }
        throw error;
      }

      console.log('[Auth] Sign in successful:', data.user?.email);
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

      console.log('[Auth] Signing out');
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
    resendConfirmation,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
