-- Gradex Supabase Schema
-- Complete migration for all tables used across all 10 phases
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ════════════════════════════════════════════════════════════════
-- TRADERS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE traders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  total_followers INTEGER DEFAULT 0,
  total_volume NUMERIC(40,0) DEFAULT 0,
  total_pnl NUMERIC(40,0) DEFAULT 0,
  win_rate NUMERIC(5,2) DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  avg_trade_size NUMERIC(40,0) DEFAULT 0,
  max_drawdown NUMERIC(5,2) DEFAULT 0,
  sharpe_ratio NUMERIC(5,2) DEFAULT 0,
  trade_frequency NUMERIC(5,2) DEFAULT 0,
  risk_management_score INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 0,
  consistent_score INTEGER DEFAULT 0,
  risk_level TEXT DEFAULT 'medium',
  roi_30d NUMERIC(10,2) DEFAULT 0,
  roi_7d NUMERIC(10,2) DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  preferred_dexes TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_traders_wallet ON traders(wallet_address);
CREATE INDEX idx_traders_active ON traders(is_active);
CREATE INDEX idx_traders_reputation ON traders(reputation_score DESC);
CREATE INDEX idx_traders_volume ON traders(total_volume DESC);

-- ════════════════════════════════════════════════════════════════
-- VAULTS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE vaults (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_hash TEXT UNIQUE NOT NULL,
  trader_address TEXT NOT NULL REFERENCES traders(wallet_address),
  name TEXT NOT NULL,
  description TEXT,
  total_allocated NUMERIC(40,0) DEFAULT 0,
  total_followers INTEGER DEFAULT 0,
  min_allocation NUMERIC(40,0) DEFAULT 0,
  max_allocation NUMERIC(40,0),
  performance_fee INTEGER DEFAULT 200,
  subscription_fee NUMERIC(40,0) DEFAULT 0,
  frequency TEXT DEFAULT 'per_trade',
  is_active BOOLEAN DEFAULT true,
  risk_level TEXT DEFAULT 'medium',
  strategy TEXT,
  roi_30d NUMERIC(10,2) DEFAULT 0,
  roi_7d NUMERIC(10,2) DEFAULT 0,
  drawdown NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vaults_trader ON vaults(trader_address);
CREATE INDEX idx_vaults_active ON vaults(is_active);

-- ════════════════════════════════════════════════════════════════
-- COPY POSITIONS (follower subscriptions)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE copy_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_address TEXT NOT NULL,
  vault_id UUID NOT NULL REFERENCES vaults(id),
  allocated_amount NUMERIC(40,0) NOT NULL,
  current_value NUMERIC(40,0) DEFAULT 0,
  pnl NUMERIC(40,0) DEFAULT 0,
  pnl_percentage NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  auto_compound BOOLEAN DEFAULT true,
  max_drawdown INTEGER DEFAULT 50,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_copy_trade_at TIMESTAMPTZ,
  total_profits_distributed NUMERIC(40,0) DEFAULT 0,
  total_royalties_paid NUMERIC(40,0) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_positions_follower ON copy_positions(follower_address);
CREATE INDEX idx_positions_vault ON copy_positions(vault_id);
CREATE INDEX idx_positions_active ON copy_positions(is_active);

-- ════════════════════════════════════════════════════════════════
-- COPY TRADES
-- ════════════════════════════════════════════════════════════════

CREATE TABLE copy_trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_address TEXT NOT NULL,
  vault_id UUID REFERENCES vaults(id),
  original_tx_hash TEXT NOT NULL,
  copied_tx_hash TEXT,
  dex TEXT,
  action TEXT NOT NULL,
  token TEXT,
  token_amount NUMERIC(40,0) DEFAULT 0,
  cspr_amount NUMERIC(40,0) DEFAULT 0,
  status TEXT DEFAULT 'pending',
  profit NUMERIC(40,0),
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trades_follower ON copy_trades(follower_address);
CREATE INDEX idx_trades_status ON copy_trades(status);
CREATE INDEX idx_trades_executed ON copy_trades(executed_at DESC);

-- ════════════════════════════════════════════════════════════════
-- LEADERBOARD (refreshed periodically)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE leaderboard (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_address TEXT UNIQUE NOT NULL REFERENCES traders(wallet_address),
  display_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  score NUMERIC(10,2) NOT NULL,
  roi_30d NUMERIC(10,2) DEFAULT 0,
  roi_7d NUMERIC(10,2) DEFAULT 0,
  followers_count INTEGER DEFAULT 0,
  volume_30d NUMERIC(40,0) DEFAULT 0,
  win_rate NUMERIC(5,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaderboard_rank ON leaderboard(rank ASC);

-- ════════════════════════════════════════════════════════════════
-- TRADER AI SCORES (from Groq + Tavily)
-- ════════════════════════════════════════════════════════════════

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

CREATE INDEX idx_scores_overall ON trader_scores(overall_score DESC);
CREATE INDEX idx_scores_recommendation ON trader_scores(recommendation);

-- ════════════════════════════════════════════════════════════════
-- SCORING CACHE
-- ════════════════════════════════════════════════════════════════

CREATE TABLE scoring_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT UNIQUE NOT NULL,
  score_data JSONB NOT NULL,
  cached_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- SCORING REQUESTS LOG
-- ════════════════════════════════════════════════════════════════

CREATE TABLE scoring_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_address TEXT NOT NULL,
  requested_by TEXT,
  score_id UUID REFERENCES trader_scores(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- ROYALTY PAYMENTS
-- ════════════════════════════════════════════════════════════════

CREATE TABLE royalty_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id BIGINT,
  trader_address TEXT NOT NULL REFERENCES traders(wallet_address),
  follower_address TEXT NOT NULL,
  vault_id UUID REFERENCES vaults(id),
  profit_amount NUMERIC(40,0) NOT NULL,
  royalty_amount NUMERIC(40,0) NOT NULL,
  royalty_rate_bps INTEGER DEFAULT 500,
  transaction_hash TEXT,
  payment_method TEXT DEFAULT 'onchain',
  paid_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_royalty_trader ON royalty_payments(trader_address);
CREATE INDEX idx_royalty_follower ON royalty_payments(follower_address);
CREATE INDEX idx_royalty_paid_at ON royalty_payments(paid_at DESC);

-- ════════════════════════════════════════════════════════════════
-- TRADER PAYOUTS (aggregated)
-- ════════════════════════════════════════════════════════════════

CREATE TABLE trader_payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trader_address TEXT UNIQUE NOT NULL REFERENCES traders(wallet_address),
  total_earned NUMERIC(40,0) DEFAULT 0,
  total_payments INTEGER DEFAULT 0,
  avg_royalty_rate NUMERIC(5,2) DEFAULT 0,
  last_payout_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════════════════════════════════════════════════════════════════
-- LEADERBOARD REFRESH FUNCTION
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION calculate_leaderboard_score(
  win_rate NUMERIC,
  roi_30d NUMERIC,
  ai_reputation NUMERIC,
  followers_count INTEGER,
  volume_30d NUMERIC
) RETURNS NUMERIC(10,2) AS $$
DECLARE
  max_followers INTEGER;
  max_volume NUMERIC;
  roi_normalized NUMERIC;
  followers_normalized NUMERIC;
  volume_normalized NUMERIC;
BEGIN
  SELECT COALESCE(MAX(total_followers), 1) INTO max_followers FROM traders;
  SELECT COALESCE(MAX(total_volume), 1) INTO max_volume FROM traders;

  roi_normalized := GREATEST(0, LEAST(100, (roi_30d + 100) / 2));
  followers_normalized := (followers_count::NUMERIC / max_followers) * 100;
  volume_normalized := (volume_30d::NUMERIC / max_volume) * 100;

  RETURN ROUND(
    COALESCE(win_rate, 0) * 0.25 +
    COALESCE(roi_normalized, 0) * 0.30 +
    COALESCE(ai_reputation, 0) * 0.25 +
    COALESCE(followers_normalized, 0) * 0.10 +
    COALESCE(volume_normalized, 0) * 0.10
  , 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  DELETE FROM leaderboard;

  INSERT INTO leaderboard (trader_address, display_name, rank, score, roi_30d, roi_7d, followers_count, volume_30d, win_rate)
  SELECT
    t.wallet_address,
    t.display_name,
    ROW_NUMBER() OVER (ORDER BY calculate_leaderboard_score(t.win_rate, t.roi_30d, t.reputation_score, t.total_followers, t.total_volume) DESC),
    calculate_leaderboard_score(t.win_rate, t.roi_30d, t.reputation_score, t.total_followers, t.total_volume),
    t.roi_30d,
    t.roi_7d,
    t.total_followers,
    t.total_volume,
    t.win_rate
  FROM traders t
  WHERE t.is_active = true
    AND t.total_trades > 10;

  UPDATE leaderboard SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ════════════════════════════════════════════════════════════════
-- ENABLE REALTIME
-- ════════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE royalty_payments;
ALTER PUBLICATION supabase_realtime ADD TABLE copy_trades;
ALTER PUBLICATION supabase_realtime ADD TABLE trader_scores;

-- ════════════════════════════════════════════════════════════════
-- AUTO-UPDATE TRIGGER for updated_at columns
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_traders_updated_at
  BEFORE UPDATE ON traders
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_vaults_updated_at
  BEFORE UPDATE ON vaults
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_copy_positions_updated_at
  BEFORE UPDATE ON copy_positions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_trader_scores_updated_at
  BEFORE UPDATE ON trader_scores
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_trader_payouts_updated_at
  BEFORE UPDATE ON trader_payouts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_scoring_cache_updated_at
  BEFORE UPDATE ON scoring_cache
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
