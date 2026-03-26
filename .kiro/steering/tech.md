# Tech Stack

## Core
- Vanilla JavaScript (ES6+) — no frameworks, no build tools
- HTML5 Canvas API for all rendering
- Single `game.js` file, single `index.html` entry point

## Runtime
- Runs directly in the browser — open `demo-game/index.html` to play
- No npm, no bundler, no compilation step required

## Rendering
- `canvas.getContext('2d')` for 2D drawing
- `requestAnimationFrame` game loop targeting 60 FPS
- Image sprite loaded via `new Image()` (kiro-logo.png as player sprite)

## Common Commands
- Run the game: open `demo-game/index.html` in a browser (no server needed for local assets)
- If assets fail to load due to CORS: `npx serve demo-game` or use VS Code Live Server
