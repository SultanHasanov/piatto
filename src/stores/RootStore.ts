import { DataStore } from './DataStore'
import { CartStore } from './CartStore'
import { SyncStore } from './SyncStore'
import { loadAppState, loadCart, requestPersistentStorage } from '../db/localDb'
import { AuthStore } from './AuthStore'

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
  const [state, cartLines] = await Promise.all([loadAppState(), loadCart()])
  void requestPersistentStorage()
  return new RootStore(new DataStore(state), new CartStore(cartLines), new AuthStore())
}
