"use client";

import { cn, formatCSPR, shortenAddress } from "@/lib/utils";
import {
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
} from "lucide-react";

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
    <div className="glass-card rounded-xl p-4 flex items-center justify-between hover:border-brand-500/20 transition-all gap-4 flex-wrap">
      {/* Left: Action + Trader */}
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            isBuy ? "bg-profit/10" : "bg-loss/10",
          )}
        >
          {isBuy ? (
            <ArrowUpRight className="w-5 h-5 text-profit" />
          ) : (
            <ArrowDownRight className="w-5 h-5 text-loss" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-semibold",
                isBuy ? "text-profit" : "text-loss",
              )}
            >
              {isBuy ? "Bought" : "Sold"}
            </span>
            <span className="text-sm font-medium truncate">{trade.token}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
            <span>via {trade.dex}</span>
            <span>·</span>
            <span className="font-mono">
              {shortenAddress(trade.traderAddress)}
            </span>
            <span>·</span>
            <span>
              {new Date(trade.executedAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Center: Amounts */}
      <div className="text-right shrink-0">
        <p className="text-sm font-mono">
          {formatCSPR(trade.csprAmount)} CSPR
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {formatCSPR(trade.tokenAmount)} {trade.token}
        </p>
      </div>

      {/* Right: PnL + Status */}
      <div className="flex items-center gap-4 shrink-0">
        {hasProfit && (
          <div className="text-right hidden sm:block">
            <span
              className={cn(
                "text-sm font-mono font-semibold",
                profit > 0n ? "text-profit" : "text-loss",
              )}
            >
              {profit > 0n ? "+" : ""}
              {formatCSPR(trade.profit)} CSPR
            </span>
          </div>
        )}
        <span
          className={cn(
            "text-[10px] px-2 py-0.5 rounded-full font-medium",
            trade.status === "executed" && "bg-profit/10 text-profit",
            trade.status === "pending" && "bg-yellow-400/10 text-yellow-400",
            trade.status === "failed" && "bg-loss/10 text-loss",
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
