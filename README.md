# Gradex — On-Chain Social Trading on Casper Network

**AI-powered copy trading protocol. Subscribe to top Casper traders. Smart contracts automatically mirror their trades. Traders earn x402 royalties when you profit.**

Built for the [Casper Agentic Buildathon 2026](https://casper.network/ai).

---

## 🌟 Features

| Feature | Description |
|---------|-------------|
| **Auto-Copy Trading** | Proportional trade mirroring via Odra vault smart contracts |
| **AI Reputation Scoring** | Groq (LLama 3.3) + Tavily evaluate trader performance, consistency, and web reputation |
| **x402 Royalties** | Trustless machine-to-machine payments — traders earn automatically when followers profit |
| **Real-Time Leaderboard** | Supabase Realtime-powered trader rankings with rank change tracking |
| **Casper Wallet Integration** | Seamless connection with Casper Wallet browser extension |
| **Copy Trade History** | Complete audit trail of every mirrored trade with PnL tracking |
| **Portfolio Management** | Allocate, adjust, auto-compound, and track performance per position |

## 🏗 Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     GRADEX SYSTEM                             │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────────┐    ┌──────────────────┐                  │
│  │   Smart Contracts│    │   AI Pipeline     │                  │
│  │   (Odra/Rust)    │    │                   │                  │
│  │                  │    │  Groq → Scoring   │                  │
│  │  CopyVault       │    │  Tavily → Web Rep │                  │
│  │  CopyEngine      │    └──────────────────┘                  │
│  │  RoyaltyDistrib. │                                          │
│  │  TraderRegistry  │    ┌──────────────────┐                  │
│  └────────┬─────────┘    │   Database        │                  │
│           │              │   (Supabase)       │                  │
│  ┌────────▼─────────┐    │                   │                  │
│  │   Off-Chain       │    │  Traders/Vaults  │                  │
│  │   Services        │    │  Positions/Trades│                  │
│  │                   │    │  Leaderboard     │                  │
│  │  SSE Listener     │    │  Royalties/Scores│                  │
│  │  Copy Executor    │    └──────────────────┘                  │
│  │  Health Monitor   │                                          │
│  └────────┬─────────┘    ┌──────────────────┐                  │
│           │              │   Frontend        │                  │
│           │              │   (Next.js 16)    │                  │
│           │              │                   │                  │
│           └──────────────► Dashboard        │                  │
│                          │  Trader Discovery │                  │
│                          │  Portfolio       │                  │
│                          │  Leaderboard     │                  │
│                          └──────────────────┘                  │
└──────────────────────────────────────────────────────────────┘
```

### Component Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Smart Contracts | Odra (Rust) | Vault, Copy Engine, Royalty, Registry |
| Frontend | Next.js 16 + TypeScript | Dashboard, trading UI, leaderboard |
| AI Scoring | Groq (LLama 3.3 70B) | Performance & consistency analysis |
| Reputation Check | Tavily Search | Web presence & red flag detection |
| Database | Supabase (PostgreSQL) | Off-chain storage, leaderboard |
| Payments | x402 Protocol | Automated royalty distribution |
| Blockchain | Casper Network | On-chain trades, deposits, payments |
| Realtime | Supabase Realtime | Live leaderboard updates |

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **Rust** with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- **Odra CLI** (`cargo install odra-cli`) or use `cargo odra` via `cargo install cargo-odra`
- **Casper Wallet** browser extension (Chrome/Firefox)
- **pnpm** (`npm install -g pnpm`) or **npm** 10+

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gradex
cd gradex

# Install frontend dependencies (choose one)
pnpm install
# or: npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys

# Start the development server
pnpm dev
# or: npm run dev
```

### Smart Contracts

```bash
cd gradex_contracts

# Run all tests
cargo odra test

# Run specific test suites
cargo odra test vault_tests
cargo odra test copy_engine_tests
cargo odra test royalty_tests
cargo odra test integration_tests

# Build for Casper testnet
cargo odra build --target casper
```

### Testnet Deployment

```bash
# Deploy individual contracts
npx ts-node scripts/deploy-testnet.ts \
  --contract gradex_contracts/target/wasm32-unknown-unknown/release/gradex_contracts.wasm \
  --args '{"owner":"YOUR_PUBLIC_KEY","name":"Gradex Vault","performance_fee_bps":200,"subscription_fee":"1000000000","min_allocation":"100000000000","max_allocation":"100000000000000"}'
```

## 📜 Smart Contracts (Testnet)

| Contract | Description | Address |
|----------|-------------|---------|
| **CopyVault** | Manages follower deposits, profit/loss tracking, allocations | Deploy via script |
| **CopyEngine** | DEX integration, proportional copy trades, anti-wash-trade | Deploy via script |
| **RoyaltyDistributor** | x402 trustless royalty payments to traders | Deploy via script |
| **TraderRegistry** | On-chain trader profiles and registration | Deploy via script |

## 🧪 Testnet

| Resource | URL |
|----------|-----|
| Network | Casper Testnet |
| RPC | https://rpc.testnet.casper.network/rpc |
| SSE | ws://node.testnet.casper.network:9999/events/main |
| Explorer | https://testnet.cspr.live |

## 🎯 Use Cases

### For Followers
1. **Discover traders** — Browse the leaderboard or explore traders with AI reputation scores
2. **Evaluate** — Run AI checks (Groq + Tavily) to assess performance and detect red flags
3. **Subscribe** — Allocate CSPR to a trader's vault with configurable drawdown and auto-compound
4. **Earn passively** — Trades are automatically mirrored proportionally to your allocation
5. **Track** — Monitor portfolio performance, PnL, and copy trade history in real-time

### For Traders
1. **Register** — Create your on-chain trader profile
2. **Attract followers** — Build reputation through consistent performance
3. **Earn automatically** — x402 royalty payments deposited when followers profit
4. **No lock-in** — Full control over your trading strategy and vault configuration

## 🔑 Environment Variables

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

## 📁 Project Structure

```
gradex/
├── src/                          # Next.js 16 frontend
│   ├── app/
│   │   ├── page.tsx              # Landing page
│   │   ├── dashboard/            # Dashboard + Portfolio + Copies
│   │   ├── traders/              # Trader discovery & detail
│   │   ├── subscribe/            # Subscription flow
│   │   ├── leaderboard/          # Leaderboard
│   │   ├── vault/                # Vault detail
│   │   └── api/                  # API routes (10 endpoints)
│   ├── components/
│   │   ├── dashboard/            # Sidebar, TopBar, Charts
│   │   ├── trader/               # Cards, Score, Stats, History
│   │   ├── portfolio/            # Summary, Table, Charts, Modal
│   │   ├── copies/               # CopyTradeRow
│   │   ├── social/               # ShareButton
│   │   ├── wallet/               # WalletConnectButton
│   │   └── ui/                   # ThemeProvider
│   ├── hooks/                    # useWallet
│   ├── lib/
│   │   ├── casper/               # SDK wrappers (client, deploy, vault, wallet)
│   │   ├── supabase/             # DB clients + queries
│   │   ├── groq/                 # AI scoring
│   │   ├── tavily/               # Web reputation
│   │   └── x402/                 # x402 protocol client
│   └── types/                    # TypeScript interfaces
├── gradex_contracts/              # Odra smart contracts (Rust)
│   ├── src/
│   │   ├── vault.rs              # CopyVault contract
│   │   ├── copy_engine.rs        # CopyEngine contract
│   │   ├── royalty.rs            # RoyaltyDistributor contract
│   │   ├── trader_registry.rs    # TraderRegistry contract
│   │   └── types.rs              # Shared types
│   └── tests/                    # Unit + integration tests
├── scripts/                      # Deployment, monitoring, execution
├── supabase/                     # SQL migrations
├── playwright.config.ts          # E2E test config
└── docs/                         # Phase documentation
```

## 💻 Development

```bash
# Frontend
pnpm dev                 # Start dev server (localhost:3000)
npm run dev
pnpm build               # Production build
npm run build
pnpm lint                # Run ESLint
npm run lint

# Smart Contracts
cd gradex_contracts
cargo odra test       # Run all contract tests
cargo odra build      # Build Wasm artifacts

# E2E Tests
npx playwright install
npx playwright test

# Monitoring
npx ts-node scripts/monitor.ts
```

## 🔗 Links

- [Demo Video](https://youtu.be/your-video) (Coming Soon)
- [Casper AI Toolkit](https://casper.network/ai)
- [Odra Documentation](https://odra.dev)
- [Casper Wallet](https://www.casperwallet.io/)

## 📄 License

MIT

---

*Built for Casper Agentic Buildathon 2026 · Powered by Groq + Tavily + x402*
