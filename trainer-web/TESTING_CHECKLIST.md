# Nexora Trainer V2 - Testing Checklist

## Manual Testing

### 1. Authentication
- [ ] Discord login works
- [ ] User session persists after refresh
- [ ] Logout works correctly
- [ ] Protected routes redirect to login

### 2. Training Scenes (All 6 Maps)

#### Gridshot
- [ ] 5 targets spawn at grid positions
- [ ] Targets respawn immediately after hit
- [ ] Score increases on hit
- [ ] Misses are tracked
- [ ] Timer counts down from 60s
- [ ] Game ends at 0 seconds
- [ ] Score submits to leaderboard

#### Tracking
- [ ] Single target moves in patterns
- [ ] Circular pattern works
- [ ] Linear pattern works
- [ ] Figure-8 pattern works
- [ ] Pattern changes every 10 seconds
- [ ] Score increases while tracking
- [ ] Crosshair detection is accurate

#### Flicking
- [ ] Targets spawn at extreme angles
- [ ] Random spawn delays work
- [ ] Speed bonus calculated correctly
- [ ] Distance multiplier works
- [ ] Only one target at a time

#### Microshot
- [ ] Targets are 50% smaller
- [ ] Targets spawn at varying distances
- [ ] Center-hit bonus works (1.5x)
- [ ] Fast spawn rate (0.3-0.7s)

#### Sixshot
- [ ] 6 targets spawn in circle
- [ ] All targets must be eliminated
- [ ] New set spawns after completion
- [ ] Speed bonus for <3s completion
- [ ] Set counter works

#### Spidershot
- [ ] Targets spawn 360° (including behind)
- [ ] Spatial audio plays for targets outside FOV
- [ ] Bonus points for outside-FOV targets
- [ ] 2 targets active simultaneously

### 3. Controls & Camera
- [ ] Mouse look works smoothly
- [ ] Pointer lock activates on game start
- [ ] ESC pauses the game
- [ ] ESC resumes from pause
- [ ] Sensitivity changes apply immediately
- [ ] Vertical rotation clamped correctly
- [ ] No gimbal lock issues

### 4. Crosshair
- [ ] Crosshair renders at screen center
- [ ] Color changes apply
- [ ] Size changes apply
- [ ] Thickness changes apply
- [ ] Gap changes apply
- [ ] Outline works
- [ ] Glow effect visible

### 5. Audio
- [ ] Hit sound plays on target hit
- [ ] Miss sound plays on miss (if enabled)
- [ ] Countdown beeps in last 3 seconds
- [ ] Spatial audio works in Spidershot
- [ ] Volume controls work
- [ ] Mute works

### 6. UI/UX
- [ ] HUD shows score, accuracy, time
- [ ] Pause menu appears on ESC
- [ ] Results screen shows after game
- [ ] Personal best comparison works
- [ ] Leaderboard rank shown if top 10
- [ ] All buttons work
- [ ] Animations smooth

### 7. Settings
- [ ] Sensitivity slider works
- [ ] Crosshair preview updates in real-time
- [ ] FOV changes apply
- [ ] Audio settings save
- [ ] Settings persist after refresh

### 8. Leaderboard
- [ ] Shows top 10 for each map
- [ ] Current user highlighted
- [ ] Auto-refreshes every 30s
- [ ] Map selector works
- [ ] Avatars load correctly
- [ ] Trophy icons for top 3

### 9. Dashboard
- [ ] Shows all 6 maps
- [ ] Personal best displayed
- [ ] Stats overview works
- [ ] Map cards clickable
- [ ] Navigation works

### 10. Mobile Detection
- [ ] Mobile warning shows on mobile
- [ ] Desktop users can access normally
- [ ] Warning message clear and helpful

## Performance Testing

### FPS Targets
- [ ] Gridshot: 60 FPS stable
- [ ] Tracking: 60 FPS stable
- [ ] Flicking: 60 FPS stable
- [ ] Microshot: 60 FPS stable
- [ ] Sixshot: 60 FPS stable
- [ ] Spidershot: 60 FPS stable

### Memory Usage
- [ ] No memory leaks during gameplay
- [ ] Memory usage < 500MB
- [ ] Object pooling working (no GC spikes)

### Network
- [ ] Score submission < 200ms
- [ ] Leaderboard load < 500ms
- [ ] Settings save < 200ms

## Browser Compatibility

### Chrome
- [ ] All features work
- [ ] WebGL 2.0 supported
- [ ] Audio works
- [ ] Pointer lock works

### Firefox
- [ ] All features work
- [ ] WebGL 2.0 supported
- [ ] Audio works
- [ ] Pointer lock works

### Edge
- [ ] All features work
- [ ] WebGL 2.0 supported
- [ ] Audio works
- [ ] Pointer lock works

## Known Issues
- SCSS deprecation warnings (non-critical)
- Bundle size > 500KB (consider code splitting)

## Production Deployment Checklist
- [ ] Environment variables set
- [ ] Frontend built successfully
- [ ] Backend running on port 3001
- [ ] Nginx configured correctly
- [ ] SSL certificate valid
- [ ] MongoDB connected
- [ ] PM2 process running
- [ ] Domain resolves correctly
- [ ] Discord OAuth callback works
- [ ] Cookies work with Cloudflare

## Post-Deployment Verification
- [ ] Login works on production
- [ ] All 6 maps playable
- [ ] Scores save to database
- [ ] Leaderboard updates
- [ ] Settings persist
- [ ] No console errors
- [ ] Performance acceptable
