# Purpose: High-level feature list and progress indicators.

Legend: `[ ]` not started · `[~]` in progress · `[x]` done

## P1–P10: COMPLETE
Core gameplay, polish, backend, auth, song library, hold notes, profiles,
social, game modes, juice — all shipped.

## P11 — Multiplayer (deferred — needs WebSocket architecture)

## P12–P20: COMPLETE
Advanced chart editor, audio analysis, cosmetics, mobile + accessibility,
tutorial, stats, community, advanced audio, replay system.

## P21 — Music-synced gameplay (CRITICAL FIX)
- [~] Unified music event schedule (instruments mapped to timeline)
- [ ] Charts generated FROM music events (notes = musical hits)
- [ ] Musical hit sounds (kick/snare/bass/lead per note, not generic beep)
- [ ] Audio ducking on miss (music stumbles when you miss)
- [ ] Lane-to-instrument mapping (A=bass/kick, S=snare, D=melody)

## P22 — Visual storytelling + stage effects
- [ ] Stage backgrounds that evolve during a song (intro → buildup → drop → outro)
- [ ] Beat-synced camera zoom/pulse (subtle canvas scale on downbeats)
- [ ] Lane color shifts during song sections (verse=cool, chorus=warm)
- [ ] Lyrics/text display system (show song section names during play)
- [ ] Crowd/energy meter that fills based on performance

## P23 — Difficulty system overhaul
- [ ] Auto-difficulty: analyze player's recent accuracy, suggest appropriate charts
- [ ] Difficulty stars (1-10 scale) computed from note density + speed + patterns
- [ ] Dynamic difficulty: if player is struggling, subtly widen timing windows mid-song
- [ ] Chart modifiers: hidden (notes fade before hit zone), sudden (notes appear late)
- [ ] Fail state: game over if health bar empties (health drains on miss, heals on hit)

## P24 — Sound design
- [ ] Keysound system: each note triggers a unique pitched sample
- [ ] Audio mixing: separate volume sliders for music/SFX/hit sounds
- [ ] Metronome toggle: optional click track overlay for practice
- [ ] Audio latency auto-calibration wizard (tap-to-calibrate)

## P25 — Content pipeline
- [ ] YouTube/SoundCloud URL import (extract audio, auto-detect BPM)
- [ ] Chart format import (osu!/StepMania .osu/.sm file parsing)
- [ ] Batch chart generation: generate easy/normal/hard from one audio
- [ ] Chart validation: warn about impossible patterns before publish

## P26 — Performance + polish
- [ ] WebGL renderer option (for low-end devices struggling with Canvas 2D)
- [ ] Offscreen canvas for particle systems
- [ ] Asset preloading with progress bar
- [ ] Service worker for offline play (cached songs + charts)
- [ ] PWA manifest for "Add to Home Screen"

## P27 — Economy + incentives
- [ ] In-game currency earned from plays
- [ ] Cosmetic shop: buy themes/skins/effects with earned currency
- [ ] Season pass: weekly challenges with exclusive rewards
- [ ] Streak rewards: daily login/play streak bonuses
