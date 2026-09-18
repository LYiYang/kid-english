import { useState, type FormEvent } from 'react'
import { useApp } from '../store/useApp'

const ICONS = ['🍦', '📺', '🎡', '🎁', '🍕', '🎮', '🏊', '🛴']

export default function Rewards() {
  const { points, rewards, claimReward, addReward, isAdmin } = useApp()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState(ICONS[0])
  const [cost, setCost] = useState(30)

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addReward(name, icon, cost)
    setName('')
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>学习奖励 🏆</h1>
        <p className="subtitle">
          全家积分：<strong className="points-big">{points}</strong>
        </p>
      </header>

      <div className="reward-grid">
        {rewards.length === 0 && <p className="empty">还没有奖励，让家长添加一个吧。</p>}
        {rewards.map((r) => {
          const affordable = points >= r.cost && !r.claimed
          return (
            <div key={r.id} className={`reward-card${r.claimed ? ' reward-card--claimed' : ''}`}>
              <span className="reward-icon">{r.icon}</span>
              <span className="reward-name">{r.name}</span>
              <span className="reward-cost">🔸 {r.cost} 分</span>
              {r.claimed ? (
                <span className="reward-status reward-status--done">已兑换</span>
              ) : (
                <button
                  type="button"
                  className={`btn btn--block ${affordable ? 'btn--primary' : 'btn--ghost'}`}
                  disabled={!affordable}
                  onClick={() => claimReward(r.id)}
                >
                  {affordable ? '兑换' : '积分不足'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {isAdmin && (
        <form className="member-form reward-add-form" onSubmit={handleAdd}>
          <input
            className="member-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="奖励名称，如 冰淇淋…"
            aria-label="奖励名称"
          />
          <div className="member-avatar-picker">
            {ICONS.map((ic) => (
              <button
                key={ic}
                type="button"
                className={`member-avatar${icon === ic ? ' member-avatar-active' : ''}`}
                onClick={() => setIcon(ic)}
              >
                {ic}
              </button>
            ))}
          </div>
          <div className="reward-cost-row">
            <label>
              需要积分
              <input
                className="member-input"
                type="number"
                min={1}
                value={cost}
                onChange={(e) => setCost(Math.max(1, Number(e.target.value)))}
              />
            </label>
            <button className="btn btn--primary" type="submit">
              添加奖励
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
