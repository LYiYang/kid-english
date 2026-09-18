import { useCallback, useEffect, useRef, useState } from 'react'

export interface SpeakOptions {
  rate?: number
  pitch?: number
  lang?: string
}

/**
 * Hook wrapping the Web Speech Synthesis API for reading text aloud.
 */
export function useSpeech() {
  const [speaking, setSpeaking] = useState(false)
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const voicesRef = useRef<SpeechSynthesisVoice[]>([])

  useEffect(() => {
    if (!supported) return
    const loadVoices = () => {
      voicesRef.current = window.speechSynthesis.getVoices()
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
    }
  }, [supported])

  const cancel = useCallback(() => {
    if (!supported) return
    window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [supported])

  const pickVoice = useCallback((lang: string): SpeechSynthesisVoice | undefined => {
    const voices = voicesRef.current
    if (voices.length === 0) return undefined
    const primary = lang.slice(0, 2)
    return (
      voices.find((v) => v.lang === lang) ??
      voices.find((v) => v.lang.startsWith(primary)) ??
      voices[0]
    )
  }, [])

  const speak = useCallback(
    (text: string, opts: SpeakOptions = {}) => {
      if (!supported || !text) return
      const { rate = 0.9, pitch = 1, lang = 'en-US' } = opts
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      const voice = pickVoice(lang)
      if (voice) utterance.voice = voice
      utterance.lang = lang
      utterance.rate = rate
      utterance.pitch = pitch
      utterance.onstart = () => setSpeaking(true)
      utterance.onend = () => setSpeaking(false)
      utterance.onerror = () => setSpeaking(false)
      window.speechSynthesis.speak(utterance)
    },
    [supported, pickVoice],
  )

  return { speak, cancel, speaking, supported }
}
