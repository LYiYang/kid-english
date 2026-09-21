export interface DictResult {
  en: string
  phonetic: string
  cn: string
  pos: string
  category: string
  theme: string
  source: 'local' | 'online'
  found: boolean
}

export interface DictExample {
  en: string
  cn: string
}

// 词典条目：[原词, 音标, 中文释义, 词性, 考纲标签, 主题分类]
type DictEntry = [string, string, string, string, string, string]
type Dict = Record<string, DictEntry>

const TAG_LABELS: Record<string, string> = {
  zk: '中考',
  gk: '高考',
  cet4: '四级',
  cet6: '六级',
  ky: '考研',
  toefl: '托福',
  ielts: '雅思',
  gre: 'GRE',
}
const TAG_ORDER = ['zk', 'gk', 'cet4', 'cet6', 'ky', 'toefl', 'ielts', 'gre']

// 可手动选择的主题分类
export const THEME_OPTIONS = [
  '水果',
  '蔬菜',
  '食物',
  '饮料',
  '动物',
  '颜色',
  '数字',
  '身体',
  '家庭',
  '学校',
  '交通',
  '天气',
  '时间',
  '衣物',
  '运动',
  '职业',
  '自然',
  '情绪',
  '房屋',
  '科技',
  '节日',
  '爱好',
  '购物',
  '方位',
  '玩具',
]

const base = () => import.meta.env.BASE_URL

let corePromise: Promise<Dict> | null = null
function loadCore(): Promise<Dict> {
  if (!corePromise) {
    corePromise = fetch(`${base()}dict.json`).then((r) => r.json() as Promise<Dict>)
    corePromise.catch(() => {
      corePromise = null
    })
  }
  return corePromise
}

const shardCache = new Map<string, Promise<Dict>>()
function loadShard(letter: string): Promise<Dict> {
  if (!letter.match(/[a-z]/)) return Promise.resolve({})
  if (!shardCache.has(letter)) {
    const p = fetch(`${base()}dict/${letter}.json`).then((r) =>
      r.ok ? (r.json() as Promise<Dict>) : ({} as Dict),
    )
    p.catch(() => shardCache.delete(letter))
    shardCache.set(letter, p)
  }
  return shardCache.get(letter) as Promise<Dict>
}

function categoryOf(tag: string): string {
  if (!tag) return ''
  const tags = tag.split(/\s+/)
  for (const lv of TAG_ORDER) if (tags.includes(lv)) return TAG_LABELS[lv]
  return ''
}

function toResult(e: DictEntry, source: 'local'): DictResult {
  return {
    en: e[0],
    phonetic: e[1] || '',
    cn: e[2] || '',
    pos: e[3] || '',
    category: categoryOf(e[4] || ''),
    theme: e[5] || '',
    source,
    found: true,
  }
}

// 简单词形还原尝试（复数/过去式/进行时）
function candidates(word: string): string[] {
  const w = word.toLowerCase().trim()
  const list = [w]
  if (w.endsWith('ies') && w.length > 4) list.push(w.slice(0, -3) + 'y')
  if (w.endsWith('es') && w.length > 3) list.push(w.slice(0, -2))
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) list.push(w.slice(0, -1))
  if (w.endsWith('ing') && w.length > 5) {
    list.push(w.slice(0, -3))
    list.push(w.slice(0, -3) + 'e')
  }
  if (w.endsWith('ed') && w.length > 4) {
    list.push(w.slice(0, -2))
    list.push(w.slice(0, -1))
    list.push(w.slice(0, -2) + 'e')
  }
  return [...new Set(list)]
}

async function onlineTranslate(word: string): Promise<string> {
  try {
    const r = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(word)}&langpair=en|zh-CN`,
    )
    if (!r.ok) return ''
    const j = (await r.json()) as { responseData?: { translatedText?: string } }
    const t = j?.responseData?.translatedText
    if (typeof t === 'string' && t && /[\u4e00-\u9fa5]/.test(t)) return t
    return ''
  } catch {
    return ''
  }
}

/** 查词：核心词库 → 全量分片 → 在线翻译兜底 */
export async function lookupWord(word: string, online = true): Promise<DictResult> {
  const en = word.toLowerCase().trim()

  try {
    const core = await loadCore()
    for (const c of candidates(word)) {
      const e = core[c]
      if (e) return toResult(e, 'local')
    }
  } catch {
    // 忽略核心库失败
  }

  for (const c of candidates(word)) {
    if (!c.match(/^[a-z]/)) continue
    try {
      const shard = await loadShard(c[0])
      const e = shard[c]
      if (e) return toResult(e, 'local')
    } catch {
      // 忽略分片失败
    }
  }

  if (online) {
    const cn = await onlineTranslate(word)
    if (cn) {
      return { en, phonetic: '', cn, pos: '', category: '', theme: '', source: 'online', found: true }
    }
  }
  return { en, phonetic: '', cn: '', pos: '', category: '', theme: '', source: 'local', found: false }
}

/** 发音音频（有道，<audio> 播放不受 CORS 限制） */
export function wordAudioUrl(en: string, type: '1' | '2' = '2'): string {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(en)}&type=${type}`
}

/** 例句（在线，经 CORS 代理取有道词典数据） */
export async function fetchExamples(word: string): Promise<DictExample[]> {
  try {
    const target = `https://dict.youdao.com/jsonapi?q=${encodeURIComponent(word)}`
    const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`)
    if (!r.ok) return []
    const j = (await r.json()) as {
      blng_sents_part?: { 'sentence-pair'?: Array<{ sentence?: string; 'sentence-translation'?: string }> }
    }
    const pairs = j?.blng_sents_part?.['sentence-pair']
    if (!Array.isArray(pairs)) return []
    return pairs
      .slice(0, 4)
      .map((p) => ({
        en: String(p.sentence ?? '').replace(/<[^>]+>/g, '').trim(),
        cn: String(p['sentence-translation'] ?? '').trim(),
      }))
      .filter((x) => x.en)
  } catch {
    return []
  }
}
