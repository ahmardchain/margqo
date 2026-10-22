import { NextResponse } from "next/server";
import { positionsConfigured, STRIKE } from "@/lib/strike";


// Authenticated Strike positions require the user's own API wallet
// (Ed25519 headers, builder-connect flow). Margqo holds no user keys, so
// until a user configures STRIKE_API_WALLET_* for their own wallet this
// honestly returns 501 — positions are entered manually in the guardian
// (symbol/side/size/entry/margin) and scored against live market data.
export async function GET() {
  if (!positionsConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        error: "Authenticated positions not configured. Set STRIKE_API_WALLET_PUBLIC_KEY and STRIKE_API_WALLET_SECRET_KEY (your own Strike API wallet) to enable. Upstream GET /v2/positions returns 401 without API-wallet auth.",
        docs: STRIKE.builderReference,
      },
      { status: 501 }
    );
  }
  return NextResponse.json(
    { configured: true, error: "API-wallet signing is documented but not enabled in this MVP build." },
    { status: 501 }
  );
}
