// ─── Kiro Soccer ────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// ─── Constants ───────────────────────────────────────────────────────────────
const GROUND_Y      = H - 60;
const GRAVITY       = 0.3;
const BALL_GRAVITY  = 0.13;
const JUMP_POWER    = -6;
const PLAYER_SPEED  = 3.5;
const BALL_FRICTION = 0.988;
const BALL_BOUNCE   = 0.62;
const BALL_RADIUS   = 16;
const PLAYER_W      = 48;
const PLAYER_H      = 48;

// Goal: post at right side, net extends further right (behind post from player view)
const GOAL      = { x: W - 100, y: GROUND_Y - 120, w: 12, h: 120 };
const NET_DEPTH = 60; // how far the net extends behind the post

// Kick limit
const MAX_KICKS = 3;

// Fan crowd
const FAN_COUNT     = 30;
const FAN_COLORS    = ['#3a2a4a', '#2a1a3a', '#4a2a5a', '#1a1a2a'];
const FAN_AMPLITUDE = 3;
const FAN_SPEED     = 0.04;

// Kick trail
const KICK_TRAIL_FRAMES = 8;
const KICK_TRAIL_COLOR  = '#790ECB';
const KICK_TRAIL_WIDTH  = 3;

// Confetti
const CONFETTI_COLORS       = ['#790ECB', '#9b3de8', '#ffffff', '#FFD700'];
const CONFETTI_COUNT        = 60;
const NEW_HS_DISPLAY_FRAMES = 120;

// Brand colors
const PURPLE  = '#790ECB';
const PURPLE2 = '#9b3de8';
const WHITE   = '#ffffff';
const GRAY    = '#2a2a3a';
const DARK    = '#0a0a0f';

// ─── State ───────────────────────────────────────────────────────────────────
let gameState = 'nameEntry'; // 'nameEntry' | 'start' | 'playing' | 'gameOver'
let score     = 0;
let highScore = 0;
let frameCount = 0;
let particles  = [];
let kickCount  = 0;
let kickTrail  = null; // { x1, y1, life }
let confettiParticles = [];
let newHighScoreTimer = 0;
let goalBannerTimer   = 0;
let ballStuckTimer    = 0; // frames ball has been near-stationary on crossbar

// ─── Player name ─────────────────────────────────────────────────────────────
let playerName    = '';
let nameInput     = '';
let nameEntered   = false;
let highScoreName = '';

// ─── Fans ────────────────────────────────────────────────────────────────────
const fans = [];
function initFans() {
  fans.length = 0;
  for (let i = 0; i < FAN_COUNT; i++) {
    fans.push({
      x:     (W / FAN_COUNT) * i + W / FAN_COUNT / 2,
      baseY: GROUND_Y - 40 - Math.random() * 30,
      phase: (i / FAN_COUNT) * Math.PI * 2,
      color: FAN_COLORS[i % FAN_COLORS.length],
      scale: 0.6 + Math.random() * 0.3,
      row: 0,
    });
  }
  for (let i = 0; i < FAN_COUNT; i++) {
    fans.push({
      x:     (W / FAN_COUNT) * i + (W / FAN_COUNT / 2) + (W / FAN_COUNT / 2) * 0.5,
      baseY: GROUND_Y - 80 - Math.random() * 40,
      phase: (i / FAN_COUNT) * Math.PI * 2 + Math.PI,
      color: FAN_COLORS[(i + 2) % FAN_COLORS.length],
      scale: 0.5 + Math.random() * 0.25,
      row: 1,
    });
  }
}

// ─── Player ──────────────────────────────────────────────────────────────────
const player = {
  x: 100, y: GROUND_Y - PLAYER_H,
  vx: 0,  vy: 0,
  onGround: false,
  facing: 1,
  kickCooldown: 0,
};

// ─── Ball ────────────────────────────────────────────────────────────────────
const ball = {
  x: 300, y: GROUND_Y - BALL_RADIUS,
  vx: 0,  vy: 0,
  angle: 0, // rotation in radians, updated each frame
};

// ─── Opponent ────────────────────────────────────────────────────────────────
const opponent = {
  x: W / 2, y: GROUND_Y - PLAYER_H,
  vx: 1.5, vy: 0,
  w: 40, h: 48,
  active: false,
  patrolMin: W / 3,
  patrolMax: GOAL.x - 60,
};

// ─── Audio ───────────────────────────────────────────────────────────────────
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playGoalpostClang() {
  const ac = getAudioCtx();
  if (!ac || ac.state === 'suspended') return;
  const osc  = ac.createOscillator();
  const gain = ac.createGain();
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ac.currentTime);
  osc.frequency.linearRampToValueAtTime(220, ac.currentTime + 0.3);
  gain.gain.setValueAtTime(0.4, ac.currentTime);
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.3);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + 0.3);
}

function playGoalSound() {
  const ac = getAudioCtx();
  if (!ac || ac.state === 'suspended') return;
  const t = ac.currentTime;

  // Layer 1: rising crowd cheer — low rumble noise swell
  const bufSize = ac.sampleRate * 2.0;
  const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = (Math.random() * 2 - 1);
  const crowd = ac.createBufferSource();
  crowd.buffer = buf;
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(300, t);
  lowpass.frequency.linearRampToValueAtTime(2000, t + 1.0); // sweeps up = crowd rising
  const crowdGain = ac.createGain();
  crowdGain.gain.setValueAtTime(0, t);
  crowdGain.gain.linearRampToValueAtTime(0.5, t + 0.3);
  crowdGain.gain.linearRampToValueAtTime(0.3, t + 1.5);
  crowdGain.gain.linearRampToValueAtTime(0, t + 2.0);
  crowd.connect(lowpass);
  lowpass.connect(crowdGain);
  crowdGain.connect(ac.destination);
  crowd.start(t);
  crowd.stop(t + 2.0);

  // Layer 2: high-pitched cheer shimmer
  const shimBuf = ac.createBuffer(1, bufSize, ac.sampleRate);
  const shimData = shimBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) shimData[i] = (Math.random() * 2 - 1);
  const shim = ac.createBufferSource();
  shim.buffer = shimBuf;
  const bandpass = ac.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 3000;
  bandpass.Q.value = 0.8;
  const shimGain = ac.createGain();
  shimGain.gain.setValueAtTime(0, t + 0.2);
  shimGain.gain.linearRampToValueAtTime(0.2, t + 0.6);
  shimGain.gain.linearRampToValueAtTime(0, t + 2.0);
  shim.connect(bandpass);
  bandpass.connect(shimGain);
  shimGain.connect(ac.destination);
  shim.start(t + 0.2);
  shim.stop(t + 2.0);

  // Layer 3: triumphant horn stab
  const horn = ac.createOscillator();
  const hornGain = ac.createGain();
  horn.type = 'sawtooth';
  horn.frequency.setValueAtTime(220, t);
  horn.frequency.setValueAtTime(330, t + 0.1);
  horn.frequency.setValueAtTime(440, t + 0.2);
  hornGain.gain.setValueAtTime(0.15, t);
  hornGain.gain.linearRampToValueAtTime(0, t + 0.5);
  horn.connect(hornGain);
  hornGain.connect(ac.destination);
  horn.start(t);
  horn.stop(t + 0.5);
}

// ─── Input ───────────────────────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

  if (gameState === 'nameEntry') {
    if (e.code === 'Enter' && nameInput.trim().length > 0) {
      playerName = nameInput.trim().toUpperCase().slice(0, 12);
      gameState  = 'start';
    } else if (e.code === 'Backspace') {
      nameInput = nameInput.slice(0, -1);
    } else if (e.key.length === 1 && nameInput.length < 12) {
      nameInput += e.key;
    }
    e.preventDefault();
    return;
  }

  if (e.code === 'Escape' && gameState === 'playing') {
    gameState = 'start';
    return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    if (gameState === 'start')         startGame();
    else if (gameState === 'gameOver') startGame();
    else if (gameState === 'playing' && player.onGround) jump();
  }
});
document.addEventListener('keyup',  e => { keys[e.code] = false; });
canvas.addEventListener('click', () => {
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (gameState === 'start' || gameState === 'gameOver') startGame();
});

// ─── Goalpost collision ───────────────────────────────────────────────────────
let goalpPostContactActive = false;

function ballHitsRect(rx, ry, rw, rh) {
  const cx = Math.max(rx, Math.min(ball.x, rx + rw));
  const cy = Math.max(ry, Math.min(ball.y, ry + rh));
  const dx = ball.x - cx, dy = ball.y - cy;
  return dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS;
}

// ─── Kiro Logo Sprite ────────────────────────────────────────────────────────
const sprite = new Image();
sprite.src   = 'kiro-logo.png';

// ─── High Score Persistence ──────────────────────────────────────────────────
function loadHighScore() {
  try {
    const v = parseInt(localStorage.getItem('kiroSoccerHighScore'), 10);
    highScore = isNaN(v) ? 0 : v;
    highScoreName = localStorage.getItem('kiroSoccerHighScoreName') || '';
  } catch (_) { highScore = 0; highScoreName = ''; }
}

function saveHighScore() {
  try {
    localStorage.setItem('kiroSoccerHighScore', highScore);
    localStorage.setItem('kiroSoccerHighScoreName', playerName || 'PLAYER');
    highScoreName = playerName || 'PLAYER';
  } catch (_) {}
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function resetBall() {
  ball.x  = 150 + Math.random() * (GOAL.x - 250);
  ball.y  = GROUND_Y - BALL_RADIUS;
  ball.vx = 0;
  ball.vy = 0;
}

function resetPositions() {
  player.x = 80; player.y = GROUND_Y - PLAYER_H;
  player.vx = 0;  player.vy = 0; player.onGround = false;
  player.kickCooldown = 0;
  resetBall();
}

function startGame() {
  score      = 0;
  frameCount = 0;
  particles  = [];
  kickCount  = 0;
  kickTrail  = null;
  confettiParticles = [];
  newHighScoreTimer = 0;
  goalBannerTimer   = 0;
  ballStuckTimer    = 0;
  goalpPostContactActive = false;
  opponent.active = false;
  opponent.x = W / 2;
  opponent.vx = 1.5;
  resetPositions();
  gameState  = 'playing';
}

function jump() {
  player.vy = JUMP_POWER;
  player.onGround = false;
}

// ─── Particles ───────────────────────────────────────────────────────────────
function spawnGoalParticles(x, y) {
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 60,
      maxLife: 60,
      color: Math.random() > 0.5 ? PURPLE : WHITE,
      size: 2 + Math.random() * 4,
    });
  }
}

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

function updateParticles() {
  particles = particles.filter(p => p.life > 0);
  particles.forEach(p => {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.1;
    p.life--;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

// ─── Update ──────────────────────────────────────────────────────────────────
function update() {
  if (gameState !== 'playing') return;
  frameCount++;

  // ── Player movement ──
  player.vx = 0;
  if (keys['ArrowLeft']  || keys['KeyA']) { player.vx = -PLAYER_SPEED; player.facing = -1; }
  if (keys['ArrowRight'] || keys['KeyD']) { player.vx =  PLAYER_SPEED; player.facing =  1; }
  if ((keys['ArrowUp'] || keys['KeyW']) && player.onGround) jump();

  // Apply gravity
  player.vy += GRAVITY;
  player.x  += player.vx;
  player.y  += player.vy;

  // Ground collision
  if (player.y >= GROUND_Y - PLAYER_H) {
    player.y = GROUND_Y - PLAYER_H;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }

  // Wall bounds
  player.x = Math.max(0, Math.min(W - PLAYER_W, player.x));

  // ── Ball physics ──
  ball.vy += BALL_GRAVITY;
  ball.vx *= BALL_FRICTION;
  ball.x  += ball.vx;
  ball.y  += ball.vy;

  // Ball ground bounce — emoji renders centered so BALL_RADIUS is correct
  if (ball.y >= GROUND_Y - BALL_RADIUS) {
    ball.y  = GROUND_Y - BALL_RADIUS;
    ball.vy = -Math.abs(ball.vy) * BALL_BOUNCE;
    if (Math.abs(ball.vy) < 0.5) ball.vy = 0;
  }

  // Ball rotation — rolls based on horizontal velocity
  ball.angle += ball.vx / BALL_RADIUS;

  // Ball wall bounce (left side)
  if (ball.x - BALL_RADIUS < 0) {
    ball.x  = BALL_RADIUS;
    ball.vx = Math.abs(ball.vx) * 0.7;
  }
  // Ball exits right side — reset to random position (missed shot)
  if (ball.x - BALL_RADIUS > W) {
    resetBall();
  }
  if (ball.y - BALL_RADIUS < 0) {
    ball.y  = BALL_RADIUS;
    ball.vy = Math.abs(ball.vy) * 0.7;
  }

  // ── Player ↔ Ball collision ──
  const px = player.x + PLAYER_W / 2;
  const py = player.y + PLAYER_H / 2;
  const dx = ball.x - px;
  const dy = ball.y - py;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const minDist = BALL_RADIUS + Math.min(PLAYER_W, PLAYER_H) / 2;

  if (dist < minDist) {
    const nx = dx / dist;
    const ny = dy / dist;

    const playerSpeed  = Math.sqrt(player.vx * player.vx + player.vy * player.vy);
    const kickStrength = 7 + playerSpeed * 1.1; // more power = longer parabola
    // Base loft: ~20° standing, up to ~40° full sprint
    const sprintRatio  = Math.min(Math.abs(player.vx) / PLAYER_SPEED, 1);
    let   loftAngle    = -(0.35 + sprintRatio * 0.35); // -0.35 to -0.70 rad
    // Diagonal kick bonus: running + jumping adds extra elevation (~15° more)
    const isDiagonal   = Math.abs(player.vx) > 1.0 && Math.abs(player.vy) > 0.5;
    if (isDiagonal) loftAngle -= 0.28;
    ball.vx = kickStrength * Math.cos(loftAngle) * (player.facing >= 0 ? 1 : -1);
    ball.vy = kickStrength * Math.sin(loftAngle);

    // push ball out of overlap
    ball.x = px + nx * (minDist + 1);
    ball.y = py + ny * (minDist + 1);

    if (player.kickCooldown === 0) {
      player.kickCooldown = 20;
      kickCount++;
      kickTrail = {
        x1: px,
        y1: py,
        life: KICK_TRAIL_FRAMES,
      };
      if (kickCount >= MAX_KICKS) {
        gameState = 'gameOver';
      }
    }
  }

  // Decrement kickCooldown each frame
  if (player.kickCooldown > 0) player.kickCooldown--;

  // Decrement kick trail life each frame
  if (kickTrail) {
    kickTrail.life--;
    if (kickTrail.life <= 0) kickTrail = null;
  }

  // ── Goalpost collision sound — crossbar only ──
  const hitsCrossbar = ballHitsRect(GOAL.x, GOAL.y, NET_DEPTH + GOAL.w, GOAL.w);

  if (hitsCrossbar && !goalpPostContactActive) {
    goalpPostContactActive = true;
    playGoalpostClang();
  } else if (!hitsCrossbar) {
    goalpPostContactActive = false;
  }

  // ── Crossbar bounce — physics based on contact normal ──
  const cbX = GOAL.x, cbY = GOAL.y, cbW = NET_DEPTH + GOAL.w, cbH = GOAL.w;
  if (ballHitsRect(cbX, cbY, cbW, cbH)) {
    const closestX = Math.max(cbX, Math.min(ball.x, cbX + cbW));
    const closestY = Math.max(cbY, Math.min(ball.y, cbY + cbH));
    const normDx = ball.x - closestX;
    const normDy = ball.y - closestY;
    const normLen = Math.sqrt(normDx * normDx + normDy * normDy) || 1;
    const nx = normDx / normLen;
    const ny = normDy / normLen;
    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx = (ball.vx - 2 * dot * nx) * 0.7;
    ball.vy = (ball.vy - 2 * dot * ny) * 0.7;
    ball.x = closestX + nx * (BALL_RADIUS + 1);
    ball.y = closestY + ny * (BALL_RADIUS + 1);

    // Stuck detection — if ball barely moving on crossbar, reset after 90 frames
    if (Math.abs(ball.vx) < 0.5 && Math.abs(ball.vy) < 0.5) {
      ballStuckTimer++;
      if (ballStuckTimer > 90) {
        ballStuckTimer = 0;
        resetBall();
      }
    } else {
      ballStuckTimer = 0;
    }
  } else {
    ballStuckTimer = 0;
  }

  // ── Goal detection — ball fully crosses the front post line ──
  // Ball centre must be past the front post (GOAL.x + GOAL.w) and within net height
  const inNetY    = ball.y >= GOAL.y + GOAL.w && ball.y <= GOAL.y + GOAL.h;
  const crossedPost = ball.x - BALL_RADIUS > GOAL.x + GOAL.w && ball.x < GOAL.x + GOAL.w + NET_DEPTH;

  if (crossedPost && inNetY) {
    score++;
    goalBannerTimer = 150;
    playGoalSound();
    if (score > highScore) {
      highScore = score;
      saveHighScore();
      spawnConfetti();
    }
    spawnGoalParticles(GOAL.x, GOAL.y + GOAL.h / 2);
    kickCount = 0;
    resetBall();
  }

  // ── Goal banner timer ──
  if (goalBannerTimer > 0) goalBannerTimer--;

  updateParticles();

  // ── Confetti physics ──
  confettiParticles.forEach(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.1;
    p.vx += (Math.random() - 0.5) * 0.5;
  });
  confettiParticles = confettiParticles.filter(p => p.y < H);
  if (newHighScoreTimer > 0) newHighScoreTimer--;

  // ── Opponent ──
  if (score >= 5) opponent.active = true;
  if (opponent.active) {
    opponent.x += opponent.vx;
    if (opponent.x <= opponent.patrolMin || opponent.x >= opponent.patrolMax) {
      opponent.vx *= -1;
    }
    // Ball collision with opponent
    const odx = ball.x - (opponent.x + opponent.w / 2);
    const ody = ball.y - (opponent.y + opponent.h / 2);
    const odist = Math.sqrt(odx * odx + ody * ody);
    const ominDist = BALL_RADIUS + Math.min(opponent.w, opponent.h) / 2;
    if (odist < ominDist && odist > 0) {
      const onx = odx / odist;
      const ony = ody / odist;
      ball.vx = onx * 4;
      ball.vy = ony * 4 - 1;
      ball.x = (opponent.x + opponent.w / 2) + onx * (ominDist + 1);
      ball.y = (opponent.y + opponent.h / 2) + ony * (ominDist + 1);
    }
  }
}

// ─── Draw ─────────────────────────────────────────────────────────────────────
function drawFans() {
  fans.forEach(fan => {
    const dy = gameState === 'playing'
      ? FAN_AMPLITUDE * Math.sin(frameCount * FAN_SPEED + fan.phase)
      : 0;
    const y = fan.baseY + dy;
    const s = fan.scale;
    ctx.fillStyle = fan.color;
    ctx.beginPath();
    ctx.arc(fan.x, y - 14 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(fan.x - 5 * s, y - 8 * s, 10 * s, 16 * s);
  });
}

function drawBackground() {
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, GROUND_Y);

  drawFans();

  ctx.fillStyle = '#1a3a1a';
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  ctx.strokeStyle = '#2a5a2a';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  ctx.strokeStyle = '#ffffff22';
  ctx.lineWidth   = 1;
  ctx.setLineDash([8, 8]);
  ctx.beginPath();
  ctx.moveTo(W / 2, GROUND_Y);
  ctx.lineTo(W / 2, GROUND_Y - 10);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawGoal() {
  // The net spans from the front post rightward by NET_DEPTH
  // Crossbar top is at GOAL.y, bottom of crossbar at GOAL.y + GOAL.w
  // Net sides go from GOAL.y + GOAL.w (below crossbar) to GOAL.y + GOAL.h (bottom)
  const netLeft  = GOAL.x + GOAL.w;
  const netRight = GOAL.x + GOAL.w + NET_DEPTH;
  const netTop   = GOAL.y + GOAL.w;
  const netBot   = GOAL.y + GOAL.h;

  // Net background fill
  ctx.fillStyle = '#ffffff0a';
  ctx.fillRect(netLeft, netTop, NET_DEPTH, netBot - netTop);

  // Net vertical lines — aligned to net boundaries
  ctx.strokeStyle = '#ffffff33';
  ctx.lineWidth   = 1;
  for (let i = 0; i <= 4; i++) {
    const nx = netLeft + (NET_DEPTH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(nx, netTop);
    ctx.lineTo(nx, netBot);
    ctx.stroke();
  }
  // Net horizontal lines — aligned to net boundaries
  for (let i = 0; i <= 6; i++) {
    const ny = netTop + ((netBot - netTop) / 6) * i;
    ctx.beginPath();
    ctx.moveTo(netLeft, ny);
    ctx.lineTo(netRight, ny);
    ctx.stroke();
  }
  // Right side net edge (vertical line closing the net)
  ctx.beginPath();
  ctx.moveTo(netRight, netTop);
  ctx.lineTo(netRight, netBot);
  ctx.stroke();
  // Bottom net edge
  ctx.beginPath();
  ctx.moveTo(netLeft, netBot);
  ctx.lineTo(netRight, netBot);
  ctx.stroke();

  // Front post (left face — what player kicks toward)
  ctx.fillStyle = '#cccccc';
  ctx.fillRect(GOAL.x, GOAL.y, GOAL.w, GOAL.h);

  // Top crossbar — exactly spans front post to end of net
  ctx.fillRect(GOAL.x, GOAL.y, NET_DEPTH + GOAL.w, GOAL.w);

  // Purple glow on goal mouth (left opening)
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur  = 12;
  ctx.strokeStyle = PURPLE2;
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(GOAL.x, GOAL.y);
  ctx.lineTo(GOAL.x, GOAL.y + GOAL.h);
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawBall() {
  // Ground shadow
  const shadowY     = GROUND_Y + 2;
  const heightAbove = Math.max(0, GROUND_Y - BALL_RADIUS - ball.y);
  const shadowScale = Math.max(0.3, 1 - heightAbove / 180);
  ctx.fillStyle = `rgba(0,0,0,${0.35 * shadowScale})`;
  ctx.beginPath();
  ctx.ellipse(ball.x, shadowY, BALL_RADIUS * 0.9 * shadowScale, 5 * shadowScale, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(ball.x, ball.y);
  ctx.rotate(ball.angle);

  // Clip to ball circle
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.clip();

  // White base
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // Black patches — emoji ⚽ style: 1 center hex + 5 surrounding pentagons
  ctx.fillStyle = '#111111';

  // Center hexagon
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const r = BALL_RADIUS * 0.30;
    i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r)
            : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();

  // 5 outer black pentagons
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const cx = Math.cos(angle) * BALL_RADIUS * 0.65;
    const cy = Math.sin(angle) * BALL_RADIUS * 0.65;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
      const r = BALL_RADIUS * 0.26;
      j === 0 ? ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
              : ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Ball outline
  ctx.strokeStyle = '#aaaaaa';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.stroke();

  // Glossy specular highlight
  const shine = ctx.createRadialGradient(-4, -5, 1, -3, -4, BALL_RADIUS * 0.6);
  shine.addColorStop(0,    'rgba(255,255,255,0.88)');
  shine.addColorStop(0.4,  'rgba(255,255,255,0.28)');
  shine.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.fillStyle = '#00000055';
  ctx.beginPath();
  ctx.ellipse(player.x + PLAYER_W / 2, GROUND_Y + 4, PLAYER_W * 0.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  if (player.facing === -1) {
    ctx.translate(player.x + PLAYER_W, player.y);
    ctx.scale(-1, 1);
    ctx.drawImage(sprite, 0, 0, PLAYER_W, PLAYER_H);
  } else {
    ctx.drawImage(sprite, player.x, player.y, PLAYER_W, PLAYER_H);
  }

  ctx.restore();
}

function drawOpponent() {
  if (!opponent.active) return;
  ctx.save();

  // Shadow
  ctx.fillStyle = '#00000055';
  ctx.beginPath();
  ctx.ellipse(opponent.x + opponent.w / 2, GROUND_Y + 4, opponent.w * 0.4, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw sprite (same as player) with red tint via composite
  ctx.drawImage(sprite, opponent.x, opponent.y, opponent.w, opponent.h);

  // Orange colour overlay using source-atop
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255, 120, 0, 0.65)';
  ctx.fillRect(opponent.x, opponent.y, opponent.w, opponent.h);
  ctx.globalCompositeOperation = 'source-over';

  // Red glow — subtle shadow only, no rectangle outline
  ctx.shadowColor = '#ff7700';
  ctx.shadowBlur  = 12;
  ctx.drawImage(sprite, opponent.x, opponent.y, opponent.w, opponent.h);
  ctx.shadowBlur  = 0;

  ctx.restore();
}

function drawKickTrail() {
  if (!kickTrail) return;
  const alpha = kickTrail.life / KICK_TRAIL_FRAMES;
  const radius = (1 - alpha) * 40 + 10; // expands outward
  ctx.save();
  ctx.globalAlpha = alpha * 0.9;
  // Outer glow ring
  ctx.shadowColor = KICK_TRAIL_COLOR;
  ctx.shadowBlur  = 20;
  ctx.strokeStyle = KICK_TRAIL_COLOR;
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(kickTrail.x1, kickTrail.y1, radius, 0, Math.PI * 2);
  ctx.stroke();
  // Inner white flash
  ctx.shadowBlur  = 0;
  ctx.globalAlpha = alpha * 0.6;
  ctx.fillStyle   = '#ffffff';
  ctx.beginPath();
  ctx.arc(kickTrail.x1, kickTrail.y1, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  // Star burst lines
  ctx.globalAlpha = alpha * 0.7;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth   = 1.5;
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const inner = radius * 0.5;
    const outer = radius * 1.1;
    ctx.beginPath();
    ctx.moveTo(kickTrail.x1 + Math.cos(angle) * inner, kickTrail.y1 + Math.sin(angle) * inner);
    ctx.lineTo(kickTrail.x1 + Math.cos(angle) * outer, kickTrail.y1 + Math.sin(angle) * outer);
    ctx.stroke();
  }
  ctx.restore();
}

function drawConfetti() {
  confettiParticles.forEach(p => {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.w / 2, p.y - p.h / 2, p.w, p.h);
  });
}

// Helper: rounded rectangle path
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawHUD() {
  ctx.save();

  // ── Goals (center top) — vibrant pill ──
  ctx.textAlign = 'center';
  // Gradient pill background
  const pillGrad = ctx.createLinearGradient(W / 2 - 55, 0, W / 2 + 55, 0);
  pillGrad.addColorStop(0, '#790ECB44');
  pillGrad.addColorStop(1, '#9b3de844');
  ctx.fillStyle = pillGrad;
  roundRect(ctx, W / 2 - 55, 8, 110, 36, 12);
  ctx.fill();
  ctx.strokeStyle = PURPLE2;
  ctx.lineWidth   = 1.5;
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur  = 6;
  roundRect(ctx, W / 2 - 55, 8, 110, 36, 12);
  ctx.stroke();
  ctx.shadowBlur  = 0;
  ctx.fillStyle   = WHITE;
  ctx.font        = 'bold 22px Courier New';
  ctx.fillText(`⚽ ${score}`, W / 2, 32);

  // ── High score (top left) — pill with trophy + name ──
  const hsLabel = `🏆 ${highScoreName || playerName || 'BEST'}: ${highScore}`;
  ctx.textAlign = 'left';
  ctx.font      = 'bold 13px Courier New';
  const hsWidth = ctx.measureText(hsLabel).width + 16;
  ctx.fillStyle = '#FFD70022';
  roundRect(ctx, 8, 8, hsWidth, 26, 6);
  ctx.fill();
  ctx.strokeStyle = '#FFD70066';
  ctx.lineWidth   = 1;
  roundRect(ctx, 8, 8, hsWidth, 26, 6);
  ctx.stroke();
  ctx.fillStyle = '#FFD700';
  ctx.fillText(hsLabel, 16, 26);

  // ── Kick dots (top right) — filled = kicks remaining, hollow = used ──
  const dotR   = 7;
  const dotGap = 20;
  const dotsX  = W - 20 - (MAX_KICKS - 1) * dotGap;
  const dotsY  = 20;
  const kicksLeft = MAX_KICKS - kickCount;
  for (let i = 0; i < MAX_KICKS; i++) {
    ctx.beginPath();
    ctx.arc(dotsX + i * dotGap, dotsY, dotR, 0, Math.PI * 2);
    if (i < kicksLeft) {
      // Remaining kick — filled purple
      ctx.fillStyle   = PURPLE;
      ctx.shadowColor = PURPLE;
      ctx.shadowBlur  = 8;
      ctx.fill();
      ctx.shadowBlur  = 0;
    } else {
      // Used kick — hollow gray
      ctx.strokeStyle = '#555577';
      ctx.lineWidth   = 2;
      ctx.stroke();
    }
  }

  // ── NEW HIGH SCORE banner ──
  if (newHighScoreTimer > 0) {
    const alpha = Math.min(1, newHighScoreTimer / 30);
    ctx.globalAlpha = alpha;
    ctx.fillStyle   = '#FFD700';
    ctx.font        = 'bold 20px Courier New';
    ctx.textAlign   = 'center';
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur  = 15;
    ctx.fillText('🌟 NEW HIGH SCORE! 🌟', W / 2, 80);
    ctx.shadowBlur  = 0;
    ctx.globalAlpha = 1;
  }

  // ── GOOOAAAL!!! banner ──
  if (goalBannerTimer > 0) {
    const scale = 1 + 0.3 * Math.sin(goalBannerTimer * 0.2);
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.font        = `bold ${Math.floor(48 * scale)}px Courier New`;
    ctx.fillStyle   = '#FFD700';
    ctx.shadowColor = '#00ff00';
    ctx.shadowBlur  = 20;
    ctx.fillText('GOOOAAAL!!!', W / 2, H / 2 - 20);
    ctx.shadowBlur  = 0;
    ctx.restore();
  }

  // ── ESC hint (bottom right) ──
  ctx.textAlign = 'right';
  ctx.font      = '11px Courier New';
  ctx.fillStyle = '#ffffff33';
  ctx.fillText('ESC to quit', W - 10, H - 10);

  ctx.restore();
}

function drawStartScreen() {
  ctx.fillStyle = '#0a0a0fcc';
  ctx.fillRect(0, 0, W, H);

  const lw = 100, lh = 100;
  ctx.drawImage(sprite, W / 2 - lw / 2, H / 2 - 160, lw, lh);

  ctx.textAlign   = 'center';
  ctx.fillStyle   = WHITE;
  ctx.font        = 'bold 48px Courier New';
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur  = 20;
  ctx.fillText('KIRO SOCCER', W / 2, H / 2 - 30);
  ctx.shadowBlur  = 0;

  ctx.font      = '18px Courier New';
  ctx.fillStyle = '#9b3de8';
  ctx.fillText('Kick the ball into the goal!', W / 2, H / 2 + 10);

  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.globalAlpha = pulse;
  ctx.fillStyle   = WHITE;
  ctx.font        = '20px Courier New';
  ctx.fillText('Press SPACE or click to start!', W / 2, H / 2 + 60);
  ctx.globalAlpha = 1;

  ctx.font      = '13px Courier New';
  ctx.fillStyle = '#666688';
  ctx.fillText('← → to move  |  SPACE / W / ↑ to jump', W / 2, H / 2 + 100);

  ctx.textAlign = 'left';
}

function drawGameOver() {
  ctx.fillStyle = '#0a0a0fcc';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign   = 'center';
  ctx.fillStyle   = WHITE;
  ctx.font        = 'bold 48px Courier New';
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur  = 20;
  ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
  ctx.shadowBlur  = 0;

  ctx.font      = '28px Courier New';
  ctx.fillStyle = PURPLE2;
  ctx.fillText(`${playerName || 'PLAYER'}: ${score} goals`, W / 2, H / 2 + 10);

  if (score >= highScore && score > 0) {
    ctx.font = '18px Courier New';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('🌟 NEW HIGH SCORE! 🌟', W / 2, H / 2 + 45);
  }

  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 400);
  ctx.globalAlpha = pulse;
  ctx.fillStyle   = WHITE;
  ctx.font        = '20px Courier New';
  ctx.fillText('Press SPACE or click to restart!', W / 2, H / 2 + 80);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'left';
}

function drawNameEntry() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a0a2e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.drawImage(sprite, W / 2 - 50, 40, 100, 100);

  ctx.textAlign = 'center';

  ctx.fillStyle   = WHITE;
  ctx.font        = 'bold 42px Courier New';
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur  = 20;
  ctx.fillText('KIRO SOCCER', W / 2, 190);
  ctx.shadowBlur  = 0;

  ctx.font      = '18px Courier New';
  ctx.fillStyle = '#9b3de8';
  ctx.fillText('ENTER YOUR NAME', W / 2, 240);

  const boxW = 300, boxH = 44, boxX = W / 2 - boxW / 2, boxY = 258;
  ctx.fillStyle = '#ffffff15';
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = PURPLE;
  ctx.lineWidth   = 2;
  ctx.shadowColor = PURPLE;
  ctx.shadowBlur  = 8;
  roundRect(ctx, boxX, boxY, boxW, boxH, 8);
  ctx.stroke();
  ctx.shadowBlur  = 0;

  const cursor = Math.floor(Date.now() / 500) % 2 === 0 ? '|' : '';
  ctx.fillStyle = WHITE;
  ctx.font      = 'bold 22px Courier New';
  ctx.fillText((nameInput || '') + cursor, W / 2, boxY + 30);

  ctx.font      = '13px Courier New';
  ctx.fillStyle = '#666688';
  ctx.fillText('Press ENTER to continue', W / 2, 330);

  if (highScore > 0 && highScoreName) {
    ctx.fillStyle = '#FFD700';
    ctx.font      = '13px Courier New';
    ctx.fillText(`🏆 BEST: ${highScoreName} — ${highScore} goals`, W / 2, 370);
  }

  ctx.textAlign = 'left';
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
function loop() {
  ctx.clearRect(0, 0, W, H);

  if (gameState === 'nameEntry') {
    drawNameEntry();
  } else {
    drawBackground();
    drawGoal();
    drawBall();
    drawPlayer();
    drawOpponent();
    drawKickTrail();
    drawParticles();
    drawConfetti();

    if (gameState === 'playing') {
      drawHUD();
      update();
    } else if (gameState === 'start') {
      drawStartScreen();
    } else if (gameState === 'gameOver') {
      drawHUD();
      drawGameOver();
    }
  }

  requestAnimationFrame(loop);
}

loadHighScore();
initFans();
loop();
