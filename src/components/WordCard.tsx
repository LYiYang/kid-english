import type { Word } from '../types'
import { useSpeech } from '../hooks/useSpeech'

interface WordCardProps {
  word: Word
  size?: 'sm' | 'md' | 'lg'
  showCn?: boolean
  onSpeak?: () => void
}

export default function WordCard({ word, size = 'md', showCn = true, onSpeak }: WordCardProps) {
  const { playWord, supported } = useSpeech()

  return (
    <div className={`word-card word-card--${size}`}>
      <div className="word-card-body">
        <div className="word-card-top">
          <span className="word-card-en">{word.en}</span>
          {supported && (
            <button
              type="button"
              className="sound-btn"
              onClick={(e) => {
                e.stopPropagation()
                playWord(word.en)
                onSpeak?.()
              }}
            >
              🔊
            </button>
          )}
        </div>
        {word.phonetic && <span className="word-card-phonetic">{word.phonetic}</span>}
        {showCn && (
          <span className="word-card-cn">
            {word.pos && <span className="word-card-pos">{word.pos}</span>}
            {word.cn}
          </span>
        )}
      </div>
    </div>
  )
}
