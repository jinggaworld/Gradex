import { NextRequest, NextResponse } from "next/server";
import { calculateTraderScore } from "@/lib/groq/scoring";
import type { TraderData } from "@/lib/groq/scoring";
import { checkTraderReputation } from "@/lib/tavily/reputation";

/**
 * POST /api/traders/scoring
 *
 * Evaluates a trader's reputation using:
 * 1. On-chain trading data (provided in request)
 * 2. Web reputation via Tavily search
 * 3. AI analysis via Groq LLM
 *
 * Body: { walletAddress: string, tradingData?: TraderData, displayName?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletAddress, tradingData, displayName } = body;

    if (!walletAddress) {
      return NextResponse.json(
        { error: "walletAddress is required" },
        { status: 400 },
      );
    }

    // 1. Use provided trading data or generate a placeholder
    const traderData: TraderData = tradingData || {
      walletAddress,
      totalTrades: 0,
      winRate: 0,
      totalVolume: "0",
      totalPnL: "0",
      averageTradeSize: "0",
      maxDrawdown: 0,
      sharpeRatio: 0,
      riskManagementScore: 0,
      tradeFrequency: 0,
      preferredDexes: [],
      tradingHistory: [],
    };

    // 2. Check web reputation via Tavily
    const tavilyReport = await checkTraderReputation(walletAddress, displayName);

    // 3. Calculate AI-powered score via Groq
    const score = await calculateTraderScore(traderData, tavilyReport);

    // 4. Try to persist results in Supabase (non-blocking)
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("trader_scores").upsert(
          {
            wallet_address: walletAddress,
            overall_score: score.overallScore,
            win_rate_score: score.winRateScore,
            consistency_score: score.consistencyScore,
            risk_score: score.riskScore,
            volume_legitimacy_score: score.volumeLegitimacyScore,
            risk_level: score.riskLevel,
            recommendation: score.recommendation,
            reasoning: score.reasoning,
            red_flags: score.redFlags,
            strengths: score.strengths,
            tavily_sentiment: tavilyReport.sentimentScore,
            tavily_summary: tavilyReport.summary,
            evaluated_at: new Date().toISOString(),
          },
          { onConflict: "wallet_address" },
        );
      }
    } catch (dbError) {
      console.warn("[Scoring] Failed to persist to Supabase:", dbError);
    }

    return NextResponse.json({
      score,
      reputation: {
        sentimentScore: tavilyReport.sentimentScore,
        redFlags: tavilyReport.redFlags,
        sourceCount: tavilyReport.sources.length,
      },
      cached: false,
      evaluatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Scoring API] Error:", error);
    return NextResponse.json(
      {
        error: "Scoring failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
