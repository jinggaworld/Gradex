"use client";

import { formatCSPR } from "@/lib/utils";
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
  const pnlPercent =
    invested > 0n
      ? Number((current - invested) * 10000n / invested) / 100
      : 0;
  const isPositive = pnl >= 0n;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div
          className={`text-lg font-bold font-mono ${isPositive ? "text-profit" : "text-loss"}`}
        >
          {isPositive ? "+" : ""}
          {formatCSPR(totalPnL)} CSPR
          <span
            className={`text-xs ml-1 ${isPositive ? "text-profit" : "text-loss"}`}
          >
            ({isPositive ? "+" : ""}
            {pnlPercent.toFixed(2)}%)
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
          {activePositions} active position
          {activePositions !== 1 ? "s" : ""}
        </div>
      </div>
    </div>
  );
}
