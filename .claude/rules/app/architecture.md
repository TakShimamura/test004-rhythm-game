# Purpose: Technical source of truth — API endpoints, schemas, contracts.

> This doc reflects the *current* shape of the system. Update as phases land.

## Runtime architecture
- **Client (browser)**: SvelteKit SPA routes for menus; single canvas-backed route for gameplay. Web Audio API manages track playback and provides the authoritative clock.
- **Server (SvelteKit)**: API routes under `/api/*`, server-side only DB access via Drizzle.
- **Database**: Postgres (OrbStack local dev).

## Gameplay clock contract
- `AudioContext.currentTime` (seconds) is the single source of truth for "now" during a run.
- `requestAnimationFrame` is used only for rendering; never for timing decisions.
- Note scheduling: each note has `t` (seconds from track start). Hit judgment compares `keydownTime` (captured via `performance.now()` → converted to audio time) against `t`.
- Calibration: user-configurable `audioOffsetMs` shifts all notes by a constant to account for hardware latency.

## Timing windows (tentative, tune in P1)
| Window  | ±ms     | Score | Combo effect |
|---------|---------|-------|--------------|
| Perfect | 0–35    | 300   | +1           |
| Good    | 35–80   | 100   | +1           |
| Miss    | >80     | 0     | reset        |

## Chart JSON format (v1)
```ts
type Chart = {
  id: string;
  songId: string;
  difficulty: "easy" | "normal" | "hard";
  bpm: number;
  offsetMs: number;          // audio start offset
  notes: Note[];
};
type Note = {
  t: number;                 // seconds from song start
  lane: 0 | 1 | 2;           // A=0, S=1, D=2
};
```
Validated with Zod on both client load and API write.

## Database schema (planned for P3)
```
users(
  id uuid pk,
  email text unique,
  display_name text,
  created_at timestamptz default now()
)

songs(
  id uuid pk,
  title text,
  artist text,
  audio_url text,            -- path or object-store URL
  bpm int,
  duration_ms int,
  uploaded_by uuid -> users.id,
  created_at timestamptz default now()
)

charts(
  id uuid pk,
  song_id uuid -> songs.id,
  difficulty text,
  notes jsonb,               -- Chart.notes
  created_by uuid -> users.id,
  created_at timestamptz default now()
)

scores(
  id uuid pk,
  user_id uuid -> users.id,
  chart_id uuid -> charts.id,
  score int,
  max_combo int,
  accuracy real,             -- 0.0–1.0
  played_at timestamptz default now()
)
```

## API endpoints (planned)
- `GET  /api/songs` — list songs (id, title, artist, difficulty count)
- `GET  /api/songs/:id` — song detail + charts list
- `GET  /api/charts/:id` — full chart incl. notes
- `POST /api/scores` — submit a run (auth required)
- `GET  /api/charts/:id/leaderboard` — top 50 scores
- `POST /api/songs` — upload (auth required, P5)
- `POST /api/charts` — publish chart (auth required, P5)

## Keybindings (default)
| Key | Lane |
|-----|------|
| A   | 0    |
| S   | 1    |
| D   | 2    |

Remappable in settings, persisted to localStorage.

## Directory layout (target)
```
src/
  lib/
    game/          # engine: clock, input, scoring, renderer
    chart/         # chart types, Zod schemas, loaders
    server/        # db client, drizzle schema, auth
  routes/
    +page.svelte           # home / song select
    play/[chartId]/+page.svelte
    api/...
```
