import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView } from 'framer-motion'

/** NumberTicker, animated count-up when scrolled into view. */
export function NumberTicker({
  value,
  from = 0,
  duration = 1.4,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}: {
  value: number
  from?: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!inView || done) return
    const node = ref.current
    if (!node) return
    const controls = animate(from, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate(v) {
        node.textContent =
          prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
      },
      onComplete: () => setDone(true),
    })
    return () => controls.stop()
  }, [inView, value, from, duration, decimals, prefix, suffix, done])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {from.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      {suffix}
    </span>
  )
}

/** BlurFade, fade + de-blur reveal for hero content. */
export function BlurFade({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
