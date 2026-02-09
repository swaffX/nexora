// Performance monitoring utility
export class PerformanceMonitor {
  constructor() {
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
    this.maxHistoryLength = 60;
  }
  
  update() {
    this.frameCount++;
    const currentTime = performance.now();
    const delta = currentTime - this.lastTime;
    
    if (delta >= 1000) {
      this.fps = Math.round((this.frameCount * 1000) / delta);
      this.fpsHistory.push(this.fps);
      
      if (this.fpsHistory.length > this.maxHistoryLength) {
        this.fpsHistory.shift();
      }
      
      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }
  
  getFPS() {
    return this.fps;
  }
  
  getAverageFPS() {
    if (this.fpsHistory.length === 0) return 60;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.fpsHistory.length);
  }
  
  getMinFPS() {
    if (this.fpsHistory.length === 0) return 60;
    return Math.min(...this.fpsHistory);
  }
  
  reset() {
    this.fps = 60;
    this.frameCount = 0;
    this.lastTime = performance.now();
    this.fpsHistory = [];
  }
}
