import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useApp } from '../store/useApp'
import WordCard from '../components/WordCard'
import { fetchExamples, lookupWord, wordAudioUrl, type DictExample } from '../lib/dictionary'

export default function WordBook() {
  const { words, wordsView, addWord, removeWord } = useApp()
  const [groupFilter, setGroupFilter] = useState<string>('全部')
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const set = new Set(words.map((w) => w.group))
    return ['全部', ...Array.from(set)]
  }, [words])

  const filtered = useMemo(() => {
    return wordsView.filter((w) => {
      const okGroup = groupFilter === '全部' || w.group === groupFilter
      const q = query.trim().toLowerCase()
      const okQuery = !q || w.en.toLowerCase().includes(q) || w.cn.includes(query.trim())
      return okGroup && okQuery
    })
  }, [wordsView, groupFilter, query])

  const [en, setEn] = useState('')
  const [cn, setCn] = useState('')
  const [pos, setPos] = useState('')
  const [group, setGroup] = useState('')
  const [phonetic, setPhonetic] = useState('')
  const [looking, setLooking] = useState(false)
  const [lookupMsg, setLookupMsg] = useState('')
  const [examples, setExamples] = useState<DictExample[]>([])
  const [loadingEx, setLoadingEx] = useState(false)

  function playPreview() {
    const w = en.trim()
    if (!w) return
    try {
      const audio = new Audio(wordAudioUrl(w))
      audio.play().catch(() => undefined)
    } catch {
      // ignore
    }
  }

  async function handleLookup() {
    const word = en.trim()
    if (!word) {
      setLookupMsg('请先输入英文单词')
      return
    }
    setLooking(true)
    setLookupMsg('查询中…')
    setExamples([])
    const r = await lookupWord(word)
    if (r.found) {
      setCn((prev) => prev || r.cn)
      setPhonetic((prev) => prev || r.phonetic)
      setPos((prev) => prev || r.pos)
      if (!group.trim() && (r.theme || r.category)) setGroup(r.theme || r.category)
      const tags = [r.pos && r.pos, r.theme && `主题:${r.theme}`, r.category && `考纲:${r.category}`]
        .filter(Boolean)
        .join(' · ')
      setLookupMsg(
        r.source === 'online'
          ? '词典库未收录，已用在线翻译填充释义（无音标/词性）'
          : `已自动填充${tags ? '（' + tags + '）' : ''}`,
      )
    } else {
      setLookupMsg('未查到该词，请手动填写')
    }
    setLooking(false)
  }

  async function handleLoadExamples() {
    const word = en.trim()
    if (!word) return
    setLoadingEx(true)
    const list = await fetchExamples(word)
    setExamples(list)
    setLoadingEx(false)
    if (list.length === 0) setLookupMsg('未获取到例句（需联网）')
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!en.trim() || !cn.trim()) return
    const finalGroup = group.trim() || '未分组'
    addWord({
      en: en.trim(),
      cn: cn.trim(),
      phonetic: phonetic.trim() || undefined,
      pos: pos.trim() || undefined,
      group: finalGroup,
    })
    setEn('')
    setCn('')
    setPos('')
    setGroup('')
    setPhonetic('')
    setLookupMsg('')
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>单词本 📚</h1>
        <p className="subtitle">共 {words.length} 个单词 · 输入英文点「查词」自动带出翻译/音标/词性</p>
      </header>

      <form className="add-form" onSubmit={handleSubmit}>
        <div className="add-form-en">
          <input
            value={en}
            onChange={(e) => setEn(e.target.value)}
            placeholder="英文单词"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleLookup()
              }
            }}
          />
          <button type="button" className="btn btn--ghost btn--sm" onClick={handleLookup} disabled={looking}>
            {looking ? '查询中…' : '🔍 查词'}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={playPreview}
            disabled={!en.trim()}
            title="播放发音"
          >
            🔊
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={handleLoadExamples}
            disabled={!en.trim() || loadingEx}
            title="获取例句"
          >
            {loadingEx ? '例句…' : '例句'}
          </button>
        </div>
        <input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="中文释义" />
        <input value={pos} onChange={(e) => setPos(e.target.value)} placeholder="词性，如 n./v." />
        <input value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="音标（可选）" />
        <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="分组分类" />
        <button type="submit" className="btn btn--primary">添加</button>
      </form>
      {lookupMsg && <p className="lookup-msg">{lookupMsg}</p>}
      {examples.length > 0 && (
        <ul className="example-list">
          {examples.map((ex, i) => (
            <li key={i} className="example-item">
              <span className="example-en">{ex.en}</span>
              {ex.cn && <span className="example-cn">{ex.cn}</span>}
            </li>
          ))}
        </ul>
      )}

      <div className="toolbar">
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索单词…"
        />
        <div className="filter-chips">
          {groups.map((g) => (
            <button
              key={g}
              type="button"
              className={g === groupFilter ? 'chip chip--active' : 'chip'}
              onClick={() => setGroupFilter(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="empty">没有找到符合条件的单词</p>
      ) : (
        <div className="word-list">
          {filtered.map((w) => (
            <div key={w.id} className="word-row">
              <WordCard word={w} size="sm" />
              <span className="word-group-tag">{w.group}</span>
              <span className={`status-pill status-${w.progress.status}`}>
                {statusLabel(w.progress.status)}
              </span>
              <button type="button" className="btn btn--danger btn--sm" onClick={() => removeWord(w.id)}>
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function statusLabel(status: string): string {
  switch (status) {
    case 'new':
      return '未学'
    case 'learning':
      return '学习中'
    case 'reviewing':
      return '复习中'
    case 'mastered':
      return '已掌握'
    default:
      return status
  }
}
