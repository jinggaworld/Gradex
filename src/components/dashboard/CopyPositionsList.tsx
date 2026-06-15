"use client";

import { useWallet } from "@/hooks/useWallet";
import { shortenAddress, formatCSPR } from "@/lib/utils";
import { TrendingUp, Plus } from "lucide-react";

interface MockPosition {
  trader: string;
  vault: string;
  allocated: bigint;
  currentValue: bigint;
  pnl: number;
  status: "active" | "paused";
  tradesCopied: number;
}

const mockPositions: MockPosition[] = [
  {
    trader: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    vault: "Gradex Alpha Vault",
    allocated: BigInt(500_000_000_000), // 500 CSPR
    currentValue: BigInt(523_000_000_000), // 523 CSPR
    pnl: 4.6,
    status: "active",
    tradesCopied: 12,
  },
  {
    trader: "023456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0",
    vault: "Blue Chip Momentum",
    allocated: BigInt(250_000_000_000), // 250 CSPR
    currentValue: BigInt(238_000_000_000), // 238 CSPR
    pnl: -4.8,
    status: "active",
    tradesCopied: 8,
  },
];

export function CopyPositionsList() {
  const { isConnected } = useWallet();

  if (!isConnected) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Connect your wallet to view copy positions.
      </div>
    );
  }

  if (mockPositions.length === 0) {
    return (
      <div className="text-center py-12 space-y-4">
        <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
          <TrendingUp className="w-6 h-6 text-brand-500" />
        </div>
        <p className="text-muted-foreground text-sm">
          No active copy positions yet.
        </p>
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all">
          <Plus className="w-4 h-4" />
          Subscribe to a Trader
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mockPositions.map((position, i) => (
        <div
          key={i}
          className="flex items-center justify-between p-4 rounded-lg bg-surface-elevated/50 hover:bg-surface-elevated transition-all border border-border"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-500/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-brand-500" />
            </div>
            <div>
              <p className="text-sm font-semibold">{position.vault}</p>
              <p className="text-xs text-muted-foreground">
                Trader: {shortenAddress(position.trader)}
              </p>
              <p className="text-xs text-muted-foreground">
                {position.tradesCopied} trades copied
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-mono font-semibold">
              {formatCSPR(position.currentValue)} CSPR
            </p>
            <p className="text-xs text-muted-foreground">
              Allocated: {formatCSPR(position.allocated)} CSPR
            </p>
            <p
              className={`text-xs font-medium ${
                position.pnl >= 0 ? "text-profit" : "text-loss"
              }`}
            >
              {position.pnl >= 0 ? "+" : ""}
              {position.pnl.toFixed(1)}%
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
