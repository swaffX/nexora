// Audio Manager for game sounds
export class AudioManager {
  constructor() {
    this.context = null;
    this.sounds = {};
    this.masterVolume = 0.7;
    this.enabled = true;
    
    this.initAudioContext();
  }
  
  initAudioContext() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('Web Audio API not supported');
      this.enabled = false;
    }
  }
  
  // Generate hit sound (synthesized)
  playHitSound() {
    if (!this.enabled || !this.context) return;
    
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(800, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, this.context.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(this.masterVolume * 0.3, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.1);
  }
  
  // Generate miss sound
  playMissSound() {
    if (!this.enabled || !this.context) return;
    
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'sawtooth';
    oscillator.frequency.setValueAtTime(200, this.context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, this.context.currentTime + 0.15);
    
    gainNode.gain.setValueAtTime(this.masterVolume * 0.2, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.15);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.15);
  }
  
  // Generate spawn sound with 3D positioning
  playSpawnSound(position) {
    if (!this.enabled || !this.context) return;
    
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    const panner = this.context.createPanner();
    
    // Configure panner for 3D audio
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 20;
    panner.rolloffFactor = 1;
    
    if (position) {
      panner.setPosition(position.x, position.y, position.z);
    }
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, this.context.currentTime);
    
    gainNode.gain.setValueAtTime(this.masterVolume * 0.25, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.2);
    
    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.context.destination);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.2);
  }
  
  // Play countdown beep
  playCountdownBeep(isLast = false) {
    if (!this.enabled || !this.context) return;
    
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(isLast ? 1200 : 800, this.context.currentTime);
    
    gainNode.gain.setValueAtTime(this.masterVolume * 0.4, this.context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    oscillator.connect(gainNode);
    gainNode.connect(this.context.destination);
    
    oscillator.start(this.context.currentTime);
    oscillator.stop(this.context.currentTime + 0.1);
  }
  
  // Set master volume (0-1)
  setVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }
  
  // Enable/disable all sounds
  setEnabled(enabled) {
    this.enabled = enabled;
  }
  
  // Resume audio context (required after user interaction)
  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }
  
  // Cleanup
  dispose() {
    if (this.context) {
      this.context.close();
      this.context = null;
    }
  }
}

// Singleton instance
let audioManagerInstance = null;

export function getAudioManager() {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}
