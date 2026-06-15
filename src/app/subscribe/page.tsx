"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/hooks/useWallet";
import { cn, formatCSPR } from "@/lib/utils";
import {
  ArrowLeft,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";

function SubscribeForm() {
  const searchParams = useSearchParams();
  const traderAddress = searchParams.get("trader");
  const { isConnected, balance } = useWallet();

  const [allocation, setAllocation] = useState("1000");
  const [maxDrawdown, setMaxDrawdown] = useState("50");
  const [autoCompound, setAutoCompound] = useState(true);
  const [step, setStep] = useState<"configure" | "confirming" | "success">("configure");
  const [trader, setTrader] = useState<any>(null);
  const [txHash, setTxHash] = useState("");

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
        <div className="w-12 h-12 rounded-full bg-brand-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6 text-brand-500" />
        </div>
        <h1 className="text-2xl font-bold">Connect Your Wallet</h1>
        <p className="text-muted-foreground">
          You need to connect your Casper Wallet to subscribe to a trader.
        </p>
        <Link
          href="/traders"
          className="text-brand-500 hover:underline inline-block text-sm"
        >
          Browse traders
        </Link>
      </div>
    );
  }

  if (!traderAddress || !trader) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">No trader selected</p>
        <Link
          href="/traders"
          className="text-brand-500 hover:underline inline-block text-sm"
        >
          Browse traders
        </Link>
      </div>
    );
  }

  const allocationBigInt = BigInt(Math.round(parseFloat(allocation) * 10 ** 9));
  const balanceBigInt = BigInt(balance || "0");
  const insufficientBalance = allocationBigInt > balanceBigInt;
  const invalidAllocation = allocationBigInt <= 0n;

  const displayName = trader.displayName || traderAddress.slice(0, 8);

  const handleSubscribe = async () => {
    setStep("confirming");

    // Simulate deploy submission
    setTimeout(() => {
      setTxHash(
        `deploy-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`,
      );
      setStep("success");
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Link
        href={`/traders/${traderAddress}`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Trader Profile
      </Link>

      <h1 className="text-2xl font-bold mb-6">
        Subscribe to {displayName}
      </h1>

      {step === "configure" && (
        <div className="space-y-6">
          {/* Allocation Amount */}
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Allocation Amount</h3>
              <span className="text-sm text-muted-foreground font-mono">
                Balance: {formatCSPR(balance)} CSPR
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="number"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                min="100"
                className="flex-1 px-4 py-3 rounded-lg glass-card border border-border bg-transparent text-lg font-mono outline-none focus:border-brand-500/50 transition-colors"
              />
              <span className="text-lg font-semibold">CSPR</span>
            </div>
            {insufficientBalance && (
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
              If losses exceed this threshold, your position will be automatically
              closed.
            </p>
          </div>

          {/* Auto-Compound Toggle */}
          <div className="glass-card rounded-xl p-6">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <h3 className="font-semibold">Auto-Compound Profits</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Automatically reinvest profits to grow your position
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoCompound(!autoCompound)}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  autoCompound ? "bg-brand-600" : "bg-surface-elevated",
                )}
              >
                <div
                  className={cn(
                    "w-5 h-5 rounded-full bg-white absolute top-0.5 transition-all shadow",
                    autoCompound ? "left-6" : "left-0.5",
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
              <span className="font-medium">{displayName}</span>
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
            disabled={insufficientBalance || invalidAllocation}
            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-600/25"
          >
            Confirm Subscription
          </button>
        </div>
      )}

      {step === "confirming" && (
        <div className="glass-card rounded-xl p-12 text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-brand-500" />
          <p className="font-semibold text-lg">Confirming Subscription...</p>
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
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            You are now copying {displayName}. Your trades will execute
            automatically.
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

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-elevated rounded w-1/3" />
            <div className="h-64 bg-surface-elevated rounded-xl" />
          </div>
        </div>
      }
    >
      <SubscribeForm />
    </Suspense>
  );
}
