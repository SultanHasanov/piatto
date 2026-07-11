import { useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react'

interface Props extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> {
  src: string
  fallback?: ReactNode
  retries?: number
}

function retryUrl(src: string, attempt: number): string {
  try {
    const url = new URL(src, window.location.href)
    url.searchParams.set('_image_retry', String(attempt))
    return url.toString()
  } catch {
    return src
  }
}

async function evictFailedImage(...urls: string[]): Promise<void> {
  if (!('caches' in window)) return
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames
    .filter((name) => name.startsWith('piatto-images-'))
    .flatMap((name) => urls.map(async (url) => {
      const cache = await caches.open(name)
      await cache.delete(url)
    })))
}

export function ReliableImage({ src, fallback = null, retries = 2, ...props }: Props) {
  const [attempt, setAttempt] = useState(0)

  useEffect(() => setAttempt(0), [src])

  if (attempt > retries) return <>{fallback}</>

  const currentSrc = attempt === 0 ? src : retryUrl(src, attempt)
  return (
    <img
      {...props}
      src={currentSrc}
      onError={() => {
        void evictFailedImage(src, currentSrc).finally(() => setAttempt((value) => value + 1))
      }}
    />
  )
}
