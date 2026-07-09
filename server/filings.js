/**
 * Real disclosure tracking via SEC EDGAR.
 *
 * Each hedge-fund pilot maps to its manager's SEC CIK. We poll EDGAR's
 * submissions feed and record the latest 13F-HR (the quarterly holdings
 * disclosure copy-trading runs on). When a new filing lands, it's logged
 * and exposed through the API, so "watching for new trades" is literal:
 * the same public source professionals use, checked automatically.
 */

const CIKS = {
  buffett: { cik: '0001067983', manager: 'Berkshire Hathaway' },
  burry: { cik: '0001649339', manager: 'Scion Asset Management' },
  ackman: { cik: '0001336528', manager: 'Pershing Square Capital' },
  dalio: { cik: '0001350694', manager: 'Bridgewater Associates' },
  cohen: { cik: '0001603466', manager: 'Point72 Asset Management' },
  renaissance: { cik: '0001037389', manager: 'Renaissance Technologies' },
  druckenmiller: { cik: '0001536411', manager: 'Duquesne Family Office' },
}

const POLL_MS = 6 * 60 * 60 * 1000 // EDGAR updates a few times a day; 6h is polite
const UA = 'Alutic filings watcher (contact: admin@alutic.example)'

// pilotId -> { form, filedAt, accession, manager, checkedAt }
const latest = new Map()

async function checkOne(pilotId, { cik, manager }) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': UA, accept: 'application/json' } })
    if (!res.ok) throw new Error(`edgar ${res.status}`)
    const json = await res.json()
    const recent = json?.filings?.recent
    if (!recent?.form) return
    const idx = recent.form.findIndex((f) => f === '13F-HR' || f === '13F-HR/A')
    if (idx === -1) return
    const filing = {
      form: recent.form[idx],
      filedAt: recent.filingDate[idx],
      accession: recent.accessionNumber[idx],
      manager,
      checkedAt: Date.now(),
    }
    const prev = latest.get(pilotId)
    if (prev && prev.accession !== filing.accession) {
      console.log(`[filings] NEW 13F for ${manager}: filed ${filing.filedAt} (${filing.accession})`)
    }
    latest.set(pilotId, filing)
  } catch (e) {
    console.warn(`[filings] ${manager}: ${e.message}`)
  } finally {
    clearTimeout(timer)
  }
}

async function sweep() {
  for (const [pilotId, info] of Object.entries(CIKS)) {
    await checkOne(pilotId, info)
    await new Promise((r) => setTimeout(r, 400)) // stay well under EDGAR rate limits
  }
  console.log(`[filings] tracking ${latest.size}/${Object.keys(CIKS).length} funds on EDGAR`)
}

export function startFilingsWatcher() {
  sweep().catch(() => {})
  setInterval(() => sweep().catch(() => {}), POLL_MS)
}

export function filingFor(pilotId) {
  return latest.get(pilotId) ?? null
}
