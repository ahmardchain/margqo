# Margqo

**Know your distance. Save your position.**

Margqo is a liquidation-distance guardian for **Strike Finance** perpetuals, built for the first Strike Hackathon (Oct 21–23, 2026).

Strike's own UI gives you a liquidation price. A number. What it doesn't give you is what that number *means* for your money, or what to do about it before the wick arrives. Margqo does exactly that one job:

1. **Distance, not just a price** — your liquidation distance in %, a 0–100 health score, and a plain status (SAFE / WATCH / DANGER / CRITICAL / LIQUIDATED), computed from Strike's real margin tiers.
2. **Funding bleed** — what your position pays or earns per hour and per day at Strike's live hourly funding rate.
3. **A priced rescue** — pick a target distance (e.g. 20%) and Margqo computes the two ways back to safety: **add exactly $X of isolated margin**, or **cut exactly Y% of the position**. Both plans are verified by recomputing the liquidation price with the plan applied.
4. **Shock table** — your status at −30% … +30% mark moves, so the rescue happens *before* the candle, not during it.

## Why this wedge?

The Strike ecosystem already has a dashboard/activity tracker (Hizz), copy trading (Bolt, Strike Copilot) and grid bots. Nobody owns **position survival**. Perps traders don't lose money because they lacked a chart — they lose it in one violent candle, staring at a liquidation price they never translated into a distance or a plan. Margqo is the translation layer, and it is deliberately *not* a Tavren-style loan monitor clone: the math, failure mode and rescue are perps-specific (hourly funding, margin tiers by notional, signed-size liquidation formula).

## Live vs demo — honestly

| Layer | Status |
|---|---|
| Strike markets, margin tiers | **LIVE** — `GET https://api.strikefinance.org/v2/markets` |
| Mark price, index, hourly funding rate | **LIVE** — `GET https://api.strikefinance.org/price/v2/markPrice` |
| Server time | **LIVE** — `GET /v2/time` |
| Depth, klines | **LIVE-verified** endpoints, client included (`lib/strike.ts`) |
| Liquidation / IM / MM / funding math | **Real** — mirrors Strike's official `strike-builder-reference` formulas |
| Your position | **You enter it** (symbol / side / size / entry / margin). Preset buttons are clearly labelled DEMO positions. Margqo holds no keys and places no trades. |
| Authenticated position import | **Env-gated, honest 501** — Strike's `GET /v2/positions` requires the user's own API wallet (Ed25519 headers from the builder-connect flow). `GET /api/positions` returns 501 until `STRIKE_API_WALLET_*` is set. No fabricated account data anywhere. |
| Testnet (`api-v2-testnet.strikefinance.org`) | Probed 2026-10-22: intermittent — `/v2/time` timed out but `/v2/markets` responded once. Mainnet public API is the live integration surface. |

Full integration notes: [`docs/STRIKE_INTEGRATION.md`](docs/STRIKE_INTEGRATION.md).

## How a judge verifies it

1. Run the app (below), open the home page — the tape and markets table are live Strike mainnet data (compare any mark price against `curl https://api.strikefinance.org/price/v2/markPrice?symbol=ADA-USD`).
2. Enter the demo preset "ADA long, tight" and hit **Score my position** — the liquidation price, distance and rescue numbers come from `POST /api/analyze`, which fetches live tiers + mark server-side.
3. Cross-check the math against Strike's own reference repo (`strike-finance/strike-builder-reference`, `src/math`) — Margqo's `lib/engine.js` implements the same formulas and is covered by unit tests.
4. `curl localhost:3000/api/positions` → honest 501 with the reason, not fake positions.

## Run it

```bash
npm install
npm run build && npm start   # or: npm run dev
npm test                     # engine unit tests (node --test)
```

Optional env: `STRIKE_API_URL` (defaults to `https://api.strikefinance.org`).

## Stack

Next.js 16 (App Router) + React 19 + Tailwind CSS v4. shadcn-style card/table components and a Magic UI-style NumberTicker + marquee tape, implemented in-repo (no component-library dependency). Pure-function risk engine in `lib/engine.js`, Strike client in `lib/strike.ts`, API routes in `app/api/`.

## Roadmap (future potential)

- API-wallet position import (builder-connect flow) so positions load themselves.
- WebSocket mark streaming (`wss://api.strikefinance.org/ws/price`) + distance alerts (Telegram/Discord) when a position crosses WATCH → DANGER.
- Cross-margin mode (the engine currently models isolated positions; Strike's cross formulas are documented in the same reference).
- Funding-regime scanner across all Strike markets (annualised funding outliers worth farming or avoiding).

*Not financial advice. Margqo is a risk calculator, not a trading product.*
