import { lazy, Suspense } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Tuner from './pages/Tuner'

const Intonation = lazy(() => import('./pages/Intonation'))
const SheetMusic = lazy(() => import('./pages/SheetMusic'))

export default function App() {
  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Tuner />} />
          <Route path="/intonation" element={
            <Suspense fallback={null}>
              <Intonation />
            </Suspense>
          } />
          <Route path="/sheet-music" element={
            <Suspense fallback={null}>
              <SheetMusic />
            </Suspense>
          } />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
