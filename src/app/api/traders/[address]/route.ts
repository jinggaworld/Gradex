import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/traders/[address]
 *
 * Returns detailed trader profile data including performance stats,
 * AI reputation score, and recent trade history.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;

  if (!address) {
    return NextResponse.json(
      { error: "Trader address is required" },
      { status: 400 },
    );
  }

  try {
    // Try fetching from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let traderData: any = null;
    let scoreData: any = null;

    if (supabaseUrl && supabaseKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get trader info
      const { data: trader } = await supabase
        .from("traders")
        .select("*")
        .eq("wallet_address", address)
        .single();

      if (trader) {
        traderData = {
          walletAddress: trader.wallet_address,
          displayName: trader.display_name,
          bio: trader.bio,
          totalTrades: trader.total_trades || 0,
          winRate: trader.win_rate || 0,
          totalVolume: trader.total_volume || "0",
          totalPnL: trader.total_pnl || "0",
          avgTradeSize: trader.total_trades
            ? (
                BigInt(trader.total_volume || "0") /
                BigInt(trader.total_trades || 1)
              ).toString()
            : "0",
          maxDrawdown: trader.max_drawdown || 0,
          sharpeRatio: trader.sharpe_ratio || 0,
          tradeFrequency: trader.trade_frequency || 0,
          riskManagementScore: trader.risk_management_score || 0,
          totalFollowers: trader.total_followers || 0,
          riskLevel: trader.risk_level || "medium",
          preferredDexes: trader.preferred_dexes || [],
          recentTrades: [],
        };
      }

      // Get AI score data
      const { data: scoreRecord } = await supabase
        .from("trader_scores")
        .select("*")
        .eq("wallet_address", address)
        .order("evaluated_at", { ascending: false })
        .limit(1)
        .single();

      if (scoreRecord) {
        scoreData = {
          overallScore: scoreRecord.overall_score,
          winRateScore: scoreRecord.win_rate_score,
          consistencyScore: scoreRecord.consistency_score,
          riskScore: scoreRecord.risk_score,
          volumeLegitimacyScore: scoreRecord.volume_legitimacy_score,
          riskLevel: scoreRecord.risk_level,
          recommendation: scoreRecord.recommendation,
          reasoning: scoreRecord.reasoning,
          redFlags: scoreRecord.red_flags || [],
          strengths: scoreRecord.strengths || [],
        };
      }
    }

    // Fallback: return mock data if no DB connection
    if (!traderData) {
      traderData = {
        walletAddress: address,
        displayName: address.slice(0, 8),
        bio: null,
        totalTrades: 0,
        winRate: 0,
        totalVolume: "0",
        totalPnL: "0",
        avgTradeSize: "0",
        maxDrawdown: 0,
        sharpeRatio: 0,
        tradeFrequency: 0,
        riskManagementScore: 0,
        totalFollowers: 0,
        riskLevel: "medium",
        preferredDexes: [],
        recentTrades: [],
      };
    }

    return NextResponse.json({
      trader: traderData,
      score: scoreData,
    });
  } catch (error) {
    console.error("[Trader Detail API] Error:", error);

    // Return fallback data on error
    return NextResponse.json({
      trader: {
        walletAddress: address,
        displayName: address.slice(0, 8),
        bio: null,
        totalTrades: 0,
        winRate: 0,
        totalVolume: "0",
        totalPnL: "0",
        avgTradeSize: "0",
        maxDrawdown: 0,
        sharpeRatio: 0,
        tradeFrequency: 0,
        riskManagementScore: 0,
        totalFollowers: 0,
        riskLevel: "medium",
        preferredDexes: [],
        recentTrades: [],
      },
      score: null,
    });
  }
}
