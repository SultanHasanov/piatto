import type { Category, Product } from '../types'

export const IMAGE_CACHE_NAME = 'piatto-images-v2'

export async function cacheImage(url: string): Promise<boolean> {
  if (!('caches' in window) || !url) return false
  const response = await fetch(url, { mode: 'cors', cache: 'no-cache' })
  if (!response.ok || response.type === 'opaque') return false
  const cache = await caches.open(IMAGE_CACHE_NAME)
  await cache.put(url, response)
  return true
}

export async function warmImageCache(categories: Category[], products: Product[]): Promise<void> {
  if (!navigator.onLine || !('caches' in window)) return
  const urls = [...new Set([...categories, ...products].map((item) => item.image).filter((url): url is string => Boolean(url?.startsWith('http'))))]
  if (!urls.length) return

  await Promise.allSettled(urls.map(async (url) => {
    const cache = await caches.open(IMAGE_CACHE_NAME)
    if (await cache.match(url)) return
    await cacheImage(url)
  }))
}
