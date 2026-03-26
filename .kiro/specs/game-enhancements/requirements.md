# Requirements Document

## Introduction

This document defines the MVP requirements for enhancing the Kiro Soccer browser game with persistent score tracking and visual/audio effects. The enhancements include saving the player's score and high score using localStorage, a kick trail flash effect between Kiro and the ball, animated crowd fans in the background, a goalpost collision sound, and a confetti burst when the player sets a new high score. All features are implemented in vanilla JavaScript using the HTML5 Canvas API within the existing single-file architecture.

## Glossary

- **Game**: The Kiro Soccer browser game running in `game.js` via `requestAnimationFrame` at 60 FPS
- **Player**: The Kiro-logo sprite controlled by keyboard input
- **Ball**: The soccer ball object with position and velocity properties
- **Score**: The number of goals scored in the current session
- **High_Score**: The highest score ever achieved, persisted across sessions via localStorage
- **Trail**: A short-lived visual flash rendered between the Player and the Ball at the moment of a kick
- **Fan**: A simple animated silhouette figure rendered in the background stadium area above the ground line
- **Goalpost**: The white rectangular post and crossbar structure at the right side of the canvas
- **Confetti_Particle**: A colored rectangular particle spawned when a new high score is achieved
- **HUD**: The heads-up display drawn on the canvas showing score and high score

---

## Requirements

### Requirement 1: Score and High Score Persistence

**User Story:** As a player, I want my score and high score to be saved between sessions, so that I can track my personal best across multiple plays.

#### Acceptance Criteria

1. WHEN a goal is scored, THE Game SHALL increment the current session score by 1.
2. WHEN a game session ends or a goal is scored and the current score exceeds the stored high score, THE Game SHALL write the new high score to localStorage under the key `kiroSoccerHighScore`.
3. WHEN the Game initialises, THE Game SHALL read the high score from localStorage and display it in the HUD.
4. IF localStorage is unavailable or returns a non-numeric value, THEN THE Game SHALL default the high score to 0 without throwing an error.
5. THE HUD SHALL display both the current session score and the all-time high score simultaneously during gameplay.

---

### Requirement 2: Kick Flash Effect

**User Story:** As a player, I want to see a radial flash burst at the point of contact when a kick happens, so that the kick feels impactful and satisfying.

#### Acceptance Criteria

1. WHEN the Player collides with the Ball and a kick is applied, THE Game SHALL render a radial flash burst centred on the Player's contact point for exactly 8 frames.
2. THE flash SHALL consist of an expanding outer glow ring using the brand color `#790ECB` (Purple-500), an inner white filled circle, and 8 starburst lines radiating outward.
3. WHILE the flash is active, THE flash SHALL expand outward and decrease in opacity linearly from 1.0 to 0.0 over its 8-frame lifetime.
4. WHEN the flash lifetime expires, THE Game SHALL remove the flash and render no residual effect.
5. IF a new kick occurs while a flash is still active, THEN THE Game SHALL reset the flash lifetime to 8 frames from the new kick moment.

---

### Requirement 3: Background Crowd Fans

**User Story:** As a player, I want to see animated fans in the background, so that the game feels like a real stadium match.

#### Acceptance Criteria

1. THE Game SHALL render a row of at least 12 Fan silhouettes in the background area between y=0 and the ground line.
2. THE Fan silhouettes SHALL be drawn using simple filled shapes (circle for head, rectangle for body) in muted colors that do not distract from gameplay.
3. WHILE the gameState is `'playing'`, THE Fans SHALL animate by oscillating vertically by 3 pixels using a sine wave tied to `frameCount`, with each Fan offset by a unique phase so they do not all move in unison.
4. WHILE the gameState is `'start'` or `'gameOver'`, THE Fans SHALL remain stationary at their base positions.
5. THE Fan rendering SHALL complete within the existing `drawBackground` call order so Fans appear behind the goal, ball, and player.

---

### Requirement 4: Goalpost Collision Sound

**User Story:** As a player, I want to hear a sound when the ball hits the goalpost, so that near-misses feel distinct and reactive.

#### Acceptance Criteria

1. WHEN the Ball contacts the Goalpost geometry (post or crossbar rectangles), THE Game SHALL play a short metallic clang sound using the Web Audio API `AudioContext`.
2. THE sound SHALL be synthesised procedurally using an `OscillatorNode` with a frequency of 440 Hz decaying to 220 Hz over 300 milliseconds, requiring no external audio file.
3. IF the browser has not received a user gesture and the `AudioContext` is suspended, THEN THE Game SHALL resume the `AudioContext` on the next user input event before playing the sound.
4. WHEN the Ball is in contact with the Goalpost for consecutive frames, THE Game SHALL play the sound only once per contact event, not once per frame.
5. THE goalpost collision detection SHALL check the Ball circle against the post rectangle (`GOAL.x`, `GOAL.y`, `GOAL.w`, `GOAL.h`) and the crossbar rectangle using axis-aligned bounding box overlap.

---

### Requirement 5: Confetti on New High Score

**User Story:** As a player, I want to see a confetti burst when I beat my high score, so that the achievement feels rewarding and celebratory.

#### Acceptance Criteria

1. WHEN a goal is scored and the resulting score exceeds the stored high score, THE Game SHALL spawn 60 Confetti_Particles at random x positions along the top of the canvas.
2. EACH Confetti_Particle SHALL have a random color chosen from the set `['#790ECB', '#9b3de8', '#ffffff', '#FFD700']`, a random width between 6 and 12 pixels, a random height between 4 and 8 pixels, and a random initial downward velocity between 2 and 5 pixels per frame.
3. WHILE Confetti_Particles are active, THE Game SHALL apply a horizontal drift of ±0.5 pixels per frame and a gravity increment of 0.1 pixels per frame squared to each particle.
4. WHEN a Confetti_Particle exits the bottom of the canvas, THE Game SHALL remove it from the particles array.
5. THE Game SHALL display the text `NEW HIGH SCORE!` in the HUD for 120 frames after a new high score is set, rendered in `#FFD700` (gold) using the existing `Courier New` font at 18px.

---

### Requirement 6: Three-Kick Limit Per Round

**User Story:** As a player, I want a limited number of kicks per round, so that each attempt feels tense and I must score efficiently.

#### Acceptance Criteria

1. THE Game SHALL allow the Player exactly 3 kick attempts per round.
2. WHEN the Player collides with the Ball and a kick is applied, THE Game SHALL increment the kick counter for the current round by 1.
3. WHEN a goal is scored within 3 kicks, THE Game SHALL reset the kick counter to 0 and begin a new round.
4. WHEN the kick counter reaches 3 and no goal has been scored, THE Game SHALL transition the gameState to `'gameOver'`.
5. THE HUD SHALL display the number of remaining kicks for the current round during gameplay.
6. WHEN a new game session starts, THE Game SHALL reset the kick counter to 0.
