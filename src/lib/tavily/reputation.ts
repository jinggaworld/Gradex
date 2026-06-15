/**
 * Tavily Reputation Check for Gradex.
 *
 * Searches the web for trader mentions, reviews, and red flags using the Tavily API.
 * Provides a comprehensive reputation report including sentiment analysis.
 */

interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  raw_content?: string;
}

interface TavilyApiResponse {
  results: TavilySearchResult[];
  answer?: string;
  query: string;
}

export interface TavilyReputationReport {
  traderName: string;
  walletAddress: string;
  searchResults: TavilySearchResult[];
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
  lastChecked: string;
}

/**
 * Check trader reputation using Tavily search API.
 * Searches by wallet address and display name for comprehensive coverage.
 */
export async function checkTraderReputation(
  walletAddress: string,
  displayName?: string,
): Promise<TavilyReputationReport> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return generateEmptyReport(walletAddress, displayName, "Tavily API key not configured");
  }

  const queries = buildReputationQueries(walletAddress, displayName);
  const allResults: TavilySearchResult[] = [];

  for (const query of queries) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
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
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        console.warn(`[Tavily] API returned ${response.status} for query: ${query}`);
        continue;
      }

      const data = (await response.json()) as TavilyApiResponse;
      if (data.results) {
        allResults.push(...data.results);
      }
    } catch (error) {
      console.error(`[Tavily] Search failed for query: "${query}":`, error);
    }
  }

  const uniqueResults = deduplicateResults(allResults);
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
  displayName?: string,
): string[] {
  const queries = [
    `${walletAddress} Casper blockchain trader review`,
    `${walletAddress} crypto scam check`,
  ];

  if (displayName) {
    queries.push(
      `${displayName} Casper trader reputation`,
      `${displayName} crypto trading performance review`,
      `${displayName} DeFi trader analysis`,
    );
  }

  return queries;
}

function deduplicateResults(
  results: TavilySearchResult[],
): TavilySearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}

const RED_FLAG_KEYWORDS = [
  "scam",
  "rug",
  "fraud",
  "fake",
  "wash trade",
  "pump and dump",
  "manipulation",
  "ponzi",
  "exploit",
  "hack",
  "phishing",
  "unauthorized",
  "complaint",
  "lawsuit",
  "investigation",
];

const POSITIVE_KEYWORDS = [
  "profitable",
  "consistent",
  "trusted",
  "verified",
  "expert",
  "reliable",
  "transparent",
  "successful",
  "top trader",
];

function analyzeSearchResults(results: TavilySearchResult[]) {
  const redFlags: string[] = [];
  const positiveMentions: string[] = [];
  const negativeMentions: string[] = [];
  const sources: TavilyReputationReport["sources"] = [];

  for (const result of results) {
    const content = (
      result.content +
      " " +
      (result.raw_content || "")
    ).toLowerCase();
    const title = result.title.toLowerCase();

    // Check for red flags
    for (const keyword of RED_FLAG_KEYWORDS) {
      if (content.includes(keyword) || title.includes(keyword)) {
        redFlags.push(
          `Found "${keyword}" in: ${result.title} (${result.url})`,
        );
      }
    }

    // Check for positive mentions
    for (const keyword of POSITIVE_KEYWORDS) {
      if (content.includes(keyword)) {
        positiveMentions.push(`"${keyword}" found in: ${result.title}`);
        break;
      }
    }

    // Categorize sources
    try {
      const url = new URL(result.url);
      let sourceType: "review" | "news" | "social" | "forum" | "regulatory" =
        "news";

      if (
        url.hostname.includes("twitter") ||
        url.hostname.includes("x.com")
      ) {
        sourceType = "social";
      } else if (
        url.hostname.includes("reddit") ||
        url.hostname.includes("discord")
      ) {
        sourceType = "forum";
      } else if (
        url.hostname.includes("medium") ||
        url.hostname.includes("github")
      ) {
        sourceType = "review";
      }

      sources.push({
        name: result.title,
        url: result.url,
        type: sourceType,
      });
    } catch {
      // Skip invalid URLs
    }
  }

  // Calculate sentiment score (-1.0 to 1.0)
  let sentimentScore = 0;
  if (redFlags.length === 0 && positiveMentions.length > 0) {
    sentimentScore = Math.min(positiveMentions.length * 0.2, 1.0);
  } else if (redFlags.length > 0) {
    sentimentScore = -Math.min(redFlags.length * 0.3, 1.0);
  }

  return {
    sentimentScore,
    redFlags: [...new Set(redFlags)],
    positiveMentions: [...new Set(positiveMentions)],
    negativeMentions: [...new Set(negativeMentions)],
    summary: generateSummary(results, redFlags, positiveMentions),
    sources,
  };
}

function generateSummary(
  results: TavilySearchResult[],
  redFlags: string[],
  positiveMentions: string[],
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

function generateEmptyReport(
  walletAddress: string,
  displayName?: string,
  reason?: string,
): TavilyReputationReport {
  return {
    traderName: displayName || walletAddress,
    walletAddress,
    searchResults: [],
    sentimentScore: 0,
    redFlags: [],
    positiveMentions: [],
    negativeMentions: [],
    summary: reason
      ? `⚠️ ${reason}. Cannot perform web reputation check.`
      : "No web presence found for this trader.",
    sources: [],
    lastChecked: new Date().toISOString(),
  };
}
