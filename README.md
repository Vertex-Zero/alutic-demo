# Alutic

> Auto copy-trade the smart money onchain. Politicians, hedge-fund legends and AI models, mirrored to your own
> wallet through tokenized stocks. **$0/month · $0 deposit fee · 0.25% per executed trade.**

A full-stack product: **React + TypeScript + Vite + Tailwind CSS v4** frontend and a **Node.js (Express) backend**
that owns accounts, streams **live market prices**, and runs the autopilot trade engine server-side. The thesis:
take the model behind subscription copy-trading apps (Autopilot, eToro), remove the brokerage, the per-portfolio
minimum and the monthly fee by using tokenized assets onchain, and monetize with a single transparent
**25 bps fee on every executed trade**.

## Deploy on Render

The repo ships with `render.yaml`: in Render choose **New + > Blueprint**, point it at this repo, and it builds
(`npm ci && npm run gen && npm run build`) and serves everything (site + API) from one Node service with
`/api/health` as the health check. `FEE_RECIPIENT` and `SOLANA_RPC` are set as environment variables.

Two things to know before real traffic:
- The free plan's disk is ephemeral: accounts, vaults, and the fee ledger (`server/*.json`) reset on each deploy,
  and the treasury keypair is regenerated. Attach a persistent disk or move state to a database before taking
  real deposits.
- Keep `server/treasury.json` and `server/deposits.json` secret wherever they live; they hold private keys.
  They are gitignored and never leave the server.

## Run it

```bash
npm install
npm run dev      # frontend on http://localhost:5173 + API on :8787, together
```

Other scripts:

```bash
npm run server   # API only (port 8787)
npm run start    # production: builds the frontend and serves it + the API from :8787
npm run build    # typecheck + build frontend to dist/
```

## Architecture

```
src/                     React SPA (the product)
  lib/store.tsx          API client: wallet connect, portfolio polling (6s), price polling (30s)
  data/pilots.ts         The 14 pilot portfolios (source of truth, shared with the server)
server/
  index.js               Express REST API + static serving in production
  prices.js              Live price feed: Yahoo Finance -> Stooq fallback -> synthetic offline fallback,
                         refreshed every 60s, keyed by tokenized ticker (NVDAx, AAPLx, ...)
  engine.js              The autopilot: unit-based positions bought at live prices, mirror trades on each
                         pilot's cadence, 25 bps fee per execution, server-enforced stop-losses,
                         JSON persistence (server/db.json)
  pilots.gen.mjs         Generated from src/data/pilots.ts by esbuild (npm run gen)
```

### API

| Endpoint | What it does |
|---|---|
| `GET /api/health` | Status + live-quote coverage |
| `GET /api/prices` | Live quotes for every tokenized ticker (+ SOL) |
| `GET /api/history?pilotId=&range=` | Real chart series: weighted composite of the pilot's holdings' actual price history (Yahoo daily closes) |
| `GET /api/history?address=&range=` | The same composite across an account's positions |
| `GET /api/pilots` | Every pilot (built-in + community vaults) with stats computed from real market history and real platform copiers/AUM |
| `POST /api/vaults` `{address, name, description, allocations}` | Create a community vault; creator earns **half of every copier's trade fee**, credited to their balance in real time |
| `GET /api/auth/message?address=` | The one-time autopilot authorization message for the wallet to sign |
| `POST /api/portfolio/connect` `{address, signature?, nonce?}` | Create/fetch the account; verifies the ed25519 signature and marks the account authorized |
| `GET /api/portfolio?address=` | Account snapshot: balance, positions (valued live), trade ledger, fees |
| `POST /api/deposit` `{address, amount}` | Fund the account (free) |
| `POST /api/copy` `{address, pilotId, allocation, stopLoss, copyMode}` | Buy the pilot's basket at live prices, start the autopilot |
| `POST /api/stop` `{address, pilotId}` | Liquidate the basket back to USDC |
| `GET /api/fees` | Protocol revenue: accrued fees, treasury address/balance, settlements |
| `POST /api/fees/settle` | Batch-settle pending fees on-chain to your Solana address |
| `GET /api/deposit-address?address=` | The account's personal Solana deposit address; real SOL/USDC deposits credit automatically (~30s watcher) |
| `GET /api/execution/status` | Venue status: real xStock mints resolved on Jupiter, trading mode (paper/live) |
| `GET /api/execution/quote?ticker=&usd=` | Real Jupiter router quote (mint, shares out, price impact, route) |

## Wallet & no-popup auto-trading

Connect is **Phantom-first** (real Solana wallet): one click to connect, then **one** `signMessage`
authorization, verified server-side with ed25519 (tweetnacl). After that single signature there are no wallet
popups ever — the engine executes trades server-side. MetaMask (EIP-1193) and a generated session address are
fallbacks. When real funds move, the same one-approval UX maps to an SPL token **delegate approval** (capped at
the user's allocation, trade-only, revocable).

## Fees to your Solana address

Every executed trade accrues its 0.25% fee to the protocol revenue ledger (`server/revenue.json`). Fees settle
on-chain **in batches** (a 3-cent fee shouldn't pay its own network fee): `POST /api/fees/settle` transfers the
pending USD amount as SOL, converted at the live SOL price, from the server treasury to your address.

Setup:
1. Put your Solana address in `server/config.json` → `"feeRecipient": "YOUR_ADDRESS"` (or env `FEE_RECIPIENT`).
2. The treasury keypair auto-generates at `server/treasury.json` (keep it secret). Fund it — on devnet:
   `solana airdrop 2 <treasuryAddress> -u devnet`. Default RPC is devnet; set `SOLANA_RPC` to mainnet to go live.
3. `GET /api/fees` shows accrued/pending/settled and the treasury balance; `POST /api/fees/settle` executes a
   real transfer and returns the transaction signature.

## How the engine works

- **Copying** buys the pilot's holdings as real units at live prices (97% invested, 3% USDC sleeve for
  rebalances). Position value = units × live price, so P&L moves with the market.
- **The autopilot tick** (every 5s) mirrors each copied pilot at ~2400× its real trade cadence, buying and
  selling against the cash sleeve. Every execution charges the 0.25% protocol fee and lands in the ledger.
- **Stop-losses are enforced server-side**: if a position's value drops through the floor, the engine
  liquidates it automatically.
- **Prices** come from Yahoo Finance (with Stooq as backup). With no internet, a deterministic synthetic
  walk keeps the product fully usable.

## The business model (as designed)

- **No platform token, no proprietary chain, on purpose.** Users connect their own wallet; funds sit in the
  user's own smart account as USDC.
- **Auto-trading without custody:** the user grants the execution engine a *session key* scoped to one
  permission: swapping whitelisted tokenized stocks within the user's allocation. It can never withdraw.
- **Revenue = 0.25% of each executed trade** (entry basket, every auto-mirrored trade, exit), charged at
  execution. No subscription, no deposit/withdrawal fee, no AUM fee, no profit share.

## Pilots & community vaults

14 built-in portfolios across four categories: **Politician** (Pelosi, Tuberville, Khanna, Capitol Bulls),
**Hedge Fund** (Buffett, Burry, Ackman, Dalio, Cohen, Druckenmiller, Renaissance), **AI** (AI Alpha/Claude,
DeepSeek Fund) and **Index** (Inverse Cramer) — plus **Community vaults**: anyone can create a vault
(`/create`), it lists on the leaderboard, and the creator earns half of every trade fee copiers pay
(Hyperliquid-style creator economics).

**Nothing displayed is fabricated:** returns, Sharpe, max drawdown and win rate are computed from the real 1y
price history of each portfolio's holdings; copier counts and AUM are actual platform numbers.

## Design

Playful, game-like system: Nunito + Feather Bold display, cash-green primary on white, navy dark panels,
chunky 3D buttons, 2px-border rounded cards, uniform neutral chips, single-color charts.

## Real funds

- **Deposits are real:** every account gets its own Solana deposit address (`server/deposits.json` holds the
  keys — protect it). A watcher polls the chain and credits SOL/USDC deposits at the live price. Devnet by
  default; set `SOLANA_RPC` to mainnet to accept real value.
- **The venue is real:** the server resolves the actual xStock mints on Solana mainnet via Jupiter (35 of our
  tickers exist as xStocks) and fetches real, executable swap quotes (e.g. $250 → 1.27 NVDAx via Raydium CLMM).
- **Execution is gated:** the swap-execution path is implemented but requires `LIVE_TRADING=yes` plus a funded
  custody wallet. Until then fills are simulated at real market prices.

## Status & disclaimer

Deposits and quotes are live; order execution ships behind the `LIVE_TRADING` gate. Before enabling it you are
operating a fee-collecting trading service for other people's money: get securities-law advice first (xStocks
are also geo-restricted in some jurisdictions, including for US persons at issuance). Nothing here is investment
advice. Politician and fund portfolios approximate the latest public filings (STOCK Act, 13F) and are subject to
disclosure lag. All displayed statistics are computed from real market data; copier counts and AUM are actual
platform numbers. Alutic is not affiliated with any named individual, fund, or model provider.
