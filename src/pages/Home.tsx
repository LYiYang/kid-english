import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../store/useApp'
import { isDue } from '../utils/spacedRepeat'

const quickActions = [
  { to: '/review', icon: '🔁', title: '复习', desc: '间隔重复记忆' },
  { to: '/dictation', icon: '🎧', title: '听写', desc: '听音拼写单词' },
  { to: '/read', icon: '🎤', title: '跟读', desc: '开口跟读打分' },
  { to: '/game', icon: '🎮', title: '闯关', desc: '单词消消乐' },
]

export default function Home() {
  const { words, wordsView, totalStars, userData, activeMember } = useApp()

  const stats = useMemo(() => {
    const learned = wordsView.filter((w) => w.progress.status !== 'new').length
    const mastered = wordsView.filter((w) => w.progress.status === 'mastered').length
    const starsEarned = Object.values(userData.levels).reduce((sum, r) => sum + r.stars, 0)
    return {
      total: words.length,
      learned,
      mastered,
      due: wordsView.filter((w) => isDue(w.progress)).length,
      totalStars,
      starsEarned,
      reviewCount: userData.reviewCount,
    }
  }, [words, wordsView, totalStars, userData])

  const groups = useMemo(() => {
    const map = new Map<string, number>()
    words.forEach((w) => map.set(w.group, (map.get(w.group) ?? 0) + 1))
    return Array.from(map.entries())
  }, [words])

  return (
    <div className="home">
      <header className="page-header">
        <h1>
          你好，{activeMember.name} {activeMember.avatar}
        </h1>
        <p className="subtitle">今天也要好好学习哦！</p>
      </header>

      <section className="stat-grid">
        <div className="stat-card stat-card--splash">
          <span className="stat-value">{stats.total}</span>
          <span className="stat-label">全部单词</span>
        </div>
        <div className="stat-card stat-card--learned">
          <span className="stat-value">{stats.learned}</span>
          <span className="stat-label">已学单词</span>
        </div>
        <div className="stat-card stat-card--mastered">
          <span className="stat-value">{stats.mastered}</span>
          <span className="stat-label">已掌握</span>
        </div>
        <div className="stat-card stat-card--due">
          <span className="stat-value">{stats.due}</span>
          <span className="stat-label">待复习</span>
        </div>
      </section>

      <section className="stat-grid stat-grid--two">
        <div className="stat-card stat-card--stars">
          <span className="stat-value">⭐ {stats.totalStars}</span>
          <span className="stat-label">累计星星</span>
        </div>
        <div className="stat-card stat-card--review">
          <span className="stat-value">{stats.reviewCount}</span>
          <span className="stat-label">复习次数</span>
        </div>
      </section>

      <section>
        <h2 className="section-title">快速开始</h2>
        <div className="quick-grid">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to} className="quick-card">
              <span className="quick-icon">{a.icon}</span>
              <span className="quick-title">{a.title}</span>
              <span className="quick-desc">{a.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">词库分类</h2>
        <div className="group-chips">
          {groups.length === 0 && <p className="empty">暂无单词数据</p>}
          {groups.map(([group, count]) => (
            <Link key={group} to="/words" className="group-chip">
              <span>{group}</span>
              <span className="group-count">{count}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
