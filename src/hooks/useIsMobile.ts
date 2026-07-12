import { useSyncExternalStore } from 'react'

// Phones in landscape can be wider than the regular mobile breakpoint while
// still being too short for the desktop receipt column.
const QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
