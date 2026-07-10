import type { Category, Product } from '../types'

export const IMAGE_CACHE_NAME = 'piatto-images-v1'

export async function warmImageCache(categories: Category[], products: Product[]): Promise<void> {
  if (!navigator.onLine || !('caches' in window)) return
  const urls = [...new Set([...categories, ...products].map((item) => item.image).filter((url): url is string => Boolean(url?.startsWith('http'))))]
  if (!urls.length) return

  const cache = await caches.open(IMAGE_CACHE_NAME)
  await Promise.allSettled(urls.map(async (url) => {
    if (await cache.match(url)) return
    const response = await fetch(url, { mode: 'no-cors', cache: 'no-cache' })
    await cache.put(url, response)
  }))
}
