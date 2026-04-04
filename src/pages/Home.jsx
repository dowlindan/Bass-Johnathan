import { useNavigate } from 'react-router-dom'
import './Home.css'

const features = [
  {
    path: '/tuner',
    label: 'Tuner',
    description: 'Tune your bass in real time',
    icon: '🎸',
  },
  {
    path: '/intonation',
    label: 'Intonation',
    description: 'Check your intonation against a scale',
    icon: '🎯',
  },
  {
    path: '/sheet-music',
    label: 'Sheet Music',
    description: 'Browse great bass lines',
    icon: '🎼',
  },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="home">
      <header className="home-header">
        <h1>Bass Johnathan</h1>
        <p>Your bass practice companion</p>
      </header>

      <main className="home-cards">
        {features.map(({ path, label, description, icon }) => (
          <button
            key={path}
            className="feature-card"
            onClick={() => navigate(path)}
          >
            <span className="feature-icon">{icon}</span>
            <span className="feature-label">{label}</span>
            <span className="feature-description">{description}</span>
          </button>
        ))}
      </main>
    </div>
  )
}
