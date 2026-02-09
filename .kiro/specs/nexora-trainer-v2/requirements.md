# Requirements Document - Nexora Trainer V2

## Introduction

Nexora Trainer V2 is a professional-grade web-based 3D aim training platform designed for the Nexora Discord community. The system provides Aim Labs/Kovaak's quality training scenarios with Valorant-compatible settings, real-time leaderboards, and a modern cyberpunk aesthetic.

## Glossary

- **Training_Scene**: A 3D environment where users practice aim
- **Target**: A clickable 3D object that users must hit
- **Sensitivity**: Mouse movement speed multiplier (Valorant-compatible)
- **Crosshair**: Visual aiming reticle in the center of the screen
- **Hit_Detection**: System that determines if a click intersects with a target
- **Leaderboard**: Ranked list of top 10 scores per training map
- **Session**: A single playthrough of a training scenario
- **Accuracy**: Percentage of successful hits vs total shots
- **Reaction_Time**: Time between target spawn and successful hit

## Requirements

### Requirement 1: 3D First-Person Camera Control

**User Story:** As a player, I want to control my view with mouse movement like in FPS games, so that I can practice realistic aim scenarios.

#### Acceptance Criteria

1. WHEN a player enters a training scene, THE System SHALL lock the mouse pointer and enable first-person camera control
2. WHEN the player moves their mouse, THE Camera SHALL rotate smoothly based on sensitivity settings
3. WHEN the player presses ESC, THE System SHALL unlock the mouse pointer and pause the game
4. THE System SHALL apply Valorant-compatible sensitivity conversion (Valorant sens × 0.07 = Three.js rotation speed)
5. THE Camera SHALL have vertical rotation limits (-89° to +89°) to prevent gimbal lock

### Requirement 2: Gridshot Training Scene

**User Story:** As a player, I want to practice quick target switching on stationary targets, so that I can improve my flick accuracy.

#### Acceptance Criteria

1. WHEN Gridshot starts, THE System SHALL spawn 5 stationary spherical targets in a grid pattern
2. WHEN a target is hit, THE System SHALL immediately despawn it and spawn a new target at a random grid position
3. THE System SHALL track hits, misses, and accuracy for 60 seconds
4. WHEN the timer ends, THE System SHALL calculate and display the final score (hits × accuracy multiplier)
5. THE System SHALL submit the score to the leaderboard if it's in the top 10

### Requirement 3: Tracking Training Scene

**User Story:** As a player, I want to practice following moving targets, so that I can improve my tracking aim.

#### Acceptance Criteria

1. WHEN Tracking starts, THE System SHALL spawn 1 spherical target that moves in smooth patterns
2. THE Target SHALL move at varying speeds (slow, medium, fast) in circular, linear, and figure-8 patterns
3. WHEN the player's crosshair is on the target, THE System SHALL accumulate tracking score
4. THE System SHALL calculate accuracy as (time on target / total time) × 100
5. THE System SHALL display real-time tracking percentage during gameplay

### Requirement 4: Flicking Training Scene

**User Story:** As a player, I want to practice quick flick shots to distant targets, so that I can improve my reaction speed.

#### Acceptance Criteria

1. WHEN Flicking starts, THE System SHALL spawn targets at extreme angles (60°-180° from center)
2. WHEN a target is hit, THE System SHALL measure reaction time and award bonus points for fast hits
3. THE System SHALL spawn targets with 0.5-1.5 second delays between spawns
4. THE System SHALL track average reaction time and flick distance
5. THE System SHALL calculate score based on (hits × speed bonus × distance multiplier)

### Requirement 5: Microshot Training Scene

**User Story:** As a player, I want to practice precision aim on small targets, so that I can improve my accuracy on distant enemies.

#### Acceptance Criteria

1. WHEN Microshot starts, THE System SHALL spawn small targets (50% smaller than Gridshot)
2. THE Targets SHALL appear at varying distances (5-15 units from camera)
3. THE System SHALL require precise crosshair placement for successful hits
4. THE System SHALL track precision percentage (center hits vs edge hits)
5. THE System SHALL award bonus points for center-mass hits

### Requirement 6: Sixshot Training Scene

**User Story:** As a player, I want to practice eliminating multiple targets quickly, so that I can improve my multi-target engagement.

#### Acceptance Criteria

1. WHEN Sixshot starts, THE System SHALL spawn 6 targets simultaneously in a circular pattern
2. WHEN all 6 targets are eliminated, THE System SHALL record the completion time
3. THE System SHALL spawn a new set of 6 targets immediately after completion
4. THE System SHALL track average elimination time per set
5. THE System SHALL calculate score based on (sets completed × speed bonus)

### Requirement 7: Spidershot Training Scene

**User Story:** As a player, I want to practice 360° awareness and target acquisition, so that I can improve my spatial awareness.

#### Acceptance Criteria

1. WHEN Spidershot starts, THE System SHALL spawn targets in all directions (including behind the player)
2. THE Targets SHALL appear at random angles (0°-360° horizontal, -45° to +45° vertical)
3. THE System SHALL provide audio cues for target spawns outside the field of view
4. THE System SHALL track 360° coverage (which angles the player engaged)
5. THE System SHALL award bonus points for targets hit outside the initial field of view

### Requirement 8: Crosshair Customization

**User Story:** As a player, I want to customize my crosshair exactly like in Valorant, so that I can use familiar aiming references.

#### Acceptance Criteria

1. THE System SHALL provide crosshair settings matching Valorant's options (color, size, thickness, gap, outline)
2. WHEN a player changes crosshair settings, THE System SHALL update the crosshair in real-time
3. THE System SHALL save crosshair settings to the database per user
4. THE System SHALL render the crosshair as a 2D overlay on top of the 3D scene
5. THE Crosshair SHALL remain centered and visible in all lighting conditions

### Requirement 9: Sensitivity Settings

**User Story:** As a player, I want to use my exact Valorant sensitivity, so that my muscle memory transfers perfectly.

#### Acceptance Criteria

1. THE System SHALL accept Valorant sensitivity values (0.001 - 5.0)
2. THE System SHALL convert Valorant sensitivity to Three.js rotation speed using the formula: `rotation = valorantSens × 0.07`
3. WHEN a player changes sensitivity, THE System SHALL apply it immediately without restart
4. THE System SHALL provide a sensitivity test area in settings
5. THE System SHALL save sensitivity settings to the database per user

### Requirement 10: Leaderboard System

**User Story:** As a player, I want to see the top 10 scores for each map, so that I can compete with other players.

#### Acceptance Criteria

1. WHEN a session ends, THE System SHALL check if the score qualifies for the top 10
2. THE System SHALL display rank, username, score, accuracy, and date for each leaderboard entry
3. THE System SHALL update leaderboards in real-time using Socket.io
4. THE System SHALL maintain separate leaderboards for each of the 6 training maps
5. THE System SHALL highlight the current user's position if they are in the top 10

### Requirement 11: Modern UI/UX Design

**User Story:** As a player, I want a visually stunning and intuitive interface, so that the experience feels premium and engaging.

#### Acceptance Criteria

1. THE System SHALL use SCSS for styling with a cyberpunk/futuristic theme
2. THE System SHALL implement glow effects on interactive elements (buttons, cards, crosshair)
3. THE System SHALL provide smooth transitions and animations (fade, slide, scale)
4. THE System SHALL be fully responsive (desktop, tablet, mobile)
5. THE System SHALL maintain 60 FPS performance during 3D rendering

### Requirement 12: Performance Optimization

**User Story:** As a player, I want smooth 60 FPS gameplay, so that my aim practice is not hindered by lag.

#### Acceptance Criteria

1. THE System SHALL render 3D scenes at a minimum of 60 FPS on mid-range hardware
2. THE System SHALL use object pooling for targets to minimize garbage collection
3. THE System SHALL implement frustum culling to avoid rendering off-screen objects
4. THE System SHALL use efficient hit detection (raycasting with bounding spheres)
5. THE System SHALL lazy-load 3D assets and textures

### Requirement 13: Session Statistics

**User Story:** As a player, I want detailed statistics after each session, so that I can track my improvement.

#### Acceptance Criteria

1. WHEN a session ends, THE System SHALL display a results screen with comprehensive stats
2. THE System SHALL show: total score, accuracy %, average reaction time, hits, misses, and rank
3. THE System SHALL provide a performance graph showing accuracy over time
4. THE System SHALL compare the current session to the player's personal best
5. THE System SHALL offer options to retry, return to dashboard, or view leaderboard

### Requirement 14: Audio Feedback

**User Story:** As a player, I want audio feedback for hits and misses, so that I can focus on aiming without looking at UI.

#### Acceptance Criteria

1. WHEN a target is hit, THE System SHALL play a satisfying "hit" sound effect
2. WHEN a shot misses, THE System SHALL play a subtle "miss" sound effect
3. WHEN a target spawns, THE System SHALL play a spawn sound (especially for Spidershot)
4. THE System SHALL provide volume controls in settings
5. THE System SHALL allow players to mute audio entirely

### Requirement 15: Mobile Responsiveness

**User Story:** As a player, I want to view leaderboards and settings on mobile, so that I can check my stats on the go.

#### Acceptance Criteria

1. THE System SHALL display dashboard, leaderboards, and settings properly on mobile devices
2. THE System SHALL show a "Desktop Required" message when accessing training scenes on mobile
3. THE System SHALL use touch-friendly UI elements (larger buttons, swipe gestures)
4. THE System SHALL optimize images and assets for mobile bandwidth
5. THE System SHALL maintain the visual design aesthetic on all screen sizes
