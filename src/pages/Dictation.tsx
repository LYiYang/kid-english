import { useEffect, useState } from 'react'
import { useApp } from '../store/useApp'
import { useSpeech } from '../hooks/useSpeech'
import type { Word } from '../types'
import ProgressBar from '../components/ProgressBar'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildQueue(words: Word[], count: number): Word[] {
  return shuffle(words).slice(0, count)
}

export default function Dictation() {
  const { words, incrementReviewCount, addPoints } = useApp()
  const { speak, supported } = useSpeech()

  const [queue, setQueue] = useState<Word[]>(() => buildQueue(words, 8))
  const [index, setIndex] = useState(0)
  const [input, setInput] = useState('')
  const [round, setRound] = useState(0)
  const [score, setScore] = useState(0)

  useEffect(() => {
    if (queue.length > 0) speak(queue[index]?.en ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, round, queue])

  if (words.length === 0) {
    return (
      <div className="page-container">
        <header className="page-header"><h1>听写 🎧</h1></header>
        <div className="card empty-state">
          <p>词库是空的，先到单词本添加单词吧。</p>
        </div>
      </div>
    )
  }

  if (index >= queue.length) {
    return (
      <div className="page-container">
        <header className="page-header"><h1>听写 🎧</h1></header>
        <div className="card empty-state">
          <h2>🎉 听写完成！</h2>
          <p className="muted">正确 {score} / {queue.length} 个</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setQueue(buildQueue(words, 8))
            setIndex(0)
            setScore(0)
            setRound((r) => r + 1)
            setInput('')
          }}>
            再来一轮
          </button>
        </div>
      </div>
    )
  }

  const current = queue[index]

  function submit() {
    const answer = input.trim().toLowerCase()
    if (!answer) return
    const correct = answer === current.en.toLowerCase()
    if (correct) {
      setScore((s) => s + 1)
      addPoints(5)
    }
    incrementReviewCount()
    setInput('')
    setIndex((i) => i + 1)
    next()
  }

  function next() {
    if (index + 1 < queue.length) {
      setTimeout(() => speak(queue[index + 1].en), 150)
    }
  }

  function playAgain() {
    speak(current.en)
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>听写 🎧</h1>
        <p className="subtitle">听单词，拼出正确的英文</p>
      </header>

      <ProgressBar value={index} max={queue.length} label={`${index + 1} / ${queue.length}`} />

      <div className="card dictation-card">
        <div className="center-block">
          <span className="score-badge">得分 {score}</span>
          <div className="dictation-player">
            <button type="button" className="big-sound" onClick={playAgain}>
              🔊
            </button>
            <span className="muted">点击重新播放</span>
          </div>
          {!supported && <p className="warn">当前浏览器不支持语音朗读，请换用 Chrome。</p>}
          <form
            className="dictation-form"
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入英文单词…"
              className="dictation-input"
            />
            <button type="submit" className="btn btn--primary btn--block" disabled={!input.trim()}>
              提交
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
