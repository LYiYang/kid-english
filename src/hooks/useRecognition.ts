import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Word similarity check (Levenshtein distance based).
 * Returns a score from 0 to 1.
 */
export function similarity(target: string, actual: string): number {
  const a = target.toLowerCase().trim()
  const b = actual.toLowerCase().trim()
  if (!a || !b) return 0
  if (a === b) return 1

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  )
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }
  const longest = Math.max(a.length, b.length)
  return 1 - dp[a.length][b.length] / longest
}

/**
 * Hook wrapping the Web Speech Recognition API for voice recognition.
 */
export function useRecognition() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!supported) return
    const Ctor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Ctor) return
    const instance = new Ctor()
    instance.lang = 'en-US'
    instance.interimResults = true
    instance.continuous = false
    instance.maxAlternatives = 1

    instance.onresult = (event) => {
      let text = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript
      }
      if (text) setTranscript(text)
    }
    instance.onerror = (event) => {
      setError(event.error)
      setListening(false)
    }
    instance.onend = () => setListening(false)
    recognitionRef.current = instance
    return () => {
      instance.onresult = null
      instance.onerror = null
      instance.onend = null
      if (instance) instance.abort()
    }
  }, [supported])

  const start = useCallback(() => {
    if (!supported || !recognitionRef.current) return
    setTranscript('')
    setError(null)
    try {
      recognitionRef.current.start()
      setListening(true)
    } catch {
      // already started
    }
  }, [supported])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    setTranscript('')
    setError(null)
  }, [])

  return { supported, listening, transcript, error, start, stop, reset }
}
