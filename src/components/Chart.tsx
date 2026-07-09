import { useId, useRef, useState } from 'react'

interface ChartProps {
  data: number[]
  width?: number
  height?: number
  stroke?: string
  strokeWidth?: number
  className?: string
}

function buildPath(data: number[], w: number, h: number, pad = 2) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const n = data.length
  const x = (i: number) => (i / (n - 1)) * (w - pad * 2) + pad
  const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2)
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(2)},${h} L${x(0).toFixed(2)},${h} Z`
  return { line, area, x, y, min, max }
}

/** Sparkline, compact inline chart with no axes. */
export function Sparkline({
  data,
  width = 120,
  height = 36,
  stroke,
  strokeWidth = 1.6,
  className,
}: ChartProps) {
  const id = useId()
  const color = stroke ?? 'var(--color-accent)'
  const { line } = buildPath(data, width, height, 2)
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <title>{`spark-${id}`}</title>
    </svg>
  )
}

const fmtDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const fmtDateShort = (ts: number) => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

interface AreaChartProps extends ChartProps {
  /** Timestamps (ms) aligned with data; enables hover tooltip + date axis. */
  dates?: number[]
}

/**
 * Area chart with gradient fill. When `dates` are provided the chart is
 * interactive: hover/touch shows the exact date and the value at that
 * point (series is indexed to 100 at the window start, shown as %).
 */
export function AreaChart({
  data,
  width = 720,
  height = 240,
  stroke = 'var(--color-accent)',
  strokeWidth = 2,
  className,
  dates,
}: AreaChartProps) {
  const id = useId().replace(/:/g, '')
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const { line, area, x, y } = buildPath(data, width, height, 6)
  const interactive = !!dates && dates.length === data.length

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(data.length - 1, Math.round(frac * (data.length - 1)))))
  }

  const hv = hover !== null && interactive ? hover : null
  const hoverPct = hv !== null ? ((data[hv] - data[0]) / data[0]) * 100 : 0
  // keep the tooltip inside the chart near the edges
  const labelX = hv !== null ? Math.max(70, Math.min(width - 70, x(hv))) : 0

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        className={className}
        preserveAspectRatio="none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={`fill-${id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={width} y1={height * f} y2={height * f} stroke="rgba(28,29,21,0.07)" strokeWidth="1" />
        ))}
        <path d={area} fill={`url(#fill-${id})`} />
        <path d={line} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
        {hv !== null && (
          <g>
            <line x1={x(hv)} x2={x(hv)} y1={0} y2={height} stroke="var(--color-line-2)" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx={x(hv)} cy={y(data[hv])} r="4.5" fill={stroke} stroke="#fff" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* hover tooltip */}
      {hv !== null && dates && (
        <div
          className="pointer-events-none absolute -top-1 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl bg-navy px-3 py-1.5 text-center shadow-lg"
          style={{ left: `${(labelX / width) * 100}%` }}
        >
          <div className={`tnum text-sm ${hoverPct >= 0 ? 'text-[#7adb2e]' : 'text-[#ff8080]'}`}>
            {hoverPct >= 0 ? '+' : ''}
            {hoverPct.toFixed(2)}%
          </div>
          <div className="text-[10px] font-bold text-white/60">{fmtDate(dates[hv])}</div>
        </div>
      )}

      {/* date axis */}
      {interactive && dates && (
        <div className="mt-1.5 flex justify-between text-[10px] font-bold text-muted-2">
          <span>{fmtDateShort(dates[0])}</span>
          <span className="hidden sm:block">{fmtDateShort(dates[Math.floor(dates.length / 2)])}</span>
          <span>{fmtDateShort(dates[dates.length - 1])}</span>
        </div>
      )}
    </div>
  )
}
