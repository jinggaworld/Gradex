const CHAIN_NAME = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test";

export class VaultContractInteractor {
  async buildSubscribeDeploy(
    vaultContractHash: string,
    followerPublicKey: string,
    amount: bigint,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(followerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(vaultContractHash.replace("hash-", ""), "hex"),
      "subscribe",
      RuntimeArgs.fromMap({
        follower: CLValueBuilder.byteArray(Buffer.from(followerPublicKey, "hex")),
        amount: CLValueBuilder.u512(amount.toString()),
      }),
    );

    const payment = DeployUtil.standardPayment(amount);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  async buildUnsubscribeDeploy(vaultContractHash: string, followerPublicKey: string) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(followerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(vaultContractHash.replace("hash-", ""), "hex"),
      "unsubscribe",
      RuntimeArgs.fromMap({
        follower: CLValueBuilder.byteArray(Buffer.from(followerPublicKey, "hex")),
      }),
    );

    const payment = DeployUtil.standardPayment(2000000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  async buildUpdateAllocationDeploy(
    vaultContractHash: string,
    followerPublicKey: string,
    newAmount: bigint,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(followerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(vaultContractHash.replace("hash-", ""), "hex"),
      "update_allocation",
      RuntimeArgs.fromMap({
        follower: CLValueBuilder.byteArray(Buffer.from(followerPublicKey, "hex")),
        new_amount: CLValueBuilder.u512(newAmount.toString()),
      }),
    );

    const payment = DeployUtil.standardPayment(1500000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  async buildSetMaxDrawdownDeploy(
    vaultContractHash: string,
    followerPublicKey: string,
    drawdownBps: number,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(followerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(vaultContractHash.replace("hash-", ""), "hex"),
      "set_max_drawdown",
      RuntimeArgs.fromMap({
        follower: CLValueBuilder.byteArray(Buffer.from(followerPublicKey, "hex")),
        drawdown_bps: CLValueBuilder.u256(drawdownBps.toString()),
      }),
    );

    const payment = DeployUtil.standardPayment(1500000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  async buildToggleAutoCompoundDeploy(
    vaultContractHash: string,
    followerPublicKey: string,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(followerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(vaultContractHash.replace("hash-", ""), "hex"),
      "toggle_auto_compound",
      RuntimeArgs.fromMap({
        follower: CLValueBuilder.byteArray(Buffer.from(followerPublicKey, "hex")),
      }),
    );

    const payment = DeployUtil.standardPayment(1000000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  async getVaultState(vaultContractHash: string) {
    const { getRpcClient } = await import("./client");
    try {
      const client = await getRpcClient();
      const entity = await client.getLatestEntity({ Contract: vaultContractHash });
      return entity;
    } catch (error) {
      console.error("Failed to get vault state:", error);
      return null;
    }
  }

  async getFollowerAllocation(vaultContractHash: string, followerAddress: string) {
    const { getRpcClient } = await import("./client");
    try {
      const client = await getRpcClient();
      const result = await client.queryLatestGlobalState(
        `vault_${vaultContractHash}_allocations_${followerAddress}`,
        [],
      );
      return result;
    } catch (error) {
      console.error("Failed to get follower allocation:", error);
      return null;
    }
  }

  async getFollowerProfit(vaultContractHash: string, followerAddress: string) {
    const { getRpcClient } = await import("./client");
    try {
      const client = await getRpcClient();
      const result = await client.queryLatestGlobalState(
        `vault_${vaultContractHash}_follower_profits_${followerAddress}`,
        [],
      );
      return result;
    } catch (error) {
      console.error("Failed to get follower profit:", error);
      return null;
    }
  }
}

export const vaultInteractor = new VaultContractInteractor();
