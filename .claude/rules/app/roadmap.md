# Purpose: High-level feature list and progress indicators.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

## P1 — Core gameplay (client-only)
- [x] Vite/SvelteKit project scaffold, TS strict, Tailwind
- [x] Canvas renderer: 3-lane highway, falling note markers
- [x] Audio clock: load track, drive gameplay from `AudioContext.currentTime`
- [x] Input: A/S/D keybinds, lane press visual
- [x] Timing windows: perfect / good / miss (ms thresholds)
- [x] Scoring: points, combo, accuracy %
- [x] Basic HUD: score, combo, progress bar
- [x] One hardcoded chart + one built-in audio track (playable end-to-end)

## P2 — Polish
- [x] Hit/miss visual feedback (flashes, particle burst)
- [x] Start screen, pause, results screen
- [x] Settings panel: key remap, audio offset calibration
- [x] Persist settings to localStorage

## P3 — Backend foundation
- [x] Postgres in OrbStack, `.env` wired
- [x] Drizzle schema: `users`, `songs`, `charts`, `scores`
- [x] Initial migrations + seed script (seed the P1 hardcoded song)
- [x] SvelteKit API routes: GET /songs, GET /charts/:id
- [x] Client fetches chart from API instead of hardcoded import

## P4 — Auth + leaderboards
- [x] better-auth integration (email/password)
- [x] Signup / login / logout flows
- [x] POST /scores on run completion
- [x] Per-chart leaderboard view (top 50)
- [x] Personal best tracking on results screen

## P5 — Song library + chart editor
- [x] Audio upload (stored on disk or S3-compatible)
- [x] Song metadata form (title, artist, BPM)
- [x] Manual chart editor: waveform display, tap-to-place notes per lane
- [x] Save draft / publish chart
- [x] Song select screen with search + difficulty filter

## P6 — Advanced gameplay
- [x] Hold notes (long press mechanic with duration scoring)
- [x] Reactive backgrounds (style-themed, combo-reactive)
- [x] Perspective highway, parallax starfield, shooting stars
- [x] Per-lane note shapes (circle/diamond/square)
- [x] 10 songs with synth instruments (pad, arp, bass, drums, lead)

## P7 — Player profile + progression
- [ ] Player profile page (stats, play history, accuracy trends)
- [ ] XP system: earn XP per play, level up
- [ ] Achievement badges (first S rank, 100 combo, all songs cleared, etc.)
- [ ] Personal best tracking per chart with delta display
- [ ] Play count + time played stats

## P8 — Social + competitive
- [ ] Global leaderboard page (all charts, top players)
- [ ] Friend system (follow other players)
- [ ] Activity feed (recent scores from followed players)
- [ ] Chart comments / ratings (1-5 stars)
- [ ] Daily challenge: random chart, one attempt, ranked

## P9 — Gameplay modes
- [ ] Practice mode: slow down speed, loop sections, auto-play visualization
- [ ] Endless mode: procedurally generated chart that gets harder over time
- [ ] Mirror mode: flip lanes L↔R
- [ ] No-fail mode: can't die, for learning charts
- [ ] Speed mods: 0.5x to 2.0x playback speed

## P10 — Polish + juice
- [ ] Screen shake on miss
- [ ] Full-combo celebration (special animation + sound)
- [ ] Streak fire: visual fire trail when combo > 50
- [ ] Note skins (different visual themes)
- [ ] Sound effects pack (different hit sounds per skin)
- [ ] Dark/light theme toggle
