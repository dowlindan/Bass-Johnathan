import { NavLink } from 'react-router-dom'
import './Layout.css'

function TunerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="8" />
      <path d="M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0" />
      <line x1="12" y1="16" x2="12" y2="22" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
    </svg>
  )
}

function IntonationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function SheetMusicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  )
}

const tabs = [
  { to: '/',            label: 'Tuner',       Icon: TunerIcon },
  { to: '/intonation',  label: 'Intonation',  Icon: IntonationIcon },
  { to: '/sheet-music', label: 'Sheet Music', Icon: SheetMusicIcon },
]

export default function Layout({ children }) {
  return (
    <div className="layout">
      <main className="layout-content">{children}</main>

      <nav className="bottom-nav">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              'nav-tab' + (isActive ? ' nav-tab--active' : '')
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
