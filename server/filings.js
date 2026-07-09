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

async function edgarJson(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': UA, accept: 'application/json' } })
    if (!res.ok) throw new Error(`edgar ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function edgarText(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 15_000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': UA } })
    if (!res.ok) throw new Error(`edgar ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Read a 13F's information table: every CUSIP held and total shares.
 * This is the real portfolio disclosure the whole product is built on.
 */
async function holdingsOf(cik, accession) {
  const cikNum = String(Number(cik))
  const acc = accession.replace(/-/g, '')
  const index = await edgarJson(`https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/index.json`)
  const files = index?.directory?.item ?? []
  const table = files.find((f) => /infotable.*\.xml$/i.test(f.name)) ?? files.find((f) => /\.xml$/i.test(f.name) && !/primary_doc/i.test(f.name))
  if (!table) throw new Error('no info table')
  const xml = await edgarText(`https://www.sec.gov/Archives/edgar/data/${cikNum}/${acc}/${table.name}`)
  const positions = new Map()
  const re = /<(?:\w+:)?cusip>([^<]+)<\/(?:\w+:)?cusip>[\s\S]*?<(?:\w+:)?sshPrnamt>([\d.]+)<\/(?:\w+:)?sshPrnamt>/g
  let m
  while ((m = re.exec(xml))) {
    const cusip = m[1].trim()
    positions.set(cusip, (positions.get(cusip) ?? 0) + Number(m[2]))
  }
  if (positions.size === 0) throw new Error('empty info table')
  return positions
}

/** Real position changes between the last two quarterly filings. */
function diffPositions(prev, curr) {
  let changes = 0
  for (const [cusip, shares] of curr) {
    const before = prev.get(cusip)
    if (before === undefined) changes++ // new position
    else if (Math.abs(shares - before) / before > 0.005) changes++ // resized
  }
  for (const cusip of prev.keys()) if (!curr.has(cusip)) changes++ // closed
  return changes
}

async function checkOne(pilotId, { cik, manager }) {
  try {
    const json = await edgarJson(`https://data.sec.gov/submissions/CIK${cik}.json`)
    const recent = json?.filings?.recent
    if (!recent?.form) return
    const idxs = []
    recent.form.forEach((f, i) => {
      if ((f === '13F-HR' || f === '13F-HR/A') && idxs.length < 2) idxs.push(i)
    })
    if (idxs.length === 0) return
    const [i0, i1] = idxs
    const filing = {
      form: recent.form[i0],
      filedAt: recent.filingDate[i0],
      accession: recent.accessionNumber[i0],
      manager,
      positionChanges: null,
      holdingsCount: null,
      checkedAt: Date.now(),
    }

    const prev = latest.get(pilotId)
    if (prev && prev.accession !== filing.accession) {
      console.log(`[filings] NEW 13F for ${manager}: filed ${filing.filedAt} (${filing.accession})`)
    }

    // real quarter-over-quarter trade count from the actual info tables
    if (prev?.accession === filing.accession && prev.positionChanges !== null) {
      filing.positionChanges = prev.positionChanges // already computed for this filing
      filing.holdingsCount = prev.holdingsCount
    } else if (i1 !== undefined) {
      try {
        const curr = await holdingsOf(cik, recent.accessionNumber[i0])
        await new Promise((r) => setTimeout(r, 300))
        const before = await holdingsOf(cik, recent.accessionNumber[i1])
        filing.positionChanges = diffPositions(before, curr)
        filing.holdingsCount = curr.size
      } catch (e) {
        console.warn(`[filings] ${manager} info table: ${e.message}`)
      }
    }
    latest.set(pilotId, filing)
  } catch (e) {
    console.warn(`[filings] ${manager}: ${e.message}`)
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
