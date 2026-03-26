# Project Structure

```
demo-game/
  index.html      # Entry point — canvas setup, styles, loads game.js
  game.js         # All game logic: state, physics, input, rendering
  kiro-logo.png   # Player sprite (used as the character)

.kiro/
  steering/       # AI assistant guidance files
```

## Code Organization in game.js

The file is organized into clearly commented sections:

- Constants — physics values, dimensions, brand colors
- State — gameState, score, frameCount, particles array
- Player / Ball — object literals with position and velocity
- Input — keydown/keyup listeners, click handler
- Helpers — resetPositions, startGame, jump
- Particles — spawn, update, draw
- Update — main game logic (movement, physics, collision, goal detection)
- Draw — background, goal, ball, player, HUD, start/game-over screens
- Game Loop — `loop()` via `requestAnimationFrame`

## Conventions
- All drawing happens inside named `draw*` functions
- Physics constants are defined at the top as `const` — change them there, not inline
- Game states: `'start'`, `'playing'`, `'gameOver'`
- Brand colors are defined as named constants (`PURPLE`, `WHITE`, etc.) at the top
