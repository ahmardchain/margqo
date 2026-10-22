"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import NumberTicker from "@/components/NumberTicker";

type MarketRow = {
  symbol: string; name: string; base: string; defaultLeverage: number;
  mark: number | null; index: number | null; fundingRate: number | null; fundingApr: number | null;
};
type Analysis = any;

const PRESETS = [
  { label: "DEMO · ADA long, tight", symbol: "ADA-USD", side: "long", size: 20000, entry: 0.238, margin: 420 },
  { label: "DEMO · BTC long, comfy", symbol: "BTC-USD", side: "long", size: 0.4, entry: 109000, margin: 9000 },
  { label: "DEMO · ETH short, spicy", symbol: "ETH-USD", side: "short", size: 6, entry: 2380, margin: 1500 },
] as const;

function fmt(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined || !isFinite(n as number)) return "—";
  return (n as number).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pct(n: number | null | undefined, d = 2) {
  if (n === null || n === undefined || !isFinite(n as number)) return "—";
  return `${((n as number) * 100).toFixed(d)}%`;
}
const STATUS_STYLE: Record<string, string> = {
  SAFE: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  WATCH: "text-yellow-300 border-yellow-500/40 bg-yellow-500/10",
  DANGER: "text-orange-300 border-orange-500/40 bg-orange-500/10",
  CRITICAL: "text-red-300 border-red-500/40 bg-red-500/10",
  LIQUIDATED: "text-white border-red-600 bg-red-600",
};
function priceDecimals(v: number) { return v >= 1000 ? 2 : v >= 10 ? 3 : v >= 1 ? 4 : 6; }

export default function Home() {
  const [markets, setMarkets] = useState<MarketRow[]>([]);
  const [marketsMeta, setMarketsMeta] = useState<{ count: number; fetchedAt: number } | null>(null);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [symbol, setSymbol] = useState<string>("ADA-USD");
  const [side, setSide] = useState<"long" | "short">("long");
  const [size, setSize] = useState("20000");
  const [entry, setEntry] = useState("0.238");
  const [margin, setMargin] = useState("420");
  const [target, setTarget] = useState(20);
  const [result, setResult] = useState<Analysis>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const loadMarkets = useCallback(async () => {
    try {
      const r = await fetch("/api/markets");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setMarkets(j.markets); setMarketsMeta({ count: j.count, fetchedAt: j.fetchedAt }); setMarketsError(null);
    } catch (e: any) { setMarketsError(e.message); }
  }, []);

  useEffect(() => { loadMarkets(); const id = setInterval(loadMarkets, 20000); return () => clearInterval(id); }, [loadMarkets]);

  const analyze = useCallback(async (over?: Partial<{ symbol: string; side: string; size: string; entry: string; margin: string }>) => {
    setAnalyzing(true); setAnalyzeError(null);
    try {
      const r = await fetch("/api/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: over?.symbol ?? symbol, side: over?.side ?? side,
          size: Number(over?.size ?? size), entry: Number(over?.entry ?? entry), margin: Number(over?.margin ?? margin),
          targetDistance: target / 100,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      setResult(j);
    } catch (e: any) { setAnalyzeError(e.message); setResult(null); }
    finally { setAnalyzing(false); }
  }, [symbol, side, size, entry, margin, target]);

  const marketsReady = markets.length > 0;
  useEffect(() => { if (marketsReady) analyze(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [marketsReady]);

  const visibleMarkets = useMemo(() => markets.filter((m) => m.symbol.toLowerCase().includes(filter.toLowerCase())), [markets, filter]);
  const a = result?.analysis;
  const tape = markets.filter((m) => m.mark !== null).slice(0, 18);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-lime-400 font-black text-zinc-950">M</div>
          <div>
            <p className="text-lg font-bold leading-none tracking-tight">Margqo</p>
            <p className="text-xs text-zinc-400">Liquidation-distance guardian for Strike perps</p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
          <span className="live-dot h-2 w-2 rounded-full bg-emerald-400" />
          {marketsMeta ? `LIVE · Strike mainnet · ${marketsMeta.count} markets` : "Connecting to Strike…"}
        </div>
      </header>

      {tape.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 py-2" aria-label="Live Strike mark prices">
          <div className="animate-marquee flex w-max gap-8 px-4 text-xs text-zinc-300">
            {[...tape, ...tape].map((m, i) => (
              <span key={i} className="whitespace-nowrap">
                <span className="font-semibold text-zinc-100">{m.symbol}</span>{" "}
                <NumberTicker value={m.mark as number} decimals={priceDecimals(m.mark as number)} />{" "}
                <span className={(m.fundingRate ?? 0) >= 0 ? "text-orange-300" : "text-sky-300"}>fund {pct(m.fundingRate, 4)}/h</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <section className="py-10 text-center sm:py-14">
        <h1 className="mx-auto max-w-3xl text-4xl font-black tracking-tight sm:text-6xl">
          Know your distance.<br /><span className="text-lime-300">Save your position.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-400">
          Strike shows you a liquidation price. Margqo shows you what it <em>means</em> — how far you are in %,
          what funding bleeds you per day, and the exact rescue: <strong className="text-zinc-200">add this much margin</strong> or{" "}
          <strong className="text-zinc-200">cut this much size</strong> to buy back a safe distance. Scored live with Strike&apos;s own margin-tier math.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-5">
        <form
          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-2"
          onSubmit={(e) => { e.preventDefault(); analyze(); }}
        >
          <h2 className="font-bold">Your Strike position</h2>
          <p className="mt-1 text-xs text-zinc-400">
            Enter the terms of a position you hold (or plan) on Strike. Margqo never connects to your wallet in this MVP —
            market data is <span className="text-emerald-300">live from Strike mainnet</span>, the position is yours.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button"
                onClick={() => { setSymbol(p.symbol); setSide(p.side as any); setSize(String(p.size)); setEntry(String(p.entry)); setMargin(String(p.margin)); analyze({ symbol: p.symbol, side: p.side, size: String(p.size), entry: String(p.entry), margin: String(p.margin) }); }}
                className="rounded-full border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-300 hover:border-lime-400/60 hover:text-lime-200">
                {p.label}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs font-medium text-zinc-300">Market (live Strike markets)
            <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm">
              {markets.map((m) => <option key={m.symbol} value={m.symbol}>{m.symbol} — {m.name}</option>)}
            </select>
          </label>
          <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Side">
            {(["long", "short"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setSide(s)}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold capitalize ${side === s ? (s === "long" ? "border-emerald-400 bg-emerald-400/10 text-emerald-200" : "border-red-400 bg-red-400/10 text-red-200") : "border-zinc-700 text-zinc-400"}`}>
                {s}
              </button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <label className="block text-xs font-medium text-zinc-300">Size (base)
              <input value={size} onChange={(e) => setSize(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-zinc-300">Entry price
              <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /></label>
            <label className="block text-xs font-medium text-zinc-300">Margin (USD)
              <input value={margin} onChange={(e) => setMargin(e.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" /></label>
          </div>
          <label className="mt-4 block text-xs font-medium text-zinc-300">Rescue target distance: <span className="text-lime-300">{target}%</span>
            <input type="range" min={5} max={50} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="mt-1 w-full accent-lime-400" /></label>
          <button disabled={analyzing} className="mt-4 w-full rounded-lg bg-lime-400 px-4 py-2.5 font-bold text-zinc-950 disabled:opacity-50">
            {analyzing ? "Scoring against live Strike data…" : "Score my position"}
          </button>
          {analyzeError && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">{analyzeError}</p>}
          <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
            Math mirrors Strike&apos;s published formulas (margin tiers from <span className="font-mono">GET /v2/markets</span>, liquidation price from the official builder reference).
            Reduce-size rescue ignores realised PnL on the closed part — documented approximation. Not financial advice.
          </p>
        </form>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 lg:col-span-3" aria-live="polite">
          {!a && <p className="text-sm text-zinc-400">{analyzing ? "Scoring…" : "Your distance, health and rescue plan will appear here."}</p>}
          {a && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">{a.symbol} · <span className="capitalize">{a.side}</span></h2>
                <span className={`rounded-full border px-3 py-1 text-xs font-bold ${STATUS_STYLE[a.status]}`}>{a.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 p-3"><p className="text-[11px] uppercase tracking-wide text-zinc-500">Distance to liq.</p>
                  <p className="mt-1 text-2xl font-black">{a.distancePct === null ? "∞" : pct(a.distancePct, 1)}</p>
                  <p className="text-xs text-zinc-400">health {a.health}/100</p></div>
                <div className="rounded-xl border border-zinc-800 p-3"><p className="text-[11px] uppercase tracking-wide text-zinc-500">Mark (live)</p>
                  <p className="mt-1 text-2xl font-black"><NumberTicker value={a.mark} decimals={priceDecimals(a.mark)} /></p>
                  <p className="text-xs text-zinc-400">index {fmt(a.index, priceDecimals(a.index))}</p></div>
                <div className="rounded-xl border border-zinc-800 p-3"><p className="text-[11px] uppercase tracking-wide text-zinc-500">Liquidation price</p>
                  <p className="mt-1 text-2xl font-black">{a.liquidationPrice === null ? "none" : fmt(a.liquidationPrice, priceDecimals(a.liquidationPrice))}</p>
                  <p className="text-xs text-zinc-400">tier MMR {pct(a.tier.mmr, 2)}</p></div>
                <div className="rounded-xl border border-zinc-800 p-3"><p className="text-[11px] uppercase tracking-wide text-zinc-500">uPnL</p>
                  <p className={`mt-1 text-2xl font-black ${a.upnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>{a.upnl >= 0 ? "+" : "−"}${fmt(Math.abs(a.upnl))}</p>
                  <p className="text-xs text-zinc-400">notional ${fmt(a.notional)} · lev {a.leverage ? `${fmt(a.leverage, 1)}x` : "—"} (max {a.maxLeverage}x)</p></div>
              </div>
              <div className="mt-4">
                <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div className={`h-full rounded-full ${a.health >= 70 ? "bg-emerald-400" : a.health >= 40 ? "bg-yellow-400" : a.health >= 20 ? "bg-orange-400" : "bg-red-500"}`} style={{ width: `${a.health}%` }} />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-zinc-500"><span>liquidation</span><span>funding {a.fundingPerHour >= 0 ? "+" : "−"}${fmt(Math.abs(a.fundingPerHour), 4)}/h · {a.fundingPerDay >= 0 ? "+" : "−"}${fmt(Math.abs(a.fundingPerDay))}/day</span><span>safe</span></div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-lime-400/30 bg-lime-400/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-lime-300">Rescue A · Add margin</p>
                  {result.rescue.addMargin.feasible ? (
                    result.rescue.addMargin.addMargin > 0 ? (
                      <p className="mt-2 text-sm">Add <strong className="text-xl text-lime-200">${fmt(result.rescue.addMargin.addMargin)}</strong> isolated margin to reach <strong>{target}%</strong> distance (new LP ≈ {fmt(result.rescue.addMargin.targetLp, priceDecimals(a.mark))}).</p>
                    ) : <p className="mt-2 text-sm text-zinc-300">No top-up needed — already beyond {target}% distance.</p>
                  ) : <p className="mt-2 text-sm text-zinc-300">{result.rescue.addMargin.reason}</p>}
                </div>
                <div className="rounded-xl border border-sky-400/30 bg-sky-400/5 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-sky-300">Rescue B · Cut size</p>
                  {result.rescue.reduceSize.feasible ? (
                    result.rescue.reduceSize.cutFraction > 0 ? (
                      <p className="mt-2 text-sm">Close <strong className="text-xl text-sky-200">{pct(result.rescue.reduceSize.cutFraction, 0)}</strong> of the position (down to {fmt(result.rescue.reduceSize.newSize, 4)} {a.symbol.split("-")[0]}) to reach <strong>{target}%</strong> distance.</p>
                    ) : <p className="mt-2 text-sm text-zinc-300">No cut needed — already beyond {target}% distance.</p>
                  ) : <p className="mt-2 text-sm text-zinc-300">{result.rescue.reduceSize.reason}</p>}
                </div>
              </div>
              <div className="mt-5 overflow-x-auto">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">Shock test — if mark moves…</p>
                <table className="mt-2 w-full text-left text-xs">
                  <thead><tr className="text-zinc-500"><th className="py-1 pr-3">Move</th><th className="py-1 pr-3">Mark</th><th className="py-1 pr-3">Distance</th><th className="py-1 pr-3">Health</th><th className="py-1 pr-3">uPnL</th><th className="py-1">Status</th></tr></thead>
                  <tbody>
                    {result.shocks.map((s: any) => (
                      <tr key={s.movePct} className="border-t border-zinc-800">
                        <td className="py-1.5 pr-3 font-semibold">{s.movePct > 0 ? "+" : ""}{Math.round(s.movePct * 100)}%</td>
                        <td className="py-1.5 pr-3 tabular-nums">{fmt(s.mark, priceDecimals(s.mark))}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{s.distancePct === null ? "∞" : pct(s.distancePct, 1)}</td>
                        <td className="py-1.5 pr-3 tabular-nums">{s.health}</td>
                        <td className={`py-1.5 pr-3 tabular-nums ${s.upnl >= 0 ? "text-emerald-300" : "text-red-300"}`}>{s.upnl >= 0 ? "+" : "−"}${fmt(Math.abs(s.upnl))}</td>
                        <td className="py-1.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[s.status]}`}>{s.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="mt-12 grid gap-4 sm:grid-cols-3">
        {[
          ["Not another dashboard", "Hizz already tracks Strike activity and Bolt/Copilot do copy trading. Margqo does one job dashboards don't: it turns a liquidation price into a distance, a daily funding bleed, and a priced rescue."],
          ["Strike's own math", "Margin tiers come live from Strike's /v2/markets; the liquidation formula mirrors the official strike-builder-reference exactly — same MMR, same maintenance amount, same hourly funding."],
          ["Built for the wick", "Most liquidations are one violent candle. The shock table shows your status at −5% to −30% before the candle prints, so the rescue happens while it's still cheap."],
        ].map(([t, b]) => (
          <div key={t} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h3 className="font-bold text-lime-200">{t}</h3><p className="mt-2 text-sm leading-relaxed text-zinc-400">{b}</p>
          </div>
        ))}
      </section>

      <section className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Live Strike markets <span className="text-sm font-normal text-zinc-400">— real mainnet data, refreshes every 20s</span></h2>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter symbol…" className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm" />
        </div>
        {marketsError && <p className="mt-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">Strike API error: {marketsError}</p>}
        <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="px-4 py-3">Market</th><th className="px-4 py-3">Mark</th><th className="px-4 py-3">Index</th><th className="px-4 py-3">Funding /h</th><th className="px-4 py-3">Funding APR</th><th className="px-4 py-3">Max lev</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {visibleMarkets.slice(0, 40).map((m) => (
                <tr key={m.symbol} className="border-t border-zinc-800/70 hover:bg-zinc-900/60">
                  <td className="px-4 py-2.5 font-semibold">{m.symbol} <span className="block text-xs font-normal text-zinc-500">{m.name}</span></td>
                  <td className="px-4 py-2.5 tabular-nums">{m.mark !== null ? fmt(m.mark, priceDecimals(m.mark)) : "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-400">{m.index !== null ? fmt(m.index, priceDecimals(m.index)) : "—"}</td>
                  <td className={`px-4 py-2.5 tabular-nums ${(m.fundingRate ?? 0) >= 0 ? "text-orange-300" : "text-sky-300"}`}>{pct(m.fundingRate, 4)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-400">{pct(m.fundingApr, 1)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{m.defaultLeverage}x</td>
                  <td className="px-4 py-2.5"><button onClick={() => { setSymbol(m.symbol); if (m.mark) setEntry(String(m.mark)); window.scrollTo({ top: 240, behavior: "smooth" }); }} className="rounded-full border border-zinc-700 px-2.5 py-1 text-xs hover:border-lime-400/60 hover:text-lime-200">Guard this →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Showing {Math.min(40, visibleMarkets.length)} of {visibleMarkets.length} trading markets. Source: api.strikefinance.org — GET /v2/markets + /price/v2/markPrice.</p>
      </section>

      <footer className="mt-14 border-t border-zinc-800 pt-6 text-xs leading-relaxed text-zinc-500">
        <p><strong className="text-zinc-300">Margqo</strong> — built for the Strike Finance Hackathon (Oct 21–23, 2026). Live data: Strike mainnet public API. Position inputs and demo presets are illustrative; Margqo holds no keys, places no trades, and gives no financial advice. Authenticated position import (Strike API wallet) is documented and env-gated — see docs/STRIKE_INTEGRATION.md in the repo.</p>
      </footer>
    </main>
  );
}
