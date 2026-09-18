import { useState } from 'react'
import { useApp } from '../store/useApp'
import { useSpeech } from '../hooks/useSpeech'
import { useRecognition, similarity } from '../hooks/useRecognition'
import ProgressBar from '../components/ProgressBar'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export default function ReadAloud() {
  const { words, incrementReviewCount, addPoints } = useApp()
  const { speak, supported: speakSupported } = useSpeech()
  const { supported: recSupported, listening, transcript, error, start, stop, reset } =
    useRecognition()

  const [queue, setQueue] = useState(() => shuffle(words).slice(0, 8))
  const [index, setIndex] = useState(0)
  const [scoreSheet, setScoreSheet] = useState<{ passed: boolean; score: number }[]>([])

  const done = index >= queue.length

  if (words.length === 0) {
    return (
      <div className="page-container">
        <header className="page-header"><h1>跟读 🎤</h1></header>
        <div className="card empty-state"><p>词库是空的，先到单词本添加单词吧。</p></div>
      </div>
    )
  }

  if (done) {
    const passed = scoreSheet.filter((s) => s.passed).length
    return (
      <div className="page-container">
        <header className="page-header"><h1>跟读 🎤</h1></header>
        <div className="card empty-state">
          <h2>🎉 跟读完成！</h2>
          <p className="muted">通过 {passed} / {queue.length} 个单词</p>
          <button type="button" className="btn btn--primary" onClick={() => {
            setQueue(shuffle(words).slice(0, 8))
            setIndex(0)
            setScoreSheet([])
            reset()
          }}>
            再来一轮
          </button>
        </div>
      </div>
    )
  }

  const current = queue[index]
  const score = transcript.trim() ? similarity(current.en, transcript) : 0

  function play() {
    speak(current.en)
  }

  function check() {
    if (!transcript.trim()) return
    const target = current.en
    const score = similarity(target, transcript)
    const passed = score >= 0.6
    setScoreSheet((s) => [...s, { passed, score }])
    if (passed) addPoints(5)
    incrementReviewCount()
    reset()
    setIndex((i) => i + 1)
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>跟读 🎤</h1>
        <p className="subtitle">先听发音，再大声跟读</p>
      </header>

      <ProgressBar value={index} max={queue.length} label={`${index + 1} / ${queue.length}`} />

      <div className="card read-card">
        <div className="center-block">
          <span className="big-word">{current.en}</span>
          <p className="muted">{current.cn}</p>
          <div className="read-controls">
            <button type="button" className="btn btn--primary" onClick={play}>
              🔊 播放发音
            </button>
            {recSupported ? (
              <button
                type="button"
                className={listening ? 'btn btn--danger' : 'btn btn--ghost'}
                onClick={() => {
                  if (listening) stop()
                  else start()
                }}
              >
                {listening ? '⏹ 停止录音' : '🎤 开始跟读'}
              </button>
            ) : (
              <p className="warn">当前浏览器不支持语音识别，请用 Chrome。</p>
            )}
          </div>

          {transcript.trim() && (
            <div className="dictation-result">
              <p className="muted">识别：{transcript}</p>
              <div className={`read-score ${score >= 0.6 ? 'ok' : 'bad'}`}>
                匹配度 {Math.round(score * 100)}%
              </div>
              <button type="button" className="btn btn--primary btn--block" onClick={check}>
                确认
              </button>
            </div>
          )}

          {error && <p className="warn">识别出错：{error}</p>}
          {!speakSupported && <p className="warn">当前浏览器不支持语音朗读，请用 Chrome。</p>}
        </div>
      </div>
    </div>
  )
}
