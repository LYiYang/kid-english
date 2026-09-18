import { useState } from 'react'
import { useApp } from '../store/useApp'
import { getFamilyId } from '../lib/family'

export default function Settings() {
  const { saveFamilyId, isAdmin, resetAll, activeMember, members, words, userData, points } =
    useApp()
  const [confirming, setConfirming] = useState(false)
  const [familyInput, setFamilyInput] = useState(getFamilyId())
  const [familyMsg, setFamilyMsg] = useState('')

  const totalStars = Object.values(userData.levels).reduce((sum, r) => sum + r.stars, 0)

  const handleFamilyCopy = async () => {
    try {
      await navigator.clipboard.writeText(familyInput.trim())
      setFamilyMsg('家庭码已复制')
    } catch {
      setFamilyMsg('复制失败，请手动复制')
    }
  }

  const handleFamilySave = () => {
    if (familyInput.trim().length < 4) {
      setFamilyMsg('家庭码至少 4 个字符')
      return
    }
    saveFamilyId(familyInput)
    setFamilyMsg('已切换家庭码，正在刷新…')
    setTimeout(() => window.location.reload(), 600)
  }

  const handleReset = () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    resetAll()
    setConfirming(false)
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>设置 ⚙️</h1>
      </header>

      <div className="settings-card">
        <div className="settings-row">
          <span>单词总数</span>
          <span>{words.length}</span>
        </div>
        <div className="settings-row">
          <span>成员数量</span>
          <span>{members.length}</span>
        </div>
        <div className="settings-row">
          <span>当前成员</span>
          <span>
            {activeMember.avatar} {activeMember.name}
          </span>
        </div>
        <div className="settings-row">
          <span>当前积分</span>
          <span>{points}</span>
        </div>
        <div className="settings-row">
          <span>累计星星</span>
          <span>{totalStars}</span>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-section-title">家庭共享码</h3>
        <p className="settings-hint">
          同一设备会自动生成一个家庭码。家人在另一台设备上填入相同的码，就能看到同一份学习进度。
        </p>
        <div className="family-row">
          <input
            className="family-input"
            type="text"
            value={familyInput}
            onChange={(e) => setFamilyInput(e.target.value)}
            aria-label="家庭共享码"
          />
          <button className="family-btn" type="button" onClick={handleFamilyCopy}>
            复制
          </button>
          <button className="family-btn family-btn-primary" type="button" onClick={handleFamilySave}>
            切换
          </button>
        </div>
        {familyMsg && <p className="settings-hint family-msg">{familyMsg}</p>}
      </div>

      {isAdmin && (
        <div className="settings-section settings-danger">
          <h3 className="settings-danger-title">数据管理</h3>
          <button className="settings-reset-btn" type="button" onClick={handleReset}>
            {confirming ? '再次点击确认重置' : '重置所有数据'}
          </button>
          <p className="settings-hint">
            只重置英语学习数据（词库与学习进度）。成员、家庭码、积分与「任务乐园」共用，不受影响。
          </p>
        </div>
      )}
    </div>
  )
}
