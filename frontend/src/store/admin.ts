import { create } from 'zustand';
import { login as apiLogin, me } from '../lib/apiClient';
import type { AdminUser } from '../lib/types';

const TOKEN_KEY = 'tb_admin_token';
const USER_KEY = 'tb_admin_user';

interface AdminState {
  user: AdminUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
}

export const useAdmin = create<AdminState>((set) => ({
  user: null,
  ready: false,

  login: async (email, password) => {
    const res = await apiLogin(email.trim().toLowerCase(), password);
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.admin));
    set({ user: res.admin });
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ user: null });
  },

  restore: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ ready: true, user: null });
      return;
    }
    try {
      const user = await me();
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      set({ user, ready: true });
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      set({ user: null, ready: true });
    }
  },
}));

export const adminToken = () => localStorage.getItem(TOKEN_KEY);
