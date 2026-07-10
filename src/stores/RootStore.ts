import { DataStore, SEED_VERSION } from './DataStore'
import { CartStore } from './CartStore'
import { SyncStore } from './SyncStore'
import { loadAppState, loadCart, loadParked, loadShifts, requestPersistentStorage } from '../db/localDb'
import { AuthStore } from './AuthStore'
import { warmImageCache } from '../utils/imageCache'
import { isSupabaseConfigured } from '../api/supabase'

export class RootStore {
  data: DataStore
  cart: CartStore
  sync: SyncStore
  auth: AuthStore

  constructor(data: DataStore, cart: CartStore, auth: AuthStore) {
    this.data = data
    this.cart = cart
    this.auth = auth
    this.sync = new SyncStore(this.data)
  }
}

export async function createRootStore(): Promise<RootStore> {
  const [state, cartLines, parked, shifts] = await Promise.all([loadAppState(), loadCart(), loadParked(), loadShifts()])
  void requestPersistentStorage()
  // A new Supabase-connected device must pull the existing shop catalog instead
  // of generating another demo catalog with different client UUIDs.
  const initialState = isSupabaseConfigured && !state.seeded
    ? { ...state, seeded: true, seedVersion: SEED_VERSION }
    : state
  const rootStore = new RootStore(new DataStore(initialState, shifts), new CartStore(cartLines, parked), new AuthStore())
  void warmImageCache(rootStore.data.categories, rootStore.data.products)
  window.addEventListener('online', () => void warmImageCache(rootStore.data.categories, rootStore.data.products))
  return rootStore
}
