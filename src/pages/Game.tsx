import { useEffect, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import { useSpeech } from '../hooks/useSpeech'
import type { GameLevel, StarRating, Word } from '../types'
import ProgressBar from '../components/ProgressBar'

const TIME_LIMIT = 60
const PAIR_SCORE = 10

const LEVELS: GameLevel[] = [
  { id: 1, title: '食物入门', group: '食物', cardCount: 3, unlockStars: 0 },
  { id: 2, title: '动物乐园', group: '动物', cardCount: 4, unlockStars: 2 },
  { id: 3, title: '五彩缤纷', group: '颜色', cardCount: 4, unlockStars: 5 },
  { id: 4, title: '校园生活', group: '学校', cardCount: 5, unlockStars: 10 },
  { id: 5, title: '温馨家庭', group: '家庭', cardCount: 5, unlockStars: 15 },
  { id: 6, title: '终极挑战', group: '全部', cardCount: 6, unlockStars: 22 },
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function starsForErrors(errors: number): StarRating {
  if (errors === 0) return 3
  if (errors <= 2) return 2
  return 1
}

function pickWords(all: Word[], group: string, count: number): Word[] {
  const pool = group === '全部' ? all : all.filter((w) => w.group === group)
  const exact = shuffle(pool)
  if (exact.length >= count) return exact.slice(0, count)
  const remainder = shuffle(all.filter((w) => !exact.includes(w)))
  return [...exact, ...remainder].slice(0, count)
}

type Phase = 'map' | 'play' | 'result'

export default function Game() {
  const { words, totalStars, userData, recordLevelResult } = useApp()
  const levels = userData.levels

  const [phase, setPhase] = useState<Phase>('map')
  const [activeLevel, setActiveLevel] = useState<GameLevel | null>(null)
  const [cards, setCards] = useState<Word[]>([])
  const [enSide, setEnSide] = useState<string[]>([])
  const [cnSide, setCnSide] = useState<string[]>([])
  const [selectedEn, setSelectedEn] = useState<Set<string>>(new Set())
  const [selectedCn, setSelectedCn] = useState<Set<string>>(new Set())
  const [pickedEn, setPickedEn] = useState<string | null>(null)
  const [pickedCn, setPickedCn] = useState<string | null>(null)
  const [errors, setErrors] = useState(0)
  const [score, setScore] = useState(0)
  const [seconds, setSeconds] = useState(TIME_LIMIT)
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null)
  const [timedOutFlag, setTimedOutFlag] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const endTimeRef = useRef(0)
  const errorsRef = useRef(0)
  const allMatchedRef = useRef(false)

  function begin(level: GameLevel) {
    if (totalStars < level.unlockStars) return
    const chosen = pickWords(words, level.group, level.cardCount)
    setActiveLevel(level)
    setCards(chosen)
    setEnSide(shuffle(chosen.map((w) => w.en)))
    setCnSide(shuffle(chosen.map((w) => w.cn)))
    setSelectedEn(new Set())
    setSelectedCn(new Set())
    setPickedEn(null)
    setPickedCn(null)
    setErrors(0)
    errorsRef.current = 0
    allMatchedRef.current = false
    setTimedOutFlag(false)
    setScore(0)
    setSeconds(TIME_LIMIT)
    endTimeRef.current = Date.now() + TIME_LIMIT * 1000
    setWrongPair(null)
    setPhase('play')
  }

  const finishLevel = () => {
    if (!activeLevel) return
    allMatchedRef.current = true
    setTimedOutFlag(false)
    recordLevelResult(activeLevel.id, starsForErrors(errorsRef.current), errorsRef.current)
    setPhase('result')
  }

  const finishByTimeout = () => {
    if (!activeLevel || allMatchedRef.current) return
    setTimedOutFlag(true)
    recordLevelResult(activeLevel.id, 0, errorsRef.current)
    setPhase('result')
  }

  useEffect(() => {
    if (phase !== 'play') return
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current ?? undefined)
        finishByTimeout()
      }
    }
    timerRef.current = setInterval(tick, 250)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  function pickEn(en: string) {
    if (selectedEn.has(en)) return
    if (selectedCn.size >= cards.length) return
    setPickedEn(en)
    const currentCn = pickedCn
    if (currentCn) resolvePair(en, currentCn)
  }

  function pickCn(cn: string) {
    if (selectedCn.has(cn)) return
    if (selectedEn.size >= cards.length) return
    setPickedCn(cn)
    const currentEn = pickedEn
    if (currentEn) resolvePair(currentEn, cn)
  }

  function resolvePair(en: string, cn: string) {
    const word = cards.find((w) => w.en === en)
    if (!word) return
    const isMatch = word.cn === cn
    if (isMatch) {
      const newEn = new Set(selectedEn).add(en)
      const newCn = new Set(selectedCn).add(cn)
      setSelectedEn(newEn)
      setSelectedCn(newCn)
      setScore((s) => s + PAIR_SCORE)
      allMatchedRef.current = newEn.size === cards.length
      if (allMatchedRef.current) finishLevel()
    } else {
      const pair: [string, string] = [en, cn]
      setWrongPair(pair)
      errorsRef.current += 1
      setErrors(errorsRef.current)
      setTimeout(() => setWrongPair(null), 500)
    }
    setPickedEn(null)
    setPickedCn(null)
  }

  const currentLevel = LEVELS.find((l) => l.id === (activeLevel?.id ?? 1))

  return (
    <div className="page-container">
      {phase === 'map' && (
        <LevelMap
          totalStars={totalStars}
          levels={LEVELS}
          levelResults={levels}
          onStart={begin}
        />
      )}
      {phase === 'play' && currentLevel && (
        <GameBoard
          level={currentLevel}
          enSide={enSide}
          cnSide={cnSide}
          selectedEn={selectedEn}
          selectedCn={selectedCn}
          pickedEn={pickedEn}
          pickedCn={pickedCn}
          wrongPair={wrongPair}
          score={score}
          seconds={seconds}
          total={cards.length}
          matched={selectedEn.size}
          onPickEn={pickEn}
          onPickCn={pickCn}
          onBack={() => setPhase('map')}
        />
      )}
      {phase === 'result' && activeLevel && (
        <Result
          stars={timedOutFlag ? 0 : starsForErrors(errors)}
          errors={errors}
          score={score}
          totalStars={totalStars}
          nextLevel={LEVELS.find((l) => l.id === activeLevel.id + 1) ?? null}
          onReplay={() => begin(activeLevel)}
          onMap={() => setPhase('map')}
          onNext={(next) => begin(next)}
        />
      )}
    </div>
  )
}

function StarRow({ n, max = 3 }: { n: number; max?: number }) {
  return (
    <span className="star-row">
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={i < n ? 'star star--on' : 'star'}>
          ⭐
        </span>
      ))}
    </span>
  )
}

function LevelMap({
  totalStars,
  levels,
  levelResults,
  onStart,
}: {
  totalStars: number
  levels: GameLevel[]
  levelResults: Record<number, { stars: StarRating; errors: number } | undefined>
  onStart: (level: GameLevel) => void
}) {
  const available = levels.filter((l) => totalStars >= l.unlockStars)
  const totalAvailable = available.length
  const completed = levels.filter((l) => levelResults[l.id]).length
  return (
    <div className="game-map">
      <header className="page-header">
        <h1>闯关游戏 🎮</h1>
        <p className="subtitle">
          累计 ⭐ {totalStars} · 已完成 {completed} / {levels.length} 关
        </p>
      </header>

      <ProgressBar value={completed} max={levels.length} label="关卡进度" />

      <div className="level-grid">
        {levels.map((level) => {
          const result = levelResults[level.id]
          const locked = totalStars < level.unlockStars
          const isNext = !locked && !result && level.id === (completed + 1)
          return (
            <button
              key={level.id}
              type="button"
              className={
                ['level-card', locked ? 'level-card--locked' : '', isNext ? 'level-card--next' : ''].join(' ')
              }
              onClick={() => onStart(level)}
              disabled={locked}
            >
              <span className="level-num">第 {level.id} 关</span>
              <span className="level-title">{level.title}</span>
              <span className="level-theme">{locked ? `🔒 需 ${level.unlockStars} 星解锁` : level.group}</span>
              {result && <StarRow n={result.stars} />}
              {!locked && !result && <span className="level-play">开始 ▶</span>}
            </button>
          )
        })}
      </div>

      <div className="legend">
        <div className="legend-item"><span className="star">⭐</span> 全对</div>
        <div className="legend-item"><span className="star">⭐⭐</span> 错 1~2</div>
        <div className="legend-item"><span className="star">⭐</span> 错 3+</div>
      </div>

      {totalAvailable === 0 && <p className="empty">先完成第 1 关开始闯关吧！</p>}
    </div>
  )
}

function GameBoard({
  level,
  enSide,
  cnSide,
  selectedEn,
  selectedCn,
  pickedEn,
  pickedCn,
  wrongPair,
  score,
  seconds,
  total,
  matched,
  onPickEn,
  onPickCn,
  onBack,
}: {
  level: GameLevel
  enSide: string[]
  cnSide: string[]
  selectedEn: Set<string>
  selectedCn: Set<string>
  pickedEn: string | null
  pickedCn: string | null
  wrongPair: [string, string] | null
  score: number
  seconds: number
  total: number
  matched: number
  onPickEn: (en: string) => void
  onPickCn: (cn: string) => void
  onBack: () => void
}) {
  const { speak } = useSpeech()
  const wrongEn = wrongPair?.[0]
  const wrongCn = wrongPair?.[1]

  return (
    <div className="game-board">
      <header className="game-header">
        <button type="button" className="btn btn--ghost btn--sm" onClick={onBack}>
          ‹ 返回
        </button>
        <span className="game-level-title">{level.title}</span>
        <span className="game-score">得分 {score}</span>
      </header>

      <div className="game-timer-row">
        <span className={`game-timer ${seconds <= 10 ? 'game-timer--low' : ''}`}>⏱ {seconds}s</span>
        <ProgressBar value={matched} max={total} label={`${matched} / ${total}`} />
      </div>

      <div className="board-cols">
        <div className="board-col board-col--en">
          <span className="board-title">English</span>
          <div className="board-cards">
            {enSide.map((en) => {
              const matched = selectedEn.has(en)
              const selected = pickedEn === en
              const wrong = wrongEn === en
              return (
                <button
                  key={en}
                  type="button"
                  className={[
                    'pair-card', 'pair-card--en',
                    matched ? 'pair-card--matched' : '',
                    selected ? 'pair-card--selected' : '',
                    wrong ? 'pair-card--wrong' : '',
                  ].join(' ')}
                  disabled={matched}
                  onClick={() => {
                    if (!matched) speak(en)
                    onPickEn(en)
                  }}
                >
                  {en}
                </button>
              )
            })}
          </div>
        </div>

        <div className="board-col board-col--cn">
          <span className="board-title">中文</span>
          <div className="board-cards">
            {cnSide.map((cn) => {
              const matched = selectedCn.has(cn)
              const selected = pickedCn === cn
              const wrong = wrongCn === cn
              return (
                <button
                  key={cn}
                  type="button"
                  className={[
                    'pair-card', 'pair-card--cn',
                    matched ? 'pair-card--matched' : '',
                    selected ? 'pair-card--selected' : '',
                    wrong ? 'pair-card--wrong' : '',
                  ].join(' ')}
                  disabled={matched}
                  onClick={() => onPickCn(cn)}
                >
                  {cn}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function Result({
  stars,
  errors,
  score,
  totalStars,
  nextLevel,
  onReplay,
  onMap,
  onNext,
}: {
  stars: StarRating
  errors: number
  score: number
  totalStars: number
  nextLevel: GameLevel | null
  onReplay: () => void
  onMap: () => void
  onNext: (level: GameLevel) => void
}) {
  return (
    <div className="card empty-state result-card">
      <h2>{stars === 0 ? '⏰ 时间到！' : '🎉 挑战成功！'}</h2>
      <StarRow n={stars} />
      <p className="muted">
        得分 {score} · 错误 {errors} 次
        {nextLevel && stars > 0 && ` · 已解锁：${nextLevel.title}`}
      </p>
      <p className="muted">当前累计 ⭐ {totalStars}</p>
      <div className="result-actions">
        {stars > 0 && nextLevel && (
          <button type="button" className="btn btn--primary" onClick={() => onNext(nextLevel)}>
            下一关 ▶
          </button>
        )}
        <button type="button" className="btn btn--ghost" onClick={onReplay}>
          再试一次
        </button>
        <button type="button" className="btn btn--ghost" onClick={onMap}>
          返回关卡图
        </button>
      </div>
    </div>
  )
}
