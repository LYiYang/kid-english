/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import wordsData from '../data/words.json'
import textsData from '../data/texts.json'
import type {
  LevelResult,
  Member,
  MemberRole,
  Rating,
  Reward,
  StarRating,
  TextUnit,
  UserData,
  Word,
  WordView,
} from '../types'
import { createInitialProgress, schedule } from '../utils/spacedRepeat'
import { usePersistentState } from '../hooks/usePersistentState'
import { getFamilyId, setFamilyId } from '../lib/family'

// 与 kid-tasks 共用的 key（同一浏览器、同一 Supabase 行）→ 共享成员/活跃身份/积分/奖励
const MEMBERS_KEY = 'kid-tasks.members'
const ACTIVE_KEY = 'kid-tasks.activeMember'
const POINTS_KEY = 'kid-tasks.earnedPoints'
const REWARDS_KEY = 'kid-tasks.rewards'
// kids-english 专属：每个成员的学习进度（词库、复习、星星）+ 课文
const WORDS_KEY = 'kids-english:words'
const PROGRESS_KEY = 'kids-english:progress'
const TEXTS_KEY = 'kids-english:texts'

const DEFAULT_REWARDS: Reward[] = [
  { id: 'r-1', name: '冰淇淋', icon: '🍦', cost: 30, claimed: false },
  { id: 'r-2', name: '看动画片', icon: '📺', cost: 50, claimed: false },
  { id: 'r-3', name: '去游乐园', icon: '🎡', cost: 100, claimed: false },
]

const DEFAULT_PIN = '1234'

function makeDefaultMembers(): Member[] {
  const now = Date.now()
  return [
    { id: 'm-1', name: '爸爸', avatar: '🐻', color: '#3b82f6', role: 'admin', parentPin: DEFAULT_PIN, createdAt: now },
    { id: 'm-2', name: '妈妈', avatar: '🐱', color: '#ec4899', role: 'admin', parentPin: DEFAULT_PIN, createdAt: now },
    { id: 'm-3', name: '阳阳', avatar: '🐰', color: '#8b5cf6', role: 'kid', createdAt: now },
    { id: 'm-4', name: '安安', avatar: '🐻‍❄️', color: '#f59e0b', role: 'kid', createdAt: now },
  ]
}

function makeDefaultWords(): Word[] {
  const now = Date.now()
  return (wordsData as Word[]).map((w, i) => ({
    ...w,
    id: w.id || `seed-${i}-${w.en}`,
    createdAt: now - i,
  }))
}

function makeDefaultTexts(): TextUnit[] {
  const now = Date.now()
  return (textsData as TextUnit[]).map((t) => ({
    ...t,
    createdAt: t.createdAt || now,
    id: t.id || `text-${now}-${t.title}`,
  }))
}

function defaultUserData(): UserData {
  return { reviewCount: 0, progress: {}, levels: {} }
}

function ensureUserData(map: Record<string, UserData>, id: string): Record<string, UserData> {
  if (map[id]) return map
  return { ...map, [id]: defaultUserData() }
}

interface AppContextValue {
  ready: boolean
  // 家庭共享码
  familyId: string
  saveFamilyId: (id: string) => void
  // 成员与角色（与 kid-tasks 共享）
  members: Member[]
  activeMember: Member
  isAdmin: boolean
  parentUnlocked: boolean
  verifyPin: (pin: string) => boolean
  lockParent: () => void
  switchMember: (id: string) => void
  addMember: (name: string, avatar: string, color: string, role: MemberRole, parentPin?: string) => void
  deleteMember: (id: string) => void
  /* 词库（家庭共享） */
  words: Word[]
  wordsView: WordView[]
  addWord: (w: { en: string; cn: string; phonetic?: string; group: string }) => void
  removeWord: (id: string) => void
  resetWords: () => void
  /* 课文（家庭共享，可增删） */
  texts: TextUnit[]
  addText: (t: TextUnit) => void
  removeText: (id: string) => void
  // 当前成员学习进度（英语专属，按成员隔离）
  userData: UserData
  totalStars: number
  // 积分 / 奖励（与 kid-tasks 共享）
  points: number
  rewards: Reward[]
  reviewWord: (id: string, rating: Rating) => void
  recordLevelResult: (levelId: number, stars: StarRating, errors: number) => void
  addPoints: (n: number) => void
  incrementReviewCount: () => void
  claimReward: (id: string) => void
  addReward: (name: string, icon: string, cost: number) => void
  resetAll: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [members, setMembers, membersReady] = usePersistentState<Member[]>(
    MEMBERS_KEY,
    makeDefaultMembers(),
  )
  const [activeMemberId, setActiveMemberId, activeReady] = usePersistentState<string>(
    ACTIVE_KEY,
    'm-3',
  )
  const [words, setWords, wordsReady] = usePersistentState<Word[]>(WORDS_KEY, makeDefaultWords())
  const [progressMap, setProgressMap, progressReady] = usePersistentState<
    Record<string, UserData>
  >(PROGRESS_KEY, {})
  const [points, setPoints, pointsReady] = usePersistentState<number>(POINTS_KEY, 0)
  const [rewards, setRewards, rewardsReady] = usePersistentState<Reward[]>(
    REWARDS_KEY,
    DEFAULT_REWARDS,
  )
  const [texts, setTexts, textsReady] = usePersistentState<TextUnit[]>(
    TEXTS_KEY,
    makeDefaultTexts(),
  )
  const [parentUnlocked, setParentUnlocked] = useState(false)

  const ready =
    membersReady &&
    activeReady &&
    wordsReady &&
    progressReady &&
    pointsReady &&
    rewardsReady &&
    textsReady

  // 保证每个成员都有 progress 数据
  useEffect(() => {
    if (!ready) return
    setProgressMap((prev) => {
      let next = prev
      for (const m of members) {
        if (!next[m.id]) next = ensureUserData(next, m.id)
      }
      return next
    })
  }, [ready, members, setProgressMap])

  const activeMember = useMemo(
    () => members.find((m) => m.id === activeMemberId) ?? members[0] ?? makeDefaultMembers()[0],
    [members, activeMemberId],
  )

  const isAdmin = activeMember.role === 'admin'

  const userData = useMemo(
    () => progressMap[activeMember.id] ?? defaultUserData(),
    [progressMap, activeMember.id],
  )

  const wordsView = useMemo<WordView[]>(
    () =>
      words.map((w) => ({
        ...w,
        progress: userData.progress[w.id] ?? createInitialProgress(),
      })),
    [words, userData.progress],
  )

  const totalStars = useMemo(
    () => Object.values(userData.levels).reduce((sum, r) => sum + r.stars, 0),
    [userData.levels],
  )

  const value = useMemo<AppContextValue>(() => {
    const setActiveProgress = (updater: (prev: UserData) => UserData) => {
      setProgressMap((prev) => ({
        ...prev,
        [activeMember.id]: updater(prev[activeMember.id] ?? defaultUserData()),
      }))
    }

    return {
      ready,
      familyId: getFamilyId(),
      saveFamilyId: (id) => setFamilyId(id),
      members,
      activeMember,
      isAdmin,
      parentUnlocked,
      verifyPin: (pin) => {
        const match = members.some((m) => m.role === 'admin' && m.parentPin === pin)
        if (match) setParentUnlocked(true)
        return match
      },
      lockParent: () => setParentUnlocked(false),
      switchMember: (id) => {
        setActiveMemberId(id)
        setParentUnlocked(false)
      },
      addMember: (name, avatar, color, role = 'kid', parentPin) => {
        const member: Member = {
          id: `m-${Date.now()}-${name}`,
          name: name.trim(),
          avatar: avatar || '🐰',
          color: color || '#f59e0b',
          role,
          parentPin: role === 'admin' ? parentPin || DEFAULT_PIN : undefined,
          createdAt: Date.now(),
        }
        setMembers((prev) => [...prev, member])
        setProgressMap((prev) => ensureUserData(prev, member.id))
      },
      deleteMember: (id) => {
        setMembers((prev) => prev.filter((m) => m.id !== id))
        setProgressMap((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      },
      words,
      wordsView,
      addWord: ({ en, cn, phonetic, group }) => {
        const now = Date.now()
        setWords((prev) => [
          ...prev,
          { id: `word-${now}-${en}`, en: en.trim(), cn: cn.trim(), phonetic, group, createdAt: now },
        ])
      },
      removeWord: (id) => setWords((prev) => prev.filter((w) => w.id !== id)),
      resetWords: () => setWords(makeDefaultWords()),
      texts,
      addText: (t) => setTexts((prev) => [...prev, t]),
      removeText: (id) => setTexts((prev) => prev.filter((t) => t.id !== id)),
      userData,
      totalStars,
      points,
      rewards,
      reviewWord: (id, rating) => {
        setActiveProgress((prev) => {
          const cur = prev.progress[id] ?? createInitialProgress()
          return { ...prev, progress: { ...prev.progress, [id]: schedule(cur, rating) } }
        })
      },
      recordLevelResult: (levelId, stars, errors) => {
        const prevBest = userData.levels[levelId]?.stars ?? 0
        setActiveProgress((prev) => ({
          ...prev,
          levels: {
            ...prev.levels,
            [levelId]: { levelId, stars, errors, completedAt: Date.now() } satisfies LevelResult,
          },
        }))
        const delta = stars > prevBest && stars > 0 ? stars * 10 : 0
        if (delta) setPoints((p) => Math.max(0, p + delta))
      },
      addPoints: (n) => setPoints((p) => Math.max(0, p + n)),
      incrementReviewCount: () => setActiveProgress((prev) => ({ ...prev, reviewCount: prev.reviewCount + 1 })),
      claimReward: (id) => {
        const r = rewards.find((x) => x.id === id)
        if (!r || r.claimed || points < r.cost) return
        setRewards((prev) => prev.map((x) => (x.id === id ? { ...x, claimed: true } : x)))
        setPoints((p) => Math.max(0, p - r.cost))
      },
      addReward: (name, icon, cost) =>
        setRewards((prev) => [
          ...prev,
          { id: `r-${Date.now()}`, name: name.trim(), icon, cost, claimed: false },
        ]),
      resetAll: () => {
        setMembers(makeDefaultMembers())
        setActiveMemberId('m-3')
        setWords(makeDefaultWords())
        setProgressMap({})
        setPoints(0)
        setRewards(DEFAULT_REWARDS)
      },
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    members,
    activeMember,
    isAdmin,
    parentUnlocked,
    words,
    wordsView,
    userData,
    totalStars,
    points,
    rewards,
    texts,
  ])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
