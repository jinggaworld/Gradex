# Phase 7: Frontend — Trader Discovery & Subscription Flow

**Goal:** Build the trader browsing, AI scoring display, and subscription flow where users allocate CSPR to a trader's vault.

**Duration:** 4-6 days

---

## 7.1 Traders Listing Page

### src/app/traders/page.tsx

```tsx
"use client";

import { useState, useEffect } from "react";
import { TraderCard } from "@/components/trader/TraderCard";
import { TraderFilters } from "@/components/trader/TraderFilters";
import { Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";

interface TraderSummary {
  walletAddress: string;
  displayName: string;
  reputationScore: number;
  totalVolume: string;
  winRate: number;
  totalFollowers: number;
  roi30d: number;
  riskLevel: string;
}

export default function TradersPage() {
  const [traders, setTraders] = useState<TraderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "volume" | "followers" | "roi">("score");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTraders();
  }, [sortBy, riskFilter]);

  async function fetchTraders() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        sortBy,
        ...(riskFilter !== "all" && { riskLevel: riskFilter }),
        ...(search && { search }),
      });
      const res = await fetch(`/api/traders?${params}`);
      const data = await res.json();
      setTraders(data.traders);
    } catch (error) {
      console.error("Failed to fetch traders:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Explore Traders</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover top Casper traders verified by AI reputation scoring
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or address..."
            className="w-full pl-10 pr-4 py-2.5 rounded-lg glass-card border border-border bg-transparent text-sm outline-none focus:border-brand-500/50 transition-colors"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg glass-card border border-border hover:bg-surface-elevated transition-all text-sm"
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as any)}
          className="px-4 py-2.5 rounded-lg glass-card border border-border bg-transparent text-sm outline-none focus:border-brand-500/50"
        >
          <option value="score">AI Score</option>
          <option value="volume">Volume</option>
          <option value="followers">Followers</option>
          <option value="roi">ROI (30d)</option>
        </select>
      </div>

      {/* Active Filters */}
      {showFilters && (
        <TraderFilters
          riskFilter={riskFilter}
          setRiskFilter={setRiskFilter}
        />
      )}

      {/* Traders Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-surface-elevated" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-surface-elevated rounded w-2/3" />
                  <div className="h-3 bg-surface-elevated rounded w-1/3" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-surface-elevated rounded" />
                <div className="h-3 bg-surface-elevated rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : traders.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground">No traders found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {traders.map((trader) => (
            <TraderCard key={trader.walletAddress} trader={trader} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### src/components/trader/TraderCard.tsx

```tsx
"use client";

import Link from "next/link";
import { cn, shortenAddress, formatCSPR, formatPercentage } from "@/lib/utils";
import { Users, TrendingUp, Shield } from "lucide-react";

interface TraderCardProps {
  trader: {
    walletAddress: string;
    displayName: string;
    reputationScore: number;
    totalVolume: string;
    winRate: number;
    totalFollowers: number;
    roi30d: number;
    riskLevel: string;
  };
}

export function TraderCard({ trader }: TraderCardProps) {
  const scoreColor =
    trader.reputationScore >= 70
      ? "text-profit"
      : trader.reputationScore >= 40
        ? "text-yellow-400"
        : "text-loss";

  return (
    <Link href={`/traders/${trader.walletAddress}`}>
      <div className="glass-card rounded-xl p-6 space-y-4 hover:border-brand-500/30 transition-all group cursor-pointer">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-lg">
              {trader.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold group-hover:text-brand-500 transition-colors">
                {trader.displayName}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {shortenAddress(trader.walletAddress)}
              </p>
            </div>
          </div>
          {/* AI Score */}
          <div className="flex flex-col items-center">
            <div className={cn("text-lg font-bold font-mono", scoreColor)}>
              {trader.reputationScore}
            </div>
            <span className="text-[10px] text-muted-foreground">AI Score</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 py-3 border-y border-border">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <TrendingUp className="w-3 h-3" />
              ROI 30d
            </div>
            <span
              className={cn(
                "text-sm font-semibold font-mono",
                trader.roi30d >= 0 ? "text-profit" : "text-loss"
              )}
            >
              {formatPercentage(trader.roi30d)}
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Shield className="w-3 h-3" />
              Win Rate
            </div>
            <span className="text-sm font-semibold font-mono">
              {trader.winRate}%
            </span>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-1">
              <Users className="w-3 h-3" />
              Followers
            </div>
            <span className="text-sm font-semibold font-mono">
              {trader.totalFollowers}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Volume: {formatCSPR(trader.totalVolume)} CSPR
          </span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium",
              trader.riskLevel === "low" && "bg-profit/10 text-profit",
              trader.riskLevel === "medium" && "bg-yellow-400/10 text-yellow-400",
              trader.riskLevel === "high" && "bg-loss/10 text-loss"
            )}
          >
            {trader.riskLevel.toUpperCase()}
          </span>
        </div>
      </div>
    </Link>
  );
}
```

---

## 7.2 Trader Detail Page

### src/app/traders/[address]/page.tsx

```tsx
"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { TraderScoreCard } from "@/components/trader/TraderScoreCard";
import { SubscribeButton } from "@/components/trader/SubscribeButton";
import { TraderStats } from "@/components/trader/TraderStats";
import { TradeHistory } from "@/components/trader/TradeHistory";
import { ArrowLeft, ExternalLink, RefreshCw } from "lucide-react";
import Link from "next/link";
import { shortenAddress } from "@/lib/utils";

export default function TraderDetailPage() {
  const params = useParams();
  const address = params.address as string;
  const [trader, setTrader] = useState<any>(null);
  const [score, setScore] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  useEffect(() => {
    fetchTraderData();
  }, [address]);

  async function fetchTraderData() {
    setLoading(true);
    try {
      const res = await fetch(`/api/traders/${address}`);
      const data = await res.json();
      setTrader(data.trader);
      setScore(data.score);
    } catch (error) {
      console.error("Failed to fetch trader:", error);
    } finally {
      setLoading(false);
    }
  }

  async function triggerScoring() {
    setScoring(true);
    try {
      const res = await fetch("/api/traders/scoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          displayName: trader?.displayName,
        }),
      });
      const data = await res.json();
      setScore(data.score);
    } catch (error) {
      console.error("Scoring failed:", error);
    } finally {
      setScoring(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-elevated rounded w-1/3" />
          <div className="h-64 bg-surface-elevated rounded-xl" />
          <div className="h-48 bg-surface-elevated rounded-xl" />
        </div>
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Trader not found</p>
        <Link href="/traders" className="text-brand-500 hover:underline mt-2 inline-block">
          Browse all traders
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back Navigation */}
      <Link
        href="/traders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Traders
      </Link>

      {/* Trader Header */}
      <div className="glass-card rounded-xl p-6 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-2xl">
            {trader.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{trader.displayName}</h1>
            <p className="text-sm text-muted-foreground font-mono">
              {shortenAddress(trader.walletAddress)}
              <a
                href={`https://testnet.cspr.live/account/${trader.walletAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 text-brand-500 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View on Explorer
              </a>
            </p>
          </div>
        </div>
        <SubscribeButton
          traderAddress={address}
          traderName={trader.displayName}
          disabled={(score && score.recommendation === "avoid") || false}
        />
      </div>

      {/* AI Score & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Stats Grid */}
          <TraderStats trader={trader} />

          {/* Trade History */}
          <TradeHistory trades={trader.recentTrades || []} />
        </div>

        <div className="space-y-4">
          {/* Score Card */}
          {score ? (
            <TraderScoreCard
              score={score.overallScore}
              riskLevel={score.riskLevel}
              recommendation={score.recommendation}
              reasoning={score.reasoning}
              redFlags={score.redFlags}
              strengths={score.strengths}
            />
          ) : (
            <div className="glass-card rounded-xl p-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Run AI reputation check to evaluate this trader
              </p>
              <button
                onClick={triggerScoring}
                disabled={scoring}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all disabled:opacity-50"
              >
                {scoring ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Shield className="w-4 h-4" />
                )}
                {scoring ? "Analyzing..." : "Run AI Check"}
              </button>
            </div>
          )}

          {/* Re-score Button */}
          {score && (
            <button
              onClick={triggerScoring}
              disabled={scoring}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg glass-card border border-border hover:bg-surface-elevated text-sm text-muted-foreground transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${scoring ? "animate-spin" : ""}`} />
              {scoring ? "Re-analyzing..." : "Refresh Score"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Shield({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;
}
```

---

## 7.3 Subscription Flow

### src/components/trader/SubscribeButton.tsx

```tsx
"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wallet, Loader2, Check } from "lucide-react";

interface SubscribeButtonProps {
  traderAddress: string;
  traderName: string;
  disabled?: boolean;
}

export function SubscribeButton({
  traderAddress,
  traderName,
  disabled,
}: SubscribeButtonProps) {
  const { isConnected, connect } = useWallet();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    // Navigate to subscription page
    router.push(`/subscribe?trader=${traderAddress}`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={cn(
        "px-6 py-3 rounded-xl font-semibold text-sm transition-all",
        disabled
          ? "bg-loss/20 text-loss/50 cursor-not-allowed"
          : "bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40"
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
      ) : disabled ? (
        "Not Recommended"
      ) : !isConnected ? (
        <span className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          Connect to Subscribe
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Check className="w-4 h-4" />
          Subscribe to {traderName}
        </span>
      )}
    </button>
  );
}
```

### src/app/subscribe/page.tsx

```tsx
"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatCSPR } from "@/lib/utils";
import {
  ArrowLeft,
  Info,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function SubscribePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const traderAddress = searchParams.get("trader");
  const { isConnected, publicKey, balance } = useWallet();

  const [allocation, setAllocation] = useState("1000"); // CSPR
  const [maxDrawdown, setMaxDrawdown] = useState("50"); // %
  const [autoCompound, setAutoCompound] = useState(true);
  const [step, setStep] = useState<"configure" | "review" | "confirming" | "success">("configure");
  const [trader, setTrader] = useState<any>(null);
  const [txHash, setTxHash] = useState<string>("");

  useEffect(() => {
    if (traderAddress) {
      fetch(`/api/traders/${traderAddress}`)
        .then((res) => res.json())
        .then((data) => setTrader(data.trader));
    }
  }, [traderAddress]);

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
        <p className="text-muted-foreground">
          You need to connect your Casper Wallet to subscribe to a trader.
        </p>
      </div>
    );
  }

  if (!traderAddress || !trader) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-muted-foreground">No trader selected</p>
        <Link href="/traders" className="text-brand-500 hover:underline mt-2 inline-block">
          Browse traders
        </Link>
      </div>
    );
  }

  // Parse values
  const allocationBigInt = BigInt(parseFloat(allocation) * 10 ** 9);
  const balanceBigInt = BigInt(balance || "0");

  const handleSubscribe = async () => {
    setStep("confirming");

    try {
      // Build and sign the deploy
      const deploy = await buildSubscribeDeploy(
        traderAddress,
        publicKey!,
        allocationBigInt,
        maxDrawdown,
        autoCompound
      );

      // Send deploy
      const response = await fetch("/api/deploys/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploy }),
      });

      const result = await response.json();
      setTxHash(result.deployHash);
      setStep("success");
    } catch (error) {
      console.error("Subscription failed:", error);
      setStep("configure");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/traders/${traderAddress}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Trader Profile
      </Link>

      <h1 className="text-2xl font-bold mb-6">
        Subscribe to {trader?.displayName || "Trader"}
      </h1>

      {step === "configure" && (
        <div className="space-y-6">
          {/* Allocation Amount */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Allocation Amount</h3>
              <span className="text-sm text-muted-foreground">
                Balance: {formatCSPR(balance)} CSPR
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                min="100"
                className="flex-1 px-4 py-3 rounded-lg glass-card border border-border bg-transparent text-lg font-mono outline-none focus:border-brand-500/50"
              />
              <span className="text-lg font-semibold">CSPR</span>
            </div>
            {allocationBigInt > balanceBigInt && (
              <p className="flex items-center gap-2 text-sm text-loss">
                <AlertTriangle className="w-4 h-4" />
                Insufficient balance
              </p>
            )}
          </div>

          {/* Max Drawdown */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Max Drawdown</h3>
              <span className="text-sm font-mono">{maxDrawdown}%</span>
            </div>
            <input
              type="range"
              value={maxDrawdown}
              onChange={(e) => setMaxDrawdown(e.target.value)}
              min="10"
              max="100"
              className="w-full accent-brand-500"
            />
            <p className="text-xs text-muted-foreground">
              If losses exceed this threshold, your position will be automatically closed.
            </p>
          </div>

          {/* Auto-Compound */}
          <div className="glass-card rounded-xl p-6">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <h3 className="font-semibold">Auto-Compound Profits</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically reinvest profits to grow your position
                </p>
              </div>
              <button
                onClick={() => setAutoCompound(!autoCompound)}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  autoCompound ? "bg-brand-600" : "bg-surface-elevated"
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow",
                    autoCompound ? "left-6" : "left-0.5"
                  )}
                />
              </button>
            </label>
          </div>

          {/* Summary */}
          <div className="glass-card rounded-xl p-6 space-y-3">
            <h3 className="font-semibold mb-2">Subscription Summary</h3>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trader</span>
              <span>{trader?.displayName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Allocation</span>
              <span className="font-mono">{allocation} CSPR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Max Drawdown</span>
              <span className="font-mono">{maxDrawdown}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Auto-Compound</span>
              <span>{autoCompound ? "Yes" : "No"}</span>
            </div>
          </div>

          <button
            onClick={handleSubscribe}
            disabled={allocationBigInt > balanceBigInt || allocationBigInt <= 0n}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Subscription
          </button>
        </div>
      )}

      {step === "confirming" && (
        <div className="glass-card rounded-xl p-12 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-brand-500" />
          <p className="font-semibold">Confirming Subscription...</p>
          <p className="text-sm text-muted-foreground">
            Please approve the transaction in your Casper Wallet
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="glass-card rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-profit/10 flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-profit" />
          </div>
          <h2 className="text-xl font-bold">Subscription Successful!</h2>
          <p className="text-sm text-muted-foreground">
            You are now copying {trader?.displayName}. Your trades will execute automatically.
          </p>
          {txHash && (
            <a
              href={`https://testnet.cspr.live/deploy/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-brand-500 hover:underline"
            >
              View Transaction
            </a>
          )}
          <div className="flex items-center justify-center gap-4 pt-4">
            <Link
              href="/dashboard"
              className="px-6 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-all"
            >
              Go to Dashboard
            </Link>
            <Link
              href="/traders"
              className="px-6 py-2 rounded-lg glass-card border border-border hover:bg-surface-elevated font-medium transition-all"
            >
              Browse More Traders
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

async function buildSubscribeDeploy(
  traderAddress: string,
  followerPublicKey: string,
  amount: bigint,
  maxDrawdown: string,
  autoCompound: boolean
) {
  // Build the deploy using casper-js-sdk
  // This would call the vault contract's subscribe entry point
  return {};
}
```

---

## 7.4 API Route: Traders List

### src/app/api/traders/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sortBy = searchParams.get("sortBy") || "score";
  const riskLevel = searchParams.get("riskLevel");
  const search = searchParams.get("search");

  const supabase = createClient();

  let query = supabase
    .from("traders")
    .select(`
      wallet_address,
      display_name,
      reputation_score,
      total_volume,
      win_rate,
      total_followers,
      roi_30d,
      risk_level
    `)
    .eq("is_active", true);

  // Filters
  if (riskLevel && riskLevel !== "all") {
    query = query.eq("risk_level", riskLevel);
  }

  if (search) {
    query = query.or(
      `display_name.ilike.%${search}%,wallet_address.ilike.%${search}%`
    );
  }

  // Sorting
  const sortMap: Record<string, string> = {
    score: "reputation_score",
    volume: "total_volume",
    followers: "total_followers",
    roi: "roi_30d",
  };
  const sortColumn = sortMap[sortBy] || "reputation_score";
  query = query.order(sortColumn, { ascending: false }).limit(50);

  const { data: traders, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    traders: (traders || []).map((t: any) => ({
      walletAddress: t.wallet_address,
      displayName: t.display_name,
      reputationScore: t.reputation_score,
      totalVolume: t.total_volume,
      winRate: t.win_rate,
      totalFollowers: t.total_followers,
      roi30d: t.roi_30d,
      riskLevel: t.risk_level,
    })),
  });
}
```

---

## 7.5 Verification Checklist

- [ ] Traders list page loads with real trader data
- [ ] Search by name/address works
- [ ] Sorting by score/volume/followers/ROI works
- [ ] Risk level filter works
- [ ] AI Score card displays with correct score color coding
- [ ] Subscribe button navigates to subscription page
- [ ] Subscription form calculates correctly
- [ ] Max drawdown slider works
- [ ] Auto-compound toggle works
- [ ] Wallet balance validation works (prevents over-allocation)
- [ ] Subscription confirm flow submits deploy to wallet
- [ ] Success page shows transaction hash
- [ ] Responsive design for mobile

---

**Phase 7 Complete.** Users can now discover traders, view AI scores, and subscribe. Phase 8 will build the copy trading management and portfolio features.
