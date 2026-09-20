export type WordStatus = 'new' | 'learning' | 'reviewing' | 'mastered'

export interface WordProgress {
  repeatCount: number
  easeFactor: number
  intervalDays: number
  dueAt: number
  lastReviewedAt: number
  status: WordStatus
}

// 家庭共享词库（不含个人进度）
export interface Word {
  id: string
  en: string
  cn: string
  phonetic?: string
  pos?: string
  group: string
  example?: string
  exampleCn?: string
  createdAt: number
}

// 合并了当前成员进度的单词视图
export type WordView = Word & { progress: WordProgress }

export interface Sentence {
  id: string
  en: string
  cn: string
}

export interface TextUnit {
  id: string
  title: string
  en: string
  cn: string
  sentences: Sentence[]
  createdAt: number
}

export type Rating = 1 | 2 | 3 | 4

export interface ReviewedWord {
  wordId: string
  rating: Rating
  reviewedAt: number
}

export type StarRating = 0 | 1 | 2 | 3

export interface LevelResult {
  levelId: number
  stars: StarRating
  errors: number
  completedAt: number
}

export interface GameLevel {
  id: number
  title: string
  group: string
  cardCount: number
  unlockStars: number
}

export type MemberRole = 'admin' | 'kid'

export interface Member {
  id: string
  name: string
  avatar: string
  color: string
  role: MemberRole
  parentPin?: string
  createdAt: number
}

// 每个成员独立的学习进度；积分与成员共用 kid-tasks 的按成员积分
export interface UserData {
  reviewCount: number
  progress: Record<string, WordProgress>
  levels: Record<number, LevelResult>
}

export interface AppState {
  members: Member[]
  activeMemberId: string
  words: Word[]
  userData: Record<string, UserData>
}
