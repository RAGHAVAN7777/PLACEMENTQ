export interface AvatarSpeechCue {
  active: boolean;
  text: string;
  charIndex: number;
  startedAt: number;
  boundaryAt: number;
  rate: number;
}

/** Estimated lip shapes, clocked only while our utterance is actually speaking.
 * Browser voices may omit word boundaries. Never clamp to a word's final letter:
 * that can leave the lips closed for the rest of an otherwise audible sentence.
 */
export function speechMotion(cue: AvatarSpeechCue | null, now: number) {
  if (!cue?.active) return { jaw: 0, round: 0, wide: 0 };
  const rate = Math.max(0.5, Math.min(2, cue.rate));
  const elapsed = Math.max(0, (now - cue.startedAt) / 1000);
  const sinceBoundary = Math.max(0, (now - cue.boundaryAt) / 1000);
  const letters = sinceBoundary * 13 * rate;
  const index = (cue.charIndex + Math.floor(letters)) % Math.max(1, cue.text.length);
  const letter = (cue.text[index] || 'a').toLowerCase();
  // Maintain an audible-syllable rhythm even when word timing is absent/stale.
  // A short closure for bilabials/punctuation must never freeze the whole mouth.
  const closure = /[mbp\s.,!?;:]/.test(letter) && letters % 1 < 0.55;
  // Small overlapping articulations instead of a full open/close metronome.
  const pulse = 0.48 + 0.22 * Math.sin(elapsed * rate * 19.3) + 0.10 * Math.sin(elapsed * rate * 31.7 + .8);
  const emphasis = /[a]/.test(letter) ? .85 : /[eiouy]/.test(letter) ? .6 : .28;
  const jaw = closure ? 0 : pulse * emphasis;
  return {
    jaw,
    round: /[ouqw]/.test(letter) ? pulse : 0,
    wide: /[eiy]/.test(letter) ? pulse : 0,
  };
}
