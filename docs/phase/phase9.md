# Phase 9: Leaderboard & Social Features

**Goal:** Build the real-time leaderboard system and social features using Supabase Realtime, enabling users to discover top traders and interact with the community.

**Duration:** 4-5 days

---

## 9.1 Leaderboard Architecture

```
┌─────────────────────────────────────────────┐
│           LEADERBOARD SYSTEM                │
├─────────────────────────────────────────────┤
│                                              │
│   DATA SOURCES                               │
│   ├── On-chain: Volume, PnL, Win Rate        │
│   ├── Off-chain: AI Score, Followers Count   │
│   └── Composite Formula                      │
│                                              │
│   SCORING FORMULA                            │
│   Score = (win_rate × 0.25)                  │
│         + (roi_30d_normalized × 0.30)        │
│         + (ai_reputation × 0.25)             │
│         + (followers_normalized × 0.10)      │
│         + (volume_normalized × 0.10)         │
│                                              │
│   REALTIME UPDATES                           │
│   ├── Supabase Realtime subscriptions        │
│   ├── Auto-refresh every 60 seconds          │
│   └── Event-driven updates on new trades     │
│                                              │
└─────────────────────────────────────────────┘
```

### Leaderboard Database Function (PostgreSQL)

```sql
-- Function to calculate composite leaderboard score
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
  -- Get max values for normalization
  SELECT COALESCE(MAX(total_followers), 1) INTO max_followers FROM traders;
  SELECT COALESCE(MAX(total_volume), 1) INTO max_volume FROM traders;
  
  -- Normalize values to 0-100 range
  roi_normalized := GREATEST(0, LEAST(100, (roi_30d + 100) / 2));
  followers_normalized := (followers_count::NUMERIC / max_followers) * 100;
  volume_normalized := (volume_30d::NUMERIC / max_volume) * 100;
  
  -- Composite score
  RETURN ROUND(
    COALESCE(win_rate, 0) * 0.25 +
    COALESCE(roi_normalized, 0) * 0.30 +
    COALESCE(ai_reputation, 0) * 0.25 +
    COALESCE(followers_normalized, 0) * 0.10 +
    COALESCE(volume_normalized, 0) * 0.10
  , 2);
END;
$$ LANGUAGE plpgsql;

-- Scheduled function to refresh leaderboard
CREATE OR REPLACE FUNCTION refresh_leaderboard()
RETURNS void AS $$
BEGIN
  -- Clear existing leaderboard
  DELETE FROM leaderboard;
  
  -- Insert updated rankings
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
    AND t.total_trades > 10;  -- Minimum trades to qualify
  
  UPDATE leaderboard SET updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Run every 5 minutes via pg_cron or trigger
-- SELECT cron.schedule('refresh-leaderboard', '*/5 * * * *', 'SELECT refresh_leaderboard();');
```

---

## 9.2 Leaderboard Page

### src/app/leaderboard/page.tsx

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { cn, formatCSPR, formatPercentage, shortenAddress } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Trophy, TrendingUp, Users, Shield, Medal, ArrowUp, ArrowDown, Minus } from "lucide-react";
import Link from "next/link";

interface LeaderboardEntry {
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

type TimeFilter = "all" | "7d" | "30d";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  const supabase = useRef(createClient());

  useEffect(() => {
    fetchLeaderboard();
    subscribeToUpdates();
  }, [timeFilter]);

  async function fetchLeaderboard() {
    try {
      const res = await fetch(`/api/leaderboard?period=${timeFilter}`);
      const data = await res.json();
      
      // Store current ranks as previous for animation
      const prev: Record<string, number> = {};
      entries.forEach((e) => {
        prev[e.trader_address] = e.rank;
      });
      setPreviousRanks(prev);
      
      setEntries(data.entries || []);
    } catch (error) {
      console.error("Failed to fetch leaderboard:", error);
    } finally {
      setLoading(false);
    }
  }

  function subscribeToUpdates() {
    const channel = supabase.current
      .channel("leaderboard-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaderboard" },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.current.removeChannel(channel);
    };
  }

  function getRankChange(traderAddress: string, currentRank: number): number | null {
    const prev = previousRanks[traderAddress];
    if (prev === undefined) return null;
    return prev - currentRank; // Positive = moved up
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Trader Leaderboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Top-performing traders ranked by AI composite score
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "7d", "30d"] as TimeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                timeFilter === f
                  ? "bg-brand-600/20 text-brand-500 border border-brand-500/30"
                  : "bg-surface-elevated text-muted-foreground border border-border"
              )}
            >
              {f === "all" ? "All Time" : f === "7d" ? "7 Days" : "30 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-card/50">
                <th className="text-left py-3 px-4 text-muted-foreground font-medium w-16">Rank</th>
                <th className="text-left py-3 px-4 text-muted-foreground font-medium">Trader</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Score</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">ROI</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Win Rate</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Followers</th>
                <th className="text-right py-3 px-4 text-muted-foreground font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [...Array(10)].map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td colSpan={7} className="py-4 px-4">
                        <div className="h-8 bg-surface-elevated rounded animate-pulse" />
                      </td>
                    </tr>
                  ))
                : entries.map((entry, index) => {
                    const rankChange = getRankChange(entry.trader_address, entry.rank);
                    const isTop3 = entry.rank <= 3;

                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          "border-b border-border/50 transition-colors",
                          isTop3 ? "hover:bg-yellow-500/5" : "hover:bg-surface-elevated/50",
                          index < 3 && "bg-gradient-to-r from-yellow-500/[0.03] to-transparent"
                        )}
                      >
                        {/* Rank */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            {isTop3 ? (
                              <Medal
                                className={cn(
                                  "w-5 h-5",
                                  entry.rank === 1 && "text-yellow-400",
                                  entry.rank === 2 && "text-gray-400",
                                  entry.rank === 3 && "text-amber-600"
                                )}
                              />
                            ) : (
                              <span className="font-mono text-muted-foreground w-5 text-center">
                                {entry.rank}
                              </span>
                            )}
                            {rankChange !== null && rankChange !== 0 && (
                              <span
                                className={cn(
                                  "flex items-center text-[10px]",
                                  rankChange > 0
                                    ? "text-profit"
                                    : "text-loss"
                                )}
                              >
                                {rankChange > 0 ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : (
                                  <ArrowDown className="w-3 h-3" />
                                )}
                                {Math.abs(rankChange)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Trader */}
                        <td className="py-4 px-4">
                          <Link
                            href={`/traders/${entry.trader_address}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-xs group-hover:bg-brand-500/20 transition-colors">
                              {entry.display_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium group-hover:text-brand-500 transition-colors">
                                {entry.display_name}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {shortenAddress(entry.trader_address)}
                              </p>
                            </div>
                          </Link>
                        </td>

                        {/* Score */}
                        <td className="py-4 px-4 text-right">
                          <span
                            className={cn(
                              "font-bold font-mono",
                              entry.score >= 70
                                ? "text-profit"
                                : entry.score >= 40
                                  ? "text-yellow-400"
                                  : "text-loss"
                            )}
                          >
                            {entry.score.toFixed(1)}
                          </span>
                        </td>

                        {/* ROI */}
                        <td className="py-4 px-4 text-right">
                          <span
                            className={cn(
                              "font-mono font-medium",
                              entry.roi_30d >= 0 ? "text-profit" : "text-loss"
                            )}
                          >
                            {entry.roi_30d >= 0 ? "+" : ""}{entry.roi_30d.toFixed(2)}%
                          </span>
                        </td>

                        {/* Win Rate */}
                        <td className="py-4 px-4 text-right font-mono">
                          {entry.win_rate.toFixed(1)}%
                        </td>

                        {/* Followers */}
                        <td className="py-4 px-4 text-right font-mono">
                          {entry.followers_count}
                        </td>

                        {/* Volume */}
                        <td className="py-4 px-4 text-right font-mono text-xs">
                          {formatCSPR(entry.volume_30d)}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Footer */}
      <div className="glass-card rounded-xl p-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>Updated in real-time via Supabase Realtime</span>
        <span>
          {entries.length} traders ranked
          {entries.length > 0 && (
            <> · Last updated: {new Date(entries[0].updated_at).toLocaleTimeString()}</>
          )}
        </span>
      </div>
    </div>
  );
}
```

---

## 9.3 Leaderboard API

### src/app/api/leaderboard/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const period = request.nextUrl.searchParams.get("period") || "all";

  const supabase = createClient();

  let query = supabase
    .from("leaderboard")
    .select("*")
    .order("rank", { ascending: true })
    .limit(100);

  // Apply time filter for ROI calculation
  if (period === "7d") {
    query = supabase
      .from("leaderboard")
      .select("*")
      .order("roi_7d", { ascending: false })
      .limit(100);
  } else if (period === "30d") {
    query = supabase
      .from("leaderboard")
      .select("*")
      .order("roi_30d", { ascending: false })
      .limit(100);
  }

  const { data: entries, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ entries });
}
```

---

## 9.4 Vault Page (Per-Trader Detail)

### src/app/vault/[id]/page.tsx

```tsx
"use client";

import { useState, useEffect, use } from "react";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatCSPR, shortenAddress } from "@/lib/utils";
import { SubscribeButton } from "@/components/trader/SubscribeButton";
import {
  BarChart3,
  Users,
  TrendingUp,
  Clock,
  Shield,
  ArrowLeft,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function VaultPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { isConnected } = useWallet();
  const [vault, setVault] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVault();
  }, [resolvedParams.id]);

  async function fetchVault() {
    try {
      const res = await fetch(`/api/vaults/${resolvedParams.id}`);
      const data = await res.json();
      setVault(data.vault);
    } catch (error) {
      console.error("Failed to fetch vault:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-surface-elevated rounded w-1/3" />
          <div className="h-48 bg-surface-elevated rounded-xl" />
          <div className="h-64 bg-surface-elevated rounded-xl" />
        </div>
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted-foreground">Vault not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back */}
      <Link
        href="/traders"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Traders
      </Link>

      {/* Vault Header */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{vault.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              by {vault.traderName}
              <a
                href={`https://testnet.cspr.live/account/${vault.traderAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 ml-2 text-brand-500 hover:underline"
              >
                <ExternalLink className="w-3 h-3" />
                View
              </a>
            </p>
          </div>
          {isConnected && (
            <SubscribeButton
              traderAddress={vault.traderAddress}
              traderName={vault.traderName}
            />
          )}
        </div>
        {vault.description && (
          <p className="text-sm text-muted-foreground mt-4">{vault.description}</p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Allocated", value: `${formatCSPR(vault.totalAllocated)} CSPR`, icon: BarChart3 },
          { label: "Followers", value: vault.totalFollowers.toString(), icon: Users },
          { label: "30d ROI", value: `${vault.roi30d >= 0 ? "+" : ""}${vault.roi30d?.toFixed(2)}%`, icon: TrendingUp, isGreen: vault.roi30d >= 0 },
          { label: "Performance Fee", value: `${(vault.performanceFee / 100).toFixed(1)}%`, icon: Clock },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <stat.icon className="w-3 h-3" />
              {stat.label}
            </div>
            <p
              className={cn(
                "text-lg font-bold font-mono",
                "isGreen" in stat && stat.isGreen !== undefined
                  ? stat.isGreen ? "text-profit" : "text-loss"
                  : ""
              )}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Strategy & Details */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4 text-brand-500" />
          Strategy & Details
        </h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground mb-1">Risk Level</p>
            <span
              className={cn(
                "px-2 py-0.5 rounded text-xs font-medium",
                vault.riskLevel === "low" && "bg-profit/10 text-profit",
                vault.riskLevel === "medium" && "bg-yellow-400/10 text-yellow-400",
                vault.riskLevel === "high" && "bg-loss/10 text-loss"
              )}
            >
              {vault.riskLevel?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Min Allocation</p>
            <p className="font-mono">{formatCSPR(vault.minAllocation)} CSPR</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Max Allocation</p>
            <p className="font-mono">{vault.maxAllocation ? formatCSPR(vault.maxAllocation) + " CSPR" : "Unlimited"}</p>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Max Drawdown</p>
            <p className="font-mono">{vault.maxDrawdown || "50"}%</p>
          </div>
        </div>
        {vault.strategy && (
          <div className="pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">Strategy Description</p>
            <p className="text-sm">{vault.strategy}</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 9.5 Supabase Realtime Subscription

### src/lib/supabase/client.ts

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### src/lib/supabase/server.ts

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
}
```

---

## 9.6 Social Features Enhancement

### Share & Invite System

```tsx
// src/components/social/ShareButton.tsx
"use client";

import { useState } from "react";
import { Share2, Check, Copy, Twitter, Link } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareButtonProps {
  traderName: string;
  traderAddress: string;
  vaultId: string;
}

export function ShareButton({ traderName, traderAddress, vaultId }: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/traders/${traderAddress}`;
  const shareText = `Check out ${traderName} on Gradex — AI-verified social trading on Casper Network! 🚀`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank"
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card border border-border hover:bg-surface-elevated text-xs transition-all"
      >
        <Share2 className="w-3 h-3" />
        Share
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 mt-2 w-48 z-20 glass-card rounded-lg border border-border shadow-xl overflow-hidden">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-profit" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={handleTwitterShare}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors"
            >
              <Twitter className="w-4 h-4" />
              Share on X
            </button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 9.7 Verification Checklist

- [ ] Leaderboard page loads with ranked traders
- [ ] Score calculation formula is correct
- [ ] Rank changes show up/down arrows
- [ ] Top 3 have medal icons
- [ ] Time filter works (All/7d/30d)
- [ ] Supabase Realtime subscription updates leaderboard live
- [ ] Vault detail page shows all stats correctly
- [ ] Subscribe button appears on vault page
- [ ] Share functionality works (copy link, Twitter)
- [ ] Responsive: table scrolls on mobile
- [ ] Loading states show skeleton animation
- [ ] Empty state shows helpful message

---

**Phase 9 Complete.** The leaderboard and social features are live. Phase 10 will cover testing, deployment, and launch.
