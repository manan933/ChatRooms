import { create } from 'zustand';
import api from '../api/api';
import socketService from '../api/socket';
import { useChatStore } from './chatStore';

const getInitialUser = () => {
  try {
    const cached = localStorage.getItem('zyntra_user');
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export const useAuthStore = create((set, get) => ({
  user: getInitialUser(),
  token: localStorage.getItem('zyntra_token') || null,
  isAuthenticated: Boolean(localStorage.getItem('zyntra_token') && getInitialUser()),
  isLoading: false,
  error: null,
  promptWorkspaceOnLogin: false,
  setPromptWorkspaceOnLogin: (val) => set({ promptWorkspaceOnLogin: val }),

  initAuth: async () => {
    const token = localStorage.getItem('zyntra_token');
    if (!token) {
      set({ isAuthenticated: false, user: null, token: null, isLoading: false });
      return;
    }

    try {
      const res = await api.auth.me();
      if (res.ok && res.data) {
        const user = res.data.user || res.data;
        localStorage.setItem('zyntra_user', JSON.stringify(user));
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

        if (token) localStorage.setItem('zyntra_token', token);
        if (user) localStorage.setItem('zyntra_user', JSON.stringify(user));

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

  register: async ({ name, email, password, primaryUsername }) => {
    set({ isLoading: true, error: null });
    const cleanUsername = primaryUsername.replace(/^@/, '').toLowerCase().trim();
    const cleanEmail = email.toLowerCase().trim();

    try {
      const res = await api.auth.register({
        name: name.trim(),
        email: cleanEmail,
        password,
        primaryUsername: cleanUsername,
      });

      if (res.ok && res.data) {
        const token = res.data.token;
        const user = res.data.user || res.data;

        if (token) localStorage.setItem('zyntra_token', token);
        if (user) localStorage.setItem('zyntra_user', JSON.stringify(user));

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

  updateProfile: async ({ name, avatar }) => {
    try {
      const res = await api.auth.updateProfile({ name, avatar });
      if (res.ok && res.data) {
        const updatedUser = res.data.user || res.data;
        localStorage.setItem('zyntra_user', JSON.stringify(updatedUser));
        set({ user: updatedUser });
        return { success: true };
      }
      return { success: false, error: res.error || 'Failed to update profile' };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  logout: () => {
    localStorage.removeItem('zyntra_token');
    localStorage.removeItem('zyntra_user');
    socketService.disconnect();
    useChatStore.getState().resetStore?.();

    set({
      user: null,
      token: null,
      isAuthenticated: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));

export default useAuthStore;
