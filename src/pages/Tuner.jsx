import { useEffect, useRef, useState } from 'react'
import { PitchDetector } from 'pitchy'
import { freqToNoteInfo, MAX_CENTS, BASS_MIN_FREQ, BASS_MAX_FREQ } from '../utils/audio'
import './Tuner.css'

// ─── Audio / sensitivity ─────────────────────────────────────────────────────
const FFT_SIZE = 2048            // analyser window; larger = better low-freq resolution
const CLARITY_THRESHOLD = 0.92  // pitchy confidence required (0–1); higher = fewer false reads
const VOLUME_GATE = 0.015       // RMS energy floor; signals below this are treated as silence
const HISTORY_SIZE = 8          // consecutive frames that must agree before displaying
const STABILITY_CENTS = 12      // max spread (cents) allowed within the history window
const IDLE_TIMEOUT_MS = 500     // ms of silence before reverting to "Waiting for pitch"

// ─── SVG dial geometry ───────────────────────────────────────────────────────
// 0° = straight up, positive degrees = clockwise
const SVG_WIDTH = 320
const SVG_HEIGHT = 200
const CX = SVG_WIDTH / 2        // horizontal centre of the dial
const CY = SVG_HEIGHT - 5       // pivot near the bottom so the arc fans upward
const R = 140                    // arc radius in SVG units
const SWEEP = 75                 // degrees each side of centre (covers ±MAX_CENTS)
const NEEDLE_INSET = 18         // needle tip sits this many units inside the arc

const TICK_INTERVAL_CENTS = 10  // one tick every N cents
const MAJOR_TICK_INTERVAL = 25  // ticks at multiples of this are drawn larger
const TICKS = Array.from(
  { length: (MAX_CENTS * 2) / TICK_INTERVAL_CENTS + 1 },
  (_, i) => -MAX_CENTS + i * TICK_INTERVAL_CENTS
)
const MAJOR_TICK_INNER_INSET = 17  // inset from R for the inner end of a major tick
const MINOR_TICK_INNER_INSET = 12
const MAJOR_TICK_OUTER_EXTEND = 5  // how far a major tick protrudes past the arc
const MINOR_TICK_OUTER_EXTEND = 2
const MAJOR_TICK_STROKE = 2
const MINOR_TICK_STROKE = 1

// ─── Needle colours ──────────────────────────────────────────────────────────
const IN_TUNE_THRESHOLD = 5     // cents — within this range the needle shows blue
const COLOR_IN_TUNE = '#4a9eff'
const COLOR_FLAT    = '#4caf50'
const COLOR_SHARP   = '#f44336'
const COLOR_IDLE    = '#444'

// ─── Pure functions ──────────────────────────────────────────────────────────

// Map an angle (0° = up, positive = clockwise) to an SVG {x, y} coordinate.
function pt(deg, r = R) {
  const rad = (deg - 90) * Math.PI / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

// Build an SVG arc path between two angles.
function arc(fromDeg, toDeg, r = R) {
  const s = pt(fromDeg, r)
  const e = pt(toDeg, r)
  const largeArc = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`
}

function needleColor(cents) {
  if (Math.abs(cents) <= IN_TUNE_THRESHOLD) return COLOR_IN_TUNE
  return cents < 0 ? COLOR_FLAT : COLOR_SHARP
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Tuner() {
  const [tuning, setTuning] = useState(null)
  const [error, setError] = useState(null)
  const rafRef = useRef(null)
  const pitchHistory = useRef([])
  const lastValidAt = useRef(0)

  useEffect(() => {
    let stream, audioCtx

    async function init() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        audioCtx = new AudioContext()
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = FFT_SIZE
        audioCtx.createMediaStreamSource(stream).connect(analyser)

        const detector = PitchDetector.forFloat32Array(analyser.fftSize)
        const input = new Float32Array(detector.inputLength)

        function tick() {
          analyser.getFloatTimeDomainData(input)

          // Volume gate — discard silence and transient noise
          let sumSq = 0
          for (let i = 0; i < input.length; i++) sumSq += input[i] * input[i]
          const rms = Math.sqrt(sumSq / input.length)

          if (rms < VOLUME_GATE) {
            pitchHistory.current = []
            if (Date.now() - lastValidAt.current > IDLE_TIMEOUT_MS) setTuning(null)
            rafRef.current = requestAnimationFrame(tick)
            return
          }

          const [freq, clarity] = detector.findPitch(input, audioCtx.sampleRate)

          if (clarity < CLARITY_THRESHOLD || freq < BASS_MIN_FREQ || freq > BASS_MAX_FREQ) {
            pitchHistory.current = []
            if (Date.now() - lastValidAt.current > IDLE_TIMEOUT_MS) setTuning(null)
            rafRef.current = requestAnimationFrame(tick)
            return
          }

          // Stability check — require several consecutive frames to agree
          const noteInfo = freqToNoteInfo(freq)
          const history = pitchHistory.current
          history.push(noteInfo.cents)
          if (history.length > HISTORY_SIZE) history.shift()

          if (history.length >= HISTORY_SIZE) {
            const mean = history.reduce((a, b) => a + b, 0) / history.length
            const stable = history.every(c => Math.abs(c - mean) < STABILITY_CENTS)
            if (stable) {
              lastValidAt.current = Date.now()
              setTuning(noteInfo)
            }
          }

          rafRef.current = requestAnimationFrame(tick)
        }

        rafRef.current = requestAnimationFrame(tick)
      } catch {
        setError('Microphone access denied')
      }
    }

    init()

    return () => {
      cancelAnimationFrame(rafRef.current)
      stream?.getTracks().forEach(t => t.stop())
      audioCtx?.close()
    }
  }, [])

  const cents = tuning?.cents ?? 0
  const needleDeg = (cents / MAX_CENTS) * SWEEP
  const tip = pt(needleDeg, R - NEEDLE_INSET)
  const color = tuning ? needleColor(cents) : COLOR_IDLE

  return (
    <div className="tuner">
      <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="tuner-svg" aria-hidden>
        {/* Background arc */}
        <path
          d={arc(-SWEEP, SWEEP)}
          fill="none"
          stroke="#222"
          strokeWidth="18"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {TICKS.map(c => {
          const deg = (c / MAX_CENTS) * SWEEP
          const major = c % MAJOR_TICK_INTERVAL === 0
          const inner = pt(deg, R - (major ? MAJOR_TICK_INNER_INSET : MINOR_TICK_INNER_INSET))
          const outer = pt(deg, R + (major ? MAJOR_TICK_OUTER_EXTEND : MINOR_TICK_OUTER_EXTEND))
          return (
            <line
              key={c}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={major ? '#555' : '#333'}
              strokeWidth={major ? MAJOR_TICK_STROKE : MINOR_TICK_STROKE}
              strokeLinecap="round"
            />
          )
        })}

        {/* Needle */}
        <line
          x1={CX} y1={CY}
          x2={tip.x} y2={tip.y}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r="5" fill={color} />
      </svg>

      <div className="tuner-note">
        {tuning ? (
          <>
            <span className="note-name">{tuning.note}</span>
            <span className="note-octave">{tuning.octave}</span>
          </>
        ) : (
          <span className="note-idle">{error ?? 'Waiting for pitch...'}</span>
        )}
      </div>

      <p className="tuner-cents" style={{ color }}>
        {tuning ? `${cents > 0 ? '+' : ''}${cents} cents` : '\u00a0'}
      </p>
    </div>
  )
}
