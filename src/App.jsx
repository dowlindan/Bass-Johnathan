import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Tuner from './pages/Tuner'
import Intonation from './pages/Intonation'
import SheetMusic from './pages/SheetMusic'

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Tuner />} />
          <Route path="/intonation" element={<Intonation />} />
          <Route path="/sheet-music" element={<SheetMusic />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
