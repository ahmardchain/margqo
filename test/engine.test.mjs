import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePosition, rescueAddMargin, rescueReduceSize, shockTable, tierFor } from "../lib/engine.js";

const tiers = [
  { max_notional: "50000", max_leverage: 10, maintenance_margin_rate: "0.025", maintenance_amount: "0" },
  { max_notional: "250000", max_leverage: 2, maintenance_margin_rate: "0.0333", maintenance_amount: "830" },
];
const market = { symbol: "ADA-USD", margin_tiers: tiers, default_leverage: 10 };
const mark = { mark: 0.25, index: 0.249, fundingRate: 0.0001 };

test("tier selection picks first tier covering notional, else last", () => {
  assert.equal(tierFor(1000, tiers).max_leverage, 10);
  assert.equal(tierFor(60000, tiers).max_leverage, 2);
  assert.equal(tierFor(999999, tiers).max_leverage, 2);
});

test("long: uPnL, notional and liquidation price follow Strike formulas", () => {
  const a = analyzePosition({ symbol: "ADA-USD", side: "long", size: 10000, entry: 0.25, margin: 250 }, market, mark);
  assert.equal(a.notional, 2500);
  assert.equal(a.upnl, 0);
  // LP = (0.25 - 250/10000) / (1 - 0.025) = 0.225 / 0.975
  assert.ok(Math.abs(a.liquidationPrice - 0.225 / 0.975) < 1e-9);
  assert.ok(Math.abs(a.distancePct - (0.25 - a.liquidationPrice) / 0.25) < 1e-12);
  assert.equal(a.status, "DANGER"); // LP=0.2307, distance ~7.7%
});

test("long far from liquidation is SAFE and scores high", () => {
  const a = analyzePosition({ symbol: "ADA-USD", side: "long", size: 1000, entry: 0.25, margin: 250 }, market, mark);
  assert.equal(a.status, "SAFE");
  assert.ok(a.health >= 90);
});

test("short: liquidation sits above entry and funding flips sign", () => {
  const a = analyzePosition({ symbol: "ADA-USD", side: "short", size: 10000, entry: 0.25, margin: 250 }, market, mark);
  assert.ok(a.liquidationPrice > 0.25);
  const long = analyzePosition({ symbol: "ADA-USD", side: "long", size: 10000, entry: 0.25, margin: 250 }, market, mark);
  assert.ok(Math.abs(a.fundingPerHour + long.fundingPerHour) < 1e-9);
  assert.ok(long.fundingPerHour < 0, "long pays when hourly rate is positive");
});

test("price at/below LP is LIQUIDATED for a long", () => {
  const pos = { symbol: "ADA-USD", side: "long", size: 10000, entry: 0.25, margin: 250 };
  const a = analyzePosition(pos, market, { ...mark, mark: 0.2 });
  assert.equal(a.status, "LIQUIDATED");
  assert.equal(a.health, 0);
});

test("rescue add-margin: recomputed distance hits the target", () => {
  const pos = { symbol: "ADA-USD", side: "long", size: 10000, entry: 0.26, margin: 200 };
  const live = { mark: 0.25, index: 0.249, fundingRate: 0.0001 };
  const r = rescueAddMargin(pos, market, live, 0.2);
  assert.equal(r.feasible, true);
  assert.ok(r.addMargin > 0);
  assert.ok(Math.abs(r.resultingDistancePct - 0.2) < 0.005, `got ${r.resultingDistancePct}`);
});

test("rescue add-margin is a no-op when already safe", () => {
  const r = rescueAddMargin({ symbol: "ADA-USD", side: "long", size: 100, entry: 0.25, margin: 250 }, market, mark, 0.2);
  assert.equal(r.feasible, true);
  assert.equal(r.addMargin, 0);
});

test("rescue reduce-size: recomputed distance improves toward target", () => {
  const pos = { symbol: "ADA-USD", side: "long", size: 10000, entry: 0.26, margin: 200 };
  const live = { mark: 0.25, index: 0.249, fundingRate: 0.0001 };
  const r = rescueReduceSize(pos, market, live, 0.2);
  assert.equal(r.feasible, true);
  assert.ok(r.cutFraction > 0 && r.cutFraction < 1);
  assert.ok(r.resultingDistancePct > analyzePosition(pos, market, live).distancePct);
});

test("shock table: a -30% shock hurts a long more than a +30% shock", () => {
  const pos = { symbol: "ADA-USD", side: "long", size: 5000, entry: 0.25, margin: 300 };
  const rows = shockTable(pos, market, mark);
  const down = rows.find((x) => x.movePct === -0.3);
  const up = rows.find((x) => x.movePct === 0.3);
  assert.ok(down.health < up.health);
  assert.ok(down.upnl < up.upnl);
});

test("funding per day is 24x hourly", () => {
  const a = analyzePosition({ symbol: "ADA-USD", side: "long", size: 10000, entry: 0.25, margin: 250 }, market, mark);
  assert.ok(Math.abs(a.fundingPerDay - a.fundingPerHour * 24) < 1e-9);
});
