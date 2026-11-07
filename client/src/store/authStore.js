import { create } from 'zustand';
import api from '../api/api';
import socketService from '../api/socket';
import { useChatStore } from './chatStore';

const getInitialUser = () => {
  try {
    const cached = localStorage.getItem('chatrooms_user') || localStorage.getItem('zyntra_user');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

const getStoredToken = () => {
  return localStorage.getItem('chatrooms_token') || localStorage.getItem('zyntra_token') || null;
};

export const useAuthStore = create((set, get) => ({
  user: getInitialUser(),
  token: getStoredToken(),
  isAuthenticated: Boolean(getStoredToken() && getInitialUser()),
  isLoading: false,
  error: null,
  promptWorkspaceOnLogin: false,
  setPromptWorkspaceOnLogin: (val) => set({ promptWorkspaceOnLogin: val }),

  initAuth: async () => {
    const token = getStoredToken();
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null, isLoading: false });
      return;
    }

    try {
      const res = await api.auth.me();
      if (res.ok && res.data) {
        const user = res.data.user || res.data;
        localStorage.setItem('chatrooms_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, error: null });
        socketService.connect();
      } else if (res.status === 401 || !res.ok) {
        get().logout();
      }
    } catch (e) {
      console.error('initAuth failed', e);
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const res = await api.auth.login({ email, password });

      if (res.ok && res.data) {
        const token = res.data.token;
        const user = res.data.user || res.data;

        if (token) {
          localStorage.setItem('chatrooms_token', token);
        }
        if (user) {
          localStorage.setItem('chatrooms_user', JSON.stringify(user));
        }

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          promptWorkspaceOnLogin: true,
        });

        socketService.connect();
        return { success: true };
      }

      const errorMsg = res.error || res.data?.message || 'Invalid email or password';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = err.message || 'Login failed. Please check your connection.';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  register: async ({ name, email, password, primaryUsername, username }) => {
    set({ isLoading: true, error: null });
    const targetUsername = primaryUsername || username || '';
    const cleanUsername = targetUsername.replace(/^@/, '').toLowerCase().trim();
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    try {
      const res = await api.auth.register({
        name: name ? name.trim() : '',
        email: cleanEmail,
        password,
        primaryUsername: cleanUsername,
        username: cleanUsername,
      });

      if (res.ok && res.data) {
        const token = res.data.token;
        const user = res.data.user || res.data;

        if (token) {
          localStorage.setItem('chatrooms_token', token);
        }
        if (user) {
          localStorage.setItem('chatrooms_user', JSON.stringify(user));
        }

        set({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null,
          promptWorkspaceOnLogin: true,
        });

        socketService.connect();
        return { success: true };
      }

      const errorMsg = res.error || res.data?.message || 'Registration failed';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    } catch (err) {
      const errorMsg = err.message || 'Registration failed. Please check your connection.';
      set({ isLoading: false, error: errorMsg });
      return { success: false, error: errorMsg };
    }
  },

  updateProfile: async ({ name, bio, avatar, phone }) => {
    try {
      const res = await api.auth.updateProfile({ name, bio, avatar, phone });
      if (res.ok && res.data) {
        const updatedUser = res.data.user || res.data;
        localStorage.setItem('chatrooms_user', JSON.stringify(updatedUser));
        set({ user: updatedUser });
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to update profile' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  logout: () => {
    localStorage.removeItem('chatrooms_token');
    localStorage.removeItem('chatrooms_user');
    localStorage.removeItem('zyntra_token');
    localStorage.removeItem('zyntra_user');
    socketService.disconnect();
    useChatStore.getState().resetStore?.();

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
      promptWorkspaceOnLogin: false,
    });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
