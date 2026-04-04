import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Tuner from './pages/Tuner'
import Intonation from './pages/Intonation'
import SheetMusic from './pages/SheetMusic'

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Tuner />} />
          <Route path="/intonation" element={<Intonation />} />
          <Route path="/sheet-music" element={<SheetMusic />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
