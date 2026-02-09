// Session State Management
import { create } from 'zustand';

export const useSessionStore = create((set, get) => ({
  // Game state
  isPlaying: false,
  isPaused: false,
  timeRemaining: 60,
  startTime: null,
  
  // Stats
  score: 0,
  hits: 0,
  misses: 0,
  accuracy: 0,
  reactionTimes: [],
  
  // Actions
  startSession: (duration = 60) => {
    set({
      isPlaying: true,
      isPaused: false,
      timeRemaining: duration,
      startTime: Date.now(),
      score: 0,
      hits: 0,
      misses: 0,
      accuracy: 0,
      reactionTimes: []
    });
  },
  
  pauseSession: () => {
    set({ isPaused: true });
  },
  
  resumeSession: () => {
    set({ isPaused: false });
  },
  
  endSession: () => {
    set({ isPlaying: false, isPaused: false });
  },
  
  updateTime: (time) => {
    set({ timeRemaining: Math.max(0, time) });
    
    if (time <= 0) {
      get().endSession();
    }
  },
  
  recordHit: (reactionTime) => {
    const state = get();
    const newHits = state.hits + 1;
    const newReactionTimes = [...state.reactionTimes, reactionTime];
    const newAccuracy = (newHits / (newHits + state.misses)) * 100;
    
    set({
      hits: newHits,
      reactionTimes: newReactionTimes,
      accuracy: newAccuracy
    });
  },
  
  recordMiss: () => {
    const state = get();
    const newMisses = state.misses + 1;
    const newAccuracy = (state.hits / (state.hits + newMisses)) * 100;
    
    set({
      misses: newMisses,
      accuracy: newAccuracy
    });
  },
  
  updateScore: (score) => {
    set({ score });
  },
  
  calculateFinalScore: () => {
    const state = get();
    // Score = hits × accuracy multiplier
    const accuracyMultiplier = state.accuracy / 100;
    return Math.floor(state.hits * (1 + accuracyMultiplier));
  },
  
  getAverageReactionTime: () => {
    const state = get();
    if (state.reactionTimes.length === 0) return 0;
    const sum = state.reactionTimes.reduce((a, b) => a + b, 0);
    return Math.floor(sum / state.reactionTimes.length);
  },
  
  reset: () => {
    set({
      isPlaying: false,
      isPaused: false,
      timeRemaining: 60,
      startTime: null,
      score: 0,
      hits: 0,
      misses: 0,
      accuracy: 0,
      reactionTimes: []
    });
  }
}));
