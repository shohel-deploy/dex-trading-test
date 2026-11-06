# Axonion

A full-stack, real-time crypto **DEX** — real matching engine, perpetual futures and spot, USDC-settled — running on **live market data**. The only thing that isn't real money is the demo faucet balance (testnet-style).

The product name in the app is **Axonion**. The repo and packages stay under `dex` / `@dex`.

> Spot markets mirror **Upbit's real USDT order books** (about 191 markets, shown as `BASE-USDC`). Perps use **Hyperliquid's real markets** (30). Prices, order-book depth (price **and** size, up to 30 levels), candles, trades, 24h stats, and funding are fetched live — never mocked, never hardcoded.

![Axonion landing page](./landing.png)

## What's real

| Data | Source | Notes |
| --- | --- | --- |
| Spot price / order book / trades / candles | **Upbit** USDT markets, live WS + REST | book is a mirror of the venue (prices **and** sizes), up to 30 levels (`USDT-BTC.30`) |
| Perp price / order book / trades / funding | **Hyperliquid** live WS + REST | 30 markets, real funding rates. Hyperliquid's book is shallower than 30, so those markets show every level the venue sends |
| Coin universe + English names + tick/lot/leverage | real exchange metadata | ~191 spot + 30 perp |
| Wallet auth | any injected Ethereum wallet (EIP-6963 + legacy `window.ethereum`) | EIP-191 `personal_sign` → JWT. The API verifies the signature with `viem`. The browser does not ship `viem` |
| Database | Postgres engine (PGlite by default) | durable event-sourced projection |
| **Balances** | **demo faucet (testnet-style)** | the only non-real value |

The order book you see is the venue's: a user's bid rests inside the real spread and only fills when the real market crosses it. A feed-staleness gate takes a book **down** (rather than serving a frozen one as "live") when the source WebSocket drops.

A desktop browser with an Ethereum extension can connect (MetaMask, Rabby, Trust, Coinbase, Phantom, OKX, and any other wallet that announces EIP-6963 or injects a provider). A phone can connect when the site is opened inside that wallet's own browser. A normal mobile Safari or Chrome tab has no injected wallet. Solana-only and Bitcoin-only wallets cannot sign this login.

## Features

- **Matching engine** — price-time priority limit order book; `limit`/`market`, `GTC`/`IOC`/`FOK`, `postOnly`/`reduceOnly`, self-trade prevention.
- **Perpetuals** — isolated margin, leverage, volume-weighted entry, **tiered maintenance margin** (bigger positions liquidate with more buffer), hourly funding (zero-sum, rounding-exact).
- **Manipulation-resistant mark price** — the perp mark is a **median of multiple real venues** (Hyperliquid mid + OKX swap + Coinbase spot) smoothed by an EMA, so no single source can move it; liquidations trigger on it.
- **Liquidation waterfall** — maintenance liquidation → insurance fund → **ADL** (auto-deleverage profitable counterparties, haircut by deficit share) → house clearing. No user is ever pushed negative; the house absorbs only the irreducible remainder.
- **Money conservation** — proven by property tests: assets + fees + clearing always equal net deposits, after every operation; bad debt is confined to the house account.
- **Platform UI** — dark landing, markets, portfolio, and docs, plus a trading terminal. One shared market feed drives every page. The candlestick chart (klinecharts: MA/EMA/BOLL/VOL/MACD/RSI/KDJ) loads only on `/trade`.
- **Terminal** — pair button opens a virtualized market menu (search, USDC, PERP). Chart, 30-level book, and order ticket sit on one screen. Positions, open orders, fills, balances, funding, and PnL sit under the chart.
- **Portfolio** — signed out, live prices for the main markets. Signed in, equity, positions, liquidation prices, balances, open orders, recent fills, and the same demo USDC faucet as the terminal.
- **Production hardening** — JWT auth, per-IP rate limiting, `@fastify/under-pressure` load shedding, `prom-client` Prometheus metrics (`/api/metrics`), generated OpenAPI docs (`/api/docs`), `@fastify/helmet` security headers, pino structured logging, write-ahead fail-stop durability, graceful restore-on-restart.

## Architecture (TypeScript monorepo, pnpm workspaces)

```
packages/
  shared        types, zod schemas, fixed-point bigint math (everything is 1e8-scaled bigint — never float)
  engine        pure, deterministic matching engine + margin/liquidation/funding (no I/O)
  db            Drizzle ORM + PGlite; event projector + boot restore
  market-data   Upbit + Hyperliquid + OKX + Coinbase connectors (real data, multi-source oracle)
apps/
  api           Fastify 5 REST + WebSocket; wires market-data → engine → db
  web           Vite + React 19 (landing, markets, portfolio, docs, terminal). Tailwind CSS v4 is wired for the UI
e2e             Playwright end-to-end tests against the real stack
```

- Unit, fast-check **property** tests (fund conservation, book integrity, reference-matcher cross-check, liquidation solvency, ADL, manipulation-resistant mark aggregation), real-PGlite integration, **live** tests against the real Upbit / Hyperliquid / OKX / Coinbase APIs, and a Playwright e2e suite driving the real stack.

## Run it

Requires **Node 22+** and internet (live market feeds).

```bash
node -v
npx pnpm install
npx pnpm start
```

Open **[http://127.0.0.1:5180](http://127.0.0.1:5180)** or **[http://localhost:5180](http://localhost:5180)** (landing).

Web routes:

- `/` — landing
- `/markets` — market explorer
- `/portfolio` — account hub
- `/docs` — FAQ / product docs
- `/trade` or `/trade/:marketId` — trading terminal

Startup order under `npx pnpm start`:

1. API on `:3001`
2. Web on `:5180` (waits until the API accepts TCP)

- API docs: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)
- Metrics: [http://localhost:3001/api/metrics](http://localhost:3001/api/metrics)
- Ops summary: [http://localhost:3001/api/ops/summary](http://localhost:3001/api/ops/summary)

Optional Postgres (instead of embedded PGlite):

```bash
DATABASE_URL=postgres://user:pass@localhost:5432/dex npx pnpm api
```

Default durable dir remains `DEX_DATA_DIR` / `.pglite-data` when `DATABASE_URL` is unset.

To run services separately (with normal logs): `npx pnpm api` / `npx pnpm web`.
For full logs under start: `DEX_VERBOSE=1 npx pnpm start`.

The API process does not watch files. Restart `npx pnpm start` after changing API or market-data code.

## Build

```bash
npx pnpm build
```

That runs every workspace `build` script:

- `packages/*` — `tsc --noEmit` (these packages are consumed from TypeScript source)
- `apps/api` — no compile step. Production and dev both run `tsx src/index.js`
- `apps/web` — typecheck, then Vite writes the static client to `apps/web/dist`

Web only:

```bash
npx pnpm -C apps/web build
npx pnpm -C apps/web preview
```

`preview` serves `apps/web/dist`. It does not proxy `/api` or `/ws`. Keep `npx pnpm api` running and put the static files behind a host that forwards those paths to `127.0.0.1:3001`, or keep using `npx pnpm start` for local development.

Typecheck without emitting a bundle:

```bash
npx pnpm typecheck
```

Test:

```bash
npx pnpm test        # unit + integration + property (packages + API)
npx pnpm test:live   # live API tests (needs internet)
npx pnpm e2e         # Playwright (boots the real stack)
```

Web unit tests are separate: `npx pnpm -C apps/web test`.

## Disclaimer

This project uses live market **data** but settles trades in **demo faucet balances only** — there is no custody, no real settlement, and no financial advice. Not affiliated with Hyperliquid or Upbit.

## License

MIT — see [LICENSE](LICENSE).
