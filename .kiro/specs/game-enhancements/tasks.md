# Implementation Plan: Game Enhancements

## Overview

Implement six enhancements to `demo-game/game.js` incrementally, each building on the existing single-file vanilla JS architecture. All changes are confined to `game.js`.

## Tasks

- [x] 1. Score & high score persistence
  - [x] 1.1 Add `highScore` state variable and `loadHighScore()` / `saveHighScore()` helpers with `try/catch` for unavailable localStorage
    - Call `loadHighScore()` once at script initialisation (before `loop()`)
    - _Requirements: 1.3, 1.4_
  - [x] 1.2 Wire `saveHighScore()` into the goal-detection block whenever `score > highScore`
    - _Requirements: 1.1, 1.2_
  - [x] 1.3 Extend `drawHUD()` to render `HIGH: N` alongside the existing goal counter
    - _Requirements: 1.5_
  - [ ]* 1.4 Write property test for localStorage round-trip (Property 1)
    - **Property 1: localStorage round-trip**
    - **Validates: Requirements 1.2, 1.3**
  - [ ]* 1.5 Write property test for invalid localStorage input defaults to 0 (Property 2)
    - **Property 2: localStorage invalid input defaults to 0**
    - **Validates: Requirements 1.4**
  - [ ]* 1.6 Write property test for HUD contains both score values (Property 3)
    - **Property 3: HUD contains both score values**
    - **Validates: Requirements 1.5**

- [x] 2. Three-kick limit per round
  - [x] 2.1 Add `MAX_KICKS = 3` constant and `kickCount` state variable; reset in `startGame()`
    - _Requirements: 6.1, 6.6_
  - [x] 2.2 Increment `kickCount` inside the player↔ball collision block (guarded by `kickCooldown`); transition to `'gameOver'` when `kickCount >= MAX_KICKS` and no goal was scored this frame
    - _Requirements: 6.2, 6.4_
  - [x] 2.3 Reset `kickCount` to 0 inside the goal-detection block
    - _Requirements: 6.3_
  - [x] 2.4 Add remaining-kicks display to `drawHUD()`: `KICKS: ${MAX_KICKS - kickCount}` right-aligned
    - _Requirements: 6.5_
  - [ ]* 2.5 Write property test for kick counter state machine (Property 14)
    - **Property 14: Kick counter state machine**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**
  - [ ]* 2.6 Write property test for HUD displays remaining kicks (Property 15)
    - **Property 15: HUD displays remaining kicks**
    - **Validates: Requirements 6.5**

- [x] 3. Kick trail flash effect
  - [x] 3.1 Add `KICK_TRAIL_FRAMES`, `KICK_TRAIL_COLOR`, `KICK_TRAIL_WIDTH` constants and `kickTrail` state variable (null when inactive); reset in `startGame()`
    - _Requirements: 2.1, 2.2_
  - [x] 3.2 Set `kickTrail` inside the player↔ball collision block; decrement `kickTrail.life` each frame in `update()` and null it when expired
    - _Requirements: 2.1, 2.3, 2.4, 2.5_
  - [x] 3.3 Implement `drawKickTrail()` using `globalAlpha = life / KICK_TRAIL_FRAMES`; call it after `drawPlayer()` in `loop()`
    - _Requirements: 2.2, 2.3_
  - [ ]* 3.4 Write property test for kick trail lifetime and opacity (Property 4)
    - **Property 4: Kick trail lifetime and opacity**
    - **Validates: Requirements 2.1, 2.3**
  - [ ]* 3.5 Write property test for kick trail reset on new kick (Property 5)
    - **Property 5: Kick trail reset on new kick**
    - **Validates: Requirements 2.5**

- [x] 4. Background crowd fans + goalpost collision sound
  - [x] 4.1 Add fan constants (`FAN_COUNT`, `FAN_COLORS`, `FAN_AMPLITUDE`, `FAN_SPEED`) and `fans[]` array; implement `initFans()` and call it before `loop()`
    - _Requirements: 3.1, 3.2_
  - [x] 4.2 Implement `drawFans()` with sine-wave vertical oscillation gated on `gameState === 'playing'`; call it inside `drawBackground()` after the sky fill
    - _Requirements: 3.3, 3.4, 3.5_
  - [x] 4.3 Add lazy `audioCtx` init via `getAudioCtx()`; resume on existing `keydown`/`click` listeners; implement `playGoalpostClang()` with oscillator frequency ramp 440→220 Hz over 300 ms
    - _Requirements: 4.1, 4.2, 4.3_
  - [x] 4.4 Add `goalpPostContactActive` flag and `ballHitsRect()` helper; wire goalpost AABB collision check into `update()` with debounce logic
    - _Requirements: 4.4, 4.5_
  - [ ]* 4.5 Write property test for fan count invariant (Property 6)
    - **Property 6: Fan count invariant**
    - **Validates: Requirements 3.1**
  - [ ]* 4.6 Write property test for fan animation state dependency (Property 7)
    - **Property 7: Fan animation state dependency**
    - **Validates: Requirements 3.3, 3.4**
  - [ ]* 4.7 Write property test for goalpost AABB collision correctness (Property 8)
    - **Property 8: Goalpost AABB collision correctness**
    - **Validates: Requirements 4.5**
  - [ ]* 4.8 Write property test for goalpost sound plays once per contact (Property 9)
    - **Property 9: Goalpost sound plays once per contact**
    - **Validates: Requirements 4.4**

- [x] 5. Confetti on new high score
  - [x] 5.1 Add `CONFETTI_COLORS`, `CONFETTI_COUNT`, `NEW_HS_DISPLAY_FRAMES` constants and `confettiParticles[]` / `newHighScoreTimer` state; reset both in `startGame()`
    - _Requirements: 5.1, 5.2_
  - [x] 5.2 Implement `spawnConfetti()` spawning 60 particles with randomised attributes; call it inside the goal-detection block when `score > highScore`; set `newHighScoreTimer = NEW_HS_DISPLAY_FRAMES`
    - _Requirements: 5.1, 5.2_
  - [x] 5.3 Add confetti physics update in `update()` (gravity +0.1, ±0.5 drift, remove when `y >= H`); implement `drawConfetti()` and call it after `drawParticles()` in `loop()`
    - _Requirements: 5.3, 5.4_
  - [x] 5.4 Render `NEW HIGH SCORE!` text in `drawHUD()` in `#FFD700` for `newHighScoreTimer > 0` frames
    - _Requirements: 5.5_
  - [ ]* 5.5 Write property test for confetti spawn count (Property 10)
    - **Property 10: Confetti spawn count**
    - **Validates: Requirements 5.1**
  - [ ]* 5.6 Write property test for confetti particle attributes in range (Property 11)
    - **Property 11: Confetti particle attributes in range**
    - **Validates: Requirements 5.2**
  - [ ]* 5.7 Write property test for confetti physics update (Property 12)
    - **Property 12: Confetti physics update**
    - **Validates: Requirements 5.3**
  - [ ]* 5.8 Write property test for confetti removal at canvas bottom (Property 13)
    - **Property 13: Confetti removal at canvas bottom**
    - **Validates: Requirements 5.4**

- [ ] 6. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Property tests use **fast-check** (`npm install --save-dev fast-check`) — not bundled into the game
- All changes are in `demo-game/game.js` only — no new files, no build step
- Each task references specific requirements for traceability
