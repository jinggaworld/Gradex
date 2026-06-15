/**
 * Testnet deployment script for Gradex contracts.
 * Uses commander for CLI argument parsing.
 *
 * Usage:
 *   npx ts-node scripts/deploy-testnet.ts --contract <path> --args '<json>'
 *   npx ts-node scripts/deploy-testnet.ts --contract gradex-contracts/target/wasm32-unknown-unknown/release/gradex_contracts.wasm --args '{"owner":"0123...","name":"Vault","performance_fee_bps":200,"subscription_fee":"1000000000","min_allocation":"100000000000","max_allocation":"100000000000000"}'
 */

import * as fs from "fs";
import * as path from "path";

// Minimal argument parser (avoids requiring commander dependency)
interface CliArgs {
  contract: string;
  args: Record<string, any>;
  rpc: string;
  chain: string;
  payment: string;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  const result: CliArgs = {
    contract: "",
    args: {},
    rpc: "https://rpc.testnet.casper.network/rpc",
    chain: "casper-test",
    payment: "5000000000",
  };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--contract" && i + 1 < argv.length) {
      result.contract = argv[++i];
    } else if (argv[i] === "--args" && i + 1 < argv.length) {
      try {
        result.args = JSON.parse(argv[++i]);
      } catch {
        console.error("Invalid --args JSON");
        process.exit(1);
      }
    } else if (argv[i] === "--rpc" && i + 1 < argv.length) {
      result.rpc = argv[++i];
    } else if (argv[i] === "--chain" && i + 1 < argv.length) {
      result.chain = argv[++i];
    } else if (argv[i] === "--payment" && i + 1 < argv.length) {
      result.payment = argv[++i];
    }
  }

  return result;
}

const opts = parseArgs();

async function main() {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   Gradex - Testnet Deployment           ║`);
  console.log(`║   Casper Agentic Buildathon 2026        ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);

  console.log(`Network: ${opts.chain}`);
  console.log(`RPC: ${opts.rpc}`);
  console.log(`Contract: ${opts.contract}\n`);

  if (!opts.contract) {
    console.error("❌ --contract <path> is required");
    console.log(`\nUsage: npx ts-node scripts/deploy-testnet.ts --contract <path> --args '<json>'`);
    process.exit(1);
  }

  if (!fs.existsSync(opts.contract)) {
    console.error(`❌ Wasm file not found: ${opts.contract}`);
    console.error(`  Build contracts first: cd gradex_contracts && cargo odra build`);
    process.exit(1);
  }

  const wasmBytes = fs.readFileSync(opts.contract);
  const casperSdk = await import("casper-js-sdk");
  const RpcClient = (casperSdk as any).RpcClient;
  const DeployUtil = (casperSdk as any).DeployUtil;
  const Keys = (casperSdk as any).Keys;
  const CLValueBuilder = (casperSdk as any).CLValueBuilder;
  const RuntimeArgs = (casperSdk as any).RuntimeArgs;

  // Load key pair
  const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
  const keyPath = path.join(homeDir, ".casper", "testnet-key.pem");
  if (!fs.existsSync(keyPath)) {
    console.error(`  ❌ Deployer key not found at: ${keyPath}`);
    console.error(`  Generate: casper-client keygen ~/.casper/testnet-key.pem`);
    process.exit(1);
  }

  const pemContent = fs.readFileSync(keyPath, "utf-8");
  const hexKey = pemContent.replace(/-----.*?-----/g, "").replace(/\s/g, "").trim();
  const keyPair = Keys.Ed25519.parsePrivateKey(Buffer.from(hexKey, "hex"));

  console.log(`Deployer: ${keyPair.publicKey.toHex()}\n`);

  const deployParams = new DeployUtil.DeployParams(
    keyPair.publicKey,
    opts.chain,
    1,
    1800000,
  );

  const runtimeArgs = RuntimeArgs.fromMap(
    Object.entries(opts.args).reduce((acc: Record<string, any>, [key, value]) => {
      if (typeof value === "string" && /^[0-9a-f]{64,}$/i.test(value)) {
        acc[key] = CLValueBuilder.byteArray(Buffer.from(value, "hex"));
      } else if (typeof value === "string" && !isNaN(Number(value)) && value.length > 0) {
        acc[key] = CLValueBuilder.u512(value);
      } else if (typeof value === "string") {
        acc[key] = CLValueBuilder.string(value);
      } else if (typeof value === "number" && Number.isInteger(value)) {
        acc[key] = value <= 65535 ? CLValueBuilder.u16(value) : CLValueBuilder.u512(value.toString());
      } else if (typeof value === "bigint") {
        acc[key] = CLValueBuilder.u512(value.toString());
      } else if (typeof value === "boolean") {
        acc[key] = CLValueBuilder.bool(value);
      }
      return acc;
    }, {}),
  );

  const session = DeployUtil.ExecutableDeployItem.newModuleBytes(wasmBytes, runtimeArgs);
  const payment = DeployUtil.standardPayment(BigInt(opts.payment));
  const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
  const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

  const client = new RpcClient(opts.rpc);
  const putResult = await client.putDeploy(signedDeploy);
  const deployHash = putResult.deployHash;

  console.log(`✅ Deploy submitted: ${deployHash}`);
  console.log(`🔗 https://testnet.cspr.live/deploy/${deployHash}`);
  console.log(`\n  ⏳ Waiting for finalization...`);

  // Wait for finalization
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const result = await client.getDeploy(deployHash);
      if (result?.execution_results?.length > 0) {
        const execResult = result.execution_results[0].result;
        if (execResult.Success) {
          console.log(`  ✅ Deploy finalized!`);
          let contractHash = "";
          try {
            const transforms = execResult.Success.transforms || [];
            for (const t of transforms) {
              if (t.key && t.key.startsWith("hash-")) {
                contractHash = t.key;
                break;
              }
            }
          } catch {}
          if (contractHash) {
            console.log(`  📝 Contract hash: ${contractHash}`);
          }
          process.exit(0);
        }
        if (execResult.Failure) {
          console.error(`  ❌ Deploy failed: ${execResult.Failure.error_message}`);
          process.exit(1);
        }
      }
    } catch {}
  }

  console.warn(`  ⚠️  Deploy not finalized after 30 retries.`);
  console.log(`\nCheck status at: https://testnet.cspr.live/deploy/${deployHash}`);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
