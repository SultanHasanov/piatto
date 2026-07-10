let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!audioCtx) audioCtx = new Ctor()
  if (audioCtx.state === 'suspended') void audioCtx.resume()
  return audioCtx
}

function beep(ctx: AudioContext, startTime: number, frequency: number, duration: number) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(0.25, startTime + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  oscillator.connect(gain)
  gain.connect(ctx.destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + duration)
}

/** Короткий двухтональный сигнал при успешном оформлении заказа. */
export function playOrderPaidSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  const now = ctx.currentTime
  beep(ctx, now, 880, 0.1)
  beep(ctx, now + 0.1, 1320, 0.15)
}

/** Короткий одиночный сигнал — используется для менее значимых событий (добавление в чек и т.п.). */
export function playTapSound() {
  const ctx = getAudioContext()
  if (!ctx) return
  beep(ctx, ctx.currentTime, 660, 0.06)
}
