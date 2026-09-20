import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useApp } from '../store/useApp'
import WordCard from '../components/WordCard'
import {
  fetchExamples,
  lookupWord,
  THEME_OPTIONS,
  wordAudioUrl,
  type DictExample,
} from '../lib/dictionary'

type Dim = 'group' | 'theme'

export default function WordBook() {
  const { words, wordsView, addWord, updateWord, removeWord, themeOverrides, setThemeOverride } =
    useApp()
  const [dim, setDim] = useState<Dim>('group')
  const [filter, setFilter] = useState<string>('全部')
  const [query, setQuery] = useState('')

  const groupOptions = useMemo(() => {
    const set = new Set(words.map((w) => w.group))
    return ['全部', ...Array.from(set).sort()]
  }, [words])

  const themeOptions = useMemo(() => {
    const set = new Set(words.map((w) => w.theme).filter(Boolean) as string[])
    return ['全部', '未分类', ...Array.from(set).sort()]
  }, [words])

  const filtered = useMemo(() => {
    return wordsView.filter((w) => {
      const okFilter =
        filter === '全部' ||
        (dim === 'group' && w.group === filter) ||
        (dim === 'theme' && (filter === '未分类' ? !w.theme : w.theme === filter))
      const q = query.trim().toLowerCase()
      const okQuery = !q || w.en.toLowerCase().includes(q) || w.cn.includes(query.trim())
      return okFilter && okQuery
    })
  }, [wordsView, dim, filter, query])

  const [en, setEn] = useState('')
  const [cn, setCn] = useState('')
  const [pos, setPos] = useState('')
  const [group, setGroup] = useState('')
  const [theme, setTheme] = useState('')
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

  // 手动纠正主题：写入覆盖表（永久回写），并立即生效
  function correctTheme(word: string, value: string) {
    setTheme(value)
    if (word.trim()) setThemeOverride(word, value)
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
      const override = themeOverrides[word.toLowerCase()]
      const resolvedTheme = override || r.theme || ''
      setTheme((prev) => prev || resolvedTheme)
      if (!group.trim()) setGroup((prev) => prev || resolvedTheme || r.category)
      const tags = [
        r.pos || '',
        resolvedTheme && `主题:${resolvedTheme}${override ? '(已修正)' : ''}`,
        r.category && `考纲:${r.category}`,
      ]
        .filter(Boolean)
        .join(' · ')
      setLookupMsg(
        r.source === 'online'
          ? '词典库未收录，已用在线翻译填充释义'
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
    const finalGroup = group.trim() || theme.trim() || '未分组'
    addWord({
      en: en.trim(),
      cn: cn.trim(),
      phonetic: phonetic.trim() || undefined,
      pos: pos.trim() || undefined,
      group: finalGroup,
      theme: theme.trim() || undefined,
    })
    setEn('')
    setCn('')
    setPos('')
    setGroup('')
    setTheme('')
    setPhonetic('')
    setLookupMsg('')
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>单词本 📚</h1>
        <p className="subtitle">
          共 {words.length} 个单词 · 输入英文点「查词」自动带出翻译/音标/词性，并可按单元或主题分类
        </p>
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
        <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="单元/分组" />
        <select
          className="theme-select"
          value={theme}
          onChange={(e) => correctTheme(en, e.target.value)}
          title="主题分类（可手动纠正，会永久记住）"
        >
          <option value="">主题分类…</option>
          {THEME_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
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
        <div className="dim-toggle">
          <button
            type="button"
            className={dim === 'group' ? 'chip chip--active' : 'chip'}
            onClick={() => {
              setDim('group')
              setFilter('全部')
            }}
          >
            按单元
          </button>
          <button
            type="button"
            className={dim === 'theme' ? 'chip chip--active' : 'chip'}
            onClick={() => {
              setDim('theme')
              setFilter('全部')
            }}
          >
            按主题
          </button>
        </div>
        <input
          className="search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索单词…"
        />
        <div className="filter-chips">
          {(dim === 'group' ? groupOptions : themeOptions).map((g) => (
            <button
              key={g}
              type="button"
              className={g === filter ? 'chip chip--active' : 'chip'}
              onClick={() => setFilter(g)}
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
              <select
                className="theme-select theme-select--row"
                value={w.theme || ''}
                onChange={(e) => {
                  updateWord(w.id, { theme: e.target.value || undefined })
                  setThemeOverride(w.en, e.target.value)
                }}
                title="修改主题分类（永久记住）"
              >
                <option value="">未分类</option>
                {THEME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
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
