import { useState, useRef } from 'react'
import { PitchDetector } from 'pitchy'
import ScoreViewer from '../components/ScoreViewer'
import { freqToNoteInfo, BASS_MIN_FREQ, BASS_MAX_FREQ } from '../utils/audio'
import './Intonation.css'

// ─── Exercises ───────────────────────────────────────────────────────────────
const EXERCISES = [
  {
    id: 'free-play',
    label: 'Free Play',
    description: 'Play freely — your notes and intonation are recorded',
  },
]

// ─── Configuration ────────────────────────────────────────────────────────────
const DEFAULT_BPM = 80
const MIN_BPM = 40
const MAX_BPM = 200
const BEATS_PER_BAR = 4
const COUNT_IN_BEATS = 4     // one full bar of clicks before recording starts

// ─── Audio / sensitivity ─────────────────────────────────────────────────────
const FFT_SIZE = 2048
const CLARITY_THRESHOLD = 0.92
const VOLUME_GATE = 0.015

// ─── ABC generation ───────────────────────────────────────────────────────────

function noteToABC(note, octave) {
  const isSharp = note.includes('#')
  const base = note[0]
  const accidental = isSharp ? '^' : ''
  // In ABC notation, uppercase = C3–B3 (below middle C); lowercase = C4–B4 (middle C octave)
  if (octave >= 4) return accidental + base.toLowerCase() + "'".repeat(octave - 4)
  return accidental + base.toUpperCase() + ','.repeat(Math.max(0, 3 - octave))
}

function buildResultABC(notes, bpm) {
  const tokens = notes.map(n => {
    if (!n) return 'z'
    const sign = n.cents >= 0 ? '+' : ''
    return `"_${sign}${n.cents}"${noteToABC(n.note, n.octave)}`
  })

  while (tokens.length % BEATS_PER_BAR !== 0) tokens.push('z')

  const bars = []
  for (let i = 0; i < tokens.length; i += BEATS_PER_BAR) {
    bars.push(tokens.slice(i, i + BEATS_PER_BAR).join(''))
  }

  return [
    'X:1',
    'T:Recorded',
    'M:4/4',
    'L:1/4',
    `Q:1/4=${bpm}`,
    'K:C clef=bass',
    bars.join('|') + '|]',
  ].join('\n')
}

// ─── Beat-window note selection ───────────────────────────────────────────────
// Instead of sampling a single point-in-time value, the RAF loop accumulates
// every valid detection across the full beat window. This function picks the
// most frequently detected note (mode) and averages its cents readings.
function modeNote(notes) {
  if (notes.length === 0) return null

  const counts = new Map()
  for (const n of notes) {
    const key = `${n.note}${n.octave}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  let topKey = null, topCount = 0
  for (const [key, count] of counts) {
    if (count > topCount) { topKey = key; topCount = count }
  }

  const matches = notes.filter(n => `${n.note}${n.octave}` === topKey)
  const avgCents = Math.round(matches.reduce((sum, n) => sum + n.cents, 0) / matches.length)
  return { ...matches[0], cents: avgCents }
}

// ─── Metronome click ─────────────────────────────────────────────────────────
function scheduleClick(audioCtx) {
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  const t = audioCtx.currentTime
  osc.frequency.value = 1000
  gain.gain.setValueAtTime(0.6, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
  osc.start(t)
  osc.stop(t + 0.06)
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Intonation() {
  const [selectedExercise, setSelectedExercise] = useState(EXERCISES[0])

  // BPM: two states — `bpm` (number, used for logic) and `bpmDisplay` (string, shown in input).
  // Separating them lets the user type freely without the field fighting them.
  const [bpm, setBpm] = useState(DEFAULT_BPM)
  const [bpmDisplay, setBpmDisplay] = useState(String(DEFAULT_BPM))

  const [phase, setPhase] = useState('idle')  // 'idle' | 'countdown' | 'recording' | 'results'
  const [countBeat, setCountBeat] = useState(0)    // 1–4 during countdown
  const [recordedBeats, setRecordedBeats] = useState(0)
  const [elapsed, setElapsed] = useState('0.000')
  const [resultABC, setResultABC] = useState(null)
  const [error, setError] = useState(null)

  // Audio refs
  const audioCtxRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const beatTimerRef = useRef(null)

  // Recording refs
  const beatNotesRef = useRef([])  // accumulates every valid detection within the current beat window
  const recordedRef = useRef([])
  const bpmRef = useRef(bpm)
  const totalBeatRef = useRef(0)  // beats since start, including count-in
  const recordingStartRef = useRef(null)  // Date.now() when recording phase begins

  function updateBpm(newBpm) {
    setBpm(newBpm)
    setBpmDisplay(String(newBpm))
  }

  function stopAudio() {
    cancelAnimationFrame(rafRef.current)
    clearInterval(beatTimerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    streamRef.current = null
  }

  async function handleStart() {
    setError(null)
    setCountBeat(0)
    setRecordedBeats(0)
    setElapsed('0.000')
    bpmRef.current = bpm
    totalBeatRef.current = 0
    recordedRef.current = []
    beatNotesRef.current = []
    recordingStartRef.current = null

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      const audioCtx = new AudioContext()
      streamRef.current = stream
      audioCtxRef.current = audioCtx

      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      audioCtx.createMediaStreamSource(stream).connect(analyser)

      const detector = PitchDetector.forFloat32Array(analyser.fftSize)
      const input = new Float32Array(detector.inputLength)

      function tick() {
        analyser.getFloatTimeDomainData(input)

        let sumSq = 0
        for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i]
        const rms = Math.sqrt(sumSq / input.length)

        if (rms >= VOLUME_GATE) {
          const [freq, clarity] = detector.findPitch(input, audioCtx.sampleRate)
          if (clarity >= CLARITY_THRESHOLD && freq >= BASS_MIN_FREQ && freq <= BASS_MAX_FREQ) {
            beatNotesRef.current.push(freqToNoteInfo(freq))
          }
        }

        if (recordingStartRef.current !== null) {
          const ms = Date.now() - recordingStartRef.current
          const secs = Math.floor(ms / 1000)
          const frac = String(ms % 1000).padStart(3, '0')
          setElapsed(`${secs}.${frac}`)
        }

        rafRef.current = requestAnimationFrame(tick)
      }

      rafRef.current = requestAnimationFrame(tick)

      // Fire beat 1 of the count-in immediately so there's no delay after pressing Start
      totalBeatRef.current = 1
      scheduleClick(audioCtx)
      setCountBeat(1)

      const beatIntervalMs = (60 / bpmRef.current) * 1000

      beatTimerRef.current = setInterval(() => {
        const beat = ++totalBeatRef.current
        scheduleClick(audioCtxRef.current)

        if (beat <= COUNT_IN_BEATS) {
          // Still counting in — discard any accumulated detections
          setCountBeat(beat)
          beatNotesRef.current = []
        } else {
          // Recording — take the mode of everything detected this beat, then reset
          if (beat === COUNT_IN_BEATS + 1) {
            recordingStartRef.current = Date.now()
            setPhase('recording')
          }
          recordedRef.current.push(modeNote(beatNotesRef.current))
          beatNotesRef.current = []
          setRecordedBeats(recordedRef.current.length)
        }
      }, beatIntervalMs)

      setPhase('countdown')
    } catch {
      setError('Microphone access denied')
    }
  }

  function handleStop() {
    stopAudio()
    if (recordedRef.current.length > 0) {
      setResultABC(buildResultABC(recordedRef.current, bpmRef.current))
      setPhase('results')
    } else {
      setPhase('idle')
    }
  }

  function handleReset() {
    setPhase('idle')
    setResultABC(null)
    setCountBeat(0)
    setRecordedBeats(0)
  }

  const bar = recordedBeats > 0 ? Math.ceil(recordedBeats / BEATS_PER_BAR) : 1
  const beat = recordedBeats > 0 ? (recordedBeats - 1) % BEATS_PER_BAR + 1 : 1

return (
    <div className="intonation">

      {phase === 'idle' && (
        <>
          <ul className="exercise-list">
            {EXERCISES.map(ex => (
              <li key={ex.id}>
                <button
                  className={`exercise-item${selectedExercise.id === ex.id ? ' exercise-item--active' : ''}`}
                  onClick={() => setSelectedExercise(ex)}
                >
                  <span className="exercise-label">{ex.label}</span>
                  <span className="exercise-desc">{ex.description}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="bpm-control">
            <span className="bpm-label">BPM</span>
            <div className="bpm-row">
              <button
                className="bpm-step"
                onClick={() => updateBpm(Math.max(MIN_BPM, bpm - 1))}
              >−</button>
              <input
                className="bpm-input"
                type="number"
                min={MIN_BPM}
                max={MAX_BPM}
                value={bpmDisplay}
                onChange={e => {
                  setBpmDisplay(e.target.value)
                  const v = parseInt(e.target.value, 10)
                  if (!isNaN(v) && v >= MIN_BPM && v <= MAX_BPM) setBpm(v)
                }}
                onBlur={() => setBpmDisplay(String(bpm))}
              />
              <button
                className="bpm-step"
                onClick={() => updateBpm(Math.min(MAX_BPM, bpm + 1))}
              >+</button>
            </div>
          </div>

          <p className="intonation-note">Only quarter notes are recorded at this time.</p>

          {error && <p className="intonation-error">{error}</p>}

          <button className="action-btn" onClick={handleStart}>Start</button>
        </>
      )}

      {phase === 'countdown' && (
        <div className="recording-view">
          <div className="countdown">
            {[1, 2, 3, 4].map(n => (
              <span key={n} className={`count-num${countBeat === n ? ' count-num--active' : ''}`}>
                {n}
              </span>
            ))}
          </div>
          <button className="action-btn action-btn--secondary" onClick={handleStop}>Cancel</button>
        </div>
      )}

      {phase === 'recording' && (
        <div className="recording-view">
          <div className="recording-indicator">
            <span className="recording-dot" />
            Recording
          </div>
          <div className="record-position">
            <span className="record-bar">Bar {bar} &middot; Beat {beat}</span>
            <span className="record-elapsed">{elapsed}</span>
          </div>
          <button className="action-btn" onClick={handleStop}>Stop</button>
        </div>
      )}

      {phase === 'results' && resultABC && (
        <div className="results-view">
          <ScoreViewer abc={resultABC} />
          <button className="action-btn action-btn--secondary" onClick={handleReset}>
            New Recording
          </button>
        </div>
      )}

    </div>
  )
}
