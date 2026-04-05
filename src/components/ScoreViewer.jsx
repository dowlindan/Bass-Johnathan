import { useEffect, useRef } from 'react'
import abcjs from 'abcjs'
import './ScoreViewer.css'

// Green at ≤5 cents; beyond that, light red fading to dark red at ±50 cents
function centsToColor(cents) {
  const abs = Math.abs(cents)
  if (abs <= 5) return '#4caf50'
  const t = Math.min(1, (abs - 5) / 45)   // 0 = just outside green, 1 = max deviation
  const r = Math.round(255 + t * (160 - 255))  // 255 → 160
  const g = Math.round(180 + t * (0   - 180))  // 180 → 0
  const b = Math.round(180 + t * (0   - 180))  // 180 → 0
  return `rgb(${r},${g},${b})`
}

export default function ScoreViewer({ abc }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return
    abcjs.renderAbc(containerRef.current, abc, {
      responsive: 'resize',
      paddingtop: 16,
      paddingbottom: 16,
      paddingright: 16,
      paddingleft: 16,
      add_classes: true,
    })

    // Style annotation text: smaller font, no outline, green-to-red color by cents
    containerRef.current.querySelectorAll('.abcjs-annotation').forEach(el => {
      el.style.fontSize = '9px'
      el.style.stroke = 'none'
    })
    containerRef.current.querySelectorAll('.abcjs-annotation tspan').forEach(el => {
      const match = el.textContent.match(/^([+-])(\d+)$/)
      if (!match) return
      const cents = parseInt(match[1] + match[2], 10)
      el.style.fill = centsToColor(cents)
      el.style.stroke = 'none'
    })
  }, [abc])

  return <div ref={containerRef} className="score-viewer" />
}
