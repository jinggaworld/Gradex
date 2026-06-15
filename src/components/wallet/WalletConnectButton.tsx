"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { Wallet, LogOut, Copy, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn, shortenAddress } from "@/lib/utils";

export function WalletConnectButton() {
  const {
    isConnected,
    publicKey,
    isConnecting,
    error,
    connect,
    disconnect,
  } = useWallet();
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleCopyAddress = async () => {
    if (publicKey) {
      await navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm",
          "bg-brand-600 hover:bg-brand-700 text-white transition-all",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "shadow-lg shadow-brand-600/25"
        )}
      >
        {isConnecting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Wallet className="w-4 h-4" />
        )}
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg",
          "glass-card hover:bg-surface-elevated transition-all text-sm"
        )}
      >
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse-slow" />
        <span className="font-mono">{shortenAddress(publicKey!)}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute right-0 mt-2 w-64 z-20 glass-card rounded-xl border border-border shadow-2xl overflow-hidden">
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground mb-1">Connected as</p>
              <p className="font-mono text-sm truncate">{publicKey}</p>
              {error && (
                <p className="text-xs text-red-400 mt-1">{error}</p>
              )}
            </div>
            <div className="p-2 space-y-1">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-elevated transition-colors text-sm"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <button
                onClick={disconnect}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-elevated transition-colors text-sm text-red-400"
              >
                <LogOut className="w-4 h-4" />
                Disconnect
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
