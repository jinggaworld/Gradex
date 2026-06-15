const CHAIN_NAME = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test";

export class CopyEngineInteractor {
  /**
   * Build a deploy to process a master trade (called by authorized executor).
   */
  async buildProcessMasterTradeDeploy(
    copyEngineHash: string,
    signerPublicKey: string,
    masterTrader: string,
    dexAddress: string,
    dexName: string,
    tokenAddress: string,
    tokenAmount: bigint,
    csprValue: bigint,
    action: string,
    txHash: string,
    slippageBps: number,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(signerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(copyEngineHash.replace("hash-", ""), "hex"),
      "process_master_trade",
      RuntimeArgs.fromMap({
        master_trader: CLValueBuilder.byteArray(Buffer.from(masterTrader, "hex")),
        dex_address: CLValueBuilder.byteArray(Buffer.from(dexAddress, "hex")),
        dex_name: CLValueBuilder.string(dexName),
        token_address: CLValueBuilder.byteArray(Buffer.from(tokenAddress, "hex")),
        token_amount: CLValueBuilder.u512(tokenAmount.toString()),
        cspr_value: CLValueBuilder.u512(csprValue.toString()),
        action: CLValueBuilder.string(action),
        tx_hash: CLValueBuilder.string(txHash),
        slippage_bps: CLValueBuilder.u16(slippageBps),
      }),
    );

    const payment = DeployUtil.standardPayment(2000000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  /**
   * Build a deploy to confirm a completed copy trade.
   */
  async buildConfirmCopyTradeDeploy(
    copyEngineHash: string,
    signerPublicKey: string,
    follower: string,
    trader: string,
    originalTxHash: string,
    copiedTxHash: string,
    dex: string,
    action: string,
    token: string,
    tokenAmount: bigint,
    csprAmount: bigint,
    status: string,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(signerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(copyEngineHash.replace("hash-", ""), "hex"),
      "confirm_copy_trade",
      RuntimeArgs.fromMap({
        follower: CLValueBuilder.byteArray(Buffer.from(follower, "hex")),
        trader: CLValueBuilder.byteArray(Buffer.from(trader, "hex")),
        original_tx_hash: CLValueBuilder.string(originalTxHash),
        copied_tx_hash: CLValueBuilder.string(copiedTxHash),
        dex: CLValueBuilder.string(dex),
        action: CLValueBuilder.string(action),
        token: CLValueBuilder.string(token),
        token_amount: CLValueBuilder.u512(tokenAmount.toString()),
        cspr_amount: CLValueBuilder.u512(csprAmount.toString()),
        status: CLValueBuilder.string(status),
      }),
    );

    const payment = DeployUtil.standardPayment(1500000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  /**
   * Build a deploy to register a vault with the copy engine.
   */
  async buildRegisterVaultDeploy(
    copyEngineHash: string,
    signerPublicKey: string,
    vaultAddress: string,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(signerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(copyEngineHash.replace("hash-", ""), "hex"),
      "register_vault",
      RuntimeArgs.fromMap({
        vault_address: CLValueBuilder.byteArray(
          Buffer.from(vaultAddress.replace("hash-", ""), "hex"),
        ),
      }),
    );

    const payment = DeployUtil.standardPayment(1000000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  /**
   * Build a deploy to register a DEX with the copy engine.
   */
  async buildRegisterDexDeploy(
    copyEngineHash: string,
    signerPublicKey: string,
    dexAddress: string,
    dexName: string,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(signerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(copyEngineHash.replace("hash-", ""), "hex"),
      "register_dex",
      RuntimeArgs.fromMap({
        dex_address: CLValueBuilder.byteArray(
          Buffer.from(dexAddress.replace("hash-", ""), "hex"),
        ),
        dex_name: CLValueBuilder.string(dexName),
      }),
    );

    const payment = DeployUtil.standardPayment(1000000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  /**
   * Build a deploy to link a trader to their vault.
   */
  async buildLinkTraderDeploy(
    copyEngineHash: string,
    signerPublicKey: string,
    traderAddress: string,
    vaultAddress: string,
  ) {
    const casperSdk = await import("casper-js-sdk");
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;
    const CLValueBuilder = (casperSdk as any).CLValueBuilder;
    const RuntimeArgs = (casperSdk as any).RuntimeArgs;

    const deployParams = new DeployUtil.DeployParams(
      Keys.Ed25519.parsePublicKey(signerPublicKey),
      CHAIN_NAME,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Buffer.from(copyEngineHash.replace("hash-", ""), "hex"),
      "link_trader_to_vault",
      RuntimeArgs.fromMap({
        trader: CLValueBuilder.byteArray(Buffer.from(traderAddress, "hex")),
        vault: CLValueBuilder.byteArray(
          Buffer.from(vaultAddress.replace("hash-", ""), "hex"),
        ),
      }),
    );

    const payment = DeployUtil.standardPayment(1000000000n);
    return DeployUtil.makeDeploy(deployParams, session, payment);
  }

  /**
   * Get copy trades for a follower from the engine contract.
   */
  async getFollowerCopyTrades(copyEngineHash: string, followerAddress: string) {
    const { getRpcClient } = await import("./client");
    try {
      const client = await getRpcClient();
      const result = await client.queryLatestGlobalState(
        `copy_engine_${copyEngineHash}_copy_trades`,
        [],
      );
      return result;
    } catch (error) {
      console.error("Failed to get copy trades:", error);
      return null;
    }
  }

  /**
   * Get the copy engine state.
   */
  async getEngineState(copyEngineHash: string) {
    const { getRpcClient } = await import("./client");
    try {
      const client = await getRpcClient();
      const entity = await client.getLatestEntity({ Contract: copyEngineHash });
      return entity;
    } catch (error) {
      console.error("Failed to get engine state:", error);
      return null;
    }
  }
}

export const copyEngineInteractor = new CopyEngineInteractor();
