"use client";

import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { Bell, Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-16 border-b border-border bg-surface-card/50 backdrop-blur-sm flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4 flex-1 max-w-md">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search traders, vaults, tokens..."
          className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground/50"
        />
      </div>
      <div className="flex items-center gap-4">
        <button className="relative p-2 rounded-lg hover:bg-surface-elevated transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
        </button>
        <WalletConnectButton />
      </div>
    </header>
  );
}
