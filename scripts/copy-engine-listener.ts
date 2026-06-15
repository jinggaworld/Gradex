/**
 * Copy Engine SSE Event Listener
 *
 * Monitors the Casper Network for DEX trades via Server-Sent Events (SSE),
 * detects master trader transactions, and triggers proportional copy trades.
 *
 * This runs as a standalone Node.js script (NOT inside Next.js).
 * Uses direct Supabase client instead of Next.js wrapper.
 *
 * Usage:
 *   npx ts-node scripts/copy-engine-listener.ts
 *
 * Connects to: ws://node.testnet.casper.network:9999/events/main
 */

// Direct Supabase client import (not Next.js wrapper)
import { createClient } from "@supabase/supabase-js";

interface TradeEvent {
  deployHash: string;
  blockHash: string;
  timestamp: number;
  dexContract: string;
  dexName: string;
  traderAddress: string;
  tokenAddress: string;
  tokenAmount: bigint;
  csprAmount: bigint;
  action: "buy" | "sell";
  slippageBps: number;
}

interface CopyVaultInfo {
  vaultAddress: string;
  vaultContractHash: string;
  totalAllocated: bigint;
  followerCount: number;
}

class CopyEngineListener {
  private knownDexes: Map<string, string> = new Map();
  private processedDeploys: Set<string> = new Set();
  private sseUrl: string;
  private rpcUrl: string;
  private pollInterval: number;
  private supabase: ReturnType<typeof createClient> | null = null;

  constructor(
    sseUrl: string,
    rpcUrl: string,
    knownDexes: Array<{ address: string; name: string }>,
    pollInterval = 5000,
  ) {
    this.sseUrl = sseUrl;
    this.rpcUrl = rpcUrl;
    this.pollInterval = pollInterval;

    for (const dex of knownDexes) {
      this.knownDexes.set(dex.address, dex.name);
    }

    // Initialize Supabase client if URL and key are available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }
  }

  async start() {
    console.log("[CopyEngine] Starting SSE event listener...");
    console.log(`[CopyEngine] SSE URL: ${this.sseUrl}`);
    console.log(`[CopyEngine] Watching DEXes: ${[...this.knownDexes.values()].join(", ")}`);

    // Start SSE connection
    await this.connectSSE();

    // Fallback: poll for new blocks periodically
    this.startBlockPolling();
  }

  private async connectSSE() {
    // casper-js-sdk v5 exports EventStream via the main module
    // but TypeScript types may not expose it. Use dynamic import with any cast.
    try {
      const casperSdk = await import("casper-js-sdk");
      const EventStream = (casperSdk as any).EventStream;
      if (!EventStream) {
        console.log("[CopyEngine] EventStream not available in casper-js-sdk v5, using polling only");
        return;
      }

      const eventStream = new EventStream(this.sseUrl);

      eventStream.subscribe("DeployProcessed", async (event: any) => {
        await this.handleDeployProcessed(event);
      });

      eventStream.subscribe("BlockAdded", async (event: any) => {
        await this.handleNewBlock(event);
      });

      eventStream.start();
      console.log("[CopyEngine] SSE connection established.");
    } catch (error) {
      console.error("[CopyEngine] SSE connection failed:", error);
      console.log("[CopyEngine] Falling back to block polling mode.");
    }
  }

  private startBlockPolling() {
    setInterval(async () => {
      try {
        await this.pollLatestBlock();
      } catch (error) {
        console.error("[CopyEngine] Block polling error:", error);
      }
    }, this.pollInterval);
  }

  private async handleDeployProcessed(event: any) {
    try {
      const deployHash = event.body?.DeployProcessed?.deploy_hash;
      if (!deployHash || this.processedDeploys.has(deployHash)) return;

      this.processedDeploys.add(deployHash);
      console.log(`[CopyEngine] New deploy: ${deployHash}`);

      const deploy = await this.fetchDeploy(deployHash);
      if (!deploy) return;

      const tradeEvent = await this.parseTradeFromDeploy(deploy);
      if (tradeEvent) {
        console.log(`[CopyEngine] 🎯 Detected trade: ${tradeEvent.action} ${tradeEvent.tokenAmount} tokens on ${tradeEvent.dexName}`);
        await this.processCopyTrade(tradeEvent);
      }
    } catch (error) {
      console.error("[CopyEngine] Error handling deploy event:", error);
    }
  }

  private async handleNewBlock(event: any) {
    // Future: batch scan deploys in new blocks
  }

  private async pollLatestBlock() {
    try {
      const { RpcClient } = await import("casper-js-sdk");
      const client = new (RpcClient as any)(this.rpcUrl);

      const block = await client.getLatestBlock();
      const blockHash = block.block?.hash;
      if (!blockHash) return;

      const transfers = await client.getLatestBlockTransfers();
      if (transfers?.transfers) {
        for (const transfer of transfers.transfers) {
          const deployHash = transfer.deploy_hash;
          if (!deployHash || this.processedDeploys.has(deployHash)) continue;
          this.processedDeploys.add(deployHash);

          const deploy = await this.fetchDeploy(deployHash);
          if (deploy) {
            const tradeEvent = await this.parseTradeFromDeploy(deploy);
            if (tradeEvent) {
              await this.processCopyTrade(tradeEvent);
            }
          }
        }
      }
    } catch (error) {
      // Silent fail for polling
    }
  }

  private async fetchDeploy(deployHash: string): Promise<any> {
    try {
      const { RpcClient } = await import("casper-js-sdk");
      const client = new (RpcClient as any)(this.rpcUrl);
      return await client.getDeploy(deployHash);
    } catch {
      return null;
    }
  }

  private async parseTradeFromDeploy(deploy: any): Promise<TradeEvent | null> {
    try {
      const deployInfo = deploy.deploy || deploy;
      const session = deployInfo.session;

      const targetContract = this.extractContractAddress(session);
      if (!targetContract) return null;

      const dexName = this.knownDexes.get(targetContract);
      if (!dexName) return null;

      const args = session.args || {};
      const traderAddress = deployInfo.header?.account || "";
      const entryPoint = session.entry_point || "";
      const action = entryPoint.includes("swap_cspr_for_tokens") || entryPoint.includes("buy")
        ? "buy"
        : "sell";

      const tokenAddress = this.extractArg(args, "token") || "";
      const tokenAmount = BigInt(this.extractArg(args, "amount") || "0");
      const csprAmount = BigInt(this.extractArg(args, "cspr_amount") || "0");

      if (csprAmount === 0n) return null;

      return {
        deployHash: deployInfo.hash || "",
        blockHash: deploy.block_hash || "",
        timestamp: deployInfo.timestamp || Date.now(),
        dexContract: targetContract,
        dexName,
        traderAddress,
        tokenAddress,
        tokenAmount,
        csprAmount,
        action,
        slippageBps: 100,
      };
    } catch (error) {
      return null;
    }
  }

  private extractContractAddress(session: any): string | null {
    if (!session) return null;
    if (session.StoredContractByHash) return session.StoredContractByHash.hash;
    if (session.StoredVersionedContractByHash) return session.StoredVersionedContractByHash.hash;
    if (session.stored_contract_by_hash) return session.stored_contract_by_hash.hash;
    return null;
  }

  private extractArg(args: any, name: string): string | null {
    if (!args) return null;
    if (Array.isArray(args)) {
      for (const arg of args) {
        if (arg.name === name || arg[0] === name) {
          return arg.value || arg[1]?.toString() || null;
        }
      }
    } else if (typeof args === "object") {
      return args[name]?.toString() || null;
    }
    return null;
  }

  private async processCopyTrade(trade: TradeEvent) {
    console.log(`[CopyEngine] Processing ${trade.action} trade by ${trade.traderAddress.slice(0, 8)}...`);

    try {
      const vaults = await this.findCopyVaults(trade.traderAddress);

      if (vaults.length === 0) {
        console.log(`[CopyEngine] No vaults copying ${trade.traderAddress.slice(0, 8)}...`);
        return;
      }

      console.log(`[CopyEngine] Found ${vaults.length} vault(s) to copy`);

      for (const vault of vaults) {
        await this.executeProportionalCopy(vault, trade);
      }

      await this.recordMasterTradeOnChain(trade);
    } catch (error) {
      console.error(`[CopyEngine] Error processing copy trade:`, error);
    }
  }

  private async findCopyVaults(traderAddress: string): Promise<CopyVaultInfo[]> {
    if (!this.supabase) {
      console.log("[CopyEngine] Supabase not configured, cannot find vaults");
      return [];
    }

    try {
      const { data: vaults } = await this.supabase
        .from("vaults")
        .select("contract_hash, trader_address, total_allocated, total_followers")
        .eq("trader_address", traderAddress)
        .eq("is_active", true);

      return (vaults || []).map((v: any) => ({
        vaultAddress: v.contract_hash,
        vaultContractHash: v.contract_hash,
        totalAllocated: BigInt(v.total_allocated || "0"),
        followerCount: v.total_followers || 0,
      }));
    } catch (error) {
      console.error("[CopyEngine] Failed to find vaults:", error);
      return [];
    }
  }

  private async executeProportionalCopy(vault: CopyVaultInfo, trade: TradeEvent) {
    console.log(`[CopyEngine] Executing copy for vault ${vault.vaultAddress.slice(0, 8)}...`);
    // Full implementation calls execute-copy-trades.ts module
  }

  private async recordMasterTradeOnChain(trade: TradeEvent) {
    const { submitDeploy } = await import("../src/lib/casper/deploy");
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const copyEngineHash = process.env.NEXT_PUBLIC_COPY_ENGINE_HASH;
    const privateKey = process.env.X402_PRIVATE_KEY;
    if (!copyEngineHash || !privateKey) {
      console.warn("[CopyEngine] COPY_ENGINE_HASH or X402_PRIVATE_KEY not set");
      return;
    }

    try {
      const keyPair = Keys.Ed25519.parsePrivateKey(Buffer.from(privateKey, "hex"));

      const deployParams = new DeployUtil.DeployParams(
        keyPair.publicKey,
        process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test",
        1,
        1800000,
      );

      const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
        Buffer.from(copyEngineHash.replace("hash-", ""), "hex"),
        "process_master_trade",
        RuntimeArgs.fromMap({
          master_trader: CLValueBuilder.byteArray(Buffer.from(trade.traderAddress, "hex")),
          dex_address: CLValueBuilder.byteArray(Buffer.from(trade.dexContract, "hex")),
          dex_name: CLValueBuilder.string(trade.dexName),
          token_address: CLValueBuilder.byteArray(Buffer.from(trade.tokenAddress, "hex")),
          token_amount: CLValueBuilder.u512(trade.tokenAmount.toString()),
          cspr_value: CLValueBuilder.u512(trade.csprAmount.toString()),
          action: CLValueBuilder.string(trade.action),
          tx_hash: CLValueBuilder.string(trade.deployHash),
          slippage_bps: CLValueBuilder.u16(trade.slippageBps),
        }),
      );

      const payment = DeployUtil.standardPayment(2000000000n);
      const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
      const deployHash = await submitDeploy(deploy, privateKey);

      console.log(`[CopyEngine] ✅ Master trade recorded on-chain: ${deployHash}`);
    } catch (error) {
      console.error("[CopyEngine] Failed to record master trade:", error);
    }
  }

  stop() {
    console.log("[CopyEngine] Stopping event listener...");
  }
}

// Configuration
const KNOWN_DEXES = [
  { address: "hash-0000000000000000000000000000000000000000000000000000000000000000", name: "Friendly Market" },
  { address: "hash-1111111111111111111111111111111111111111111111111111111111111111", name: "Ectoplasm" },
];

const SSE_URL = process.env.NEXT_PUBLIC_CASPER_SSE_URL || "ws://node.testnet.casper.network:9999/events/main";
const RPC_URL = process.env.NEXT_PUBLIC_CASPER_RPC_URL || "https://rpc.testnet.casper.network/rpc";

const isMain = process.argv[1]?.includes("copy-engine-listener");
if (isMain) {
  const listener = new CopyEngineListener(SSE_URL, RPC_URL, KNOWN_DEXES);
  listener.start().catch(console.error);

  process.on("SIGINT", () => {
    console.log("\n[CopyEngine] Shutting down...");
    listener.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    listener.stop();
    process.exit(0);
  });
}
