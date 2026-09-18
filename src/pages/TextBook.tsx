import { useState } from 'react'
import { useApp } from '../store/useApp'
import { useSpeech } from '../hooks/useSpeech'

export default function TextBook() {
  const { texts, removeText, isAdmin } = useApp()
  const [activeId, setActiveId] = useState<string | null>(texts[0]?.id ?? null)
  const { speak, cancel } = useSpeech()
  const active = texts.find((t) => t.id === activeId) ?? texts[0]

  if (texts.length === 0) {
    return (
      <div className="page-container">
        <header className="page-header">
          <h1>课文 📖</h1>
          <p className="subtitle">读课文，练语感</p>
        </header>
        <div className="card empty-state">
          <p>还没有课文。可以用「拍照」功能扫描书上的句子/课文来录入。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>课文 📖</h1>
        <p className="subtitle">读课文，练语感</p>
      </header>

      <div className="textbook-layout">
        <nav className="text-list">
          {texts.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === active?.id ? 'text-item text-item--active' : 'text-item'}
              onClick={() => setActiveId(t.id)}
            >
              <span className="text-item-title">{t.title}</span>
              <span className="text-item-en">{t.en}</span>
            </button>
          ))}
        </nav>

        {active && (
          <article className="text-body">
            <header className="text-head">
              <h2>{active.title}</h2>
              <div className="text-actions">
                <button type="button" className="btn btn--primary" onClick={() => speak(active.en)}>
                  🔊 朗读全文
                </button>
                <button type="button" className="btn btn--ghost" onClick={() => cancel()}>
                  ⏹ 停止
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => {
                      if (confirm(`删除课文「${active.title}」吗？`)) {
                        removeText(active.id)
                        setActiveId(null)
                      }
                    }}
                  >
                    删除
                  </button>
                )}
              </div>
            </header>
            <p className="text-overview-muted">{active.cn}</p>

            <ol className="sentence-list">
              {active.sentences.map((s, i) => (
                <li key={s.id} className="sentence-item">
                  <div className="sentence-line">
                    <span className="sentence-num">{i + 1}</span>
                    <div className="sentence-content">
                      <p className="sentence-en">{s.en}</p>
                      <p className="sentence-cn">{s.cn}</p>
                    </div>
                    <button type="button" className="sound-btn" onClick={() => speak(s.en)}>
                      🔊
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        )}
      </div>
    </div>
  )
}
