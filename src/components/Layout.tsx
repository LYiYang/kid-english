import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../store/useApp'
import { MemberAvatar } from './MemberAvatar'
import { PinDialog } from './PinDialog'

const navItems = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/words', label: '单词本', icon: '📚' },
  { to: '/review', label: '复习', icon: '🔁' },
  { to: '/dictation', label: '听写', icon: '🎧' },
  { to: '/read', label: '跟读', icon: '🎤' },
  { to: '/texts', label: '课文', icon: '📖' },
  { to: '/scan', label: '拍照', icon: '📷' },
  { to: '/game', label: '闯关', icon: '🎮' },
  { to: '/rewards', label: '奖励', icon: '🏆' },
  { to: '/members', label: '成员', icon: '👨‍👩‍👧' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

const kidTasksUrl = `${window.location.protocol}//${window.location.hostname}:5173/kid-tasks/`

function AppSwitcher({ fixed = false }: { fixed?: boolean }) {
  return (
    <a
      href={kidTasksUrl}
      className={fixed ? 'app-switcher app-switcher--mobile' : 'app-switcher'}
      title="切换到 任务乐园 kid-tasks"
    >
      <span className="app-switcher-icon">🧩</span>
      <span className="app-switcher-label">kid-tasks</span>
    </a>
  )
}

function MemberChip({ fixed = false }: { fixed?: boolean }) {
  const { activeMember, isAdmin } = useApp()
  const navigate = useNavigate()
  const [pinOpen, setPinOpen] = useState(false)

  const handleClick = () => {
    if (isAdmin) {
      navigate('/members')
    } else {
      setPinOpen(true)
    }
  }

  return (
    <>
      <button
        type="button"
        className={fixed ? 'member-chip member-chip--fixed' : 'member-chip'}
        onClick={handleClick}
        title="切换成员 / 管理成员"
      >
        <MemberAvatar member={activeMember} size={30} />
        <span className="member-chip-info">
          <span className="member-chip-name">{activeMember.name}</span>
          <span className="member-chip-role">{isAdmin ? '管理员' : '宝宝'}</span>
        </span>
        <span className="member-chip-switch">切换</span>
      </button>
      {pinOpen && (
        <PinDialog
          onClose={() => setPinOpen(false)}
          onUnlocked={() => {
            setPinOpen(false)
            navigate('/members')
          }}
        />
      )}
    </>
  )
}

export default function Layout() {
  const { totalStars, words } = useApp()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">🌟</span>
          <span>英语小达人</span>
        </div>
        <MemberChip />
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-review">
          <AppSwitcher />
        </div>
        <div className="sidebar-stats">
          <div className="stat-chip">
            <span>⭐ 累计 {totalStars}</span>
            <span>📚 {words.length} 词</span>
          </div>
        </div>
      </aside>
      <main className="page">
        <Outlet />
      </main>
      <MemberChip fixed />
      <AppSwitcher fixed />
      <BottomNav />
    </div>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => (isActive ? 'bottom-link active' : 'bottom-link')}
        >
          <span className="bottom-icon">{item.icon}</span>
          <span className="bottom-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
