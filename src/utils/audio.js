// Shared pitch detection utilities — used by Tuner and Intonation

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

export const A4_FREQ = 440           // Hz — international standard reference pitch
export const A4_MIDI = 69            // MIDI note number assigned to A4
export const SEMITONES_PER_OCTAVE = 12
export const CENTS_PER_OCTAVE = 1200 // one octave = 1200 cents (100 per semitone)
export const MIDI_OCTAVE_OFFSET = 1  // MIDI octave 0 starts at C-1, so subtract 1 for display
export const MAX_CENTS = 50          // clamp deviation to ±50 cents (beyond this, wrong note)

// Bass-specific frequency bounds
// B0 (lowest 5-string open) ≈ 30.9 Hz; C5 (top of practical bass range) ≈ 523 Hz
export const BASS_MIN_FREQ = 30
export const BASS_MAX_FREQ = 500

export function freqToNoteInfo(freq) {
  // Convert Hz to a fractional MIDI note number, then round to the nearest semitone.
  // Formula: midi = 12 * log2(freq / A4) + A4_midi
  const midi = SEMITONES_PER_OCTAVE * Math.log2(freq / A4_FREQ) + A4_MIDI
  const midiRounded = Math.round(midi)

  // Wrap MIDI number into 0–11 to get the note name, handling negative modulo.
  const noteIndex = ((midiRounded % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) % SEMITONES_PER_OCTAVE
  const note = NOTE_NAMES[noteIndex]

  const octave = Math.floor(midiRounded / SEMITONES_PER_OCTAVE) - MIDI_OCTAVE_OFFSET

  // Reconstruct the exact frequency for the nearest semitone, then measure
  // how far off the played note is in cents (1200 cents = one octave).
  const nearestFreq = A4_FREQ * Math.pow(2, (midiRounded - A4_MIDI) / SEMITONES_PER_OCTAVE)
  const cents = Math.round(CENTS_PER_OCTAVE * Math.log2(freq / nearestFreq))

  return { note, octave, cents: Math.max(-MAX_CENTS, Math.min(MAX_CENTS, cents)) }
}
