import { useEffect, useRef, useState } from 'react'

const isTestEnv = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent ?? '')

// Zählt beim Mount von 0 auf target hoch. Feste Dauer mit ease-out-quint.
export function useCountUp(target: number, duration = 800): number {
  const [value, setValue] = useState(() => isTestEnv || target <= 0 ? target : 0)
  const startRef = useRef<number | null>(null)
  const frameRef = useRef<number | null>(null)

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
    if (reduced || isTestEnv || target <= 0) { setValue(target); return }

    startRef.current = null
    const step = (now: number) => {
      if (startRef.current == null) startRef.current = now
      const elapsed = now - startRef.current
      const t = Math.min(elapsed / duration, 1)
      // ease-out-quint
      const eased = 1 - Math.pow(1 - t, 5)
      setValue(Math.round(target * eased))
      if (t < 1) frameRef.current = requestAnimationFrame(step)
    }
    frameRef.current = requestAnimationFrame(step)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [target, duration])

  return value
}
