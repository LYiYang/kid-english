import { useState } from 'react'
import { useApp } from '../store/useApp'

export function PinDialog({
  onClose,
  onUnlocked,
}: {
  onClose: () => void
  onUnlocked: () => void
}) {
  const { verifyPin } = useApp()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handlePress = (digit: string) => {
    if (pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setError(false)
    if (next.length === 4) {
      const ok = verifyPin(next)
      if (!ok) {
        setError(true)
        setTimeout(() => setPin(''), 600)
        return
      }
      onUnlocked()
    }
  }

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1))
    setError(false)
  }

  return (
    <div className="pin-overlay" role="dialog" aria-modal="true" aria-label="家长口令">
      <div className="pin-dialog">
        <h3 className="pin-title">家长权限</h3>
        <p className="pin-desc">请输入家长口令以解锁成员管理</p>
        <div className={`pin-dots${error ? ' pin-dots-error' : ''}`}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={`pin-dot${i < pin.length ? ' pin-dot-filled' : ''}`} />
          ))}
        </div>
        <div className="pin-pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key, i) =>
            key === '' ? (
              <span key={i} className="pin-spacer" />
            ) : key === '⌫' ? (
              <button key={i} type="button" className="pin-key" onClick={handleDelete}>
                ⌫
              </button>
            ) : (
              <button key={i} type="button" className="pin-key" onClick={() => handlePress(key)}>
                {key}
              </button>
            ),
          )}
        </div>
        <button className="pin-cancel" type="button" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}
