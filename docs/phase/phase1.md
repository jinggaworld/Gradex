# Phase 1: Project Foundation & Infrastructure Setup

**Goal:** Establish the complete development environment, project scaffolding, and infrastructure for Gradex — the on-chain social trading protocol on Casper Network.

**Duration:** 3-4 days

---

## 1.1 Prerequisites & Tooling Installation

### Rust & Wasm Toolchain
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add Wasm target for Casper smart contract compilation
rustup target add wasm32-unknown-unknown

# Install just (command runner used by Odra)
cargo install just

# Install cargo-odra CLI
cargo install cargo-odra
```

### Node.js & Package Management
```bash
# Use Node 20+ LTS
nvm install 20
nvm use 20

# Install pnpm for fast, disk-efficient package management
npm install -g pnpm
```

### Next.js Project Scaffolding
```bash
# Create the Next.js project with TypeScript + Tailwind
npx create-next-app@latest gradex \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"

cd gradex
```

### Odra Smart Contract Project
```bash
# Create Odra project alongside Next.js
cargo odra new gradex-contracts --lib

# This creates: gradex-contracts/ with Cargo.toml, src/lib.rs
```

---

## 1.2 Complete Project Structure

```
gradex/
├── src/                          # Next.js frontend (App Router)
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Landing page
│   │   ├── dashboard/           # User dashboard (protected)
│   │   ├── traders/             # Trader discovery & browse
│   │   ├── vault/[id]/          # Individual vault page
│   │   ├── leaderboard/         # Rankings & stats
│   │   ├── api/                 # Backend API routes
│   │   │   ├── traders/         # Trader CRUD & scoring
│   │   │   ├── vaults/          # Vault management
│   │   │   ├── subscriptions/   # Subscription handling
│   │   │   └── x402/            # x402 payment webhooks
│   │   └── subscribe/           # Subscribe flow
│   ├── components/              # Shared React components
│   │   ├── ui/                  # Base UI primitives
│   │   ├── wallet/              # Wallet connection
│   │   ├── vault/               # Vault components
│   │   ├── trader/              # Trader cards & lists
│   │   └── leaderboard/         # Leaderboard components
│   ├── lib/                     # Core utilities
│   │   ├── casper/              # Casper SDK wrappers
│   │   │   ├── client.ts        # RPC client setup
│   │   │   ├── deploy.ts        # Deploy helpers
│   │   │   ├── vault.ts         # Vault contract interactions
│   │   │   └── wallet.ts        # Wallet connection helpers
│   │   ├── groq/                # Groq AI client
│   │   │   └── scoring.ts       # Reputation scoring logic
│   │   ├── tavily/              # Tavily search client
│   │   │   └── reputation.ts    # Trader reputation check
│   │   ├── supabase/            # Supabase client
│   │   │   ├── client.ts        # Server & browser clients
│   │   │   └── leaderboard.ts   # Leaderboard queries
│   │   ├── x402/                # x402 protocol helpers
│   │   │   └── payment.ts       # Payment negotiation
│   │   └── utils.ts             # General utilities
│   ├── hooks/                   # Custom React hooks
│   │   ├── useWallet.ts         # Wallet connection state
│   │   ├── useVault.ts          # Vault data fetching
│   │   ├── useTrader.ts         # Trader data & scoring
│   │   └── useSubscription.ts   # Subscription management
│   └── types/                   # TypeScript type definitions
│       ├── casper.ts            # Casper-specific types
│       ├── vault.ts             # Vault & copy trade types
│       ├── trader.ts            # Trader profile types
│       └── supabase.ts          # Database row types
├── gradex-contracts/            # Odra smart contracts
│   ├── Cargo.toml
│   ├── src/
│   │   ├── lib.rs               # Module exports
│   │   ├── vault.rs             # Copy Vault contract
│   │   ├── copy_engine.rs       # Copy trade execution engine
│   │   ├── royalty.rs           # x402 royalty distribution
│   │   ├── trader_registry.rs   # Trader on-chain registry
│   │   └── types.rs             # Shared contract types
│   └── tests/                   # Odra integration tests
│       ├── vault_tests.rs
│       ├── copy_engine_tests.rs
│       └── royalty_tests.rs
├── docs/                        # Documentation
│   └── phase/                   # Phase-by-phase guides
├── scripts/                     # Deployment & utility scripts
│   ├── deploy-testnet.ts        # Testnet deployment
│   ├── deploy-mainnet.ts        # Mainnet deployment
│   └── seed-data.ts             # Seed test data
├── .env.local                   # Environment variables
├── .env.example                 # Example env template
├── next.config.ts
├── tailwind.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

---

## 1.3 Frontend Dependencies

```bash
pnpm add casper-js-sdk @supabase/supabase-js @supabase/ssr
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu
pnpm add @radix-ui/react-tabs @radix-ui/react-tooltip
pnpm add @radix-ui/react-progress @radix-ui/react-slider
pnpm add @radix-ui/react-toast @radix-ui/react-switch
pnpm add class-variance-authority clsx tailwind-merge
pnpm add lucide-react recharts date-fns
pnpm add zod react-hook-form @hookform/resolvers
pnpm add next-themes

# Dev dependencies
pnpm add -D @types/node prettier eslint-config-prettier
pnpm add -D tailwindcss-animate
```

---

## 1.4 Environment Variables (.env.example)

```env
# Casper Network
NEXT_PUBLIC_CASPER_RPC_URL=https://rpc.testnet.casper.network/rpc
NEXT_PUBLIC_CASPER_SSE_URL=ws://node.testnet.casper.network:9999/events/main
NEXT_PUBLIC_CASPER_CHAIN_NAME=casper-test
NEXT_PUBLIC_VAULT_CONTRACT_HASH=
NEXT_PUBLIC_COPY_ENGINE_HASH=
NEXT_PUBLIC_ROYALTY_HASH=

# Groq AI (AI Reputation Scoring)
GROQ_API_KEY=your_groq_api_key

# Tavily Search (Reputation Check)
TAVILY_API_KEY=your_tavily_api_key

# Supabase (Leaderboard & Off-chain Storage)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# x402 Micropayments
X402_PRIVATE_KEY=your_x402_signing_key
X402_PAYMENT_ADDRESS=your_payment_wallet_address
```

---

## 1.5 Odra Smart Contract Foundation

### gradex-contracts/Cargo.toml
```toml
[package]
name = "gradex-contracts"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "lib"]

[dependencies]
odra = { version = "2", features = ["casper"] }
odra-modules = { version = "2", features = ["casper"] }
casper-types = "5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
odra-test = "2"

[profile.release]
lto = true
opt-level = "z"
codegen-units = 1
```

### gradex-contracts/src/types.rs
```rust
use odra::prelude::*;
use odra::Address;

#[odra(odra_type)]
pub struct AllocationConfig {
    pub follower: Address,
    pub trader: Address,
    pub allocated_amount: U512,
    pub max_drawdown: U256,
    pub auto_compound: bool,
    pub is_active: bool,
    pub subscribed_at: u64,
}

#[odra(odra_type)]
pub struct CopyTradeRecord {
    pub id: u64,
    pub follower: Address,
    pub trader: Address,
    pub original_tx_hash: String,
    pub copied_tx_hash: Option<String>,
    pub dex: String,
    pub action: String,
    pub token: String,
    pub token_amount: U512,
    pub cspr_amount: U512,
    pub status: String,
    pub executed_at: Option<u64>,
    pub profit: Option<U512>,
}

#[odra(odra_type)]
pub struct RoyaltyPayment {
    pub id: u64,
    pub trader: Address,
    pub follower: Address,
    pub vault_id: u32,
    pub profit_amount: U512,
    pub royalty_amount: U512,
    pub paid_at: u64,
}

#[odra(odra_type)]
pub struct TraderProfile {
    pub address: Address,
    pub total_followers: u32,
    pub total_volume: U512,
    pub total_royalties_earned: U512,
    pub performance_fee_bps: u16,
    pub is_registered: bool,
    pub registered_at: u64,
}
```

### gradex-contracts/src/lib.rs
```rust
pub mod types;
pub mod vault;
pub mod copy_engine;
pub mod royalty;
pub mod trader_registry;
```

---

## 1.6 Supabase Schema Foundation

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Traders table
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
  reputation_score NUMERIC(5,2) DEFAULT 0,
  consistent_score NUMERIC(5,2) DEFAULT 0,
  risk_level TEXT DEFAULT 'medium',
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_trade_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Leaderboard (materialized view)
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

-- Vaults table (off-chain metadata)
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
  performance_fee INTEGER DEFAULT 0,
  subscription_fee NUMERIC(40,0) DEFAULT 0,
  frequency TEXT DEFAULT 'per_trade',
  is_active BOOLEAN DEFAULT true,
  risk_level TEXT DEFAULT 'medium',
  strategy TEXT,
  roi_30d NUMERIC(10,2) DEFAULT 0,
  roi_7d NUMERIC(10,2) DEFAULT 0,
  drawdown NUMERIC(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Copy positions table
CREATE TABLE copy_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_address TEXT NOT NULL,
  vault_id UUID NOT NULL REFERENCES vaults(id),
  allocated_amount NUMERIC(40,0) NOT NULL,
  current_value NUMERIC(40,0) DEFAULT 0,
  pnl NUMERIC(40,0) DEFAULT 0,
  pnl_percentage NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  auto_compound BOOLEAN DEFAULT false,
  max_drawdown NUMERIC(10,2) DEFAULT 50,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  last_copy_trade_at TIMESTAMPTZ,
  total_profits_distributed NUMERIC(40,0) DEFAULT 0,
  total_royalties_paid NUMERIC(40,0) DEFAULT 0
);

-- Enable Realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;
ALTER PUBLICATION supabase_realtime ADD TABLE traders;
ALTER PUBLICATION supabase_realtime ADD TABLE vaults;

-- Row Level Security
ALTER TABLE traders ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_positions ENABLE ROW LEVEL SECURITY;
```

---

## 1.7 TypeScript Type Definitions

### src/types/trader.ts
```typescript
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
```

### src/types/vault.ts
```typescript
export interface Vault {
  id: string;
  vaultContractHash: string;
  traderAddress: string;
  name: string;
  description: string;
  totalAllocated: string;
  totalFollowers: number;
  minAllocation: string;
  maxAllocation: string;
  performanceFee: number;
  subscriptionFee: string;
  frequency: "per_trade" | "daily" | "weekly" | "monthly";
  isActive: boolean;
  createdAt: Date;
  strategy: string;
  riskLevel: "low" | "medium" | "high";
  roi30d: number;
  roi7d: number;
  drawdown: number;
}

export interface CopyPosition {
  id: string;
  followerAddress: string;
  vaultId: string;
  allocatedAmount: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: number;
  isActive: boolean;
  autoCompound: boolean;
  maxDrawdown: number;
  subscribedAt: Date;
  lastCopyTradeAt?: Date;
  totalProfitsDistributed: string;
  totalRoyaltiesPaid: string;
}
```

### src/types/casper.ts
```typescript
export interface CasperWalletInfo {
  isConnected: boolean;
  publicKey: string | null;
  activeKey: string | null;
  balance: string;
}

export interface DeployResult {
  deployHash: string;
  blockHash?: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
  cost?: string;
}

export interface VaultContractState {
  totalDeposits: string;
  totalWithdrawals: string;
  totalCopiedVolume: string;
  followerCount: number;
  traderShare: string;
  performanceFees: string;
  isPaused: boolean;
}
```

---

## 1.8 Base Utility Library

### src/lib/utils.ts
```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCSPR(amount: string | bigint, decimals = 9): string {
  const num = typeof amount === "string" ? BigInt(amount) : amount;
  const sign = num < 0 ? "-" : "";
  const abs = num < 0 ? -num : num;
  const whole = abs / BigInt(10 ** decimals);
  const fraction = abs % BigInt(10 ** decimals);
  return `${sign}${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 4)}`;
}

export function parseCSPR(amount: string): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  const padded = fraction.padEnd(9, "0").slice(0, 9);
  return BigInt(whole) * BigInt(10 ** 9) + BigInt(padded || "0");
}

export function shortenAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## 1.9 Verification Checklist

- [ ] Rust toolchain + `wasm32-unknown-unknown` target installed
- [ ] `cargo-odra` CLI installed and working
- [ ] Next.js dev server starts without errors
- [ ] Odra project compiles (`cd gradex-contracts && cargo build`)
- [ ] Supabase project created and tables deployed
- [ ] All environment variables configured
- [ ] Casper Testnet faucet CSPR obtained
- [ ] Git repository initialized with initial commit

---

**Phase 1 Complete.** The foundation is now ready for smart contract development in Phase 2.
