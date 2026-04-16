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
- [x] Player profile page (stats, play history, accuracy trends)
- [x] XP system: earn XP per play, level up
- [x] Achievement badges (first S rank, 100 combo, all songs cleared, etc.)
- [x] Personal best tracking per chart with delta display
- [x] Play count + time played stats

## P8 — Social + competitive
- [x] Global leaderboard page (all charts, top players)
- [x] Friend system (follow other players)
- [x] Activity feed (recent scores from followed players)
- [x] Chart comments / ratings (1-5 stars)
- [x] Daily challenge: random chart, one attempt, ranked

## P9 — Gameplay modes
- [x] Practice mode: timing delta HUD, R to restart
- [x] Endless mode: procedurally generated chart that gets harder over time
- [x] Mirror mode: flip lanes L↔R
- [x] No-fail mode: can't die, for learning charts
- [x] Speed mods: 0.5x to 2.0x visual speed

## P10 — Polish + juice
- [x] Screen shake on miss
- [x] Full-combo celebration (special animation + sound)
- [x] Streak fire: visual fire trail when combo > 50
- [x] Note skins (classic, neon, minimal)
- [x] Sound effects variety (hit harmonics, miss buzz, combo chimes)
- [x] Settings: note skin selector, speed/mirror defaults

## P11 — Multiplayer foundation
- [ ] WebSocket server for real-time play
- [ ] 1v1 mode: two players play the same chart simultaneously
- [ ] Live score comparison HUD (your score vs opponent)
- [ ] Matchmaking lobby: quick match or invite by link
- [ ] Post-match results comparison screen

## P12 — Advanced chart editor
- [ ] Waveform visualization with zoom/scroll
- [ ] Snap-to-beat grid with subdivision options (1/4, 1/8, 1/16)
- [ ] Copy/paste note sections
- [ ] Playback preview in editor (hear + see notes while editing)
- [ ] Hold note placement (click-drag for duration)
- [ ] Undo/redo stack
- [ ] Import/export chart as JSON file

## P13 — Audio analysis
- [ ] BPM auto-detection from uploaded audio
- [ ] Onset detection: auto-generate starter chart from audio peaks
- [ ] Beat grid alignment visualization
- [ ] Spectral analysis for lane assignment (bass=left, mid=center, treble=right)

## P14 — Cosmetics + customization
- [ ] Unlockable highway themes (space, ocean, cyberpunk, forest)
- [ ] Custom combo colors
- [ ] Hit effect styles (sparkle, splash, lightning, pixel)
- [ ] Profile banners and borders (earned via achievements)
- [ ] Note trail customization (rainbow, flame, ice)

## P15 — Mobile + accessibility
- [ ] Touch input support (tap lanes on mobile)
- [ ] Responsive layout for mobile browsers
- [ ] Colorblind mode (patterns + shapes instead of colors only)
- [ ] Audio-only mode guidance for visually impaired
- [ ] Adjustable note size and lane width
