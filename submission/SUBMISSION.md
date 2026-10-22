# Margqo — Strike Hackathon submission pack

**Deadline: Fri Oct 23, 2026, 10:00 AM ET = 15:00 WAT. Submit well before — the form was still "Coming Soon" in the Medium article as of Oct 22, so watch Strike's Discord/official channels for the live link.**

## Form copy (paste-ready)

- **Project name:** Margqo
- **Tagline:** Know your distance. Save your position.
- **Repo:** https://github.com/ahmardchain/margqo
- **Live demo:** _(add Vercel URL after Ahmard imports the repo — see blockers)_
- **Description (short):**
  Margqo is a liquidation-distance guardian for Strike Finance perpetuals. Strike shows traders a liquidation price; Margqo turns it into what actually matters — distance to liquidation in %, a health score, hourly/daily funding bleed at Strike's live funding rate, and a priced rescue plan: add exactly $X of margin or cut exactly Y% of size to get back to a target distance. All market data (markets, margin tiers, mark prices, funding) is fetched live from Strike's mainnet API, and the liquidation math mirrors Strike's official builder-reference formulas.
- **How it integrates Strike (meaningful integration):**
  Live server-side client against Strike mainnet: `GET /v2/markets` (margin tiers), `GET /price/v2/markPrice` (mark/index/hourly funding), `GET /v2/time`; depth and klines endpoints verified and included. The risk engine implements the exact liquidation-price / IM / MM / funding formulas from Strike's official `strike-builder-reference` repo. Authenticated positions (`GET /v2/positions`, 401 without an API wallet) are documented and env-gated with an honest 501 — no fabricated account data.
- **What's new/different:** Existing Strike projects cover dashboards (Hizz), copy trading (Bolt, Copilot) and terminals (GeroWallet). Margqo is the position-survival layer none of them provide: distance + funding bleed + a verified rescue solver + shock table.
- **Tech:** Next.js 16, React 19, Tailwind v4, pure-function risk engine with unit tests (10 passing), production build green.

## 2.5-minute demo video script

1. **(0:00–0:20) The problem.** "Every Strike trader sees a liquidation price. Almost none can tell you their distance to it, what funding costs them per day, or what it takes to be safe again. That's how one wick ends an account."
2. **(0:20–0:45) Live proof.** Home page: "This tape and markets table are live Strike mainnet data right now — here's the same ADA mark from curl against api.strikefinance.org. No mocks."
3. **(0:45–1:30) The guardian.** Click the DEMO preset "ADA long, tight": "20,000 ADA long, entry 0.238, $420 margin. Margqo says: distance X%, status DANGER, funding $Y a day, liquidation at Z — computed with Strike's own margin tiers, the same formula from their builder-reference repo."
4. **(1:30–2:05) The rescue.** "I want 20% distance. Rescue A: add $N margin. Rescue B: cut P% of the position. Both are solved exactly and verified by recomputing the liquidation price. And the shock table shows me at −10%, −20%, −30% before the candle prints."
5. **(2:05–2:30) Honesty + future.** "Margqo holds no keys and places no trades. Authenticated position import via Strike's API-wallet flow is built as a gated layer — it returns 501 until you configure your own wallet, because fake positions would be lying. Next: WebSocket alerts when a position crosses into DANGER. Margqo — know your distance, save your position."

## Checklist

- [x] Working MVP: live markets + guardian + rescue + shocks
- [x] Meaningful Strike integration (live mainnet API + Strike's own math) — documented in docs/STRIKE_INTEGRATION.md
- [x] Unit tests pass (10/10), production build green, prod-server smoke test done
- [x] Public GitHub repo pushed and verified
- [x] README with live-vs-demo honesty table and judge verification steps
- [ ] Live demo URL (Vercel import — Ahmard's gate, see below)
- [ ] Demo video recorded (script above)
- [ ] Submission form submitted before Fri Oct 23, 15:00 WAT (form link pending from Strike)

## Blockers that are Ahmard's

1. **Submission form:** the Medium article listed it as "Coming Soon" — join/check Strike's Discord and official channels for the live form, then submit with the copy above.
2. **Demo video:** record the 2.5-min script (screen + voice).
3. **Vercel:** import `github.com/ahmardchain/margqo` once at vercel.com/new (project creation via the connector is blocked on his team grant — same as Turno/Rateqo). No env vars required for the live public-API features.
4. **Optional:** if he wants authenticated position import demoed, create a Strike API wallet via the builder-connect flow and set `STRIKE_API_WALLET_*` in his own deployment env — never share the secret key.
