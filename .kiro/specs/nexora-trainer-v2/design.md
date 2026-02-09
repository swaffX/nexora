# Design Document - Nexora Trainer V2

## Overview

Nexora Trainer V2 is a professional web-based 3D aim training platform built with React, Three.js, and SCSS. The system provides six fully-functional training scenarios with first-person camera controls, Valorant-compatible settings, real-time leaderboards, and a modern cyberpunk aesthetic.

### Technology Stack

**Frontend:**
- React 18 + Vite
- Three.js (3D rendering)
- React Three Fiber (React wrapper for Three.js)
- SCSS (styling with modern features)
- Zustand (state management)
- Socket.io-client (real-time updates)

**Backend:**
- Node.js + Express
- MongoDB + Mongoose
- Passport.js (Discord OAuth)
- Socket.io (WebSocket server)

**Deployment:**
- Nginx (reverse proxy)
- PM2 (process manager)
- Cloudflare (DNS + SSL)

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (React)                        │
├─────────────────────────────────────────────────────────────┤
│  Landing → Dashboard → Training Scene → Results → Leaderboard│
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Auth Store   │  │Settings Store│  │ Score Store  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           3D Scene (Three.js/R3F)                    │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │   │
│  │  │Camera  │ │Targets │ │Lights  │ │Effects │       │   │
│  │  └────────┘ └────────┘ └────────┘ └────────┘       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express)                        │
├─────────────────────────────────────────────────────────────┤
│  /auth → /api/scores → /api/settings → Socket.io            │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Passport   │  │   MongoDB    │  │  Socket.io   │      │
│  │   (Discord)  │  │  (Scores)    │  │ (Real-time)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```


## Components and Interfaces

### 1. 3D Scene Manager

**Purpose:** Manages Three.js scene lifecycle, camera, renderer, and game loop

**Interface:**
```typescript
interface SceneManager {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  
  initialize(): void;
  startGameLoop(): void;
  stopGameLoop(): void;
  cleanup(): void;
}
```

**Key Responsibilities:**
- Initialize Three.js scene with optimal settings
- Set up perspective camera (FOV: 75°, aspect ratio: window size)
- Configure WebGL renderer (antialias, shadows, tone mapping)
- Run game loop at 60 FPS using requestAnimationFrame
- Handle window resize events

### 2. First-Person Camera Controller

**Purpose:** Provides FPS-style mouse look controls with Pointer Lock API

**Interface:**
```typescript
interface CameraController {
  sensitivity: number; // Valorant sensitivity (0.001 - 5.0)
  rotation: { x: number; y: number }; // Euler angles
  
  lockPointer(): void;
  unlockPointer(): void;
  handleMouseMove(event: MouseEvent): void;
  updateCamera(): void;
}
```

**Implementation Details:**
- Use Pointer Lock API for infinite mouse movement
- Convert Valorant sensitivity: `rotationSpeed = valorantSens × 0.07`
- Clamp vertical rotation: `-Math.PI/2 + 0.01` to `Math.PI/2 - 0.01`
- Apply rotation to camera using Euler angles
- Smooth movement with lerp (optional, for polish)

**Sensitivity Conversion Formula:**
```javascript
// Valorant uses different units than Three.js
const THREE_JS_ROTATION = VALORANT_SENS * 0.07;

// Example: Valorant sens 0.5 → Three.js 0.035 rad/px
```

### 3. Target Manager

**Purpose:** Handles target spawning, despawning, and object pooling

**Interface:**
```typescript
interface TargetManager {
  activeTargets: Target[];
  targetPool: Target[];
  
  spawnTarget(position: Vector3, size: number): Target;
  despawnTarget(target: Target): void;
  getTarget(): Target; // From pool
  returnTarget(target: Target): void; // To pool
}

interface Target {
  mesh: THREE.Mesh;
  position: THREE.Vector3;
  size: number;
  spawnTime: number;
  isActive: boolean;
}
```

**Object Pooling Strategy:**
- Pre-create 50 target objects at scene initialization
- Reuse targets instead of creating/destroying (prevents GC pauses)
- Mark targets as active/inactive instead of adding/removing from scene
- Reset target properties when returning to pool


### 4. Hit Detection System

**Purpose:** Detects mouse clicks on 3D targets using raycasting

**Interface:**
```typescript
interface HitDetector {
  raycaster: THREE.Raycaster;
  mouse: THREE.Vector2;
  
  checkHit(event: MouseEvent, targets: Target[]): Target | null;
  isHit(target: Target): boolean;
}
```

**Implementation:**
```javascript
// Raycasting from camera through mouse position
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(0, 0); // Always center (crosshair)

function checkHit(targets) {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(
    targets.map(t => t.mesh)
  );
  
  return intersects.length > 0 ? intersects[0].object : null;
}
```

**Optimization:**
- Use bounding spheres for initial collision check
- Only raycast against active targets
- Cache raycaster instance (don't recreate every frame)

### 5. Crosshair Renderer

**Purpose:** Renders 2D crosshair overlay matching Valorant style

**Interface:**
```typescript
interface CrosshairSettings {
  color: string; // Hex color
  size: number; // 1-20
  thickness: number; // 1-10
  gap: number; // 0-10
  outlineThickness: number; // 0-5
  outlineColor: string;
  opacity: number; // 0-1
}

interface CrosshairRenderer {
  settings: CrosshairSettings;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  
  render(): void;
  updateSettings(settings: CrosshairSettings): void;
}
```

**Rendering Strategy:**
- Use HTML5 Canvas 2D API (not Three.js)
- Position canvas as absolute overlay (z-index: 1000)
- Render 4 lines (top, bottom, left, right) from center
- Apply glow effect using shadow blur
- Update only when settings change (not every frame)

**Valorant Crosshair Mapping:**
```javascript
// Valorant → Canvas conversion
const centerX = canvas.width / 2;
const centerY = canvas.height / 2;
const lineLength = settings.size * 2;
const gap = settings.gap * 2;
const thickness = settings.thickness;

// Draw 4 lines with gap in center
ctx.strokeStyle = settings.color;
ctx.lineWidth = thickness;
ctx.shadowBlur = 10;
ctx.shadowColor = settings.color;

// Top line
ctx.beginPath();
ctx.moveTo(centerX, centerY - gap);
ctx.lineTo(centerX, centerY - gap - lineLength);
ctx.stroke();

// Repeat for bottom, left, right
```


## Data Models

### TrainerScore (MongoDB)

```javascript
const TrainerScoreSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  mapId: { type: String, required: true, index: true }, // gridshot, tracking, etc.
  score: { type: Number, required: true },
  accuracy: { type: Number, required: true }, // 0-100
  hits: { type: Number, required: true },
  misses: { type: Number, required: true },
  avgReactionTime: { type: Number }, // milliseconds
  sessionDuration: { type: Number, required: true }, // seconds
  createdAt: { type: Date, default: Date.now, index: true }
});

// Compound index for leaderboard queries
TrainerScoreSchema.index({ mapId: 1, score: -1 });
```

### TrainerSettings (MongoDB)

```javascript
const TrainerSettingsSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  
  // Sensitivity
  sensitivity: { type: Number, default: 0.5, min: 0.001, max: 5.0 },
  
  // Crosshair
  crosshair: {
    color: { type: String, default: '#00FF00' },
    size: { type: Number, default: 4, min: 1, max: 20 },
    thickness: { type: Number, default: 2, min: 1, max: 10 },
    gap: { type: Number, default: 2, min: 0, max: 10 },
    outlineThickness: { type: Number, default: 1, min: 0, max: 5 },
    outlineColor: { type: String, default: '#000000' },
    opacity: { type: Number, default: 1, min: 0, max: 1 }
  },
  
  // Graphics
  graphics: {
    quality: { type: String, enum: ['low', 'medium', 'high'], default: 'high' },
    shadows: { type: Boolean, default: true },
    antialiasing: { type: Boolean, default: true },
    fov: { type: Number, default: 75, min: 60, max: 120 }
  },
  
  // Audio
  audio: {
    masterVolume: { type: Number, default: 0.7, min: 0, max: 1 },
    hitSound: { type: Boolean, default: true },
    missSound: { type: Boolean, default: true },
    spawnSound: { type: Boolean, default: true }
  },
  
  updatedAt: { type: Date, default: Date.now }
});
```

### Session State (Client-side Zustand)

```typescript
interface SessionState {
  // Game state
  isPlaying: boolean;
  isPaused: boolean;
  timeRemaining: number;
  
  // Stats
  score: number;
  hits: number;
  misses: number;
  accuracy: number;
  reactionTimes: number[];
  
  // Actions
  startSession: () => void;
  pauseSession: () => void;
  resumeSession: () => void;
  endSession: () => void;
  recordHit: (reactionTime: number) => void;
  recordMiss: () => void;
}
```


## Training Scene Implementations

### 1. Gridshot Scene

**Concept:** 5 stationary targets in a grid, instant respawn on hit

**Spawn Pattern:**
```javascript
const GRID_POSITIONS = [
  { x: -5, y: 0, z: -10 },  // Left
  { x: 5, y: 0, z: -10 },   // Right
  { x: 0, y: 3, z: -10 },   // Top
  { x: 0, y: -3, z: -10 },  // Bottom
  { x: 0, y: 0, z: -10 }    // Center
];

function spawnGridTarget() {
  const availablePositions = GRID_POSITIONS.filter(
    pos => !isPositionOccupied(pos)
  );
  const randomPos = availablePositions[
    Math.floor(Math.random() * availablePositions.length)
  ];
  return spawnTarget(randomPos, 1.0); // size: 1.0 units
}
```

**Score Calculation:**
```javascript
// Score = hits × accuracy multiplier
const accuracyMultiplier = accuracy / 100;
const finalScore = hits * (1 + accuracyMultiplier);
```

### 2. Tracking Scene

**Concept:** 1 moving target, score based on time tracking

**Movement Patterns:**
```javascript
const PATTERNS = {
  circular: (time, radius) => ({
    x: Math.cos(time) * radius,
    y: Math.sin(time) * radius,
    z: -10
  }),
  
  linear: (time, speed) => ({
    x: (time * speed) % 20 - 10, // -10 to 10
    y: 0,
    z: -10
  }),
  
  figure8: (time, radius) => ({
    x: Math.sin(time) * radius,
    y: Math.sin(time * 2) * radius / 2,
    z: -10
  })
};

// Cycle through patterns every 10 seconds
const currentPattern = PATTERNS[
  ['circular', 'linear', 'figure8'][Math.floor(time / 10) % 3]
];
```

**Score Calculation:**
```javascript
// Check if crosshair is on target every frame
const isTracking = raycaster.intersectObject(target).length > 0;
if (isTracking) {
  trackingTime += deltaTime;
}

// Score = (tracking time / total time) × 10000
const accuracy = (trackingTime / totalTime) * 100;
const finalScore = Math.floor(accuracy * 100);
```

### 3. Flicking Scene

**Concept:** Targets at extreme angles, reaction time bonus

**Spawn Logic:**
```javascript
function spawnFlickTarget() {
  // Random angle 60° - 180° from center
  const angle = (Math.random() * 120 + 60) * (Math.PI / 180);
  const direction = Math.random() < 0.5 ? 1 : -1;
  
  const distance = 10 + Math.random() * 5; // 10-15 units
  
  return {
    x: Math.sin(angle) * distance * direction,
    y: (Math.random() - 0.5) * 4, // -2 to 2
    z: -Math.cos(angle) * distance
  };
}
```

**Score Calculation:**
```javascript
// Reaction time bonus: faster = more points
const reactionTime = hitTime - spawnTime; // milliseconds
const speedBonus = Math.max(0, 1000 - reactionTime) / 1000;

// Distance bonus: farther = more points
const distance = Math.sqrt(x*x + y*y + z*z);
const distanceMultiplier = distance / 10;

const pointsPerHit = 100 * (1 + speedBonus) * distanceMultiplier;
const finalScore = totalPoints;
```


### 4. Microshot Scene

**Concept:** Small targets at varying distances, precision bonus

**Spawn Logic:**
```javascript
function spawnMicroshotTarget() {
  const angle = Math.random() * Math.PI * 2;
  const elevation = (Math.random() - 0.5) * Math.PI / 4;
  const distance = 5 + Math.random() * 10; // 5-15 units
  
  return {
    x: Math.cos(angle) * Math.cos(elevation) * distance,
    y: Math.sin(elevation) * distance,
    z: -Math.sin(angle) * Math.cos(elevation) * distance,
    size: 0.5 // 50% smaller than gridshot
  };
}
```

**Precision Detection:**
```javascript
// Check hit position relative to target center
const hitPoint = raycaster.intersectObject(target)[0].point;
const targetCenter = target.position;
const distanceFromCenter = hitPoint.distanceTo(targetCenter);

// Center hit bonus (within 25% of radius)
const isCenterHit = distanceFromCenter < (target.size * 0.25);
const precisionBonus = isCenterHit ? 1.5 : 1.0;
```

**Score Calculation:**
```javascript
const pointsPerHit = 100 * precisionBonus;
const finalScore = totalPoints;
```

### 5. Sixshot Scene

**Concept:** 6 targets simultaneously, speed challenge

**Spawn Logic:**
```javascript
function spawnSixshotSet() {
  const targets = [];
  const radius = 8;
  
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    targets.push({
      x: Math.cos(angle) * radius,
      y: (Math.random() - 0.5) * 2, // Slight vertical variation
      z: -Math.sin(angle) * radius,
      size: 1.0
    });
  }
  
  return targets;
}
```

**Score Calculation:**
```javascript
// Track time to eliminate all 6 targets
const setCompletionTime = endTime - startTime; // milliseconds

// Speed bonus: under 3 seconds = bonus
const speedBonus = setCompletionTime < 3000 ? 1.5 : 1.0;

const pointsPerSet = 600 * speedBonus;
const finalScore = setsCompleted * pointsPerSet;
```

### 6. Spidershot Scene

**Concept:** 360° targets with audio cues

**Spawn Logic:**
```javascript
function spawnSpidershotTarget() {
  // Full 360° horizontal, ±45° vertical
  const horizontalAngle = Math.random() * Math.PI * 2;
  const verticalAngle = (Math.random() - 0.5) * Math.PI / 2;
  const distance = 8 + Math.random() * 4;
  
  const position = {
    x: Math.cos(horizontalAngle) * Math.cos(verticalAngle) * distance,
    y: Math.sin(verticalAngle) * distance,
    z: -Math.sin(horizontalAngle) * Math.cos(verticalAngle) * distance
  };
  
  // Play directional audio cue if target is behind player
  const isBehind = position.z > 0;
  if (isBehind) {
    playSpawnSound(position);
  }
  
  return position;
}
```

**Spatial Audio:**
```javascript
// Use Web Audio API for 3D positional audio
const audioContext = new AudioContext();
const panner = audioContext.createPanner();
panner.setPosition(target.x, target.y, target.z);
panner.connect(audioContext.destination);
```

**Score Calculation:**
```javascript
// Bonus for targets outside initial FOV
const angleFromCenter = Math.atan2(target.x, -target.z);
const isOutsideFOV = Math.abs(angleFromCenter) > Math.PI / 3;

const pointsPerHit = isOutsideFOV ? 150 : 100;
const finalScore = totalPoints;
```


## SCSS Architecture

### File Structure

```
client/src/styles/
├── main.scss              # Entry point
├── _variables.scss        # Colors, sizes, breakpoints
├── _mixins.scss           # Reusable style patterns
├── _animations.scss       # Keyframe animations
├── base/
│   ├── _reset.scss        # CSS reset
│   ├── _typography.scss   # Font styles
│   └── _utilities.scss    # Utility classes
├── components/
│   ├── _navbar.scss
│   ├── _button.scss
│   ├── _card.scss
│   ├── _crosshair.scss
│   └── _modal.scss
├── pages/
│   ├── _landing.scss
│   ├── _dashboard.scss
│   ├── _training.scss
│   ├── _settings.scss
│   └── _leaderboard.scss
└── themes/
    └── _cyberpunk.scss    # Main theme
```

### Theme Variables

```scss
// _variables.scss
$colors: (
  primary: #FF0080,      // Hot pink
  secondary: #00F0FF,    // Cyan
  accent: #FFD700,       // Gold
  bg-dark: #0A0A0F,      // Almost black
  bg-card: #1A1A2E,      // Dark blue-gray
  text-primary: #FFFFFF,
  text-secondary: #A0A0B0,
  success: #00FF88,
  error: #FF3366
);

$glow: (
  primary: 0 0 20px rgba(255, 0, 128, 0.6),
  secondary: 0 0 20px rgba(0, 240, 255, 0.6),
  accent: 0 0 20px rgba(255, 215, 0, 0.6)
);

$transitions: (
  fast: 0.15s ease,
  normal: 0.3s ease,
  slow: 0.5s ease
);

$breakpoints: (
  mobile: 640px,
  tablet: 768px,
  desktop: 1024px,
  wide: 1280px
);
```

### Glow Effect Mixin

```scss
// _mixins.scss
@mixin glow($color, $intensity: 1) {
  box-shadow: 
    0 0 #{10px * $intensity} rgba($color, 0.4),
    0 0 #{20px * $intensity} rgba($color, 0.3),
    0 0 #{30px * $intensity} rgba($color, 0.2);
  
  &:hover {
    box-shadow: 
      0 0 #{15px * $intensity} rgba($color, 0.6),
      0 0 #{30px * $intensity} rgba($color, 0.4),
      0 0 #{45px * $intensity} rgba($color, 0.3);
  }
}

@mixin text-glow($color) {
  text-shadow:
    0 0 10px rgba($color, 0.8),
    0 0 20px rgba($color, 0.6),
    0 0 30px rgba($color, 0.4);
}

@mixin glass-morphism {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Button Component

```scss
// components/_button.scss
.btn {
  padding: 12px 32px;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all map-get($transitions, normal);
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    transform: translate(-50%, -50%);
    transition: width 0.6s, height 0.6s;
  }
  
  &:hover::before {
    width: 300px;
    height: 300px;
  }
  
  &--primary {
    background: linear-gradient(135deg, map-get($colors, primary), map-get($colors, accent));
    color: map-get($colors, text-primary);
    @include glow(map-get($colors, primary));
  }
  
  &--secondary {
    background: linear-gradient(135deg, map-get($colors, secondary), map-get($colors, primary));
    color: map-get($colors, text-primary);
    @include glow(map-get($colors, secondary));
  }
}
```


### Card Component

```scss
// components/_card.scss
.card {
  @include glass-morphism;
  border-radius: 16px;
  padding: 24px;
  transition: all map-get($transitions, normal);
  
  &:hover {
    transform: translateY(-8px) scale(1.02);
    border-color: map-get($colors, primary);
    @include glow(map-get($colors, primary), 0.5);
  }
  
  &__title {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 12px;
    @include text-glow(map-get($colors, accent));
  }
  
  &__description {
    color: map-get($colors, text-secondary);
    font-size: 14px;
  }
}
```

### Animations

```scss
// _animations.scss
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(255, 0, 128, 0.4);
  }
  50% {
    box-shadow: 0 0 40px rgba(255, 0, 128, 0.8);
  }
}

@keyframes slide-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-pulse-glow {
  animation: pulse-glow 2s ease-in-out infinite;
}

.animate-slide-in {
  animation: slide-in-up 0.6s ease-out;
}

.animate-fade-in {
  animation: fade-in 0.4s ease-out;
}
```

## Error Handling

### Client-Side Error Handling

```typescript
// Global error boundary for React
class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('React Error:', error, errorInfo);
    // Log to monitoring service (optional)
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorScreen error={this.state.error} />;
    }
    return this.props.children;
  }
}

// Three.js error handling
function handleWebGLError() {
  if (!renderer.capabilities.isWebGL2) {
    showError('WebGL 2.0 not supported. Please update your browser.');
    return false;
  }
  return true;
}

// Network error handling
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### Server-Side Error Handling

```javascript
// Express error middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Don't leak error details in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal Server Error' 
    : err.message;
  
  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// MongoDB error handling
mongoose.connection.on('error', (err) => {
  console.error('MongoDB Error:', err);
  // Attempt reconnection
  setTimeout(() => mongoose.connect(process.env.MONGODB_URI), 5000);
});
```


## Testing Strategy

### Unit Testing

**Tools:** Vitest + React Testing Library

**Test Coverage:**
- Utility functions (sensitivity conversion, score calculation)
- React components (Dashboard, Settings, Leaderboard)
- Zustand stores (auth, settings, session)
- API routes (scores, settings, auth)

**Example Tests:**
```javascript
// Sensitivity conversion
describe('sensitivityConverter', () => {
  it('converts Valorant sensitivity to Three.js rotation', () => {
    expect(convertSensitivity(0.5)).toBe(0.035);
    expect(convertSensitivity(1.0)).toBe(0.07);
  });
});

// Score calculation
describe('calculateGridshotScore', () => {
  it('calculates score with accuracy multiplier', () => {
    const score = calculateGridshotScore(50, 80); // 50 hits, 80% accuracy
    expect(score).toBe(90); // 50 * (1 + 0.8)
  });
});

// Component rendering
describe('Dashboard', () => {
  it('renders user stats correctly', () => {
    render(<Dashboard />);
    expect(screen.getByText(/Hoş Geldin/i)).toBeInTheDocument();
  });
});
```

### Integration Testing

**Test Scenarios:**
1. Complete training session flow (start → play → end → submit score)
2. Settings persistence (change settings → save → reload → verify)
3. Leaderboard updates (submit score → check leaderboard → verify position)
4. Discord OAuth flow (login → callback → dashboard)

### Performance Testing

**Metrics to Monitor:**
- FPS during 3D rendering (target: 60 FPS)
- Memory usage (target: < 500MB)
- Network latency (API calls < 200ms)
- Time to Interactive (TTI < 3s)

**Tools:**
- Chrome DevTools Performance tab
- Lighthouse CI
- React DevTools Profiler

### Manual Testing Checklist

**3D Controls:**
- [ ] Mouse look works smoothly
- [ ] Sensitivity changes apply immediately
- [ ] Pointer lock/unlock works correctly
- [ ] ESC pauses the game

**Training Scenes:**
- [ ] All 6 maps load without errors
- [ ] Targets spawn correctly
- [ ] Hit detection is accurate
- [ ] Score calculation is correct
- [ ] Timer counts down properly

**UI/UX:**
- [ ] Crosshair renders correctly
- [ ] Glow effects work
- [ ] Animations are smooth
- [ ] Responsive on all screen sizes
- [ ] No visual glitches

**Backend:**
- [ ] Scores save to database
- [ ] Leaderboards update in real-time
- [ ] Settings persist across sessions
- [ ] Discord login works

## Deployment Strategy

### Build Process

```bash
# Frontend build
cd client
npm run build
# Output: client/dist/

# Backend (no build needed, runs directly)
cd server
pm2 start index.js --name Nexora_Trainer_API
```

### Environment Variables

**Production (.env):**
```env
# Backend
NODE_ENV=production
PORT=3001
CLIENT_URL=https://neuroviabot.xyz
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_CALLBACK_URL=https://neuroviabot.xyz/auth/discord/callback

# Frontend (.env)
VITE_API_URL=https://neuroviabot.xyz
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name neuroviabot.xyz;
    
    root /root/nexora/trainer-web/client/dist;
    index index.html;
    
    # Frontend (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
    }
    
    # Auth routes
    location /auth {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Cookie $http_cookie;
        proxy_pass_header Set-Cookie;
    }
    
    # WebSocket (Socket.io)
    location /socket.io {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Monitoring

**PM2 Monitoring:**
```bash
pm2 monit                    # Real-time monitoring
pm2 logs Nexora_Trainer_API  # View logs
pm2 restart Nexora_Trainer_API  # Restart after updates
```

**Health Checks:**
- `/health` endpoint returns 200 OK
- MongoDB connection status
- Socket.io connection count

## Performance Optimization

### Frontend Optimizations

1. **Code Splitting:**
```javascript
// Lazy load training scenes
const GridshotScene = lazy(() => import('./scenes/GridshotScene'));
const TrackingScene = lazy(() => import('./scenes/TrackingScene'));
```

2. **Asset Optimization:**
- Compress textures (use WebP format)
- Lazy load 3D models
- Use CDN for static assets

3. **Three.js Optimizations:**
- Object pooling for targets
- Frustum culling
- LOD (Level of Detail) for distant objects
- Reduce draw calls (merge geometries)

4. **React Optimizations:**
- Use React.memo for expensive components
- Avoid unnecessary re-renders
- Use useCallback/useMemo appropriately

### Backend Optimizations

1. **Database Indexing:**
```javascript
// Compound indexes for fast queries
TrainerScoreSchema.index({ mapId: 1, score: -1 });
TrainerScoreSchema.index({ userId: 1, createdAt: -1 });
```

2. **Caching:**
- Cache leaderboard queries (Redis optional)
- Cache user settings in memory

3. **Connection Pooling:**
```javascript
mongoose.connect(uri, {
  maxPoolSize: 10,
  minPoolSize: 2
});
```

## Security Considerations

1. **Input Validation:**
- Validate all user inputs (scores, settings)
- Sanitize MongoDB queries
- Rate limit API endpoints

2. **Authentication:**
- Secure session cookies (httpOnly, secure, sameSite)
- CSRF protection
- Discord OAuth token validation

3. **XSS Prevention:**
- Sanitize user-generated content
- Use Content Security Policy headers

4. **DDoS Protection:**
- Rate limiting (express-rate-limit)
- Cloudflare proxy

This completes the design document. Ready to proceed to implementation tasks?
