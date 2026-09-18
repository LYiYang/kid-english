import type { ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import WordBook from './pages/WordBook'
import Review from './pages/Review'
import Dictation from './pages/Dictation'
import ReadAloud from './pages/ReadAloud'
import TextBook from './pages/TextBook'
import Scan from './pages/Scan'
import Game from './pages/Game'
import Settings from './pages/Settings'
import { AppProvider, useApp } from './store/useApp'
import './App.css'

function ReadyGate({ children }: { children: ReactNode }) {
  const { ready } = useApp()
  if (!ready) return <div className="app-loading">正在同步学习进度…</div>
  return children
}

export default function App() {
  return (
    <AppProvider>
      <HashRouter>
        <ReadyGate>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/words" element={<WordBook />} />
              <Route path="/review" element={<Review />} />
              <Route path="/dictation" element={<Dictation />} />
              <Route path="/read" element={<ReadAloud />} />
              <Route path="/texts" element={<TextBook />} />
              <Route path="/scan" element={<Scan />} />
              <Route path="/game" element={<Game />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </ReadyGate>
      </HashRouter>
    </AppProvider>
  )
}
