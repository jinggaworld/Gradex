import type { ReputationScore, TraderData } from "@/lib/groq/scoring";

export interface ScoringRequest {
  walletAddress: string;
  displayName?: string;
  requestedBy?: string;
}

export interface ScoringResponse {
  score: ReputationScore;
  reputation: {
    sentimentScore: number;
    redFlags: string[];
    sourceCount: number;
  };
  cached: boolean;
  evaluatedAt: string;
}

export interface TraderScoreRecord {
  id: string;
  walletAddress: string;
  overallScore: number;
  winRateScore: number;
  consistencyScore: number;
  riskScore: number;
  volumeLegitimacyScore: number;
  riskLevel: string;
  recommendation: string;
  reasoning: string;
  redFlags: string[];
  strengths: string[];
  tavilySentiment: number;
  tavilySummary: string;
  evaluatedAt: string;
}

export interface ScoringCache {
  id: string;
  walletAddress: string;
  scoreData: ScoringResponse;
  cachedAt: string;
  expiresAt: string;
}

export { type ReputationScore, type TraderData };
