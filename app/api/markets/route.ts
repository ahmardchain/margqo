import { NextResponse } from "next/server";
import { getAllMarkPrices, getMarkets, getServerTime } from "@/lib/strike";


// LIVE Strike mainnet data: markets (with margin tiers) merged with live
// mark prices + hourly funding rates. No demo data in this route.
export async function GET() {
  try {
    const [markets, marks, serverTime] = await Promise.all([getMarkets(), getAllMarkPrices(), getServerTime()]);
    const markBy = new Map(marks.map((m) => [m.symbol, m]));
    const rows = Object.values(markets)
      .filter((m) => m.status === "trading")
      .map((m) => {
        const mp = markBy.get(m.symbol);
        return {
          symbol: m.symbol,
          name: m.name,
          base: m.base_asset,
          defaultLeverage: m.default_leverage,
          tierCount: m.margin_tiers?.length ?? 0,
          topTierMmr: m.margin_tiers?.[0] ? Number(m.margin_tiers[0].maintenance_margin_rate) : null,
          mark: mp?.mark ?? null,
          index: mp?.index ?? null,
          fundingRate: mp?.fundingRate ?? null,
          fundingApr: mp ? mp.fundingRate * 24 * 365 : null,
          nextFundingTime: mp?.nextFundingTime ?? null,
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    return NextResponse.json({ source: "live", venue: "Strike Finance mainnet", serverTime, fetchedAt: Date.now(), count: rows.length, markets: rows });
  } catch (e: any) {
    return NextResponse.json({ source: "live", error: `Strike API unreachable: ${e?.message || e}` }, { status: 502 });
  }
}
