export interface Trader {
  walletAddress: string;
  publicKey: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  totalFollowers: number;
  totalVolume: string;
  totalPnL: string;
  winRate: number;
  totalTrades: number;
  avgTradeSize: string;
  consistentScore: number;
  reputationScore: number;
  isVerified: boolean;
  isActive: boolean;
  joinedAt: Date;
  lastTradeAt?: Date;
  riskLevel: "low" | "medium" | "high";
  preferredDexes: string[];
  tags: string[];
}

export interface TraderSummary {
  walletAddress: string;
  displayName: string;
  reputationScore: number;
  totalVolume: string;
  winRate: number;
  totalFollowers: number;
  roi30d: number;
  riskLevel: string;
}
