# Strike integration — what was found, what is real, what is gated

Researched and verified live on **2026-10-22** (during the hackathon window).

## Sources

- Hackathon article: https://medium.com/@strikecardano/strike-hackathon-starts-this-wednesday-3-000-in-prizes-158a029d655e
- Strike site: https://www.strikefinance.org
- Strike docs: https://docs.strikefinance.org (e.g. Risk Management page — hourly borrow/funding fee design)
- Official GitHub org: https://github.com/strike-finance
  - `strike-builder-reference` — React+TS reference app for the Builder Codes API; source of the endpoint map, auth scheme and all trading math used here. Updated 2026-10-19.
  - `strike-finance-skills` — OpenAPI specs (`openapi/market-api.yaml`, `trade-api.yaml`, `user-api.yaml`) and skills (market-data, orderbook, price-feeds, calculations, copy-trading, grid-bot, vaults…).
  - `perpetuals-smart-contracts`, `strike-sdk-v1` (Cardano/Lucid SDK: open/close position, provide/withdraw liquidity — v1 on-chain flow; the builder API above is the v2 surface Margqo targets).
- DefiLlama protocol page (context): Strike Finance Perpetuals, ~$2.35M TVL, ~$216M 30d perps volume as of Oct 21, 2026; chains Cardano (91.5%), Ethereum.

## Verified live endpoints (mainnet, no auth, 2026-10-22)

| Endpoint | Result | Used for |
|---|---|---|
| `GET https://api.strikefinance.org/v2/time` | 200 `{"serverTime": …}` | venue liveness/clock |
| `GET https://api.strikefinance.org/v2/markets` | 200, markets object with `margin_tiers[]` (max_notional, max_leverage, maintenance_margin_rate, maintenance_amount) | tiers, leverage caps |
| `GET https://api.strikefinance.org/price/v2/markPrice` | 200, array of `{e,E,s,p,i,r,T}` (mark, index, hourly funding `r`, next funding `T`) | live marks + funding |
| `GET …/price/v2/markPrice?symbol=ADA-USD` | 200 single object | per-market mark (ADA ≈ $0.2237 at probe time) |
| `GET …/price/v2/depth?symbol=ADA-USD` | 200 order-book depth | client included, not surfaced in MVP UI |
| `GET …/price/v2/klines?symbol=ADA-USD&interval=1h` | 200 kline arrays | client included, not surfaced in MVP UI |
| `GET …/v2/positions` (no auth) | **401** `{"error":"authentication required or provide vault_id, account_id, or blockchain_address"}` | proves account data is auth-gated — Margqo does not fake it |
| `GET …/stat/v1/leaderboard` | 404 at the guessed path — **not used** (path unverified; the builder reference says the stats service exists at `/stat` but does not give this route) | — |
| Testnet `https://api-v2-testnet.strikefinance.org/v2/time` + `/v2/markets` | intermittent at probe time — `/v2/time` timed out (HTTP 000) but `/v2/markets` responded once with ADA-USD testnet data at probe time | mainnet is the integration surface |

WebSockets documented in the builder reference (not used in MVP): `wss://api.strikefinance.org/ws/price` (public market data), `wss://api.strikefinance.org/ws/user-api` (API-wallet user stream).

## Auth model (for the gated layer)

Authenticated REST uses API-wallet headers (Ed25519):
`X-API-Wallet-Public-Key`, `X-API-Wallet-Signature`, `X-API-Wallet-Timestamp`, `X-API-Wallet-Nonce`; signature message `{METHOD}:{PATH}:{TIMESTAMP}:{NONCE}:{BODY_HASH}` (SHA-256 hex of raw body). API wallets are created via the builder-connect flow: `POST /auth/builder/request-signature` → wallet signs `message_to_sign` (Cardano: CIP-30 signData) → `POST /auth/builder/verify-signature`.

Margqo's stance: a user's API wallet is *their* credential. The MVP never asks for it in the browser; `GET /api/positions` checks `STRIKE_API_WALLET_PUBLIC_KEY` / `STRIKE_API_WALLET_SECRET_KEY` (server env, user's own deployment) and returns an honest **501** when unset.

## Math provenance

All formulas in `lib/engine.js` mirror `strike-builder-reference/src/math` (spec: Strike backend `docs/CALCULATION_SPECS.md`):

- `notional = mark × |size|`; `uPnL = (mark − entry) × size` (signed size)
- Tier: first tier with `notional ≤ max_notional`, else last tier → MMR, MA
- `MM = notional × MMR − MA`; `IM = notional / leverage`
- Liquidation price (isolated): `LP = (EP − (W + MA)/size) / (1 − dir × MMR)`, `LP ≤ 0` ⇒ no liquidation price
- Funding (hourly, at HH:00 UTC): `funding = −size × mark × hourlyRate`; positive rate ⇒ longs pay

Margqo extensions (original, tested): liquidation **distance %**, health score, funding per day, **rescue solvers** (add-margin and reduce-size, each verified by recomputation in unit tests), and the shock table. Reduce-size rescue documents its approximation (realised PnL on the closed fraction is ignored).

## Existing ecosystem (wedge check)

Named in the hackathon article / found in research: **Bolt** (memecoin that copy-trades and buys STRIKE), **Strike Copilot** (global copy trading), **Hizz** (perps dashboard + activity tracker), GeroWallet (in-wallet Strike terminal), community STRIKE yield calculator. Copy trading, dashboards, terminals and yield calculators are taken. **Position-survival / liquidation-distance guarding with a priced rescue was not found in the ecosystem** — that is Margqo's wedge.
