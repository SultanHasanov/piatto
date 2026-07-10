import { createContext, useContext } from 'react'
import type { RootStore } from './RootStore'

const StoreContext = createContext<RootStore | null>(null)

export function useStore() {
  const store = useContext(StoreContext)
  if (!store) throw new Error('StoreProvider не настроен')
  return store
}

export const StoreProvider = StoreContext.Provider
