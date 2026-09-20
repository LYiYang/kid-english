import { useMemo, useRef, useState } from 'react'
import { useApp } from '../store/useApp'
import type { TextUnit } from '../types'

type Mode = 'word' | 'sentence' | 'text'

function splitSentences(text: string): string[] {
  const lines = text.split('\n').map((s) => s.trim()).filter(Boolean)
  if (lines.length > 1) return lines
  const parts = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
  return parts.length > 0 ? parts : (text.trim() ? [text.trim()] : [])
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

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = src
  })
}

/**
 * 图像预处理：智能缩放 + 灰度化 + 对比度增强。
 * 手机照片通常需要这一步，否则 Tesseract 容易把单词切碎。
 */
async function preprocessImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const w = img.naturalWidth
    const h = img.naturalHeight
    const maxW = 3200
    const minW = 1200
    let scale = 1
    if (w > maxW) scale = maxW / w
    else if (w < minW) scale = Math.min(3, 2000 / w)
    const cw = Math.max(1, Math.round(w * scale))
    const ch = Math.max(1, Math.round(h * scale))

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d')
    if (!ctx) return url
    ctx.drawImage(img, 0, 0, cw, ch)

    const imageData = ctx.getImageData(0, 0, cw, ch)
    const d = imageData.data
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      let v = (gray - 128) * 1.6 + 128
      v = v < 0 ? 0 : v > 255 ? 255 : v
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  } finally {
    URL.revokeObjectURL(url)
  }
}


export default function Scan() {
  const { addWord, addText, words } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [recognizing, setRecognizing] = useState(false)
  const [recognizedText, setRecognizedText] = useState('')
  const [mode, setMode] = useState<Mode>('word')
  const [ocrError, setOcrError] = useState('')
  const [group, setGroup] = useState('')
  const [title, setTitle] = useState('')
  const [cn, setCn] = useState('')
  const [wordCn, setWordCn] = useState<Record<string, string>>({})
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState('')
  const [psm, setPsm] = useState('6')

  const groups = useMemo(() => {
    const set = new Set(words.map((w) => w.group))
    return Array.from(set)
  }, [words])

  const tokenCandidates = useMemo(() => {
    const t = recognizedText
    const tokens = t.split(/[^A-Za-z'-]+/).map((s) => s.trim()).filter((s) => s.length >= 2)
    return Array.from(new Set(tokens.map((s) => s.toLowerCase())))
  }, [recognizedText])

  const sentenceItems = useMemo(() => splitSentences(recognizedText), [recognizedText])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImageUrl(URL.createObjectURL(f))
    setRecognizedText('')
    setOcrError('')
    setMsg('')
  }

  const runOcr = async () => {
    if (!imageFile) return
    setRecognizing(true)
    setOcrError('')
    setMsg('')
    try {
      const prepared = await preprocessImage(imageFile)
      const { createWorker, PSM } = await import('tesseract.js')
      const worker = await createWorker('eng')
      const psmValue = psm === '3' ? PSM.AUTO : psm === '11' ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK
      await worker.setParameters({
        // 版式模式：3=自动，6=单块文字，11=分散文字
        tessedit_pageseg_mode: psmValue,
        // 保留单词之间的空格，避免把单词切碎
        preserve_interword_spaces: '1',
        // 让 Tesseract 按合理分辨率处理，避免过小/过大导致误切
        user_defined_dpi: '300',
      })
      const { data } = await worker.recognize(prepared)
      await worker.terminate()
      const text = (data.text || '').trim()
      setRecognizedText(text)
      setMode(suggestMode(text))
      const tokens = Array.from(new Set(text.split(/[^A-Za-z'-]+/).map((s) => s.trim()).filter((s) => s.length >= 2).map((s) => s.toLowerCase())))
      setPicked(new Set(tokens))
      setWordCn({})
      setMsg(text ? '识别完成，请校对并分类。' : '没有识别到文字，请换一张清晰的图片。')
    } catch (err) {
      setOcrError('识别失败：' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setRecognizing(false)
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
      setMsg('请至少给一个单词填写中文释义后再添加。')
      return
    }
    const g = group.trim() || '拍照录入'
    list.forEach((x) =>
      addWord({ en: x.en, cn: x.cn, group: g }),
    )
    setMsg(`已添加 ${list.length} 个单词到「${g}」分组。`)
    setPicked(new Set())
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
            <img src={imageUrl} alt="预览" className="scan-preview" />
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
          </div>
          <label className="scan-label scan-psm">
            版式
            <select value={psm} onChange={(e) => setPsm(e.target.value)} className="member-input">
              <option value="6">整段文字（默认）</option>
              <option value="3">自动版面</option>
              <option value="11">零散单词</option>
            </select>
          </label>
          <p className="scan-hint">
            拍摄技巧：光线充足、正对文字不倾斜、尽量只拍文字区域，效果最好。
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFile}
            hidden
          />
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
                已解析出 {tokenCandidates.length} 个英文单词，勾选要录入的，并填写中文释义。
              </p>
              {tokenCandidates.length === 0 && (
                <p className="empty">没有解析到单词。</p>
              )}
              {tokenCandidates.map((token) => (
                <div key={token} className="scan-word-row">
                  <input
                    type="checkbox"
                    checked={picked.has(token)}
                    onChange={() => togglePick(token)}
                  />
                  <span className="scan-word-en">{token}</span>
                  <input
                    className="member-input scan-word-cn"
                    value={wordCn[token] || ''}
                    onChange={(e) => setWordCn((prev) => ({ ...prev, [token]: e.target.value }))}
                    placeholder="中文释义"
                  />
                </div>
              ))}
              <button type="button" className="btn btn--primary" onClick={addSelectedWords}>
                添加到单词本
              </button>
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
