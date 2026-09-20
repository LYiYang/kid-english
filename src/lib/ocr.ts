export type OcrProgress = (message: string, percent?: number) => void

export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

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
 * 图像预处理：
 * 1) 智能缩放  2) 灰度化  3) 自适应阈值二值化  4) 自动反色（白字深底 → 黑字白底）
 * 支持传入裁剪区域，先把配图/笔等干扰裁掉。
 */
export async function preprocessToCanvas(
  file: File | Blob,
  crop?: CropRect | null,
): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const natW = img.naturalWidth
    const natH = img.naturalHeight

    const sx = crop ? Math.max(0, Math.min(natW - 1, Math.round(crop.x))) : 0
    const sy = crop ? Math.max(0, Math.min(natH - 1, Math.round(crop.y))) : 0
    const sw = crop ? Math.max(1, Math.min(natW - sx, Math.round(crop.w))) : natW
    const sh = crop ? Math.max(1, Math.min(natH - sy, Math.round(crop.h))) : natH

    const maxW = 3200
    const minW = 1200
    let scale = 1
    if (sw > maxW) scale = maxW / sw
    else if (sw < minW) scale = Math.min(3, 2000 / sw)
    const cw = Math.max(1, Math.round(sw * scale))
    const ch = Math.max(1, Math.round(sh * scale))

    const canvas = document.createElement('canvas')
    canvas.width = cw
    canvas.height = ch
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('无法创建画布')
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch)

    const imageData = ctx.getImageData(0, 0, cw, ch)
    const d = imageData.data
    const W = cw
    const H = ch

    // 灰度
    const gray = new Uint8Array(W * H)
    for (let i = 0; i < gray.length; i++) {
      const j = i * 4
      gray[i] = (0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2]) | 0
    }

    // 积分图，用于 O(1) 求窗口均值
    const integral = new Float64Array((W + 1) * (H + 1))
    for (let y = 0; y < H; y++) {
      let rowSum = 0
      for (let x = 0; x < W; x++) {
        rowSum += gray[y * W + x]
        integral[(y + 1) * (W + 1) + (x + 1)] = integral[y * (W + 1) + (x + 1)] + rowSum
      }
    }

    const half = Math.min(60, Math.max(8, Math.round(Math.min(W, H) / 30)))
    const C = 10
    const binary = new Uint8Array(W * H)
    let darkCount = 0

    for (let y = 0; y < H; y++) {
      const y0 = Math.max(0, y - half)
      const y1 = Math.min(H - 1, y + half)
      for (let x = 0; x < W; x++) {
        const x0 = Math.max(0, x - half)
        const x1 = Math.min(W - 1, x + half)
        const area = (x1 - x0 + 1) * (y1 - y0 + 1)
        const sum =
          integral[(y1 + 1) * (W + 1) + (x1 + 1)] -
          integral[y0 * (W + 1) + (x1 + 1)] -
          integral[(y1 + 1) * (W + 1) + x0] +
          integral[y0 * (W + 1) + x0]
        const mean = sum / area
        const black = gray[y * W + x] < mean - C
        binary[y * W + x] = black ? 0 : 255
        if (black) darkCount++
      }
    }

    // 若黑色占多数，说明是「深底浅字」，整体反色
    const invert = darkCount > (W * H) / 2
    for (let i = 0; i < W * H; i++) {
      const v = invert ? 255 - binary[i] : binary[i]
      const j = i * 4
      d[j] = d[j + 1] = d[j + 2] = v
      d[j + 3] = 255
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
