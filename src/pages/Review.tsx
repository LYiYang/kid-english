import { useMemo, useState } from 'react'
import { useApp } from '../store/useApp'
import { useSpeech } from '../hooks/useSpeech'
import { getDueWords } from '../utils/spacedRepeat'
import type { Rating, Word } from '../types'
import ProgressBar from '../components/ProgressBar'

export default function Review() {
  const { wordsView, reviewWord, incrementReviewCount, addPoints } = useApp()
  const { speak } = useSpeech()

  const queue = useMemo(() => getDueWords(wordsView), [wordsView])

  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [sessionDone, setSessionDone] = useState(false)
  const [finished, setFinished] = useState(0)

  if (queue.length === 0) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1>复习 🔁</h1>
        </header>
        <div className="card empty-state">
          <p>暂时没有需要复习的单词。</p>
          <p className="muted">去单词本里添加新单词，或者稍后再来看看吧！</p>
        </div>
      </div>
    )
  }

  if (sessionDone) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1>复习 🔁</h1>
        </header>
        <div className="card empty-state">
          <h2>🎉 复习完成！</h2>
          <p className="muted">本次共复习 {finished} 个单词。</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setIndex(0)
            setFinished(0)
            setSessionDone(false)
            setRevealed(false)
          }}>
            再来一次
          </button>
        </div>
      </div>
    )
  }

  const current = queue[index]
  const remaining = queue.length - index

  function rate(rating: Rating) {
    reviewWord(current.id, rating)
    incrementReviewCount()
    addPoints(2)
    speak(current.en)
    setFinished((f) => f + 1)
    if (index + 1 >= queue.length) {
      setSessionDone(true)
    } else {
      setIndex((i) => i + 1)
    }
    setRevealed(false)
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>复习 🔁</h1>
        <p className="subtitle">记得越牢，间隔越久</p>
      </header>

      <ProgressBar value={index} max={queue.length} label={`${index + 1} / ${queue.length}`} />

      <ReviewCard
        word={current}
        revealed={revealed}
        onReveal={() => {
          setRevealed(true)
          speak(current.en)
        }}
        onSpeak={() => speak(current.en)}
        onRate={rate}
        remaining={remaining}
      />
    </div>
  )
}

function ReviewCard({
  word,
  revealed,
  onReveal,
  onRate,
  onSpeak,
  remaining,
}: {
  word: Word
  revealed: boolean
  onReveal: () => void
  onRate: (r: Rating) => void
  onSpeak: () => void
  remaining: number
}) {
  const meanings = useMemo(() => word.cn.split(/[、,;，；]/).filter(Boolean), [word.cn])
  if (!revealed) {
    return (
      <div className="card review-card">
        <div className="center-block">
          <span className="big-word">{word.en}</span>
          <button type="button" className="btn btn--ghost" onClick={onSpeak}>
            🔊 朗读
          </button>
          <button type="button" className="btn btn--primary" onClick={onReveal}>
            显示答案
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card review-card">
      <div className="center-block">
        <span className="big-word">{word.en}</span>
        {word.phonetic && <span className="big-phonetic">{word.phonetic}</span>}
        <div className="meanings">
          {meanings.map((m) => (
            <span key={m} className="meaning-pill">{m}</span>
          ))}
        </div>
        {word.example && (
          <div className="example">
            <p>{word.example}</p>
            {word.exampleCn && <p className="muted">{word.exampleCn}</p>}
          </div>
        )}
      </div>
      <div className="rate-row">
        <button type="button" className="rate-btn rate-btn--again" onClick={() => onRate(1)}>
          <span>再记一次</span>
          <small>{remaining} 剩余</small>
        </button>
        <button type="button" className="rate-btn rate-btn--hard" onClick={() => onRate(2)}>
          <span>有点难</span>
          <small>1 天</small>
        </button>
        <button type="button" className="rate-btn rate-btn--good" onClick={() => onRate(3)}>
          <span>认得</span>
          <small>6 天</small>
        </button>
        <button type="button" className="rate-btn rate-btn--easy" onClick={() => onRate(4)}>
          <span>很简单</span>
          <small>很久</small>
        </button>
      </div>
    </div>
  )
}
