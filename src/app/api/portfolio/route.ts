import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/portfolio?follower=<address>
 *
 * Returns a follower's portfolio: positions list + aggregate stats.
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

    const { data: positions, error } = await supabase
      .from("copy_positions")
      .select(
        `
        *,
        vaults (
          name,
          trader_address
        )
      `,
      )
      .eq("follower_address", followerAddress)
      .order("subscribed_at", { ascending: false });

    if (error) {
      console.error("[Portfolio API] Supabase error:", error);
      // Return empty portfolio instead of erroring
      return NextResponse.json({
        positions: [],
        totalInvested: "0",
        currentValue: "0",
        totalPnL: "0",
        totalRoyaltiesPaid: "0",
        history: [],
      });
    }

    let totalInvested = 0n;
    let currentValue = 0n;
    let totalPnL = 0n;
    let totalRoyaltiesPaid = 0n;

    const formattedPositions = (positions || []).map((p: any) => {
      totalInvested += BigInt(p.allocated_amount || "0");
      currentValue += BigInt(p.current_value || "0");
      totalPnL += BigInt(p.pnl || "0");
      totalRoyaltiesPaid += BigInt(p.total_royalties_paid || "0");

      return {
        id: p.id,
        traderName: p.vaults?.name || "Unknown",
        traderAddress: p.vaults?.trader_address || "",
        vaultName: p.vaults?.name || "",
        allocatedAmount: p.allocated_amount,
        currentValue: p.current_value,
        pnl: p.pnl,
        pnlPercentage: p.pnl_percentage,
        isActive: p.is_active,
        autoCompound: p.auto_compound,
        subscribedAt: p.subscribed_at,
        lastCopyTradeAt: p.last_copy_trade_at,
      };
    });

    return NextResponse.json({
      positions: formattedPositions,
      totalInvested: totalInvested.toString(),
      currentValue: currentValue.toString(),
      totalPnL: totalPnL.toString(),
      totalRoyaltiesPaid: totalRoyaltiesPaid.toString(),
      history: [],
    });
  } catch (error) {
    console.error("[Portfolio API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch portfolio" },
      { status: 500 },
    );
  }
}
