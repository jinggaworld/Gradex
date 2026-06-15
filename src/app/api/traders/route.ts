import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/traders
 *
 * Returns a paginated, filtered, and sorted list of active traders.
 * Query params: sortBy, riskLevel, search
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") || "score";
  const riskLevel = searchParams.get("riskLevel");
  const search = searchParams.get("search");

  try {
    const supabase = await createClient();

    let query = supabase
      .from("traders")
      .select(
        `
        wallet_address,
        display_name,
        reputation_score,
        total_volume,
        win_rate,
        total_followers,
        roi_30d,
        risk_level
      `,
      )
      .eq("is_active", true);

    // Filters
    if (riskLevel && riskLevel !== "all") {
      query = query.eq("risk_level", riskLevel);
    }

    if (search) {
      query = query.or(
        `display_name.ilike.%${search}%,wallet_address.ilike.%${search}%`,
      );
    }

    // Sorting
    const sortMap: Record<string, string> = {
      score: "reputation_score",
      volume: "total_volume",
      followers: "total_followers",
      roi: "roi_30d",
    };
    const sortColumn = sortMap[sortBy] || "reputation_score";
    query = query.order(sortColumn, { ascending: false }).limit(50);

    const { data: traders, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      traders: (traders || []).map((t: any) => ({
        walletAddress: t.wallet_address,
        displayName: t.display_name,
        reputationScore: t.reputation_score,
        totalVolume: t.total_volume,
        winRate: t.win_rate,
        totalFollowers: t.total_followers,
        roi30d: t.roi_30d,
        riskLevel: t.risk_level,
      })),
    });
  } catch (error) {
    console.error("[Traders API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch traders" },
      { status: 500 },
    );
  }
}
