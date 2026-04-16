# Purpose: Tech stack, project purpose, and usage instructions.

## Project
Browser-based rhythm game. Keyboard-driven (A/S/D three-lane to start). Notes fall down a highway; player hits keys in time with incoming markers. Precision-scored (perfect/good/miss). Long-term goal: user-uploaded music + community chart library.

## Tech stack
- **Framework**: SvelteKit + TypeScript (strict mode)
- **Rendering**: HTML5 Canvas 2D for gameplay; Svelte components for menus/HUD
- **Audio**: Web Audio API (`AudioContext.currentTime` drives the gameplay clock — never rAF)
- **Styling**: Tailwind CSS (menus only; gameplay is canvas)
- **Database**: Postgres (via OrbStack locally)
- **ORM**: Drizzle ORM + drizzle-kit migrations
- **Validation**: Zod (chart JSON, API request/response)
- **Auth**: better-auth (email + password to start)
- **Testing**: Vitest for timing/scoring logic; Playwright later for E2E
- **Package manager**: pnpm
- **Module system**: ES modules only

## Dev environment
- Postgres runs in OrbStack (local dev)
- `.env` holds `DATABASE_URL`
- `pnpm dev` for dev server, `pnpm db:push` for schema sync, `pnpm db:studio` for inspection

## Non-goals (v1)
- Mobile/touch input
- Multiplayer/real-time sync
- Native app packaging
