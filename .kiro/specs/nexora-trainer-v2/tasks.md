# Implementation Plan: Nexora Trainer V2

## Overview

This implementation plan transforms Nexora Trainer into a professional-grade 3D aim training platform with 6 fully-functional training scenarios, first-person controls, Valorant-compatible settings, and a modern cyberpunk aesthetic using SCSS.

## Tasks

- [x] 1. Setup SCSS Architecture and Theme System
  - Install sass package and configure Vite
  - Create SCSS file structure (variables, mixins, components, pages)
  - Implement cyberpunk theme with glow effects
  - Convert existing Tailwind components to SCSS
  - _Requirements: 11.1, 11.2, 11.3_

- [-] 2. Implement First-Person Camera Controller
  - [-] 2.1 Create CameraController class with Pointer Lock API
    - Implement pointer lock/unlock on click and ESC
    - Handle mouse movement events
    - Apply Euler angle rotation to camera
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [ ] 2.2 Implement Valorant sensitivity conversion
    - Create conversion formula (valorantSens × 0.07)
    - Apply sensitivity to rotation speed
    - Add vertical rotation clamping (-89° to +89°)
    - _Requirements: 1.4, 1.5_
  
  - [ ] 2.3 Create pause menu system
    - Detect ESC key press
    - Unlock pointer and show pause overlay
    - Resume on continue button
    - _Requirements: 1.3_

- [ ] 3. Build Crosshair Rendering System
  - [ ] 3.1 Create CrosshairRenderer component
    - Set up HTML5 Canvas 2D overlay
    - Implement Valorant-style crosshair drawing
    - Add glow effect using shadow blur
    - _Requirements: 8.1, 8.4_
  
  - [ ] 3.2 Implement crosshair customization
    - Create settings UI (color, size, thickness, gap, outline)
    - Real-time preview in settings page
    - Save settings to database
    - _Requirements: 8.2, 8.3, 8.5_

- [ ] 4. Create Target Management System
  - [ ] 4.1 Implement TargetManager with object pooling
    - Pre-create 50 target objects
    - Implement spawn/despawn with pool reuse
    - Create Target interface with mesh, position, size
    - _Requirements: 12.2_
  
  - [ ] 4.2 Build hit detection system
    - Set up raycaster from camera center
    - Implement click event handler
    - Check intersections with active targets
    - Optimize with bounding spheres
    - _Requirements: 12.4_

- [ ] 5. Implement Gridshot Training Scene
  - [ ] 5.1 Create GridshotScene component
    - Set up 3D scene with lighting
    - Define 5 grid positions
    - Implement target spawn logic
    - _Requirements: 2.1_
  
  - [ ] 5.2 Implement game loop and scoring
    - 60-second timer
    - Track hits, misses, accuracy
    - Calculate final score (hits × accuracy multiplier)
    - _Requirements: 2.3, 2.4_
  
  - [ ] 5.3 Handle target hit/respawn
    - Detect hit with raycaster
    - Despawn hit target
    - Spawn new target at random grid position
    - Play hit sound effect
    - _Requirements: 2.2, 14.1_
  
  - [ ] 5.4 Submit score to leaderboard
    - POST score to /api/scores
    - Check if score is in top 10
    - Update leaderboard via Socket.io
    - _Requirements: 2.5, 10.3_

- [ ] 6. Implement Tracking Training Scene
  - [ ] 6.1 Create TrackingScene component
    - Spawn single moving target
    - Implement circular movement pattern
    - Implement linear movement pattern
    - Implement figure-8 movement pattern
    - _Requirements: 3.1, 3.2_
  
  - [ ] 6.2 Implement tracking detection
    - Check if crosshair is on target every frame
    - Accumulate tracking time
    - Calculate accuracy percentage
    - Display real-time tracking %
    - _Requirements: 3.3, 3.4, 3.5_

- [ ] 7. Implement Flicking Training Scene
  - [ ] 7.1 Create FlickingScene component
    - Spawn targets at extreme angles (60°-180°)
    - Randomize spawn delays (0.5-1.5s)
    - Track reaction time per hit
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [ ] 7.2 Implement flick scoring
    - Calculate speed bonus (faster = more points)
    - Calculate distance multiplier
    - Award points based on reaction time and distance
    - _Requirements: 4.2, 4.5_

- [ ] 8. Implement Microshot Training Scene
  - [ ] 8.1 Create MicroshotScene component
    - Spawn small targets (50% size)
    - Vary target distances (5-15 units)
    - _Requirements: 5.1, 5.2_
  
  - [ ] 8.2 Implement precision detection
    - Calculate hit distance from target center
    - Award bonus for center-mass hits
    - Track precision percentage
    - _Requirements: 5.3, 5.4, 5.5_

- [ ] 9. Implement Sixshot Training Scene
  - [ ] 9.1 Create SixshotScene component
    - Spawn 6 targets in circular pattern
    - Track elimination time per set
    - Respawn new set after completion
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 9.2 Implement speed scoring
    - Calculate set completion time
    - Award speed bonus for sub-3-second sets
    - Track average elimination time
    - _Requirements: 6.4, 6.5_

- [ ] 10. Implement Spidershot Training Scene
  - [ ] 10.1 Create SpidershotScene component
    - Spawn targets in full 360° (including behind player)
    - Randomize angles (0°-360° horizontal, ±45° vertical)
    - _Requirements: 7.1, 7.2_
  
  - [ ] 10.2 Implement spatial audio cues
    - Use Web Audio API for 3D positional audio
    - Play spawn sound for targets outside FOV
    - _Requirements: 7.3, 14.3_
  
  - [ ] 10.3 Implement 360° scoring
    - Track which angles player engaged
    - Award bonus for targets outside initial FOV
    - _Requirements: 7.4, 7.5_

- [ ] 11. Build Session Statistics System
  - [ ] 11.1 Create SessionStore (Zustand)
    - Track score, hits, misses, accuracy
    - Track reaction times array
    - Implement start/pause/resume/end actions
    - _Requirements: 13.1, 13.2_
  
  - [ ] 11.2 Create Results screen component
    - Display comprehensive stats
    - Show performance graph (accuracy over time)
    - Compare to personal best
    - Offer retry/dashboard/leaderboard options
    - _Requirements: 13.3, 13.4, 13.5_

- [ ] 12. Implement Audio Feedback System
  - [ ] 12.1 Set up Web Audio API
    - Load hit/miss/spawn sound effects
    - Create audio context and gain nodes
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ] 12.2 Add volume controls to settings
    - Master volume slider
    - Individual sound toggles
    - Mute all option
    - _Requirements: 14.4, 14.5_

- [ ] 13. Enhance Settings Page
  - [ ] 13.1 Implement sensitivity settings
    - Valorant sensitivity input (0.001 - 5.0)
    - Real-time conversion display
    - Sensitivity test area
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 13.2 Implement graphics settings
    - Quality presets (low/medium/high)
    - Shadow toggle
    - Antialiasing toggle
    - FOV slider (60-120)
    - _Requirements: 11.5_

- [ ] 14. Optimize Performance
  - [ ] 14.1 Implement Three.js optimizations
    - Object pooling for targets
    - Frustum culling
    - Reduce draw calls
    - _Requirements: 12.1, 12.2, 12.3_
  
  - [ ] 14.2 Implement React optimizations
    - Code splitting for training scenes
    - React.memo for expensive components
    - useCallback/useMemo where needed
    - _Requirements: 12.5_
  
  - [ ] 14.3 Optimize assets
    - Compress textures
    - Lazy load 3D models
    - _Requirements: 12.5_

- [ ] 15. Enhance Leaderboard System
  - [ ] 15.1 Update leaderboard UI with SCSS
    - Modern card design with glow effects
    - Smooth animations
    - Highlight current user
    - _Requirements: 10.2, 10.5_
  
  - [ ] 15.2 Implement real-time updates
    - Socket.io event listeners
    - Auto-refresh on new scores
    - _Requirements: 10.3_

- [ ] 16. Mobile Responsiveness
  - [ ] 16.1 Make dashboard/leaderboard/settings mobile-friendly
    - Touch-friendly UI elements
    - Responsive grid layouts
    - Optimize for mobile bandwidth
    - _Requirements: 15.1, 15.3, 15.4, 15.5_
  
  - [ ] 16.2 Add "Desktop Required" message for training scenes
    - Detect mobile device
    - Show informative message
    - _Requirements: 15.2_

- [ ] 17. Final Polish and Testing
  - [ ] 17.1 Manual testing checklist
    - Test all 6 training scenes
    - Verify 3D controls
    - Check crosshair rendering
    - Verify score submission
    - Test leaderboard updates
  
  - [ ] 17.2 Performance testing
    - Measure FPS during gameplay
    - Check memory usage
    - Verify API response times
  
  - [ ] 17.3 Cross-browser testing
    - Test on Chrome, Firefox, Edge
    - Verify WebGL 2.0 support
    - Check audio playback

- [ ] 18. Deployment
  - Build frontend with production env vars
  - Deploy to VPS
  - Restart PM2 process
  - Clear Nginx cache
  - Verify production deployment

## Notes

- Each training scene should be implemented and tested individually before moving to the next
- SCSS migration should be done incrementally (one page at a time)
- Performance optimizations should be applied throughout development, not just at the end
- All features must maintain 60 FPS during 3D rendering
- Crosshair and sensitivity settings must be pixel-perfect Valorant replicas
