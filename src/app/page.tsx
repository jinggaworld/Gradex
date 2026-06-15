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
