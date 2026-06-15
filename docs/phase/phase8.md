# Phase 8: Frontend — Copy Trading Management & Portfolio

**Goal:** Build the portfolio management system where users can monitor their active copy positions, view PnL, adjust allocations, and withdraw funds.

**Duration:** 4-6 days

---

## 8.1 Portfolio Dashboard

### src/app/dashboard/portfolio/page.tsx

```tsx
"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { PortfolioChart } from "@/components/portfolio/PortfolioChart";
import { PnLDistribution } from "@/components/portfolio/PnLDistribution";
import { formatCSPR, formatPercentage } from "@/lib/utils";
import { Wallet, TrendingUp, TrendingDown, PieChart } from "lucide-react";

export default function PortfolioPage() {
  const { isConnected, publicKey } = useWallet();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isConnected && publicKey) {
      fetchPortfolio();
    } else {
      setLoading(false);
    }
  }, [isConnected, publicKey]);

  async function fetchPortfolio() {
    try {
      const res = await fetch(`/api/portfolio?follower=${publicKey}`);
      const data = await res.json();
      setPortfolio(data);
    } catch (error) {
      console.error("Failed to fetch portfolio:", error);
    } finally {
      setLoading(false);
    }
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Wallet className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Connect Wallet to View Portfolio</h2>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-surface-elevated rounded-xl" />
        <div className="h-64 bg-surface-elevated rounded-xl" />
      </div>
    );
  }

  if (!portfolio || portfolio.positions.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">My Portfolio</h1>
        <div className="glass-card rounded-xl p-12 text-center space-y-4">
          <PieChart className="w-12 h-12 mx-auto text-muted-foreground" />
          <h2 className="text-lg font-semibold">No Active Positions</h2>
          <p className="text-sm text-muted-foreground">
            You haven&apos;t subscribed to any traders yet. Start by exploring top traders.
          </p>
          <a
            href="/traders"
            className="inline-block px-6 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-all"
          >
            Explore Traders
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Portfolio</h1>

      {/* Portfolio Summary */}
      <PortfolioSummary
        totalInvested={portfolio.totalInvested}
        currentValue={portfolio.currentValue}
        totalPnL={portfolio.totalPnL}
        totalRoyaltiesPaid={portfolio.totalRoyaltiesPaid}
        activePositions={portfolio.positions.length}
      />

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Portfolio Value Over Time</h3>
          <PortfolioChart data={portfolio.history} />
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">PnL Distribution</h3>
          <PnLDistribution positions={portfolio.positions} />
        </div>
      </div>

      {/* Positions Table */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Active Copy Positions</h3>
          <span className="text-xs text-muted-foreground">
            {portfolio.positions.length} position{portfolio.positions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <PositionsTable
          positions={portfolio.positions}
          onRefresh={fetchPortfolio}
        />
      </div>
    </div>
  );
}
```

### src/components/portfolio/PortfolioSummary.tsx

```tsx
"use client";

import { formatCSPR, formatPercentage } from "@/lib/utils";
import { TrendingUp, TrendingDown, Wallet, Coins } from "lucide-react";

interface PortfolioSummaryProps {
  totalInvested: string;
  currentValue: string;
  totalPnL: string;
  totalRoyaltiesPaid: string;
  activePositions: number;
}

export function PortfolioSummary({
  totalInvested,
  currentValue,
  totalPnL,
  totalRoyaltiesPaid,
  activePositions,
}: PortfolioSummaryProps) {
  const invested = BigInt(totalInvested || "0");
  const current = BigInt(currentValue || "0");
  const pnl = BigInt(totalPnL || "0");
  const pnlPercent = invested > 0n
    ? Number((current - invested) * 10000n / invested) / 100
    : 0;
  const isPositive = pnl >= 0n;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="glass-card rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="w-3 h-3" />
          Total Invested
        </div>
        <div className="text-lg font-bold font-mono">
          {formatCSPR(totalInvested)} CSPR
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          Current Value
        </div>
        <div className="text-lg font-bold font-mono">
          {formatCSPR(currentValue)} CSPR
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-profit" />
          ) : (
            <TrendingDown className="w-3 h-3 text-loss" />
          )}
          Total PnL
        </div>
        <div className={`text-lg font-bold font-mono ${isPositive ? "text-profit" : "text-loss"}`}>
          {isPositive ? "+" : ""}{formatCSPR(totalPnL)} CSPR
          <span className={`text-xs ml-1 ${isPositive ? "text-profit" : "text-loss"}`}>
            ({isPositive ? "+" : ""}{pnlPercent.toFixed(2)}%)
          </span>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Coins className="w-3 h-3" />
          Royalties Paid
        </div>
        <div className="text-lg font-bold font-mono text-brand-500">
          {formatCSPR(totalRoyaltiesPaid)} CSPR
        </div>
        <div className="text-[10px] text-muted-foreground">
          {activePositions} active position{activePositions !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
```

### src/components/portfolio/PositionsTable.tsx

```tsx
"use client";

import { useState } from "react";
import { cn, formatCSPR, formatPercentage, shortenAddress } from "@/lib/utils";
import { Copy, ExternalLink, Settings, XCircle, MoreHorizontal } from "lucide-react";

interface Position {
  id: string;
  traderName: string;
  traderAddress: string;
  vaultName: string;
  allocatedAmount: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: number;
  isActive: boolean;
  autoCompound: boolean;
  subscribedAt: string;
  lastCopyTradeAt: string | null;
}

interface PositionsTableProps {
  positions: Position[];
  onRefresh: () => void;
}

export function PositionsTable({ positions, onRefresh }: PositionsTableProps) {
  const [actionMenu, setActionMenu] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-3 px-2 text-muted-foreground font-medium">Trader</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">Allocated</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">Current</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">PnL</th>
            <th className="text-center py-3 px-2 text-muted-foreground font-medium">Auto</th>
            <th className="text-right py-3 px-2 text-muted-foreground font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const pnl = BigInt(pos.pnl || "0");
            const isProfitable = pnl >= 0n;

            return (
              <tr
                key={pos.id}
                className="border-b border-border/50 hover:bg-surface-elevated/50 transition-colors"
              >
                <td className="py-4 px-2">
                  <div>
                    <p className="font-medium">{pos.traderName}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {shortenAddress(pos.traderAddress)}
                    </p>
                  </div>
                </td>
                <td className="py-4 px-2 text-right font-mono">
                  {formatCSPR(pos.allocatedAmount)}
                </td>
                <td className="py-4 px-2 text-right font-mono">
                  {formatCSPR(pos.currentValue)}
                </td>
                <td className="py-4 px-2 text-right">
                  <span
                    className={cn(
                      "font-mono font-medium",
                      isProfitable ? "text-profit" : "text-loss"
                    )}
                  >
                    {isProfitable ? "+" : ""}{formatCSPR(pos.pnl)}
                  </span>
                  <span
                    className={cn(
                      "text-xs ml-1",
                      pos.pnlPercentage >= 0 ? "text-profit" : "text-loss"
                    )}
                  >
                    ({pos.pnlPercentage >= 0 ? "+" : ""}{pos.pnlPercentage.toFixed(2)}%)
                  </span>
                </td>
                <td className="py-4 px-2 text-center">
                  <span
                    className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      pos.autoCompound ? "bg-brand-500" : "bg-muted-foreground/30"
                    )}
                  />
                </td>
                <td className="py-4 px-2 text-right relative">
                  <button
                    onClick={() =>
                      setActionMenu(actionMenu === pos.id ? null : pos.id)
                    }
                    className="p-1 rounded hover:bg-surface-elevated transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>

                  {actionMenu === pos.id && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setActionMenu(null)}
                      />
                      <div className="absolute right-0 mt-2 w-48 z-20 glass-card rounded-lg border border-border shadow-xl overflow-hidden">
                        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors">
                          <Settings className="w-4 h-4" />
                          Adjust Allocation
                        </button>
                        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors">
                          <Copy className="w-4 h-4" />
                          View Copy Trades
                        </button>
                        <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-loss hover:bg-surface-elevated transition-colors border-t border-border">
                          <XCircle className="w-4 h-4" />
                          Unsubscribe
                        </button>
                      </div>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 8.2 Copy Trades History

### src/app/dashboard/copies/page.tsx

```tsx
"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { CopyTradeRow } from "@/components/copies/CopyTradeRow";
import { formatCSPR, formatPercentage, cn } from "@/lib/utils";
import { Activity, Filter, ChevronDown } from "lucide-react";

type TradeFilter = "all" | "buy" | "sell" | "profit" | "loss";

export default function CopyTradesPage() {
  const { isConnected, publicKey } = useWallet();
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TradeFilter>("all");

  useEffect(() => {
    if (isConnected && publicKey) {
      fetchTrades();
    }
  }, [isConnected, publicKey]);

  async function fetchTrades() {
    try {
      const res = await fetch(`/api/copies?follower=${publicKey}`);
      const data = await res.json();
      setTrades(data.trades || []);
    } catch (error) {
      console.error("Failed to fetch trades:", error);
    } finally {
      setLoading(false);
    }
  }

  const filteredTrades = trades.filter((t) => {
    switch (filter) {
      case "buy": return t.action === "buy";
      case "sell": return t.action === "sell";
      case "profit": return BigInt(t.profit || "0") > 0n;
      case "loss": return BigInt(t.profit || "0") < 0n;
      default: return true;
    }
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Activity className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Connect Wallet to View Copy Trades</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Copy Trades</h1>
        <div className="flex items-center gap-2">
          {(["all", "buy", "sell", "profit", "loss"] as TradeFilter[]).map(
            (f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                  filter === f
                    ? "bg-brand-600/20 text-brand-500 border border-brand-500/30"
                    : "bg-surface-elevated text-muted-foreground hover:text-foreground border border-border"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-surface-elevated rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No copy trades yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTrades.map((trade) => (
            <CopyTradeRow key={trade.id} trade={trade} />
          ))}
        </div>
      )}
    </div>
  );
}
```

### src/components/copies/CopyTradeRow.tsx

```tsx
"use client";

import { cn, formatCSPR, shortenAddress } from "@/lib/utils";
import { ArrowUpRight, ArrowDownRight, ExternalLink } from "lucide-react";

interface CopyTradeRowProps {
  trade: {
    id: string;
    traderName: string;
    traderAddress: string;
    dex: string;
    action: "buy" | "sell";
    token: string;
    tokenAmount: string;
    csprAmount: string;
    status: string;
    profit: string;
    executedAt: string;
    txHash: string;
  };
}

export function CopyTradeRow({ trade }: CopyTradeRowProps) {
  const isBuy = trade.action === "buy";
  const profit = BigInt(trade.profit || "0");
  const hasProfit = profit !== 0n;

  return (
    <div className="glass-card rounded-xl p-4 flex items-center justify-between hover:border-brand-500/20 transition-all">
      {/* Left: Action + Trader */}
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            isBuy ? "bg-profit/10" : "bg-loss/10"
          )}
        >
          {isBuy ? (
            <ArrowUpRight className={cn("w-5 h-5", "text-profit")} />
          ) : (
            <ArrowDownRight className={cn("w-5 h-5", "text-loss")} />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-semibold",
                isBuy ? "text-profit" : "text-loss"
              )}
            >
              {isBuy ? "Bought" : "Sold"}
            </span>
            <span className="text-sm font-medium">{trade.token}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>via {trade.dex}</span>
            <span>·</span>
            <span>{shortenAddress(trade.traderAddress)}</span>
            <span>·</span>
            <span>{new Date(trade.executedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Center: Amounts */}
      <div className="text-right">
        <p className="text-sm font-mono">
          {formatCSPR(trade.csprAmount)} CSPR
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {formatCSPR(trade.tokenAmount)} {trade.token}
        </p>
      </div>

      {/* Right: PnL + Status */}
      <div className="flex items-center gap-4">
        {hasProfit && (
          <div className="text-right">
            <span
              className={cn(
                "text-sm font-mono font-semibold",
                profit > 0n ? "text-profit" : "text-loss"
              )}
            >
              {profit > 0n ? "+" : ""}{formatCSPR(trade.profit)} CSPR
            </span>
          </div>
        )}
        <span
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            trade.status === "executed" &&
              "bg-profit/10 text-profit",
            trade.status === "pending" &&
              "bg-yellow-400/10 text-yellow-400",
            trade.status === "failed" &&
              "bg-loss/10 text-loss"
          )}
        >
          {trade.status}
        </span>
        <a
          href={`https://testnet.cspr.live/deploy/${trade.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-lg hover:bg-surface-elevated text-muted-foreground hover:text-foreground transition-all"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}
```

---

## 8.3 Position Management Actions

### Modal for Adjusting Allocation

```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface AdjustAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    id: string;
    traderName: string;
    currentAllocation: string;
  };
}

export function AdjustAllocationModal({
  isOpen,
  onClose,
  position,
}: AdjustAllocationModalProps) {
  const [newAmount, setNewAmount] = useState(
    (BigInt(position.currentAllocation) / BigInt(10 ** 9)).toString()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await fetch(`/api/positions/${position.id}/allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      });
      onClose();
    } catch (error) {
      console.error("Failed to update allocation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Adjust Allocation</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-elevated rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Update your CSPR allocation for {position.traderName}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            min="100"
            className="flex-1 px-4 py-2 rounded-lg bg-surface-elevated border border-border text-sm font-mono outline-none focus:border-brand-500/50"
          />
          <span className="text-sm font-medium">CSPR</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-surface-elevated text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## 8.4 Portfolio API Route

### src/app/api/portfolio/route.ts

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const followerAddress = request.nextUrl.searchParams.get("follower");

  if (!followerAddress) {
    return NextResponse.json({ error: "Follower address required" }, { status: 400 });
  }

  const supabase = createClient();

  // Get all copy positions for this follower
  const { data: positions, error } = await supabase
    .from("copy_positions")
    .select(`
      *,
      vaults (
        name,
        trader_address,
        traders:trader_address (display_name)
      )
    `)
    .eq("follower_address", followerAddress)
    .order("subscribed_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Calculate aggregate stats
  let totalInvested = 0n;
  let currentValue = 0n;
  let totalPnL = 0n;
  let totalRoyaltiesPaid = 0n;

  const formattedPositions = (positions || []).map((p: any) => {
    totalInvested += BigInt(p.allocated_amount || "0");
    currentValue += BigInt(p.current_value || "0");
    totalPnL += BigInt(p.pnl || "0");
    totalRoyaltiesPaid += BigInt(p.total_royalties_paid || "0");

    return {
      id: p.id,
      traderName: p.vaults?.traders?.display_name || "Unknown",
      traderAddress: p.vaults?.trader_address || "",
      vaultName: p.vaults?.name || "",
      allocatedAmount: p.allocated_amount,
      currentValue: p.current_value,
      pnl: p.pnl,
      pnlPercentage: p.pnl_percentage,
      isActive: p.is_active,
      autoCompound: p.auto_compound,
      subscribedAt: p.subscribed_at,
      lastCopyTradeAt: p.last_copy_trade_at,
    };
  });

  return NextResponse.json({
    positions: formattedPositions,
    totalInvested: totalInvested.toString(),
    currentValue: currentValue.toString(),
    totalPnL: totalPnL.toString(),
    totalRoyaltiesPaid: totalRoyaltiesPaid.toString(),
    history: [], // Would be populated from on-chain data
  });
}
```

---

## 8.5 Verification Checklist

- [ ] Portfolio page shows accurate summary stats
- [ ] Positions table lists all active positions
- [ ] PnL displays correctly with +/- signs
- [ ] Color coding works (green for profit, red for loss)
- [ ] Action menu opens/closes properly
- [ ] Adjust allocation modal calculates correctly
- [ ] Unsubscribe flow works (confirmation → deploy → success)
- [ ] Copy trades history page displays with filters
- [ ] Each trade row shows action, amounts, PnL, and status
- [ ] Links to CSPR.live deploy explorer work
- [ ] Real-time updates via Supabase Realtime subscriptions
- [ ] Mobile responsive: tables scroll horizontally

---

**Phase 8 Complete.** Users can now manage their portfolio and track copy trades. Phase 9 will build the leaderboard and social features.
