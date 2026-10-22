// Strike Finance live client — mainnet public API.
// Verified live on 2026-10-22 (see docs/STRIKE_INTEGRATION.md):
//   GET https://api.strikefinance.org/v2/time                 -> 200
//   GET https://api.strikefinance.org/v2/markets              -> 200 (margin_tiers per market)
//   GET https://api.strikefinance.org/price/v2/markPrice      -> 200 (all symbols)
//   GET https://api.strikefinance.org/price/v2/markPrice?symbol=ADA-USD -> 200
//   GET https://api.strikefinance.org/price/v2/depth?symbol=ADA-USD     -> 200
//   GET https://api.strikefinance.org/price/v2/klines?symbol=ADA-USD&interval=1h -> 200
//   GET https://api.strikefinance.org/v2/positions            -> 401 (needs API-wallet auth)
// Endpoints/shape follow strike-finance/strike-builder-reference (official).
// Authenticated account calls require a user API wallet (Ed25519 headers:
// X-API-Wallet-Public-Key / -Signature / -Timestamp / -Nonce). Margqo does
// NOT hold user keys; the authenticated path is env-gated and honestly
// reports 501 until a user configures their own API wallet.

const API = process.env.STRIKE_API_URL || "https://api.strikefinance.org";

export interface StrikeMarket {
  symbol: string;
  name: string;
  base_asset: string;
  status: string;
  default_leverage: number;
  margin_tiers: Array<{
    max_notional: string;
    max_leverage: number;
    maintenance_margin_rate: string;
    maintenance_amount: string;
  }>;
}

export interface MarkPrice {
  symbol: string;
  mark: number;
  index: number;
  fundingRate: number; // hourly rate, decimal (field `r`)
  nextFundingTime: number; // field `T`, ms epoch (Strike server clock base)
  eventTime: number;
}

async function getJson(url: string, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { cache: "no-store", signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`Strike API ${res.status} for ${url}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function getServerTime(): Promise<number> {
  const j = await getJson(`${API}/v2/time`);
  return Number(j.serverTime);
}

export async function getMarkets(): Promise<Record<string, StrikeMarket>> {
  const j = await getJson(`${API}/v2/markets`);
  return j.markets as Record<string, StrikeMarket>;
}

function parseMark(j: any): MarkPrice {
  return {
    symbol: j.s,
    mark: Number(j.p),
    index: Number(j.i),
    fundingRate: Number(j.r),
    nextFundingTime: Number(j.T),
    eventTime: Number(j.E),
  };
}

export async function getAllMarkPrices(): Promise<MarkPrice[]> {
  const j = await getJson(`${API}/price/v2/markPrice`);
  return (j as any[]).map(parseMark);
}

export async function getMarkPrice(symbol: string): Promise<MarkPrice> {
  const j = await getJson(`${API}/price/v2/markPrice?symbol=${encodeURIComponent(symbol)}`);
  return parseMark(j);
}

export async function getDepth(symbol: string) {
  return getJson(`${API}/price/v2/depth?symbol=${encodeURIComponent(symbol)}`);
}

export async function getKlines(symbol: string, interval = "1h") {
  return getJson(`${API}/price/v2/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}`);
}

// Authenticated positions — env-gated, honest when unconfigured.
// Requires STRIKE_API_WALLET_PUBLIC_KEY + STRIKE_API_WALLET_SECRET_KEY
// (Ed25519, user's own API wallet created via the Strike builder-connect
// flow). Margqo ships without any keys and never asks for a seed phrase.
export function positionsConfigured(): boolean {
  return Boolean(process.env.STRIKE_API_WALLET_PUBLIC_KEY && process.env.STRIKE_API_WALLET_SECRET_KEY);
}

export const STRIKE = {
  apiBase: API,
  priceWs: "wss://api.strikefinance.org/ws/price",
  userWs: "wss://api.strikefinance.org/ws/user-api",
  builderReference: "https://github.com/strike-finance/strike-builder-reference",
  githubOrg: "https://github.com/strike-finance",
  docs: "https://docs.strikefinance.org",
  site: "https://www.strikefinance.org",
};
