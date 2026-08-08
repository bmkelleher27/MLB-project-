import { useEffect, useState } from 'react';

/**
 * Reactive viewport check. Default breakpoint covers phones in portrait
 * (iPhone 12 Pro is 390px wide); landscape/desktop fall through to the
 * full grid layout. Updates live on resize/rotate.
 */
export function useIsMobile(query = '(max-width: 500px)'): boolean {
  const read = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [isMobile, setIsMobile] = useState(read);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setIsMobile(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return isMobile;
}
