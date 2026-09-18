import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useApp } from '../store/useApp'
import WordCard from '../components/WordCard'

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
  const [group, setGroup] = useState('')
  const [phonetic, setPhonetic] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!en.trim() || !cn.trim()) return
    const finalGroup = group.trim() || '未分组'
    addWord({ en: en.trim(), cn: cn.trim(), phonetic: phonetic.trim() || undefined, group: finalGroup })
    setEn('')
    setCn('')
    setGroup('')
    setPhonetic('')
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>单词本 📚</h1>
        <p className="subtitle">共 {words.length} 个单词</p>
      </header>

      <form className="add-form" onSubmit={handleSubmit}>
        <input value={en} onChange={(e) => setEn(e.target.value)} placeholder="英文单词" />
        <input value={cn} onChange={(e) => setCn(e.target.value)} placeholder="中文释义" />
        <input value={phonetic} onChange={(e) => setPhonetic(e.target.value)} placeholder="音标（可选）" />
        <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="分组分类" />
        <button type="submit" className="btn btn--primary">添加</button>
      </form>

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
