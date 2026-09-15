import { useState, useEffect } from 'react'

/** Returns true when the viewport is below the lg breakpoint (1024px). */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  )

  useEffect(() => {
    const getMatches = () => {
      const widthMatches = typeof window !== 'undefined' && window.innerWidth < 1024;
      if (typeof window.matchMedia !== 'function') return widthMatches;
      return window.matchMedia('(max-width: 1023px)').matches || widthMatches;
    };
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 1023px)') : null;
    const handler = () => setIsMobile(getMatches());
    handler();
    mq?.addEventListener('change', handler);
    window.addEventListener('resize', handler);
    return () => {
      mq?.removeEventListener('change', handler);
      window.removeEventListener('resize', handler);
    };
  }, []);

  return isMobile
}
