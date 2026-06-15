# Phase 5: AI Reputation Scoring System — Groq + Tavily

**Goal:** Build the AI-powered trader reputation scoring system that evaluates trader performance, consistency, and legitimacy before allowing subscriptions.

**Duration:** 5-7 days

---

## 5.1 AI Scoring Architecture

Gradex uses a dual-AI pipeline for trader evaluation:

```
┌──────────────────────────────────────────────────┐
│                TRADER EVALUATION PIPELINE         │
├──────────────────────────────────────────────────┤
│                                                   │
│  1. DATA COLLECTION                               │
│     ├── On-chain data (trades, volume, PnL)       │
│     ├── Off-chain research (Tavily web search)    │
│     └── Social signals (Twitter, Discord, forums) │
│                                                   │
│  2. TAVILY REPUTATION CHECK                       │
│     ├── Search for trader name/address            │
│     ├── Scrape mentions, reviews, red flags       │
│     └── Extract sentiment & credibility signals   │
│                                                   │
│  3. GROQ AI ANALYSIS                              │
│     ├── Analyze on-chain trading patterns         │
│     ├── Evaluate consistency & risk management    │
│     ├── Detect wash trading / manipulation        │
│     └── Generate composite reputation score       │
│                                                   │
│  4. SCORE COMPOSITE                               │
│     ├── On-chain performance (40%)                │
│     ├── Tavily reputation (30%)                   │
│     ├── Consistency analysis (20%)                │
│     └── Risk assessment (10%)                     │
│                                                   │
│  5. RESULT                                        │
│     ├── Score: 0-100                              │
│     ├── Risk level: low/medium/high               │
│     ├── Recommendation: subscribe/avoid           │
│     └── Detailed report                           │
│                                                   │
└──────────────────────────────────────────────────┘
```

### Scoring Criteria

| Criterion | Weight | Data Source | Description |
|-----------|--------|-------------|-------------|
| Win Rate | 20% | On-chain | Percentage of profitable trades |
| Sharpe Ratio | 10% | On-chain | Risk-adjusted returns |
| Max Drawdown | 10% | On-chain | Largest peak-to-trough decline |
| Consistency | 20% | On-chain + Groq | Regular trading vs. sporadic |
| Volume Profile | 10% | On-chain | Natural volume vs. wash trading |
| Web Reputation | 20% | Tavily | External mentions, reviews, red flags |
| Community Trust | 5% | Tavily | Social proof, followers, endorsements |
| Risk Management | 5% | Groq Analysis | Position sizing, stop-loss usage |

---

## 5.2 Groq AI Scoring Implementation

### src/lib/groq/scoring.ts

```typescript
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

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
  tradeFrequency: number; // trades per day
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
  overallScore: number; // 0-100
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

/**
 * Generate AI-powered reputation score using Groq
 */
export async function calculateTraderScore(
  traderData: TraderData,
  tavilyReport?: TavilyReputationReport
): Promise<ReputationScore> {
  const prompt = constructScoringPrompt(traderData, tavilyReport);

  const completion = await groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: `You are Gradex AI, an expert on-chain trading analyst and reputation scorer for the Casper Network.

Your task is to evaluate a trader's performance and reputation based on their on-chain data and web research.

Analyze the following data and provide:
1. A composite reputation score (0-100)
2. Sub-scores for each category
3. Risk level assessment
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
    temperature: 0.3, // Low temperature for consistent scoring
    response_format: {
      type: "json_object",
    },
  });

  const response = completion.choices[0]?.message?.content;
  if (!response) {
    throw new Error("No response from Groq API");
  }

  const score = JSON.parse(response) as ReputationScore;

  // Validate the score is within bounds
  if (score.overallScore < 0 || score.overallScore > 100) {
    throw new Error("Invalid score returned from AI");
  }

  return score;
}

function constructScoringPrompt(
  traderData: TraderData,
  tavilyReport?: TavilyReputationReport
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

${tavilyReport ? `### Web Reputation Research

${JSON.stringify(tavilyReport, null, 2)}` : "### Web Reputation Research\nNo web research data available."}

### Scoring Guidelines
- **Win Rate (${\\le}30%):** 0-30 points. Higher is better.
- **Consistency:** Score based on regular trading pattern versus sporadic activity.
- **Drawdown (${\\le}50%):** Lower drawdown = higher score.
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
```

---

## 5.3 Tavily Reputation Check

### src/lib/tavily/reputation.ts

```typescript
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

export interface TavilyReputationReport {
  traderName: string;
  walletAddress: string;
  searchResults: TavilySearchResult[];
  sentimentScore: number; // -1.0 to 1.0
  redFlags: string[];
  positiveMentions: string[];
  negativeMentions: string[];
  summary: string;
  sources: Array<{
    name: string;
    url: string;
    type: "review" | "news" | "social" | "forum" | "regulatory";
  }>;
  lastChecked: string;
}

/**
 * Check trader reputation using Tavily search API
 */
export async function checkTraderReputation(
  walletAddress: string,
  displayName?: string
): Promise<TavilyReputationReport> {
  // Multiple search queries for comprehensive coverage
  const queries = buildReputationQueries(walletAddress, displayName);

  const allResults: TavilySearchResult[] = [];

  for (const query of queries) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "advanced",
          include_answer: true,
          max_results: 5,
          include_domains: [
            "twitter.com",
            "x.com",
            "reddit.com",
            "discord.com",
            "medium.com",
            "github.com",
            "coingecko.com",
            "coinmarketcap.com",
            "defillama.com",
          ],
        }),
      });

      const data = await response.json();

      if (data.results) {
        allResults.push(...data.results);
      }
    } catch (error) {
      console.error(`[Tavily] Search failed for query: ${query}`, error);
    }
  }

  // Deduplicate results by URL
  const uniqueResults = deduplicateResults(allResults);

  // Analyze results for red flags and sentiment
  const analysis = analyzeSearchResults(uniqueResults);

  return {
    traderName: displayName || walletAddress,
    walletAddress,
    searchResults: uniqueResults,
    sentimentScore: analysis.sentimentScore,
    redFlags: analysis.redFlags,
    positiveMentions: analysis.positiveMentions,
    negativeMentions: analysis.negativeMentions,
    summary: analysis.summary,
    sources: analysis.sources,
    lastChecked: new Date().toISOString(),
  };
}

function buildReputationQueries(
  walletAddress: string,
  displayName?: string
): string[] {
  const queries = [
    // Search by wallet address
    `${walletAddress} Casper blockchain trader review`,
    `${walletAddress} crypto scam check`, // Intentional for red flag detection
  ];

  if (displayName) {
    queries.push(
      `${displayName} Casper trader reputation`,
      `${displayName} crypto trading performance review`,
      `${displayName} DeFi trader analysis`
    );
  }

  return queries;
}

function deduplicateResults(
  results: TavilySearchResult[]
): TavilySearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

function analyzeSearchResults(results: TavilySearchResult[]) {
  const redFlags: string[] = [];
  const positiveMentions: string[] = [];
  const negativeMentions: string[] = [];
  const sources: TavilyReputationReport["sources"] = [];

  const redFlagKeywords = [
    "scam", "rug", "fraud", "fake", "wash trade", "pump and dump",
    "manipulation", "ponzi", "exploit", "hack", "phishing",
    "unauthorized", "complaint", "lawsuit", "investigation",
  ];

  const positiveKeywords = [
    "profitable", "consistent", "trusted", "verified", "expert",
    "reliable", "transparent", "successful", "top trader",
  ];

  for (const result of results) {
    const content = (result.content + " " + (result.raw_content || "")).toLowerCase();
    const title = result.title.toLowerCase();

    // Check for red flags
    for (const keyword of redFlagKeywords) {
      if (content.includes(keyword) || title.includes(keyword)) {
        redFlags.push(`Found "${keyword}" in: ${result.title} (${result.url})`);
      }
    }

    // Check for positive mentions
    for (const keyword of positiveKeywords) {
      if (content.includes(keyword)) {
        positiveMentions.push(`"${keyword}" found in: ${result.title}`);
        break;
      }
    }

    // Categorize sources
    const url = new URL(result.url);
    let sourceType: "review" | "news" | "social" | "forum" | "regulatory" = "news";

    if (url.hostname.includes("twitter") || url.hostname.includes("x.com")) {
      sourceType = "social";
    } else if (url.hostname.includes("reddit") || url.hostname.includes("discord")) {
      sourceType = "forum";
    } else if (url.hostname.includes("medium") || url.hostname.includes("github")) {
      sourceType = "review";
    }

    sources.push({
      name: result.title,
      url: result.url,
      type: sourceType,
    });
  }

  // Calculate sentiment score
  let sentimentScore = 0;
  if (redFlags.length === 0 && positiveMentions.length > 0) {
    sentimentScore = Math.min(positiveMentions.length * 0.2, 1.0);
  } else if (redFlags.length > 0) {
    sentimentScore = -Math.min(redFlags.length * 0.3, 1.0);
  }

  return {
    sentimentScore,
    redFlags: [...new Set(redFlags)], // Deduplicate
    positiveMentions: [...new Set(positiveMentions)],
    negativeMentions: [], // Could be expanded
    summary: generateSummary(results, redFlags, positiveMentions),
    sources,
  };
}

function generateSummary(
  results: TavilySearchResult[],
  redFlags: string[],
  positiveMentions: string[]
): string {
  if (results.length === 0) {
    return "No web presence found for this trader. Proceed with caution.";
  }

  const hasRedFlags = redFlags.length > 0;
  const hasPositive = positiveMentions.length > 0;

  if (hasRedFlags && !hasPositive) {
    return `⚠️ Multiple red flags detected (${redFlags.length} findings). Strongly recommend avoiding this trader until concerns are resolved.`;
  }

  if (hasRedFlags && hasPositive) {
    return `⚠️ Mixed signals: ${positiveMentions.length} positive mentions but ${redFlags.length} red flag(s) detected. Further investigation recommended.`;
  }

  if (!hasRedFlags && hasPositive) {
    return `✅ Positive reputation found across ${positiveMentions.length} sources. No significant red flags detected.`;
  }

  return `ℹ️ Limited information available. ${results.length} sources found but no clear positive or negative signals.`;
}
```

---

## 5.4 Scoring API Routes

### src/app/api/traders/scoring/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { calculateTraderScore } from "@/lib/groq/scoring";
import { checkTraderReputation } from "@/lib/tavily/reputation";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, displayName } = await request.json();

    if (!walletAddress) {
      return NextResponse.json(
        { error: "Wallet address required" },
        { status: 400 }
      );
    }

    // 1. Fetch on-chain trading data
    const tradingData = await fetchOnChainTradingData(walletAddress);

    // 2. Check web reputation via Tavily
    const tavilyReport = await checkTraderReputation(walletAddress, displayName);

    // 3. Calculate AI score via Groq
    const score = await calculateTraderScore(tradingData, tavilyReport);

    // 4. Store results in Supabase
    const supabase = createClient();
    await supabase.from("trader_scores").upsert({
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
    });

    return NextResponse.json({
      score,
      reputation: {
        sentimentScore: tavilyReport.sentimentScore,
        redFlags: tavilyReport.redFlags,
        sources: tavilyReport.sources.length,
      },
    });
  } catch (error) {
    console.error("[Scoring API] Error:", error);
    return NextResponse.json(
      { error: "Scoring failed" },
      { status: 500 }
    );
  }
}

async function fetchOnChainTradingData(
  walletAddress: string
): Promise<TraderData> {
  // Fetch trading history from Casper RPC
  // Parse deploys to extract trade information
  // Aggregate into TraderData format

  // Placeholder implementation
  return {
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
}
```

---

## 5.5 Supabase Schema Extension

```sql
-- Trader AI scores
CREATE TABLE trader_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL REFERENCES traders(wallet_address),
  overall_score NUMERIC(5,2) NOT NULL,
  win_rate_score NUMERIC(5,2) DEFAULT 0,
  consistency_score NUMERIC(5,2) DEFAULT 0,
  risk_score NUMERIC(5,2) DEFAULT 0,
  volume_legitimacy_score NUMERIC(5,2) DEFAULT 0,
  risk_level TEXT DEFAULT 'medium',
  recommendation TEXT DEFAULT 'caution',
  reasoning TEXT,
  red_flags TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  tavily_sentiment NUMERIC(5,2) DEFAULT 0,
  tavily_summary TEXT,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scoring cache (avoid re-scoring too frequently)
CREATE TABLE scoring_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  score_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Scoring requests log
CREATE TABLE scoring_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  requested_by TEXT, -- follower who requested the score
  score_id UUID REFERENCES trader_scores(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trader_scores_overall ON trader_scores(overall_score DESC);
CREATE INDEX idx_trader_scores_recommendation ON trader_scores(recommendation);
```

---

## 5.6 Frontend: Scoring Display Component

### src/components/trader/TraderScoreCard.tsx

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Shield, AlertTriangle, CheckCircle, TrendingUp, Activity } from "lucide-react";

interface TraderScoreCardProps {
  score: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "subscribe" | "caution" | "avoid";
  reasoning: string;
  redFlags: string[];
  strengths: string[];
}

export function TraderScoreCard({
  score,
  riskLevel,
  recommendation,
  reasoning,
  redFlags,
  strengths,
}: TraderScoreCardProps) {
  const scoreColor =
    score >= 70
      ? "text-profit"
      : score >= 40
        ? "text-yellow-400"
        : "text-loss";

  const scoreBackground =
    score >= 70
      ? "bg-profit/10 border-profit/30"
      : score >= 40
        ? "bg-yellow-400/10 border-yellow-400/30"
        : "bg-loss/10 border-loss/30";

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h3 className="text-lg font-semibold">AI Reputation Score</h3>
        </div>
        {recommendation === "subscribe" && (
          <span className="flex items-center gap-1 text-xs text-profit bg-profit/10 px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" /> Recommended
          </span>
        )}
        {recommendation === "caution" && (
          <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Caution
          </span>
        )}
        {recommendation === "avoid" && (
          <span className="flex items-center gap-1 text-xs text-loss bg-loss/10 px-2 py-1 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Avoid
          </span>
        )}
      </div>

      {/* Score Circle */}
      <div className="flex justify-center">
        <div
          className={cn(
            "relative w-24 h-24 rounded-full flex items-center justify-center border-2",
            scoreBackground
          )}
        >
          <span className={cn("text-3xl font-bold font-mono", scoreColor)}>
            {score}
          </span>
          <span className="absolute -bottom-1 text-xs text-muted-foreground">
            /100
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {reasoning}
      </p>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-profit" />
            Strengths
          </h4>
          <ul className="space-y-1">
            {strengths.map((strength, i) => (
              <li
                key={i}
                className="text-xs text-profit/80 flex items-start gap-2"
              >
                <span className="mt-0.5">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Red Flags */}
      {redFlags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-loss" />
            Red Flags
          </h4>
          <ul className="space-y-1">
            {redFlags.map((flag, i) => (
              <li
                key={i}
                className="text-xs text-loss/80 flex items-start gap-2"
              >
                <span className="mt-0.5">•</span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Level Indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Risk Level
        </span>
        <span
          className={cn(
            "text-sm font-semibold px-2 py-0.5 rounded",
            riskLevel === "low" && "text-profit bg-profit/10",
            riskLevel === "medium" && "text-yellow-400 bg-yellow-400/10",
            riskLevel === "high" && "text-loss bg-loss/10"
          )}
        >
          {riskLevel.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
```

---

## 5.7 Verification Checklist

- [ ] Groq API key configured and working
- [ ] Tavily API key configured and working
- [ ] Trader scoring returns valid JSON with all fields
- [ ] Tavily reputation check returns results for known traders
- [ ] Scores are cached to avoid unnecessary API calls
- [ ] Score display component renders correctly
- [ ] Edge cases: unknown trader, empty history, API failures
- [ ] Rate limiting on scoring API (prevent abuse)
- [ ] Scoring cache invalidation after 24 hours

---

**Phase 5 Complete.** The AI reputation scoring system can now evaluate traders. Phase 6 will build the frontend dashboard and wallet integration.
