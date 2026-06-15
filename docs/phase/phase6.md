# Phase 6: Frontend Dashboard & Wallet Integration

**Goal:** Build the main web application with Casper Wallet integration, the landing page, user dashboard, and core UI infrastructure.

**Duration:** 5-7 days

---

## 6.1 Wallet Connection Infrastructure

### src/lib/casper/wallet.ts

```typescript
"use client";

import { RpcClient } from "casper-js-sdk";

interface CasperWalletProvider {
  requestConnection: () => Promise<{ publicKey: string }>;
  disconnect: () => Promise<void>;
  sign: (deployJson: any, publicKey: string) => Promise<any>;
  isConnected: () => Promise<boolean>;
  getActivePublicKey: () => Promise<string | null>;
}

interface CasperWalletState {
  isConnected: boolean;
  publicKey: string | null;
  balance: string;
  isConnecting: boolean;
  error: string | null;
}

class CasperWalletService {
  private rpcClient: RpcClient;
  private state: CasperWalletState = {
    isConnected: false,
    publicKey: null,
    balance: "0",
    isConnecting: false,
    error: null,
  };

  private listeners: Set<(state: CasperWalletState) => void> = new Set();

  constructor() {
    this.rpcClient = new RpcClient(
      process.env.NEXT_PUBLIC_CASPER_RPC_URL!
    );
  }

  async connect(): Promise<void> {
    this.setState({ isConnecting: true, error: null });

    try {
      const provider = this.getProvider();
      const { publicKey } = await provider.requestConnection();
      
      // Fetch balance
      const balance = await this.fetchBalance(publicKey);

      this.setState({
        isConnected: true,
        publicKey,
        balance,
        isConnecting: false,
        error: null,
      });
    } catch (error) {
      this.setState({
        isConnecting: false,
        error: error instanceof Error ? error.message : "Failed to connect wallet",
      });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const provider = this.getProvider();
      await provider.disconnect();
    } catch {
      // Ignore disconnect errors
    }

    this.setState({
      isConnected: false,
      publicKey: null,
      balance: "0",
      isConnecting: false,
      error: null,
    });
  }

  async refreshBalance(): Promise<void> {
    if (!this.state.publicKey) return;

    try {
      const balance = await this.fetchBalance(this.state.publicKey);
      this.setState({ balance });
    } catch (error) {
      console.error("Failed to refresh balance:", error);
    }
  }

  async signDeploy(deployJson: any): Promise<any> {
    const provider = this.getProvider();
    if (!this.state.publicKey) throw new Error("Wallet not connected");

    return provider.sign(deployJson, this.state.publicKey);
  }

  private getProvider(): CasperWalletProvider {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    const provider = (window as any).CasperWalletProvider;
    if (!provider) {
      throw new Error(
        "Casper Wallet not detected. Please install the Casper Wallet browser extension."
      );
    }

    return provider;
  }

  private async fetchBalance(publicKey: string): Promise<string> {
    try {
      const balanceData = await this.rpcClient.getBalance(
        this.rpcClient.getStateRootHash(),
        publicKey
      );
      return balanceData.toString();
    } catch {
      return "0";
    }
  }

  private setState(partial: Partial<CasperWalletState>) {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: CasperWalletState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): CasperWalletState {
    return { ...this.state };
  }
}

export const walletService = new CasperWalletService();
```

### src/hooks/useWallet.ts

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { walletService } from "@/lib/casper/wallet";

interface UseWalletReturn {
  isConnected: boolean;
  publicKey: string | null;
  balance: string;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  shortenedAddress: string;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState(walletService.getState());

  useEffect(() => {
    const unsubscribe = walletService.subscribe(setState);
    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    await walletService.connect();
  }, []);

  const disconnect = useCallback(async () => {
    await walletService.disconnect();
  }, []);

  const refreshBalance = useCallback(async () => {
    await walletService.refreshBalance();
  }, []);

  const shortenedAddress = state.publicKey
    ? `${state.publicKey.slice(0, 6)}...${state.publicKey.slice(-4)}`
    : "";

  return {
    ...state,
    connect,
    disconnect,
    refreshBalance,
    shortenedAddress,
  };
}
```

### src/components/wallet/WalletConnectButton.tsx

```tsx
"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { Wallet, LogOut, Copy, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn, shortenAddress, formatCSPR } from "@/lib/utils";

export function WalletConnectButton() {
  const {
    isConnected,
    publicKey,
    balance,
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
          "glass-card hover:bg-surface-elevated transition-all"
        )}
      >
        <div className="w-2 h-2 rounded-full bg-profit animate-pulse-slow" />
        <span className="font-mono text-sm">{shortenAddress(publicKey!)}</span>
        <span className="text-xs text-muted-foreground font-mono">
          {formatCSPR(balance)} CSPR
        </span>
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
            </div>
            <div className="p-2 space-y-1">
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-elevated transition-colors text-sm"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-profit" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <button
                onClick={disconnect}
                className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-surface-elevated transition-colors text-sm text-loss"
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
```

---

## 6.2 Landing Page

### src/app/page.tsx

```tsx
import Link from "next/link";
import { ArrowRight, TrendingUp, Shield, Zap, Users, Coins, Globe } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Navigation */}
      <nav className="border-b border-border backdrop-blur-sm bg-surface/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-xl font-bold">
                <span className="text-gradient">Gradex</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/traders"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Explore Traders
              </Link>
              <Link
                href="/leaderboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Leaderboard
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all shadow-lg shadow-brand-600/25"
              >
                Launch App
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand-600/10 via-transparent to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/30 text-sm text-brand-500 mb-6">
            <Zap className="w-4 h-4" />
            On-Chain Social Trading on Casper Network
          </div>
          <h1 className="text-4xl sm:text-6xl font-bold mb-6 leading-tight">
            Follow Top Traders.
            <br />
            <span className="text-gradient">Earn Automatically.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Gradex lets you automatically copy the trades of Casper&apos;s best traders.
            AI evaluates reputation. Smart contracts execute copies.
            Traders get paid via x402 when you profit. No middlemen.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all shadow-lg shadow-brand-600/30 hover:shadow-brand-600/50"
            >
              Start Copy Trading
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/traders"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl glass-card border border-border hover:bg-surface-elevated font-semibold transition-all"
            >
              Explore Traders
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-3xl font-bold text-center mb-16">
          How Gradex Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="glass-card rounded-xl p-6 space-y-4 hover:border-brand-500/30 transition-all group"
            >
              <div className="w-12 h-12 rounded-lg bg-brand-500/10 flex items-center justify-center group-hover:bg-brand-500/20 transition-colors">
                <feature.icon className="w-6 h-6 text-brand-500" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {stats.map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-gradient mb-1">
                  {stat.value}
                </div>
                <div className="text-sm text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              Built for Casper Agentic Buildathon 2026
            </span>
            <span className="text-sm text-muted-foreground">
              Powered by Groq + Tavily + x402
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: TrendingUp,
    title: "Auto-Copy Trading",
    description:
      "Subscribe to top Casper traders and automatically mirror their trades proportionally. Set your allocation and let the smart contract handle the rest.",
  },
  {
    icon: Shield,
    title: "AI Reputation Scoring",
    description:
      "Groq + Tavily analyze each trader's performance, consistency, and web reputation before you subscribe. No more blind trust.",
  },
  {
    icon: Coins,
    title: "x402 Royalties",
    description:
      "Traders earn automatically when followers profit. Machine-to-machine payments via x402 protocol — fully on-chain and trustless.",
  },
  {
    icon: Users,
    title: "Social Trading",
    description:
      "Browse top performers, see their strategies, and join their vault. Follow multiple traders to diversify your copy trading portfolio.",
  },
  {
    icon: Globe,
    title: "Fully On-Chain",
    description:
      "Every trade, every payment, every allocation is recorded on the Casper blockchain. Transparent, verifiable, and decentralized.",
  },
  {
    icon: Zap,
    title: "Instant Execution",
    description:
      "Casper's deterministic finality means your copy trades execute in seconds. No waiting for confirmations.",
  },
];

const stats = [
  { value: "$0", label: "Total Volume" },
  { value: "0", label: "Active Traders" },
  { value: "0", label: "Copy Trades" },
  { value: "0", label: "Royalties Paid" },
];
```

---

## 6.3 Dashboard Layout

### src/app/dashboard/layout.tsx

```tsx
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TopBar } from "@/components/dashboard/TopBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-surface flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### src/components/dashboard/Sidebar.tsx

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  TrendingUp,
  Users,
  Trophy,
  Wallet,
  Settings,
  HelpCircle,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/traders", label: "Explore Traders", icon: Users },
  { href: "/dashboard/portfolio", label: "My Portfolio", icon: Wallet },
  { href: "/dashboard/copies", label: "Copy Trades", icon: TrendingUp },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-border bg-surface-card flex flex-col">
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">
            <span className="text-gradient">Gradex</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                isActive
                  ? "bg-brand-600/10 text-brand-500 border border-brand-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        <Link
          href="/docs"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all"
        >
          <HelpCircle className="w-4 h-4" />
          Help & Guide
        </Link>
      </div>
    </aside>
  );
}
```

### src/components/dashboard/TopBar.tsx

```tsx
"use client";

import { WalletConnectButton } from "@/components/wallet/WalletConnectButton";
import { Bell, Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-16 border-b border-border bg-surface-card/50 backdrop-blur-sm flex items-center justify-between px-6">
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
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-brand-500" />
        </button>
        <WalletConnectButton />
      </div>
    </header>
  );
}
```

---

## 6.4 Dashboard Main Page

### src/app/dashboard/page.tsx

```tsx
"use client";

import { useWallet } from "@/hooks/useWallet";
import { formatCSPR, formatPercentage } from "@/lib/utils";
import { CopyPositionsList } from "@/components/dashboard/CopyPositionsList";
import { PerformanceChart } from "@/components/dashboard/PerformanceChart";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { TrendingUp, Users, Wallet, Activity } from "lucide-react";

export default function DashboardPage() {
  const { isConnected, connect, publicKey } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6">
        <div className="w-16 h-16 rounded-full bg-brand-500/10 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-brand-500" />
        </div>
        <h2 className="text-xl font-semibold">Connect Your Wallet</h2>
        <p className="text-muted-foreground text-sm max-w-md text-center">
          Connect your Casper Wallet to view your dashboard, manage copy trades,
          and track your portfolio performance.
        </p>
        <button
          onClick={connect}
          className="px-6 py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-semibold transition-all"
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Welcome back, {publicKey?.slice(0, 8)}...
        </p>
      </div>

      {/* Quick Stats */}
      <QuickStats />

      {/* Performance Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Portfolio Performance</h3>
          <PerformanceChart />
        </div>
        <div className="glass-card rounded-xl p-6">
          <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-brand-600/10 hover:bg-brand-600/20 border border-brand-500/20 transition-all text-sm font-medium">
              <Users className="w-4 h-4 text-brand-500" />
              Find New Traders
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated hover:bg-surface border border-border transition-all text-sm font-medium">
              <Wallet className="w-4 h-4" />
              Deposit to Vault
            </button>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-surface-elevated hover:bg-surface border border-border transition-all text-sm font-medium">
              <Activity className="w-4 h-4" />
              View All Trades
            </button>
          </div>
        </div>
      </div>

      {/* Active Copy Positions */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Active Copy Positions</h3>
          <button className="text-xs text-brand-500 hover:text-brand-400 transition-colors">
            View All
          </button>
        </div>
        <CopyPositionsList />
      </div>
    </div>
  );
}
```

---

## 6.5 Theme Provider

### src/components/ui/theme-provider.tsx

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { type ThemeProviderProps } from "next-themes/dist/types";

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

---

## 6.6 Verification Checklist

- [ ] Casper Wallet extension detected and connection works
- [ ] Wallet connect/disconnect flow completes without errors
- [ ] Balance displays correctly in CSPR format
- [ ] Landing page renders with all sections
- [ ] Dashboard layout shows sidebar + top bar
- [ ] Navigation links work correctly
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Dark theme applied consistently
- [ ] Quick stats show accurate data
- [ ] Performance chart renders with mock data

---

**Phase 6 Complete.** The frontend with wallet integration is ready. Phase 7 will build the trader discovery and subscription flow.
