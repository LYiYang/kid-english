export interface DictResult {
  en: string
  phonetic: string
  cn: string
  pos: string
  category: string
  source: 'local' | 'online'
  found: boolean
}

// dict.json 格式：{ word: [原词, 音标, 中文释义, 词性, 考纲标签] }
type DictEntry = [string, string, string, string, string]
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

let dictPromise: Promise<Dict> | null = null

function loadDict(): Promise<Dict> {
  if (!dictPromise) {
    dictPromise = fetch(`${import.meta.env.BASE_URL}dict.json`).then(
      (r) => r.json() as Promise<Dict>,
    )
    dictPromise.catch(() => {
      dictPromise = null
    })
  }
  return dictPromise
}

function categoryOf(tag: string): string {
  if (!tag) return ''
  const tags = tag.split(/\s+/)
  for (const lv of TAG_ORDER) {
    if (tags.includes(lv)) return TAG_LABELS[lv]
  }
  return ''
}

function cleanCn(translation: string): string {
  return translation.replace(/^\s*[a-z]+\.(?:\s*&\s*[a-z]+\.)?\s*/i, '').trim()
}

// 简单的词形还原尝试（复数/过去式/进行时）
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

/** 查词：优先本地词典，未命中再走在线翻译兜底 */
export async function lookupWord(word: string, online = true): Promise<DictResult> {
  const en = word.toLowerCase().trim()
  try {
    const dict = await loadDict()
    for (const c of candidates(word)) {
      const e = dict[c]
      if (e) {
        return {
          en: e[0],
          phonetic: e[1] || '',
          cn: cleanCn(e[2] || ''),
          pos: e[3] || '',
          category: categoryOf(e[4] || ''),
          source: 'local',
          found: true,
        }
      }
    }
  } catch {
    // 本地词典加载失败则走在线
  }
  if (online) {
    const cn = await onlineTranslate(word)
    if (cn) {
      return { en, phonetic: '', cn, pos: '', category: '', source: 'online', found: true }
    }
  }
  return { en, phonetic: '', cn: '', pos: '', category: '', source: 'local', found: false }
}
