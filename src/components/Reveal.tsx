import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

/**
 * Scroll reveal that can never leave content invisible: elements start
 * fully rendered and only get a small lift as they enter the viewport.
 */
export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  if (reduced) return <div className={className}>{children}</div>
  return (
    <motion.div
      initial={{ y }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, amount: 0.01, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[11px] font-extrabold uppercase tracking-[2px] text-accent">
      <span className="h-2 w-2 rounded-full bg-accent" />
      {children}
    </div>
  )
}
