import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // Default Settings
      sensitivity: 0.5,
      dpi: 800,
      crosshair: {
        style: 'cross',
        color: '#00ff00',
        outlineColor: '#000000',
        size: 4,
        thickness: 2,
        gap: 2,
        outline: true,
        outlineThickness: 1,
        centerDot: false,
        centerDotSize: 2
      },
      graphics: {
        fov: 90,
        showFPS: true,
        showAccuracy: true,
        showTimer: true
      },
      audio: {
        masterVolume: 0.7,
        hitSound: true,
        missSound: false,
        hitSoundVolume: 0.5
      },
      
      // Actions
      loadSettings: async () => {
        try {
          const response = await axios.get(`${API_URL}/api/settings`);
          set(response.data);
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      },
      
      saveSettings: async () => {
        try {
          const state = get();
          await axios.put(`${API_URL}/api/settings`, {
            sensitivity: state.sensitivity,
            dpi: state.dpi,
            crosshair: state.crosshair,
            graphics: state.graphics,
            audio: state.audio
          });
        } catch (error) {
          console.error('Failed to save settings:', error);
        }
      },
      
      updateSensitivity: (value) => {
        set({ sensitivity: value });
        get().saveSettings();
      },
      
      updateCrosshair: (updates) => {
        set((state) => ({
          crosshair: { ...state.crosshair, ...updates }
        }));
        get().saveSettings();
      },
      
      updateGraphics: (updates) => {
        set((state) => ({
          graphics: { ...state.graphics, ...updates }
        }));
        get().saveSettings();
      },
      
      updateAudio: (updates) => {
        set((state) => ({
          audio: { ...state.audio, ...updates }
        }));
        get().saveSettings();
      }
    }),
    {
      name: 'nexora-trainer-settings'
    }
  )
);
