import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/leaderboard?period=all|7d|30d
 *
 * Returns the leaderboard entries sorted by the specified period.
 * - "all": sorted by composite rank ascending
 * - "7d": sorted by 7-day ROI descending
 * - "30d": sorted by 30-day ROI descending
 */
export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "all";

  try {
    const supabase = await createClient();

    let query;

    if (period === "7d") {
      query = supabase
        .from("leaderboard")
        .select("*")
        .order("roi_7d", { ascending: false })
        .limit(100);
    } else if (period === "30d") {
      query = supabase
        .from("leaderboard")
        .select("*")
        .order("roi_30d", { ascending: false })
        .limit(100);
    } else {
      query = supabase
        .from("leaderboard")
        .select("*")
        .order("rank", { ascending: true })
        .limit(100);
    }

    const { data: entries, error } = await query;

    if (error) {
      console.error("[Leaderboard API] Error:", error);
      return NextResponse.json({ entries: [] });
    }

    return NextResponse.json({ entries: entries || [] });
  } catch (error) {
    console.error("[Leaderboard API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 },
    );
  }
}
