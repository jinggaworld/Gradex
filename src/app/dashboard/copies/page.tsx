"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { CopyTradeRow } from "@/components/copies/CopyTradeRow";
import { cn } from "@/lib/utils";
import { Activity } from "lucide-react";

type TradeFilter = "all" | "buy" | "sell" | "profit" | "loss";

const filters: TradeFilter[] = ["all", "buy", "sell", "profit", "loss"];

export default function CopyTradesPage() {
  const { isConnected, publicKey } = useWallet();
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TradeFilter>("all");

  useEffect(() => {
    if (isConnected && publicKey) {
      fetchTrades();
    } else {
      setLoading(false);
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
      case "buy":
        return t.action === "buy";
      case "sell":
        return t.action === "sell";
      case "profit":
        return BigInt(t.profit || "0") > 0n;
      case "loss":
        return BigInt(t.profit || "0") < 0n;
      default:
        return true;
    }
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <Activity className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">
          Connect Wallet to View Copy Trades
        </h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Copy Trades</h1>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize",
                filter === f
                  ? "bg-brand-600/20 text-brand-500 border border-brand-500/30"
                  : "bg-surface-elevated text-muted-foreground hover:text-foreground border border-border",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 bg-surface-elevated rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center space-y-3">
          <Activity className="w-12 h-12 mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">
            {trades.length === 0
              ? "No copy trades yet"
              : "No trades match the current filter"}
          </p>
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
