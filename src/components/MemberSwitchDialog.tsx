import { useApp } from '../store/useApp'
import { MemberAvatar } from './MemberAvatar'

export function MemberSwitchDialog({ onClose }: { onClose: () => void }) {
  const { members, activeMember, switchMember } = useApp()

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true" aria-label="切换成员">
      <div className="member-switch">
        <h3 className="member-switch-title">切换成员</h3>
        <p className="member-switch-desc">选择要用哪个身份学习</p>
        <div className="member-switch-list">
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`member-switch-item${m.id === activeMember.id ? ' member-switch-item--active' : ''}`}
              onClick={() => {
                switchMember(m.id)
                onClose()
              }}
            >
              <MemberAvatar member={m} size={34} />
              <span className="member-switch-name">{m.name}</span>
              <span className={`member-role member-role-${m.role}`}>
                {m.role === 'admin' ? '管理员' : '宝宝'}
              </span>
              {m.id === activeMember.id && <span className="member-switch-check">✓</span>}
            </button>
          ))}
        </div>
        <p className="member-switch-hint">
          添加或删除成员，请到「任务乐园」的成员管理操作（两个应用共用同一套成员）。
        </p>
        <button className="pin-cancel" type="button" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}
