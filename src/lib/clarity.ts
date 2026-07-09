/**
 * Microsoft Clarity analytics (heatmaps + session recordings).
 *
 * Loads only when a project ID is configured, so dev sessions and
 * ID-less deploys stay untracked. Set VITE_CLARITY_ID at build time
 * (Render env var, or .env.local for local builds) with the project ID
 * from clarity.microsoft.com for alutic.ai.
 */
export function initClarity() {
  const id = import.meta.env.VITE_CLARITY_ID as string | undefined
  if (!id || !import.meta.env.PROD) return

  const w = window as unknown as { clarity?: { q?: unknown[] } & ((...args: unknown[]) => void) }
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      ;(w.clarity!.q = w.clarity!.q || []).push(args)
    }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.clarity.ms/tag/${encodeURIComponent(id)}`
  document.head.appendChild(script)
}
