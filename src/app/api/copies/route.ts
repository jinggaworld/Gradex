import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/copies?follower=<address>
 *
 * Returns the copy trade history for a given follower address.
 */
export async function GET(request: NextRequest) {
  const followerAddress = request.nextUrl.searchParams.get("follower");

  if (!followerAddress) {
    return NextResponse.json(
      { error: "Follower address is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    const { data: trades, error } = await supabase
      .from("copy_trades")
      .select(
        `
        id,
        follower_address,
        vault_id,
        original_tx_hash,
        copied_tx_hash,
        dex,
        action,
        token,
        token_amount,
        cspr_amount,
        status,
        profit,
        executed_at,
        vaults (
          name,
          trader_address
        )
      `,
      )
      .eq("follower_address", followerAddress)
      .order("executed_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[Copies API] Supabase error:", error);
      return NextResponse.json({ trades: [] });
    }

    const formattedTrades = (trades || []).map((t: any) => ({
      id: t.id,
      traderName: t.vaults?.name || "Unknown",
      traderAddress: t.vaults?.trader_address || "",
      dex: t.dex || "Unknown",
      action: t.action || "buy",
      token: t.token || "CSPR",
      tokenAmount: t.token_amount || "0",
      csprAmount: t.cspr_amount || "0",
      status: t.status || "executed",
      profit: t.profit || "0",
      executedAt: t.executed_at || new Date().toISOString(),
      txHash: t.copied_tx_hash || t.original_tx_hash || "",
    }));

    return NextResponse.json({ trades: formattedTrades });
  } catch (error) {
    console.error("[Copies API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch copy trades" },
      { status: 500 },
    );
  }
}
