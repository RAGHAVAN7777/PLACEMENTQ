# Aria mouth movement — verified 4 October 2026

The visible face was not receiving the animated uniform values. A live diagnostic
showed speech active and a nonzero jaw target while the mounted material's jaw
remained zero. The supplied uniform and mounted material uniform were different
objects. The renderer now writes animation values through all three mounted
materials (surface, face particles and irises).

Removed undefined animation references and the text-duration/15-second fallback.
Only this application's active speech utterance drives lip motion. Word boundaries
guide estimated lip shapes; a syllable rhythm keeps the jaw moving when a Windows
voice omits or stops sending those boundaries. This is estimated lip sync, not
audio-derived phoneme alignment or monitoring unrelated speaker output.

Speech end, interruption, mute and errors clear the active cue. Pause/resume events
also update it. The auto-play timer now survives React StrictMode effect cleanup.
Jaw travel was calibrated after the material updates started reaching the GPU.

Validation:

- `npm.cmd run build --prefix frontend`: passed (existing large-bundle warning).
- `node --experimental-strip-types --test frontend/tests/speechMotion.test.mjs`:
  four passed, covering missing/stale boundaries, inactive cues and bounded shapes.
- Real browser playback at `/assessment?new=1`, after a clean reload: successive
  screenshots visibly show closed, partially open and open lips during the same
  greeting. No simulated speech events were used.
- Replay restarts movement. Interrupt and Mute return the face to a closed mouth;
  Replay is disabled while muted. Natural completion returns to the awaiting state.
- No browser error logs during final verification.
- LandingPage.tsx, LandingPage.css and ParticleHero.tsx hashes match the earlier
  checkpoint; this fix does not change the hero design.

Screenshots: `aria-speaking.png`, `aria-between-syllables.png`,
`aria-interrupted.png`, `aria-muted.png`, `aria-finished.png`.
