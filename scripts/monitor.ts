/**
 * Gradex System Monitor
 *
 * Monitors contract events via SSE and API health endpoints.
 * Useful after testnet deployment to verify everything is running.
 *
 * Usage:
 *   npx ts-node scripts/monitor.ts
 */

const RPC_URL = process.env.NEXT_PUBLIC_CASPER_RPC_URL || "https://rpc.testnet.casper.network/rpc";
const SSE_URL = process.env.NEXT_PUBLIC_CASPER_SSE_URL || "ws://node.testnet.casper.network:9999/events/main";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

interface SystemMetrics {
  totalVaults: number;
  totalFollowers: number;
  totalCopyTrades: number;
  totalRoyaltiesDistributed: string;
  avgResponseTime: number;
  errorRate: number;
  activeUsers24h: number;
}

class GradexMonitor {
  private metrics: SystemMetrics = {
    totalVaults: 0,
    totalFollowers: 0,
    totalCopyTrades: 0,
    totalRoyaltiesDistributed: "0",
    avgResponseTime: 0,
    errorRate: 0,
    activeUsers24h: 0,
  };

  async startMonitoring() {
    console.log("╔══════════════════════════════════════════╗");
    console.log("║     Gradex System Monitor Active        ║");
    console.log("╚══════════════════════════════════════════╝\n");
    console.log(`RPC: ${RPC_URL}`);
    console.log(`SSE: ${SSE_URL}`);
    console.log(`Site: ${SITE_URL}\n`);

    // Monitor API health
    this.monitorAPIHealth();

    // Periodic metrics collection
    setInterval(() => this.collectMetrics(), 60000);
    setInterval(() => this.reportHealth(), 300000);

    console.log("[Monitor] Monitoring started. Press Ctrl+C to stop.\n");
  }

  private async monitorAPIHealth() {
    const endpoints = [
      "/api/traders",
      "/api/leaderboard",
      "/api/portfolio",
      "/api/copies",
    ];

    setInterval(async () => {
      for (const endpoint of endpoints) {
        const start = Date.now();
        try {
          const res = await fetch(`${SITE_URL}${endpoint}`);
          const latency = Date.now() - start;

          if (!res.ok) {
            console.error(`[Monitor] ❌ ${endpoint} returned ${res.status}`);
            this.metrics.errorRate++;
          }

          this.metrics.avgResponseTime =
            this.metrics.avgResponseTime * 0.9 + latency * 0.1;
        } catch (error) {
          console.error(`[Monitor] ❌ ${endpoint} failed:`, error);
          this.metrics.errorRate++;
        }
      }
    }, 30000);

    console.log("[Monitor] API health checks running (every 30s)...");
  }

  private async collectMetrics() {
    try {
      const [tradersRes, leaderboardRes] = await Promise.all([
        fetch(`${SITE_URL}/api/traders`),
        fetch(`${SITE_URL}/api/leaderboard`),
      ]);

      if (tradersRes.ok) {
        const traders = await tradersRes.json();
        this.metrics.totalVaults = traders.traders?.length || 0;
      }

      if (leaderboardRes.ok) {
        const lb = await leaderboardRes.json();
        if (lb.entries) {
          this.metrics.totalFollowers = lb.entries.reduce(
            (sum: number, e: any) => sum + (e.followers_count || 0),
            0,
          );
        }
      }
    } catch (error) {
      console.error("[Monitor] Metrics collection error:", error);
    }
  }

  private reportHealth() {
    const now = new Date().toLocaleTimeString();
    console.log(`\n[${now}] Health Report:`);
    console.log(JSON.stringify(this.metrics, null, 2));

    if (this.metrics.errorRate > 10) {
      console.error("[Monitor] ⚠️ High error rate detected!");
    }
    if (this.metrics.avgResponseTime > 2000) {
      console.warn("[Monitor] ⚠️ High latency detected!");
    }
  }
}

const isMain = process.argv[1]?.endsWith("monitor.ts");
if (isMain) {
  const monitor = new GradexMonitor();
  monitor.startMonitoring().catch(console.error);

  process.on("SIGINT", () => {
    console.log("\n[Monitor] Stopping...");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    process.exit(0);
  });
}

export { GradexMonitor };
