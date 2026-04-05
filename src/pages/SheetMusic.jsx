import { useState } from 'react'
import ScoreViewer from '../components/ScoreViewer'
import { SCORES } from '../data/scores/index'
import './SheetMusic.css'

export default function SheetMusic() {
  const [active, setActive] = useState(null)

  if (active) {
    return (
      <div className="sheet-music">
        <div className="score-header">
          <button className="score-back" onClick={() => setActive(null)}>← Back</button>
          <h2 className="score-title">{active.title}</h2>
        </div>
        <ScoreViewer abc={active.abc} />
      </div>
    )
  }

  return (
    <div className="sheet-music">
      <ul className="score-list">
        {SCORES.map(score => (
          <li key={score.id}>
            <button className="score-item" onClick={() => setActive(score)}>
              {score.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
