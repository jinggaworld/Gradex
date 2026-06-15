import Groq from "groq-sdk";

let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

export interface TraderData {
  walletAddress: string;
  totalTrades: number;
  winRate: number;
  totalVolume: string;
  totalPnL: string;
  averageTradeSize: string;
  maxDrawdown: number;
  sharpeRatio: number;
  riskManagementScore: number;
  tradeFrequency: number;
  preferredDexes: string[];
  tradingHistory: Array<{
    date: string;
    action: "buy" | "sell";
    token: string;
    amount: string;
    pnl: string;
  }>;
}

export interface ReputationScore {
  overallScore: number;
  winRateScore: number;
  consistencyScore: number;
  riskScore: number;
  volumeLegitimacyScore: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "subscribe" | "caution" | "avoid";
  reasoning: string;
  redFlags: string[];
  strengths: string[];
}

interface TavilyReputationReport {
  traderName: string;
  walletAddress: string;
  sentimentScore: number;
  redFlags: string[];
  positiveMentions: string[];
  negativeMentions: string[];
  summary: string;
  sources: Array<{
    name: string;
    url: string;
    type: "review" | "news" | "social" | "forum" | "regulatory";
  }>;
}

/**
 * Generate an AI-powered reputation score for a trader using Groq's LLM.
 * Analyzes on-chain trading data and optional Tavily web research report.
 */
export async function calculateTraderScore(
  traderData: TraderData,
  tavilyReport?: TavilyReputationReport,
): Promise<ReputationScore> {
  if (!process.env.GROQ_API_KEY) {
    return generateFallbackScore(traderData, "Groq API key not configured");
  }

  const prompt = constructScoringPrompt(traderData, tavilyReport);

  try {
    const groq = getGroqClient();
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are Gradex AI, an expert on-chain trading analyst and reputation scorer for the Casper Network.

Your task is to evaluate a trader's performance and reputation based on their on-chain data and web research.

Analyze the following data and provide:
1. A composite reputation score (0-100)
2. Sub-scores for each category (winRateScore, consistencyScore, riskScore, volumeLegitimacyScore)
3. Risk level assessment (low/medium/high)
4. Clear recommendation (subscribe/caution/avoid)
5. Detailed reasoning for the score
6. Any red flags detected
7. Key strengths identified

Be conservative with high scores — a score of 70+ should represent truly exceptional traders.
Flag any signs of wash trading, manipulation, or unsustainable strategies.

Return your analysis as a structured JSON object.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("No response from Groq API");
    }

    const score = JSON.parse(response) as ReputationScore;

    if (score.overallScore < 0 || score.overallScore > 100) {
      throw new Error(`Invalid score returned: ${score.overallScore}`);
    }

    return score;
  } catch (error) {
    console.error("[Groq] Scoring error:", error);
    return generateFallbackScore(
      traderData,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}

/**
 * Generate a fallback score when the Groq API is unavailable.
 * Uses deterministic heuristics based on on-chain data.
 */
function generateFallbackScore(
  traderData: TraderData,
  reason: string,
): ReputationScore {
  const {
    totalTrades,
    winRate,
    maxDrawdown,
    tradeFrequency,
    riskManagementScore,
  } = traderData;

  const winRateScore = Math.min(Math.round(winRate * 1.5), 100);
  const consistencyScore = Math.min(
    Math.round(
      (Math.min(tradeFrequency, 20) / 20) * 50 +
        (Math.min(totalTrades, 100) / 100) * 50,
    ),
    100,
  );
  const riskScore = Math.max(
    0,
    Math.min(100 - maxDrawdown * 2, 100),
  );
  const volumeLegitimacyScore = Math.min(
    Math.round(riskManagementScore * 0.7 + 30),
    100,
  );

  const overallScore = Math.round(
    winRateScore * 0.2 +
      consistencyScore * 0.2 +
      riskScore * 0.2 +
      volumeLegitimacyScore * 0.2 +
      10, // Tavily placeholder weight (assumes no web data, allocate 10%)
  );

  return {
    overallScore: Math.min(overallScore, 100),
    winRateScore,
    consistencyScore,
    riskScore,
    volumeLegitimacyScore,
    riskLevel:
      maxDrawdown > 40 || winRate < 30
        ? "high"
        : maxDrawdown > 25 || winRate < 50
          ? "medium"
          : "low",
    recommendation:
      overallScore >= 60
        ? "subscribe"
        : overallScore >= 35
          ? "caution"
          : "avoid",
    reasoning: `Heuristic evaluation (${reason}). Based on ${totalTrades} trades, ${winRate}% win rate, ${maxDrawdown}% max drawdown.`,
    redFlags:
      maxDrawdown > 40
        ? ["High maximum drawdown indicates poor risk management"]
        : [],
    strengths:
      winRate > 60
        ? [`Strong win rate of ${winRate}%`]
        : [],
  };
}

function constructScoringPrompt(
  traderData: TraderData,
  tavilyReport?: TavilyReputationReport,
): string {
  return `
## Trader Evaluation Request

### On-Chain Profile
- **Wallet Address:** ${traderData.walletAddress}
- **Total Trades:** ${traderData.totalTrades}
- **Win Rate:** ${traderData.winRate}%
- **Total Volume:** ${traderData.totalVolume} CSPR
- **Total PnL:** ${traderData.totalPnL} CSPR
- **Average Trade Size:** ${traderData.averageTradeSize} CSPR
- **Max Drawdown:** ${traderData.maxDrawdown}%
- **Sharpe Ratio:** ${traderData.sharpeRatio}
- **Trade Frequency:** ${traderData.tradeFrequency} trades/day
- **Risk Management Score:** ${traderData.riskManagementScore}/100
- **Preferred DEXes:** ${traderData.preferredDexes.join(", ")}

### Recent Trading History (Last 20 Trades)
${JSON.stringify(traderData.tradingHistory.slice(0, 20), null, 2)}

${
  tavilyReport
    ? `### Web Reputation Research

${JSON.stringify(tavilyReport, null, 2)}`
    : "### Web Reputation Research\nNo web research data available."
}

### Scoring Guidelines
- **Win Rate:** 0-30 points. Higher is better.
- **Consistency:** Score based on regular trading pattern versus sporadic activity.
- **Drawdown:** Lower drawdown = higher score.
- **Volume Legitimacy:** Assess if volume looks organic or wash-traded.
- **Web Reputation:** Consider external mentions, reviews, and community sentiment.

### Output Format
Return a JSON object with:
- overallScore (number 0-100)
- winRateScore (number 0-100)
- consistencyScore (number 0-100)
- riskScore (number 0-100)
- volumeLegitimacyScore (number 0-100)
- riskLevel ("low" | "medium" | "high")
- recommendation ("subscribe" | "caution" | "avoid")
- reasoning (detailed string explaining the score)
- redFlags (array of strings)
- strengths (array of strings)
`;
}

export type { TavilyReputationReport };
