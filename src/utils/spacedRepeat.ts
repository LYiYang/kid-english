import type { Rating, WordProgress, WordStatus } from '../types'

export function createInitialProgress(now = Date.now()): WordProgress {
  return {
    repeatCount: 0,
    easeFactor: 2.5,
    intervalDays: 0,
    dueAt: now,
    lastReviewedAt: 0,
    status: 'new',
  }
}

/**
 * Simplified SM-2 spaced repetition algorithm.
 * Ratings: 1 = again, 2 = hard, 3 = good, 4 = easy
 */
export function schedule(progress: WordProgress, rating: Rating, now = Date.now()): WordProgress {
  const { repeatCount, easeFactor, intervalDays } = progress

  let nextEase = easeFactor
  let nextCount: number
  let nextInterval: number

  switch (rating) {
    case 1:
      nextCount = 0
      nextInterval = 0
      nextEase = Math.max(1.3, easeFactor - 0.2)
      break
    case 2:
      nextCount = repeatCount + 1
      nextInterval = repeatCount <= 1 ? 1 : Math.max(1, intervalDays * 0.5)
      nextEase = Math.max(1.3, easeFactor - 0.15)
      break
    case 3:
      nextCount = repeatCount + 1
      nextInterval = repeatCount === 0 ? 1 : repeatCount === 1 ? 6 : Math.round(intervalDays * easeFactor)
      break
    case 4:
    default:
      nextCount = repeatCount + 1
      nextEase = easeFactor + 0.15
      nextInterval = repeatCount === 0 ? 1 : repeatCount === 1 ? 6 : Math.round(intervalDays * easeFactor * 1.3)
      break
  }

  let status: WordStatus
  if (nextCount === 0) status = 'learning'
  else if (nextCount <= 1) status = 'reviewing'
  else status = 'mastered'

  return {
    repeatCount: nextCount,
    easeFactor: nextEase,
    intervalDays: nextInterval,
    dueAt: nextInterval === 0 ? now + 10 * 60 * 1000 : now + nextInterval * 86400000,
    lastReviewedAt: now,
    status,
  }
}

export function isDue(progress: WordProgress, now = Date.now()): boolean {
  return progress.dueAt <= now
}

export function getDueWords<T extends { progress: WordProgress }>(words: T[], now = Date.now()): T[] {
  return words.filter((w) => isDue(w.progress, now))
}

export function formatInterval(days: number): string {
  if (days <= 0) return '10 分钟'
  if (days === 1) return '1 天'
  return `${days} 天`
}
