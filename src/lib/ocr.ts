export type OcrProgress = (message: string, percent?: number) => void

type ImageToTextOutput = { generated_text: string }
type ImageToText = (
  input: string,
  options?: Record<string, unknown>,
) => Promise<ImageToTextOutput[] | ImageToTextOutput>

// 手写体模型（首次使用会下载，走 hf-mirror 镜像）
const HANDWRITING_MODEL = 'Xenova/trocr-base-handwritten'

let trocrPipeline: Promise<ImageToText> | null = null

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
 * 返回 canvas，供 Tesseract / TrOCR 复用。
 */
export async function preprocessToCanvas(file: File | Blob): Promise<HTMLCanvasElement> {
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
    if (!ctx) throw new Error('无法创建画布')
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
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 印刷体识别（Tesseract）。psm: '3' 自动 / '6' 单块 / '11' 分散 */
export async function recognizePrinted(
  canvas: HTMLCanvasElement,
  psm: string,
): Promise<string> {
  const { createWorker, PSM } = await import('tesseract.js')
  const worker = await createWorker('eng')
  const psmValue = psm === '3' ? PSM.AUTO : psm === '11' ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK
  await worker.setParameters({
    tessedit_pageseg_mode: psmValue,
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  })
  const { data } = await worker.recognize(canvas)
  await worker.terminate()
  return (data.text || '').trim()
}

function getTrocr(onProgress: OcrProgress): Promise<ImageToText> {
  if (!trocrPipeline) {
    trocrPipeline = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      env.allowLocalModels = false
      env.remoteHost = 'https://hf-mirror.com'
      env.useBrowserCache = true
      // GitHub Pages 无法设置 COOP/COEP，关闭多线程以免依赖 SharedArrayBuffer
      const onnxWasm = (
        env as unknown as { backends?: { onnx?: { wasm?: { numThreads?: number } } } }
      ).backends?.onnx?.wasm
      if (onnxWasm) onnxWasm.numThreads = 1
      const recognizer = await pipeline('image-to-text', HANDWRITING_MODEL, {
        progress_callback: (info: { status?: string; file?: string; progress?: number }) => {
          if (info.status === 'progress' && typeof info.progress === 'number') {
            onProgress(`下载手写模型：${info.file ?? ''}`, Math.round(info.progress))
          } else if (info.status === 'ready') {
            onProgress('手写模型已就绪')
          }
        },
      })
      return recognizer as unknown as ImageToText
    })()
    trocrPipeline.catch(() => {
      trocrPipeline = null
    })
  }
  return trocrPipeline
}

// 按行切分：水平投影法找文字行
function segmentLines(canvas: HTMLCanvasElement): { top: number; bottom: number }[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  const minInk = Math.max(2, Math.floor(width * 0.004))
  const bands: [number, number][] = []
  let start = -1
  for (let y = 0; y < height; y++) {
    let count = 0
    const rowOffset = y * width * 4
    for (let x = 0; x < width; x++) {
      if (data[rowOffset + x * 4] < 140) count++
    }
    const on = count > minInk
    if (on && start < 0) start = y
    else if (!on && start >= 0) {
      bands.push([start, y - 1])
      start = -1
    }
  }
  if (start >= 0) bands.push([start, height - 1])

  const merged: [number, number][] = []
  for (const b of bands) {
    const last = merged[merged.length - 1]
    if (last && b[0] - last[1] <= 5) last[1] = b[1]
    else merged.push([b[0], b[1]])
  }
  return merged.filter(([a, b]) => b - a >= 8).map(([top, bottom]) => ({ top, bottom }))
}

function cropLine(canvas: HTMLCanvasElement, top: number, bottom: number): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  const width = canvas.width
  const pad = 6
  const y0 = Math.max(0, top - pad)
  const y1 = Math.min(canvas.height - 1, bottom + pad)
  const h = y1 - y0 + 1

  let minX = width
  let maxX = 0
  if (ctx) {
    const band = ctx.getImageData(0, top, width, bottom - top + 1).data
    const bh = bottom - top + 1
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < width; x++) {
        if (band[(y * width + x) * 4] < 140) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
        }
      }
    }
  }
  if (maxX <= minX) {
    minX = 0
    maxX = width - 1
  }
  const x0 = Math.max(0, minX - pad)
  const x1 = Math.min(width - 1, maxX + pad)
  const w = x1 - x0 + 1

  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const octx = out.getContext('2d')
  if (octx) octx.drawImage(canvas, x0, y0, w, h, 0, 0, w, h)
  return out
}

/** 手写体识别（TrOCR，浏览器本地，按行识别） */
export async function recognizeHandwritten(
  canvas: HTMLCanvasElement,
  onProgress: OcrProgress,
): Promise<string> {
  onProgress('加载手写识别模型…')
  const recognizer = await getTrocr(onProgress)
  const lines = segmentLines(canvas)
  if (lines.length === 0) return ''

  const results: string[] = []
  for (let i = 0; i < lines.length; i++) {
    onProgress(`识别手写第 ${i + 1}/${lines.length} 行…`, Math.round(((i + 1) / lines.length) * 100))
    const lineCanvas = cropLine(canvas, lines[i].top, lines[i].bottom)
    const res = await recognizer(lineCanvas.toDataURL('image/png'), { max_new_tokens: 64 })
    const arr = Array.isArray(res) ? res : [res]
    const text = (arr[0]?.generated_text || '').trim()
    if (text) results.push(text)
  }
  return results.join('\n')
}
