# Design Document: Game Enhancements

## Overview

This document describes the technical design for six enhancements to the Kiro Soccer browser game. All features are implemented within the existing single-file architecture (`demo-game/game.js`) using vanilla JavaScript and the HTML5 Canvas API. No external dependencies, build tools, or additional files are introduced.

The enhancements are:
1. Score and high score persistence via `localStorage`
2. Kick trail flash effect (purple line between Kiro and ball)
3. Background crowd fans (animated silhouettes)
4. Goalpost collision sound (Web Audio API, procedural synthesis)
5. Confetti burst on new high score
6. Three-kick limit per round

---

## Architecture

The game follows a single-file, single-loop architecture. All state lives in module-level variables; all rendering happens inside named `draw*` functions called from the main `loop()`. The `update()` function advances physics and game logic each frame.

Each enhancement slots into this existing structure:

```
Constants
  + KICK_TRAIL_FRAMES, CONFETTI_COLORS, MAX_KICKS, FAN_COUNT, ...

State
  + highScore, kickTrail, fans[], confettiParticles[], kickCount,
    newHighScoreTimer, goalpPostContactActive

Input
  + AudioContext resume on first user gesture

Helpers
  + loadHighScore(), saveHighScore(), playGoalpostClang()

Update (per-frame logic)
  + trail lifetime decrement
  + fan animation (playing state only)
  + goalpost AABB collision + sound debounce
  + confetti physics
  + kick counter → gameOver transition

Draw
  + drawFans() called inside drawBackground()
  + drawKickTrail() called after drawPlayer()
  + drawConfetti() called after drawParticles()
  + drawHUD() extended with highScore, kicksRemaining, newHighScoreTimer text

startGame()
  + reset kickCount, kickTrail, confettiParticles, newHighScoreTimer
```

The draw order in `loop()` becomes:

```
drawBackground()        ← fans drawn here (behind everything)
drawGoal()
drawBall()
drawPlayer()
drawKickTrail()         ← trail on top of player/ball
drawParticles()         ← existing goal burst
drawConfetti()          ← new high score confetti
drawHUD()               ← score, highScore, kicks remaining, NEW HIGH SCORE! text
```

---

## Components and Interfaces

### 1. Score & High Score Persistence

**New state:**
```js
let highScore = 0;
```

**New helpers:**
```js
function loadHighScore() {
  try {
    const v = parseInt(localStorage.getItem('kiroSoccerHighScore'), 10);
    highScore = isNaN(v) ? 0 : v;
  } catch (_) { highScore = 0; }
}

function saveHighScore() {
  try { localStorage.setItem('kiroSoccerHighScore', highScore); } catch (_) {}
}
```

`loadHighScore()` is called once at script initialisation. `saveHighScore()` is called whenever `highScore` is updated (inside the goal-detection block).

**HUD change:** `drawHUD()` renders `HIGH: N` alongside the existing goal counter.

---

### 2. Kick Trail Flash Effect

**New state:**
```js
let kickTrail = null;
// shape: { x1, y1, x2, y2, life: 8 }
```

**Constants:**
```js
const KICK_TRAIL_FRAMES = 8;
const KICK_TRAIL_COLOR  = '#790ECB';
const KICK_TRAIL_WIDTH  = 3;
```

**Trigger:** Inside the player↔ball collision block in `update()`, after applying kick velocity:
```js
kickTrail = {
  x1: player.x + PLAYER_W / 2,
  y1: player.y + PLAYER_H / 2,
  x2: ball.x,
  y2: ball.y,
  life: KICK_TRAIL_FRAMES,
};
```

**Per-frame update** (in `update()`):
```js
if (kickTrail) {
  kickTrail.life--;
  if (kickTrail.life <= 0) kickTrail = null;
}
```

**Draw function:**
```js
function drawKickTrail() {
  if (!kickTrail) return;
  ctx.save();
  ctx.globalAlpha  = kickTrail.life / KICK_TRAIL_FRAMES;
  ctx.strokeStyle  = KICK_TRAIL_COLOR;
  ctx.lineWidth    = KICK_TRAIL_WIDTH;
  ctx.beginPath();
  ctx.moveTo(kickTrail.x1, kickTrail.y1);
  ctx.lineTo(kickTrail.x2, kickTrail.y2);
  ctx.stroke();
  ctx.restore();
}
```

---

### 3. Background Crowd Fans

**Constants:**
```js
const FAN_COUNT      = 14;
const FAN_COLORS     = ['#3a2a4a', '#2a1a3a', '#4a2a5a', '#1a1a2a'];
const FAN_AMPLITUDE  = 3;   // px vertical oscillation
const FAN_SPEED      = 0.04; // radians per frame
```

**Initialisation** (called once at script start, before `loop()`):
```js
const fans = [];
function initFans() {
  for (let i = 0; i < FAN_COUNT; i++) {
    fans.push({
      x:     (W / FAN_COUNT) * i + W / FAN_COUNT / 2,
      baseY: 60 + Math.random() * (GROUND_Y - 120),
      phase: (i / FAN_COUNT) * Math.PI * 2,
      color: FAN_COLORS[i % FAN_COLORS.length],
      scale: 0.7 + Math.random() * 0.6,
    });
  }
}
```

**Draw function** (called inside `drawBackground()` after the sky fill):
```js
function drawFans() {
  fans.forEach(fan => {
    const dy = gameState === 'playing'
      ? FAN_AMPLITUDE * Math.sin(frameCount * FAN_SPEED + fan.phase)
      : 0;
    const y = fan.baseY + dy;
    const s = fan.scale;

    ctx.fillStyle = fan.color;
    // Head
    ctx.beginPath();
    ctx.arc(fan.x, y - 14 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillRect(fan.x - 5 * s, y - 8 * s, 10 * s, 16 * s);
  });
}
```

Fans are drawn before the goal, ball, and player, so they appear behind all gameplay elements.

---

### 4. Goalpost Collision Sound

**AudioContext setup** (module-level, lazy init):
```js
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
```

**Resume on user gesture** — added to the existing `keydown` and `click` listeners:
```js
if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
```

**Sound synthesis:**
```js
function playGoalpostClang() {
  const ctx = getAudioCtx();
  if (ctx.state === 'suspended') return; // will retry on next gesture
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type      = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}
```

**Debounce state:**
```js
let goalpPostContactActive = false;
```

**Collision detection** (in `update()`, after ball physics):

The goalpost geometry from the existing code:
- Post (vertical bar): `{ x: GOAL.x, y: GOAL.y, w: GOAL.w, h: GOAL.h }`
- Crossbar (horizontal bar): `{ x: GOAL.x - 40, y: GOAL.y, w: 40 + GOAL.w, h: GOAL.w }`

AABB vs circle overlap helper:
```js
function ballHitsRect(rx, ry, rw, rh) {
  const cx = Math.max(rx, Math.min(ball.x, rx + rw));
  const cy = Math.max(ry, Math.min(ball.y, ry + rh));
  const dx = ball.x - cx, dy = ball.y - cy;
  return dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS;
}
```

Usage in `update()`:
```js
const hitsPost     = ballHitsRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);
const hitsCrossbar = ballHitsRect(GOAL.x - 40, GOAL.y, 40 + GOAL.w, GOAL.w);
const hitsGoalpost = hitsPost || hitsCrossbar;

if (hitsGoalpost && !goalpPostContactActive) {
  goalpPostContactActive = true;
  playGoalpostClang();
} else if (!hitsGoalpost) {
  goalpPostContactActive = false;
}
```

---

### 5. Confetti on New High Score

**Constants:**
```js
const CONFETTI_COLORS   = ['#790ECB', '#9b3de8', '#ffffff', '#FFD700'];
const CONFETTI_COUNT    = 60;
const NEW_HS_DISPLAY_FRAMES = 120;
```

**New state:**
```js
let confettiParticles  = [];
let newHighScoreTimer  = 0;
```

**Spawn function** (called inside goal-detection block when `score > highScore`):
```js
function spawnConfetti() {
  for (let i = 0; i < CONFETTI_COUNT; i++) {
    confettiParticles.push({
      x:     Math.random() * W,
      y:     0,
      vx:    (Math.random() - 0.5),
      vy:    2 + Math.random() * 3,
      w:     6 + Math.random() * 6,
      h:     4 + Math.random() * 4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    });
  }
  newHighScoreTimer = NEW_HS_DISPLAY_FRAMES;
}
```

**Per-frame update** (in `update()`):
```js
confettiParticles.forEach(p => {
  p.x  += p.vx;
  p.y  += p.vy;
  p.vy += 0.1;
  p.vx += (Math.random() - 0.5) * 0.5; // ±0.5 drift
});
confettiParticles = confettiParticles.filter(p => p.y < H);
if (newHighScoreTimer > 0) newHighScoreTimer--;
```

**Draw function:**
```js
function drawConfetti() {
  confettiParticles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
  });
}
```

**HUD text** (inside `drawHUD()` when `newHighScoreTimer > 0`):
```js
ctx.fillStyle = '#FFD700';
ctx.font      = '18px Courier New';
ctx.textAlign = 'center';
ctx.fillText('NEW HIGH SCORE!', W / 2, 80);
```

---

### 6. Three-Kick Limit Per Round

**Constants:**
```js
const MAX_KICKS = 3;
```

**New state:**
```js
let kickCount = 0;
```

**Kick increment** — inside the player↔ball collision block in `update()`, guarded so it only fires once per collision event (reusing the existing `kickCooldown` mechanism):
```js
kickCount++;
if (kickCount >= MAX_KICKS && /* no goal this frame */) {
  gameState = 'gameOver';
}
```

The game-over transition is deferred: after the kick is applied, the ball is in motion. The check `kickCount >= MAX_KICKS` triggers `gameOver` only when the ball comes to rest or exits without scoring — specifically, it transitions when the ball resets (goes out of bounds or stops) and no goal was scored. A simpler approach: transition immediately when the 3rd kick is applied and no goal is detected in the same frame.

**Goal reset** (inside goal-detection block):
```js
kickCount = 0;
```

**`startGame()` reset:**
```js
kickCount = 0;
```

**HUD display** (inside `drawHUD()`):
```js
ctx.fillStyle = WHITE;
ctx.font      = '14px Courier New';
ctx.textAlign = 'right';
ctx.fillText(`KICKS: ${MAX_KICKS - kickCount}`, W - 20, 30);
```

**Game Over screen** — the existing `drawGameOver()` already shows the score; no structural change needed.

---

## Data Models

### kickTrail
```js
{
  x1: number,  // player centre x at kick moment
  y1: number,  // player centre y at kick moment
  x2: number,  // ball centre x at kick moment
  y2: number,  // ball centre y at kick moment
  life: number // frames remaining [0..8]
}
// null when inactive
```

### Fan
```js
{
  x:     number,  // fixed horizontal position
  baseY: number,  // vertical rest position
  phase: number,  // sine wave phase offset (radians)
  color: string,  // muted fill color
  scale: number,  // size multiplier [0.7..1.3]
}
```

### ConfettiParticle
```js
{
  x:     number,  // current x
  y:     number,  // current y
  vx:    number,  // horizontal velocity (±0.5 drift applied each frame)
  vy:    number,  // vertical velocity (gravity +0.1 each frame)
  w:     number,  // width [6..12]
  h:     number,  // height [4..8]
  color: string,  // from CONFETTI_COLORS
}
```

### localStorage schema
| Key | Type | Default |
|-----|------|---------|
| `kiroSoccerHighScore` | string (numeric) | `"0"` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: localStorage round-trip

*For any* numeric high score value written to localStorage under `kiroSoccerHighScore`, calling `loadHighScore()` immediately after should produce the same numeric value in the `highScore` variable.

**Validates: Requirements 1.2, 1.3**

---

### Property 2: localStorage invalid input defaults to 0

*For any* value stored in `kiroSoccerHighScore` that is non-numeric (null, undefined, empty string, "abc", NaN), `loadHighScore()` should set `highScore` to exactly 0 without throwing.

**Validates: Requirements 1.4**

---

### Property 3: HUD contains both score values

*For any* combination of `score` and `highScore`, the canvas output of `drawHUD()` should include rendering calls that reference both values (score and high score are both drawn).

**Validates: Requirements 1.5**

---

### Property 4: Kick trail lifetime and opacity

*For any* kick event, the resulting `kickTrail` object should have `life === 8`, and for any frame t where `life === k`, the opacity used when drawing should equal `k / 8`.

**Validates: Requirements 2.1, 2.3**

---

### Property 5: Kick trail reset on new kick

*For any* `kickTrail` with `life` in [1..7], when a new kick occurs, `kickTrail.life` should be reset to exactly 8.

**Validates: Requirements 2.5**

---

### Property 6: Fan count invariant

*For any* initialisation of the game, `fans.length` should be greater than or equal to 12.

**Validates: Requirements 3.1**

---

### Property 7: Fan animation state dependency

*For any* fan and any `frameCount`, when `gameState === 'playing'` the computed y-offset should be `FAN_AMPLITUDE * sin(frameCount * FAN_SPEED + fan.phase)` (non-zero for most frames), and when `gameState` is `'start'` or `'gameOver'` the y-offset should be exactly 0.

**Validates: Requirements 3.3, 3.4**

---

### Property 8: Goalpost AABB collision correctness

*For any* ball position, `ballHitsRect(rx, ry, rw, rh)` should return `true` if and only if the distance from the ball centre to the nearest point on the rectangle is less than `BALL_RADIUS`.

**Validates: Requirements 4.5**

---

### Property 9: Goalpost sound plays once per contact

*For any* sequence of consecutive frames where the ball remains in contact with the goalpost, `playGoalpostClang()` should be called exactly once (on the first contact frame), not once per frame.

**Validates: Requirements 4.4**

---

### Property 10: Confetti spawn count

*For any* new-high-score event, `confettiParticles.length` should increase by exactly 60.

**Validates: Requirements 5.1**

---

### Property 11: Confetti particle attributes in range

*For any* spawned `ConfettiParticle`, its `w` should be in [6, 12], its `h` in [4, 8], its `vy` in [2, 5], and its `color` should be a member of `CONFETTI_COLORS`.

**Validates: Requirements 5.2**

---

### Property 12: Confetti physics update

*For any* `ConfettiParticle` before and after one `update()` step, `vy_after === vy_before + 0.1` and `|vx_after - vx_before| <= 0.5`.

**Validates: Requirements 5.3**

---

### Property 13: Confetti removal at canvas bottom

*For any* state of `confettiParticles` after an `update()` call, no particle in the array should have `y >= H`.

**Validates: Requirements 5.4**

---

### Property 14: Kick counter state machine

*For any* sequence of kicks and goals: (a) each kick increments `kickCount` by 1, (b) each goal resets `kickCount` to 0, and (c) when `kickCount` reaches `MAX_KICKS` (3) without a goal, `gameState` transitions to `'gameOver'`.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.6**

---

### Property 15: HUD displays remaining kicks

*For any* value of `kickCount` in [0, MAX_KICKS], the canvas output of `drawHUD()` should include a rendering call that displays `MAX_KICKS - kickCount` as the remaining kicks.

**Validates: Requirements 6.5**

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| `localStorage` unavailable (private browsing, quota exceeded) | `try/catch` in `loadHighScore()` and `saveHighScore()`; silently defaults to 0 |
| `AudioContext` suspended (autoplay policy) | `playGoalpostClang()` returns early if suspended; context is resumed on next user gesture via existing `keydown`/`click` listeners |
| `AudioContext` not supported | `window.AudioContext \|\| window.webkitAudioContext` fallback; if both undefined, `getAudioCtx()` returns null and `playGoalpostClang()` is a no-op |
| Ball stuck in goalpost (tunnelling) | AABB check runs every frame; `goalpPostContactActive` flag prevents repeated sound; ball velocity reversal is handled by existing wall-bounce logic |
| `kiro-logo.png` not loaded | Existing `sprite` image object; canvas `drawImage` silently draws nothing if image not loaded — no change needed |

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are used. Unit tests cover specific examples and integration points; property tests verify universal correctness across randomised inputs.

### Property-Based Testing

Library: **fast-check** (JavaScript) — `npm install --save-dev fast-check` for test runs only; not bundled into the game.

Each property test runs a minimum of **100 iterations**.

Tag format per test: `// Feature: game-enhancements, Property N: <property text>`

Each correctness property above maps to exactly one property-based test:

| Property | Test description |
|----------|-----------------|
| P1 | Arbitrary numeric highScore → write → loadHighScore → equals original |
| P2 | Arbitrary non-numeric string/null → loadHighScore → highScore === 0 |
| P3 | Arbitrary score + highScore → spy on ctx calls → both values referenced |
| P4 | Any kick event → kickTrail.life === 8; any life k → opacity === k/8 |
| P5 | Any kickTrail.life in [1..7] → new kick → life === 8 |
| P6 | After initFans() → fans.length >= 12 |
| P7 | Any fan + frameCount → y-offset formula correct per gameState |
| P8 | Any ball (x,y) → ballHitsRect result matches geometric distance check |
| P9 | Any N consecutive contact frames → playGoalpostClang called exactly once |
| P10 | Any new-high-score event → confettiParticles grows by 60 |
| P11 | Any spawned particle → w∈[6,12], h∈[4,8], vy∈[2,5], color∈CONFETTI_COLORS |
| P12 | Any particle before update → vy increases by 0.1, |vx delta| ≤ 0.5 |
| P13 | Any confettiParticles state after update → no p.y >= H |
| P14 | Any kick/goal sequence → kickCount and gameState follow state machine rules |
| P15 | Any kickCount in [0,3] → drawHUD references MAX_KICKS - kickCount |

### Unit Tests

Unit tests (plain Jest or browser-based) cover:
- `loadHighScore()` with specific localStorage values (`"42"`, `""`, `"abc"`, `null`)
- `saveHighScore()` writes the correct key
- `ballHitsRect()` with known ball positions (inside, outside, on edge)
- `spawnConfetti()` produces exactly 60 particles with valid attributes
- `startGame()` resets `kickCount`, `confettiParticles`, `newHighScoreTimer`, `kickTrail` to initial values
- Goal detection triggers `kickCount` reset and `highScore` update when appropriate

### Manual / Visual Tests

- Kick trail visible for ~8 frames after collision, fades out
- Fans visible in background, animate during play, freeze on start/game-over screens
- Goalpost clang audible on ball contact, not repeated while ball stays in contact
- Confetti burst + "NEW HIGH SCORE!" text appears when beating high score
- Game over triggers after 3 kicks with no goal; kick counter in HUD counts down correctly
