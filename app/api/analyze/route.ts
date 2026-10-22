import { NextResponse } from "next/server";
import { getMarkets, getMarkPrice } from "@/lib/strike";
import { analyzePosition, rescueAddMargin, rescueReduceSize, shockTable } from "@/lib/engine.js";


// Core Margqo loop: a position the user describes (their own Strike
// position terms) scored against LIVE Strike mark price, funding and
// margin tiers, using Strike's own liquidation math.
export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { symbol, side, size, entry, margin, targetDistance } = body || {};
  if (!symbol || !["long", "short"].includes(side) || !(Number(size) > 0) || !(Number(entry) > 0) || !(Number(margin) > 0)) {
    return NextResponse.json(
      { error: "Required: symbol, side (long|short), size > 0, entry > 0, margin > 0" },
      { status: 400 }
    );
  }
  const target = Math.min(0.5, Math.max(0.05, Number(targetDistance) || 0.2));
  try {
    const [markets, mp] = await Promise.all([getMarkets(), getMarkPrice(String(symbol))]);
    const market: any = markets[String(symbol)];
    if (!market) return NextResponse.json({ error: `Unknown Strike market: ${symbol}` }, { status: 404 });
    const pos = { symbol: String(symbol), side, size: Number(size), entry: Number(entry), margin: Number(margin) };
    const mark = { mark: mp.mark, index: mp.index, fundingRate: mp.fundingRate };
    const analysis = analyzePosition(pos, market, mark);
    return NextResponse.json({
      source: "live",
      venue: "Strike Finance mainnet",
      fetchedAt: Date.now(),
      nextFundingTime: mp.nextFundingTime,
      position: pos,
      analysis,
      rescue: {
        targetDistance: target,
        addMargin: rescueAddMargin(pos, market, mark, target),
        reduceSize: rescueReduceSize(pos, market, mark, target),
      },
      shocks: shockTable(pos, market, mark),
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Strike API unreachable: ${e?.message || e}` }, { status: 502 });
  }
}
