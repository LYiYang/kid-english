import { useState, type FormEvent } from 'react'
import { useApp } from '../store/useApp'
import { MemberAvatar } from '../components/MemberAvatar'
import type { Member, MemberRole } from '../types'

const AVATARS = ['🐰', '🐱', '🐻', '🦊', '🐸']
const COLORS = ['#ec4899', '#8b5cf6', '#3b82f6', '#22c55e', '#f59e0b']

export default function Members() {
  const { members, activeMember, addMember, deleteMember, switchMember, isAdmin, parentUnlocked } =
    useApp()
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState(AVATARS[0])
  const [color, setColor] = useState(COLORS[0])
  const [role, setRole] = useState<MemberRole>('kid')

  const canManage = isAdmin || parentUnlocked
  const shown = canManage ? members : [activeMember]

  const handleAdd = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    addMember(name, avatar, color, role)
    setName('')
  }

  const handleDelete = (member: Member) => {
    if (member.id === activeMember.id) {
      alert('不能删除当前正在使用的成员')
      return
    }
    if (confirm(`确定删除「${member.name}」吗？`)) {
      deleteMember(member.id)
    }
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>成员管理 👨‍👩‍👧</h1>
        <p className="subtitle">
          {isAdmin
            ? '管理员可以管理全部成员与各自进度；宝宝只能看自己的学习数据。'
            : '宝宝只能用自己的身份学习。管理成员需要家长口令。'}
        </p>
      </header>

      <div className="member-list">
        {shown.map((m) => (
          <div key={m.id} className={`member-item${m.id === activeMember.id ? ' member-item-active' : ''}`}>
            <MemberAvatar member={m} size={40} />
            <div className="member-info">
              <span className="member-name">{m.name}</span>
              <span className="member-meta">
                <span className={`member-role member-role-${m.role}`}>
                  {m.role === 'admin' ? '管理员' : '宝宝'}
                </span>
                {m.id === activeMember.id && <span className="member-tag">当前身份</span>}
              </span>
            </div>
            <div className="member-actions">
              {m.id !== activeMember.id && (
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => switchMember(m.id)}>
                  使用
                </button>
              )}
              {canManage && (
                <button
                  type="button"
                  className="btn btn--danger btn--sm"
                  onClick={() => handleDelete(m)}
                  aria-label={`删除 ${m.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {canManage && (
        <form className="member-form" onSubmit={handleAdd}>
          <input
            className="member-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="添加新成员…"
            aria-label="成员名称"
          />
          <div className="member-role-picker">
            {(['kid', 'admin'] as MemberRole[]).map((r) => (
              <button
                key={r}
                type="button"
                className={`member-role-btn${role === r ? ' member-role-btn-active' : ''}`}
                onClick={() => setRole(r)}
              >
                {r === 'kid' ? '宝宝' : '管理员'}
              </button>
            ))}
          </div>
          <div className="member-pickers">
            <div className="member-avatar-picker">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`member-avatar${avatar === a ? ' member-avatar-active' : ''}`}
                  onClick={() => setAvatar(a)}
                >
                  {a}
                </button>
              ))}
            </div>
            <div className="member-color-picker">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{ backgroundColor: c }}
                  className={`member-color${color === c ? ' member-color-active' : ''}`}
                  onClick={() => setColor(c)}
                  aria-label={`选择颜色 ${c}`}
                />
              ))}
            </div>
          </div>
          <button className="btn btn--primary" type="submit">
            添加成员
          </button>
        </form>
      )}
    </div>
  )
}
