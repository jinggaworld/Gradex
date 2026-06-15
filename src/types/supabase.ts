export interface DbTrader {
  id: string;
  wallet_address: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  total_followers: number;
  total_volume: string;
  total_pnl: string;
  win_rate: number;
  total_trades: number;
  reputation_score: number;
  consistent_score: number;
  risk_level: string;
  is_verified: boolean;
  is_active: boolean;
  tags: string[];
  created_at: string;
  last_trade_at: string | null;
  updated_at: string;
}

export interface DbLeaderboardEntry {
  id: string;
  trader_address: string;
  display_name: string;
  rank: number;
  score: number;
  roi_30d: number;
  roi_7d: number;
  followers_count: number;
  volume_30d: string;
  win_rate: number;
  updated_at: string;
}

export interface DbVault {
  id: string;
  contract_hash: string;
  trader_address: string;
  name: string;
  description: string | null;
  total_allocated: string;
  total_followers: number;
  min_allocation: string;
  max_allocation: string | null;
  performance_fee: number;
  subscription_fee: string;
  frequency: string;
  is_active: boolean;
  risk_level: string;
  strategy: string | null;
  roi_30d: number;
  roi_7d: number;
  drawdown: number;
  created_at: string;
  updated_at: string;
}

export interface DbTraderScore {
  id: string;
  wallet_address: string;
  overall_score: number;
  win_rate_score: number;
  consistency_score: number;
  risk_score: number;
  volume_legitimacy_score: number;
  risk_level: string;
  recommendation: string;
  reasoning: string | null;
  red_flags: string[];
  strengths: string[];
  tavily_sentiment: number;
  tavily_summary: string | null;
  evaluated_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbScoringCache {
  id: string;
  wallet_address: string;
  score_data: Record<string, unknown>;
  cached_at: string;
  expires_at: string;
}

export interface DbScoringRequest {
  id: string;
  wallet_address: string;
  requested_by: string | null;
  score_id: string | null;
  created_at: string;
}

export interface DbRoyaltyPayment {
  id: string;
  payment_id: number;
  trader_address: string;
  follower_address: string;
  vault_id: string;
  profit_amount: string;
  royalty_amount: string;
  royalty_rate_bps: number;
  transaction_hash: string | null;
  payment_method: "x402" | "onchain";
  paid_at: string;
}

export interface DbTraderPayout {
  id: string;
  trader_address: string;
  total_earned: string;
  total_payments: number;
  avg_royalty_rate: number;
  last_payout_at: string | null;
  updated_at: string;
}
export interface DbCopyPosition {
  id: string;
  follower_address: string;
  vault_id: string;
  allocated_amount: string;
  current_value: string;
  pnl: string;
  pnl_percentage: number;
  is_active: boolean;
  auto_compound: boolean;
  max_drawdown: number;
  subscribed_at: string;
  last_copy_trade_at: string | null;
  total_profits_distributed: string;
  total_royalties_paid: string;
}
