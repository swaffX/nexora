import { create } from 'zustand';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

axios.defaults.withCredentials = true;

export const useAuthStore = create((set) => ({
  user: null,
  loading: true,
  
  checkAuth: async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      set({ user: response.data, loading: false });
    } catch (error) {
      set({ user: null, loading: false });
    }
  },
  
  login: () => {
    window.location.href = `${API_URL}/auth/discord`;
  },
  
  logout: async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
      set({ user: null });
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}));
