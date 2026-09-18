import { useEffect, useRef, useState } from 'react'
import { getFamilyId, loadRemote, saveRemote } from '../lib/family'

/**
 * localStorage + Supabase 云同步的状态 Hook。
 * 挂载时从云端拉取并覆写本地，变更时防抖 300ms 存回云端。
 */
export function usePersistentState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? (JSON.parse(stored) as T) : initialValue
    } catch {
      return initialValue
    }
  })
  const [ready, setReady] = useState(false)
  const familyId = getFamilyId()
  const firstLoad = useRef(true)

  // 同源其它标签页/应用（如 kid-tasks）改动同一 key 时，实时同步
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(JSON.parse(e.newValue) as T)
          setReady(true)
        } catch {
          // ignore
        }
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const remote = await loadRemote(familyId, key)
        if (!cancelled && remote !== null && remote !== undefined) {
          setState(JSON.parse(JSON.stringify(remote)) as T)
          localStorage.setItem(key, JSON.stringify(remote))
        }
      } catch {
        // 云端读取失败则用本地缓存
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [familyId, key])

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [key, state])

  useEffect(() => {
    if (!ready || firstLoad.current) {
      firstLoad.current = false
      return
    }
    const t = setTimeout(async () => {
      try {
        await saveRemote(familyId, key, state)
      } catch {
        // 忽略云端保存失败
      }
    }, 300)
    return () => clearTimeout(t)
  }, [state, ready, familyId, key])

  return [state, setState, ready] as const
}
