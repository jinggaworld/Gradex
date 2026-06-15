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
      <div className="glass-card rounded-xl p-6 space-y-4 hover:border-brand-500/30 transition-all group cursor-pointer h-full">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 font-bold text-lg shrink-0">
              {trader.displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold group-hover:text-brand-500 transition-colors truncate">
                {trader.displayName}
              </h3>
              <p className="text-xs text-muted-foreground font-mono">
                {shortenAddress(trader.walletAddress)}
              </p>
            </div>
          </div>
          {/* AI Score */}
          <div className="flex flex-col items-center shrink-0">
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
                trader.roi30d >= 0 ? "text-profit" : "text-loss",
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
          <span className="text-muted-foreground truncate">
            Volume: {formatCSPR(trader.totalVolume)} CSPR
          </span>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium shrink-0",
              trader.riskLevel === "low" && "bg-profit/10 text-profit",
              trader.riskLevel === "medium" && "bg-yellow-400/10 text-yellow-400",
              trader.riskLevel === "high" && "bg-loss/10 text-loss",
            )}
          >
            {trader.riskLevel.toUpperCase()}
          </span>
        </div>
      </div>
    </Link>
  );
}
