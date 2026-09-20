import { useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import { useApp } from '../store/useApp'
import {
  preprocessToCanvas,
  recognizeHandwritten,
  recognizePrinted,
  type CropRect,
  type OcrProgress,
} from '../lib/ocr'
import { lookupWord } from '../lib/dictionary'
import type { TextUnit } from '../types'

type Mode = 'word' | 'sentence' | 'text'
type Engine = 'printed' | 'handwritten'

interface Sel {
  x: number
  y: number
  w: number
  h: number
}

// 把折行合并为完整句子：换行 → 空格，再按句末标点切分
function splitSentences(text: string): string[] {
  const normalized = text
    .replace(/\r/g, ' ')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return []
  const matches = normalized.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g)
  if (!matches) return [normalized]
  return matches.map((s) => s.trim()).filter(Boolean)
}

function suggestMode(text: string): Mode {
  const t = text.trim()
  const tokens = t.split(/\s+/).filter((w) => /^[A-Za-z'-]+$/.test(w))
  const lines = text.split('\n').filter((s) => s.trim())
  if (lines.length >= 2 && t.length > 30) return 'text'
  if (/[.!?]/.test(t) && tokens.length >= 2) return 'sentence'
  if (tokens.length >= 2) return 'word'
  return 'word'
}

export default function Scan() {
  const { addWord, addText, words } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const dragStartRef = useRef<{ x: number; y: number } | null>(null)

  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [sel, setSel] = useState<Sel | null>(null)
  const [engine, setEngine] = useState<Engine>('printed')
  const [psm, setPsm] = useState('6')
  const [recognizing, setRecognizing] = useState(false)
  const [status, setStatus] = useState('')
  const [recognizedText, setRecognizedText] = useState('')
  const [mode, setMode] = useState<Mode>('word')
  const [ocrError, setOcrError] = useState('')
  const [group, setGroup] = useState('')
  const [title, setTitle] = useState('')
  const [cn, setCn] = useState('')
  const [wordCn, setWordCn] = useState<Record<string, string>>({})
  const [wordPh, setWordPh] = useState<Record<string, string>>({})
  const [wordPos, setWordPos] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [looking, setLooking] = useState(false)
  const [msg, setMsg] = useState('')

  const groups = useMemo(() => {
    const set = new Set(words.map((w) => w.group))
    return Array.from(set)
  }, [words])

  const tokenCandidates = useMemo(() => {
    const tokens = recognizedText
      .split(/[^A-Za-z'-]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
    return Array.from(new Set(tokens.map((s) => s.toLowerCase())))
  }, [recognizedText])

  const sentenceItems = useMemo(() => splitSentences(recognizedText), [recognizedText])

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImageUrl(URL.createObjectURL(f))
    setSel(null)
    setRecognizedText('')
    setOcrError('')
    setMsg('')
    setStatus('')
  }

  const pointFromEvent = (e: PointerEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: Math.max(0, Math.min(rect.width, e.clientX - rect.left)),
      y: Math.max(0, Math.min(rect.height, e.clientY - rect.top)),
    }
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!imageUrl) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragStartRef.current = pointFromEvent(e)
    setSel(null)
  }

  const onPointerMove = (e: PointerEvent) => {
    if (!dragStartRef.current) return
    const p = pointFromEvent(e)
    const s = dragStartRef.current
    setSel({
      x: Math.min(s.x, p.x),
      y: Math.min(s.y, p.y),
      w: Math.abs(p.x - s.x),
      h: Math.abs(p.y - s.y),
    })
  }

  const onPointerUp = () => {
    dragStartRef.current = null
    setSel((prev) => (prev && (prev.w < 12 || prev.h < 12) ? null : prev))
  }

  const getCrop = (): CropRect | null => {
    if (!sel || !imgRef.current) return null
    const natW = imgRef.current.naturalWidth
    const natH = imgRef.current.naturalHeight
    const dispW = imgRef.current.clientWidth
    const dispH = imgRef.current.clientHeight
    if (!dispW || !dispH) return null
    const kx = natW / dispW
    const ky = natH / dispH
    return { x: sel.x * kx, y: sel.y * ky, w: sel.w * kx, h: sel.h * ky }
  }

  const runOcr = async () => {
    if (!imageFile) return
    setRecognizing(true)
    setOcrError('')
    setMsg('')
    setStatus('正在处理图片…')
    const onProgress: OcrProgress = (message, percent) => {
      setStatus(percent != null ? `${message}（${percent}%）` : message)
    }
    try {
      const canvas = await preprocessToCanvas(imageFile, getCrop())
      const text =
        engine === 'handwritten'
          ? await recognizeHandwritten(canvas, onProgress)
          : await recognizePrinted(canvas, psm)
      setRecognizedText(text)
      setMode(suggestMode(text))
      const tokens = Array.from(
        new Set(
          text
            .split(/[^A-Za-z'-]+/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 2)
            .map((s) => s.toLowerCase()),
        ),
      )
      setPicked(new Set(tokens))
      setWordCn({})
      setMsg(text ? '识别完成，已自动合并折行为完整句子，请校对并分类。' : '没有识别到文字，请框选文字区域后重试。')
    } catch (err) {
      setOcrError('识别失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRecognizing(false)
      setStatus('')
    }
  }

  const togglePick = (token: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(token)) next.delete(token)
      else next.add(token)
      return next
    })
  }

  const addSelectedWords = () => {
    const list = [...picked]
      .map((en) => ({ en, cn: (wordCn[en] || '').trim() }))
      .filter((x) => x.cn)
    if (list.length === 0) {
      setMsg('请先点「自动查词」或手动填写中文释义。')
      return
    }
    const g = group.trim() || '拍照录入'
    list.forEach((x) =>
      addWord({
        en: x.en,
        cn: x.cn,
        phonetic: wordPh[x.en] || undefined,
        pos: wordPos[x.en] || undefined,
        group: g,
      }),
    )
    setMsg(`已添加 ${list.length} 个单词到「${g}」分组。`)
    setPicked(new Set())
  }

  const autoLookup = async () => {
    const tokens = [...picked]
    if (tokens.length === 0) {
      setMsg('请先勾选要查词的单词。')
      return
    }
    setLooking(true)
    const cnMap: Record<string, string> = {}
    const phMap: Record<string, string> = {}
    const posMap: Record<string, string> = {}
    for (let i = 0; i < tokens.length; i++) {
      setStatus(`查词 ${i + 1}/${tokens.length}：${tokens[i]}`)
      const r = await lookupWord(tokens[i])
      if (r.found) {
        cnMap[tokens[i]] = r.cn
        phMap[tokens[i]] = r.phonetic
        posMap[tokens[i]] = r.pos
      }
    }
    setWordCn((prev) => ({ ...prev, ...cnMap }))
    setWordPh((prev) => ({ ...prev, ...phMap }))
    setWordPos((prev) => ({ ...prev, ...posMap }))
    setStatus('')
    setLooking(false)
    setMsg(`已自动查词 ${Object.keys(cnMap).length}/${tokens.length} 个，可再手动修改。`)
  }

  const saveText = () => {
    const sentences = splitSentences(recognizedText)
    if (sentences.length === 0) {
      setMsg('请先识别或输入一些内容。')
      return
    }
    const t = title.trim() || sentences[0].slice(0, 20)
    const unit: TextUnit = {
      id: `text-${Date.now()}-${t}`,
      title: t,
      en: sentences.join(' '),
      cn: cn.trim(),
      createdAt: Date.now(),
      sentences: sentences.map((en, i) => ({ id: `s-${Date.now()}-${i}`, en, cn: cn.trim() })),
    }
    addText(unit)
    setMsg('课文已保存到「课文」列表。')
    setRecognizedText('')
    setTitle('')
    setCn('')
  }

  return (
    <div className="page-container">
      <header className="page-header">
        <h1>拍照识别 📷</h1>
        <p className="subtitle">拍摄/上传图片，自动识别单词、句子、课文并分类录入</p>
      </header>

      <div className="scan-layout">
        <div className="scan-upload">
          {imageUrl ? (
            <div
              ref={wrapRef}
              className="scan-crop-wrap"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <img ref={imgRef} src={imageUrl} alt="预览" className="scan-preview" draggable={false} />
              {sel && (
                <span
                  className="scan-crop-rect"
                  style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h }}
                />
              )}
            </div>
          ) : (
            <div className="scan-placeholder">📷 点击下方按钮拍照或选取图片</div>
          )}

          <div className="scan-buttons">
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => fileRef.current?.click()}
            >
              {imageUrl ? '重新拍照' : '📷 拍照 / 选取'}
            </button>
            <button
              type="button"
              className="btn btn--ghost"
              onClick={runOcr}
              disabled={!imageFile || recognizing}
            >
              {recognizing ? '识别中…' : '✨ 识别文字'}
            </button>
            {sel && (
              <button type="button" className="btn btn--ghost" onClick={() => setSel(null)}>
                清除选区
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            hidden
          />

          <p className="scan-hint">
            {imageUrl ? '在图片上按住拖动可框选文字区域（排除配图、笔等干扰）。' : '拍摄技巧：光线充足、正对文字不倾斜。'}
          </p>

          <div className="scan-engine">
            <span className="scan-engine-label">识别引擎</span>
            <div className="scan-modes">
              <button
                type="button"
                className={engine === 'printed' ? 'chip chip--active' : 'chip'}
                onClick={() => setEngine('printed')}
              >
                印刷体（快）
              </button>
              <button
                type="button"
                className={engine === 'handwritten' ? 'chip chip--active' : 'chip'}
                onClick={() => setEngine('handwritten')}
              >
                手写体（准）
              </button>
            </div>
          </div>

          {engine === 'printed' ? (
            <label className="scan-label scan-psm">
              版式
              <select value={psm} onChange={(e) => setPsm(e.target.value)} className="member-input">
                <option value="6">整段文字（默认）</option>
                <option value="3">自动版面</option>
                <option value="11">零散单词</option>
              </select>
            </label>
          ) : (
            <p className="scan-hint">
              手写识别首次使用需下载模型（约几百 MB，走 hf-mirror 镜像），请耐心等待；识别按行进行，较慢。
            </p>
          )}
          {status && <p className="scan-msg">{status}</p>}
          {ocrError && <p className="warn">{ocrError}</p>}
        </div>

        <div className="scan-result">
          <h3 className="settings-section-title">识别结果（可编辑）</h3>
          <textarea
            className="scan-textarea"
            value={recognizedText}
            onChange={(e) => setRecognizedText(e.target.value)}
            rows={4}
            placeholder="识别出的文字会显示在这里，可手动修改…"
          />

          <div className="scan-modes">
            {(['word', 'sentence', 'text'] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={mode === m ? 'chip chip--active' : 'chip'}
                onClick={() => setMode(m)}
              >
                {m === 'word' ? '单词' : m === 'sentence' ? '句子' : '课文'}
              </button>
            ))}
          </div>

          <label className="scan-label">
            分类分组
            <input
              className="member-input"
              list="scan-groups"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="如 食物 / 颜色 / 学校…"
            />
          </label>
          <datalist id="scan-groups">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>

          {mode === 'word' && (
            <div className="scan-words">
              <p className="scan-hint">
                已解析出 {tokenCandidates.length} 个英文单词，勾选后点「自动查词」即可带出翻译/音标/词性。
              </p>
              {tokenCandidates.length === 0 && <p className="empty">没有解析到单词。</p>}
              {tokenCandidates.map((token) => (
                <div key={token} className="scan-word-row">
                  <input
                    type="checkbox"
                    checked={picked.has(token)}
                    onChange={() => togglePick(token)}
                  />
                  <span className="scan-word-en">
                    {token}
                    {wordPos[token] && <span className="word-card-pos">{wordPos[token]}</span>}
                    {wordPh[token] && <span className="scan-word-ph">{wordPh[token]}</span>}
                  </span>
                  <input
                    className="member-input scan-word-cn"
                    value={wordCn[token] || ''}
                    onChange={(e) => setWordCn((prev) => ({ ...prev, [token]: e.target.value }))}
                    placeholder="中文释义"
                  />
                </div>
              ))}
              <div className="scan-word-actions">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={autoLookup}
                  disabled={looking || picked.size === 0}
                >
                  {looking ? '查词中…' : '🔍 自动查词'}
                </button>
                <button type="button" className="btn btn--primary" onClick={addSelectedWords}>
                  添加到单词本
                </button>
              </div>
            </div>
          )}

          {(mode === 'sentence' || mode === 'text') && (
            <div className="scan-text">
              <label className="scan-label">
                课文标题
                <input
                  className="member-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={mode === 'sentence' ? '如：喜欢的句子' : '如：我的家庭'}
                />
              </label>
              <label className="scan-label">
                中文对照（可选）
                <input
                  className="member-input"
                  value={cn}
                  onChange={(e) => setCn(e.target.value)}
                  placeholder="整体中文翻译（可选）"
                />
              </label>
              <p className="scan-hint">已把折行合并为完整句子：</p>
              <div className="scan-sentences">
                {sentenceItems.map((s, i) => (
                  <div key={i} className="scan-sentence-item">
                    <span className="sentence-num">{i + 1}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn--primary" onClick={saveText}>
                保存为课文
              </button>
            </div>
          )}

          {msg && <p className="scan-msg">{msg}</p>}
        </div>
      </div>
    </div>
  )
}
