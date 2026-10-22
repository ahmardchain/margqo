// Margqo position-risk engine.
// Formulas mirror Strike Finance's own published trading math
// (strike-finance/strike-builder-reference, src/math — CALCULATION_SPECS):
//   notional = mark * |size|
//   uPnL     = (mark - entry) * size            (size signed: + long, - short)
//   IM       = notional / leverage
//   MM       = notional * MMR - MA              (tier from GET /v2/markets)
//   LP       = (EP - (W + MA) / size) / (1 - dir * MMR)     [isolated, TU=TM=0]
//   funding  = -size * mark * hourlyRate        (per hour; longs pay when rate > 0)
// LP <= 0 means the position cannot be liquidated at a positive price.

export function tierFor(notional, tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    return { max_notional: "0", max_leverage: 1, maintenance_margin_rate: "0.025", maintenance_amount: "0" };
  }
  for (const t of tiers) {
    if (notional <= Number(t.max_notional)) return t;
  }
  return tiers[tiers.length - 1];
}

export function liquidationPrice({ entry, size, wallet, mmr, ma }) {
  if (!size) return null;
  const dir = Math.sign(size);
  const denom = 1 - dir * mmr;
  const lp = (entry - (wallet + ma) / size) / denom;
  return lp;
}

export function statusFor(distancePct, liquidated) {
  if (liquidated) return "LIQUIDATED";
  if (distancePct === Infinity) return "SAFE";
  if (distancePct >= 0.25) return "SAFE";
  if (distancePct >= 0.15) return "WATCH";
  if (distancePct >= 0.07) return "DANGER";
  return "CRITICAL";
}

export function healthScore(distancePct, liquidated) {
  if (liquidated) return 0;
  if (distancePct === Infinity) return 100;
  // 0% distance -> 0, 35%+ -> 100, smooth in between
  return Math.max(0, Math.min(100, Math.round(100 * (1 - Math.exp(-distancePct / 0.12)))));
}

export function analyzePosition(pos, market, mark) {
  // pos: {symbol, side:'long'|'short', size (abs), entry, margin}
  // market: Strike market object (margin_tiers, default_leverage)
  // mark: {mark, index, fundingRate (hourly, decimal)}
  const size = (pos.side === "short" ? -1 : 1) * Math.abs(pos.size);
  const dir = Math.sign(size);
  const markPx = Number(mark.mark);
  const entry = Number(pos.entry);
  const wallet = Number(pos.margin); // isolated margin allocated to the position
  const notional = markPx * Math.abs(size);
  const tier = tierFor(notional, market?.margin_tiers);
  const mmr = Number(tier.maintenance_margin_rate);
  const ma = Number(tier.maintenance_amount);
  const maxLev = Number(tier.max_leverage || market?.default_leverage || 1);
  const leverage = wallet > 0 ? notional / wallet : Infinity;

  const upnl = (markPx - entry) * size;
  const im = maxLev > 0 ? notional / Math.min(leverage === Infinity ? maxLev : leverage, maxLev) : notional;
  const mm = Math.max(0, notional * mmr - ma);
  const equity = wallet + upnl;
  const lp = liquidationPrice({ entry, size, wallet, mmr, ma });
  const hasLp = lp !== null && lp > 0;
  const liquidated = hasLp && ((dir > 0 && markPx <= lp) || (dir < 0 && markPx >= lp));
  // Signed distance: positive while price is on the safe side of LP,
  // negative once past it (liquidated).
  const distancePct = !hasLp ? Infinity : (dir > 0 ? markPx - lp : lp - markPx) / markPx;
  const fundingRate = Number(mark.fundingRate || 0);
  const fundingPerHour = -size * markPx * fundingRate;

  return {
    symbol: pos.symbol,
    side: pos.side,
    size,
    entry,
    margin: wallet,
    mark: markPx,
    index: Number(mark.index || markPx),
    notional,
    leverage: leverage === Infinity ? null : leverage,
    maxLeverage: maxLev,
    tier: { mmr, ma, maxNotional: Number(tier.max_notional) },
    upnl,
    im,
    mm,
    equity,
    marginRatio: equity > 0 ? mm / equity : Infinity,
    liquidationPrice: hasLp ? lp : null,
    distancePct: distancePct === Infinity ? null : distancePct,
    distanceAbs: hasLp ? Math.abs(markPx - lp) : null,
    fundingRate,
    fundingPerHour,
    fundingPerDay: fundingPerHour * 24,
    status: statusFor(distancePct, liquidated),
    health: healthScore(distancePct, liquidated),
    liquidated,
  };
}

// Rescue plan A: how much extra isolated margin pushes the liquidation
// price to a target distance from the current mark?
export function rescueAddMargin(pos, market, mark, targetDistance = 0.2) {
  const a = analyzePosition(pos, market, mark);
  if (a.liquidated) return { feasible: false, reason: "Position is already past its liquidation price." };
  if (a.distancePct === null || a.distancePct >= targetDistance) {
    return { feasible: true, addMargin: 0, targetLp: a.liquidationPrice, note: "Already at or beyond the target distance." };
  }
  const dir = Math.sign(a.size);
  const targetLp = a.mark * (1 - dir * targetDistance);
  const denom = 1 - dir * a.tier.mmr;
  // LP = (EP - (W+MA)/size)/denom  =>  W' = size * (EP - targetLp*denom) - MA
  const wNeeded = a.size * (a.entry - targetLp * denom) - a.tier.ma;
  const add = wNeeded - a.margin;
  if (!(add > 0) || !isFinite(add)) return { feasible: false, reason: "No positive margin addition reaches that target at this tier." };
  // verify by recomputation
  const check = analyzePosition({ ...pos, margin: a.margin + add }, market, mark);
  return {
    feasible: true,
    addMargin: add,
    targetLp,
    resultingDistancePct: check.distancePct,
    resultingHealth: check.health,
  };
}

// Rescue plan B: how much of the position must be cut (margin untouched,
// entry unchanged, PnL ignored — documented approximation) to reach the
// target distance at the current margin tier?
export function rescueReduceSize(pos, market, mark, targetDistance = 0.2) {
  const a = analyzePosition(pos, market, mark);
  if (a.liquidated) return { feasible: false, reason: "Position is already past its liquidation price." };
  if (a.distancePct === null || a.distancePct >= targetDistance) {
    return { feasible: true, cutFraction: 0, newSize: Math.abs(a.size), note: "Already at or beyond the target distance." };
  }
  const dir = Math.sign(a.size);
  const targetLp = a.mark * (1 - dir * targetDistance);
  const denom = 1 - dir * a.tier.mmr;
  // W/size' = EP - targetLp*denom  =>  size' = W / (EP - targetLp*denom)
  const inner = a.entry - targetLp * denom;
  if (inner === 0) return { feasible: false, reason: "Target is unreachable by size reduction alone." };
  const sizeNeeded = a.margin / inner; // signed via inner's sign relationship
  const newAbs = Math.abs(sizeNeeded);
  if (!isFinite(newAbs) || newAbs >= Math.abs(a.size)) {
    return { feasible: false, reason: "Size reduction alone cannot reach that target at this tier — add margin instead." };
  }
  const cutFraction = 1 - newAbs / Math.abs(a.size);
  const check = analyzePosition({ ...pos, size: newAbs }, market, mark);
  return {
    feasible: true,
    cutFraction,
    newSize: newAbs,
    targetLp,
    resultingDistancePct: check.distancePct,
    resultingHealth: check.health,
  };
}

// Shock table: what happens to distance/health if mark moves by each pct?
export function shockTable(pos, market, mark, moves = [-0.3, -0.2, -0.1, -0.05, 0.05, 0.1, 0.2, 0.3]) {
  return moves.map((m) => {
    const shocked = { ...mark, mark: Number(mark.mark) * (1 + m) };
    const a = analyzePosition(pos, market, shocked);
    return { movePct: m, mark: a.mark, distancePct: a.distancePct, health: a.health, status: a.status, upnl: a.upnl };
  });
}
