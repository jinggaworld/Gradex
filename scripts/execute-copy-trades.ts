/**
 * Proportional Copy Trade Executor
 *
 * Calculates the proportional amount for each follower based on their
 * allocation relative to the vault balance, then submits copy trade deploys.
 *
 * Usage:
 *   npx ts-node scripts/execute-copy-trades.ts <vaultAddress> <masterTradeJson>
 */

interface MasterTrade {
  dexAddress: string;
  tokenAddress: string;
  tokenAmount: bigint;
  csprValue: bigint;
  action: "buy" | "sell";
  slippageBps: number;
  traderAddress: string;
  txHash: string;
}

interface FollowerAllocation {
  address: string;
  allocatedAmount: bigint;
  vaultBalance: bigint;
}

interface CopyExecutionResult {
  followerAddress: string;
  proportionalAmount: bigint;
  deployHash: string;
  success: boolean;
  error?: string;
}

function calculateProportion(
  followerAllocation: bigint,
  vaultBalance: bigint,
  tradeSize: bigint,
): bigint {
  if (vaultBalance === 0n) return 0n;
  return (followerAllocation * tradeSize) / vaultBalance;
}

async function executeFollowerCopy(
  follower: FollowerAllocation,
  masterTrade: MasterTrade,
  executorKeyHex: string,
): Promise<CopyExecutionResult> {
  const proportion = calculateProportion(
    follower.allocatedAmount,
    follower.vaultBalance,
    masterTrade.csprValue,
  );

  if (proportion <= 0n) {
    return {
      followerAddress: follower.address,
      proportionalAmount: 0n,
      deployHash: "",
      success: false,
      error: "Proportional amount is zero",
    };
  }

  console.log(
    `  [Copy] ${follower.address.slice(0, 8)}... → ${proportion} CSPR (${((Number(proportion) / Number(masterTrade.csprValue)) * 100).toFixed(2)}%)`,
  );

  try {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;
    const { submitDeploy } = await import("../src/lib/casper/deploy");

    const keyPair = Keys.Ed25519.parsePrivateKey(Buffer.from(executorKeyHex, "hex"));

    const deployParams = new DeployUtil.DeployParams(
      keyPair.publicKey,
      process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test",
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(masterTrade.dexAddress.replace("hash-", ""), "hex"),
      masterTrade.action === "buy" ? "swap_cspr_for_tokens" : "swap_tokens_for_cspr",
      RuntimeArgs.fromMap({
        token: CLValueBuilder.byteArray(
          Buffer.from(masterTrade.tokenAddress.replace("hash-", ""), "hex"),
        ),
        amount: CLValueBuilder.u512(proportion.toString()),
        minimum_amount_out: CLValueBuilder.u512(
          calculateMinOut(proportion, masterTrade.slippageBps).toString(),
        ),
        deadline: CLValueBuilder.u64(
          BigInt(Math.floor(Date.now() / 1000) + 300),
        ),
      }),
    );

    const payment = DeployUtil.standardPayment(2500000000n);
    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    const deployHash = await submitDeploy(deploy, executorKeyHex);

    return {
      followerAddress: follower.address,
      proportionalAmount: proportion,
      deployHash,
      success: true,
    };
  } catch (error) {
    return {
      followerAddress: follower.address,
      proportionalAmount: proportion,
      deployHash: "",
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function calculateMinOut(amount: bigint, slippageBps: number): bigint {
  return amount - (amount * BigInt(slippageBps)) / BigInt(10000);
}

export async function executeCopiesForVault(
  vaultAddress: string,
  vaultContractHash: string,
  masterTrade: MasterTrade,
  followers: FollowerAllocation[],
  executorKeyHex: string,
): Promise<CopyExecutionResult[]> {
  console.log(`\n📊 Executing copies for vault ${vaultAddress.slice(0, 8)}...`);
  console.log(`   Master trade: ${masterTrade.action} ${masterTrade.csprValue} CSPR`);
  console.log(`   Followers: ${followers.length}`);

  if (followers.length === 0) {
    console.log("   No active followers.");
    return [];
  }

  const results: CopyExecutionResult[] = [];

  for (const follower of followers) {
    const result = await executeFollowerCopy(follower, masterTrade, executorKeyHex);
    results.push(result);

    if (result.success) {
      console.log(`   ✅ Copy submitted: ${result.deployHash.slice(0, 16)}...`);
    } else {
      console.warn(`   ⚠️  Copy failed: ${result.error}`);
    }
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`\n📋 Results: ${successful} successful, ${failed} failed`);

  return results;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(`
Usage: npx ts-node scripts/execute-copy-trades.ts <vaultAddress> <masterTradeJson>

Example:
  npx ts-node scripts/execute-copy-trades.ts hash-xxx '{"dexAddress":"hash-yyy","tokenAddress":"hash-zzz","tokenAmount":"1000000000000","csprValue":"5000000000000","action":"buy","slippageBps":100,"traderAddress":"012345...","txHash":"deploy-hash"}'
`);
    process.exit(1);
  }

  const vaultAddress = args[0];
  const masterTrade: MasterTrade = JSON.parse(args[1], (key, value) => {
    if (["tokenAmount", "csprValue"].includes(key) && typeof value === "string") {
      return BigInt(value);
    }
    return value;
  });

  const executorKey = process.env.X402_PRIVATE_KEY;
  if (!executorKey) {
    console.error("X402_PRIVATE_KEY environment variable not set");
    process.exit(1);
  }

  const followers: FollowerAllocation[] = [];
  console.log("No followers found. In production, the copy engine fetches this automatically.");
  await executeCopiesForVault(vaultAddress, vaultAddress, masterTrade, followers, executorKey);
}

const isMain = process.argv[1]?.includes("execute-copy-trades");
if (isMain) main().catch(console.error);
