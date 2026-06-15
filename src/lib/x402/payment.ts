/**
 * x402 Protocol Implementation for Gradex
 *
 * Handles machine-to-machine (M2M) payment negotiation between the Gradex platform
 * and trader-owned HTTP endpoints. Enables automated royalty payments when followers
 * profit from copy trades.
 *
 * The x402 protocol works as follows:
 * 1. Gradex sends a GET to the trader's endpoint with context headers
 * 2. Trader's endpoint responds with 402 Payment Required + payment details
 * 3. Gradex constructs an on-chain payment proof and submits it
 * 4. Gradex sends the payment proof to the trader's endpoint for verification
 * 5. Trader's endpoint grants access / records the payment
 *
 * Falls back to direct on-chain CSPR transfer when x402 endpoint is unavailable.
 */

interface X402PaymentRequest {
  amount: string; // CSPR amount in motes
  address: string; // Trader's Casper wallet address
  currency: string; // "CSPR"
  network: string; // "casper-test" or "casper"
  memo?: string; // Optional payment identifier
}

interface X402PaymentResponse {
  signature: string; // Payment signature
  transactionHash: string;
  timestamp: number;
}

export interface RoyaltyPaymentResult {
  method: "x402" | "onchain";
  transactionHash: string;
  success: boolean;
  royaltyAmount: string;
  paymentId?: string;
}

class X402Client {
  private privateKey: string;
  private paymentAddress: string;

  constructor() {
    this.privateKey = process.env.X402_PRIVATE_KEY || "";
    this.paymentAddress = process.env.X402_PAYMENT_ADDRESS || "";
  }

  /**
   * Attempt x402 payment to a trader's HTTP endpoint.
   * Falls back to direct on-chain CSPR transfer if endpoint is unavailable.
   */
  async executeRoyaltyPayment(params: {
    traderEndpoint: string;
    traderAddress: string;
    followerAddress: string;
    vaultId: string;
    profitAmount: bigint;
    royaltyAmount: bigint;
  }): Promise<RoyaltyPaymentResult> {
    const { traderEndpoint, traderAddress, followerAddress, vaultId, royaltyAmount } = params;

    if (!this.privateKey) {
      throw new Error("X402_PRIVATE_KEY not configured");
    }

    // Try x402 protocol first
    try {
      const x402Result = await this.tryX402Payment({
        endpoint: traderEndpoint,
        amount: royaltyAmount,
        traderAddress,
        followerAddress,
        vaultId,
      });

      if (x402Result.success) {
        return {
          method: "x402",
          transactionHash: x402Result.transactionHash,
          success: true,
          royaltyAmount: royaltyAmount.toString(),
        };
      }
    } catch (error) {
      console.log(
        `[x402] HTTP endpoint failed for ${traderAddress.slice(0, 8)}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
      console.log("[x402] Falling back to on-chain transfer");
    }

    // Fallback: direct on-chain CSPR transfer
    const txHash = await this.executeOnChainTransfer(traderAddress, royaltyAmount);

    return {
      method: "onchain",
      transactionHash: txHash,
      success: !!txHash,
      royaltyAmount: royaltyAmount.toString(),
    };
  }

  /**
   * Attempt x402 HTTP-based payment negotiation.
   */
  private async tryX402Payment(params: {
    endpoint: string;
    amount: bigint;
    traderAddress: string;
    followerAddress: string;
    vaultId: string;
  }): Promise<{ success: boolean; transactionHash: string }> {
    const { endpoint, amount, followerAddress, vaultId } = params;

    // Step 1: Send request to trader's endpoint with context headers
    const response = await fetch(`${endpoint}/x402/payment`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-Gradex-Vault": vaultId,
        "X-Gradex-Follower": followerAddress,
      },
      signal: AbortSignal.timeout(10_000), // 10 second timeout
    });

    // Step 2: Expect 402 Payment Required
    if (response.status !== 402) {
      throw new Error(`Expected 402 Payment Required, got ${response.status}`);
    }

    const paymentRequired: X402PaymentRequest = await response.json();

    // Step 3: Log any amount mismatch (proceed anyway)
    if (BigInt(paymentRequired.amount) !== amount) {
      console.warn(
        `[x402] Amount mismatch: requested ${paymentRequired.amount}, expected ${amount}`,
      );
    }

    // Step 4: Construct on-chain payment proof
    const paymentResponse = await this.constructPaymentProof(
      paymentRequired,
      followerAddress,
      vaultId,
    );

    // Step 5: Submit payment proof to trader's endpoint for verification
    const verifyResponse = await fetch(`${endpoint}/x402/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-SIGNATURE": JSON.stringify(paymentResponse),
      },
      body: JSON.stringify({
        follower: followerAddress,
        vault: vaultId,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!verifyResponse.ok) {
      throw new Error(`Payment verification failed: ${verifyResponse.status}`);
    }

    return {
      success: true,
      transactionHash: paymentResponse.transactionHash,
    };
  }

  /**
   * Construct cryptographic proof of on-chain payment.
   * Builds, signs, and submits a CSPR transfer deploy to the network.
   */
  private async constructPaymentProof(
    paymentRequest: X402PaymentRequest,
    followerAddress: string,
    vaultId: string,
  ): Promise<X402PaymentResponse> {
    const casperSdk = await import("casper-js-sdk");
    const RpcClient = (casperSdk as any).RpcClient;
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;

    const rpcUrl = process.env.NEXT_PUBLIC_CASPER_RPC_URL || "https://rpc.testnet.casper.network/rpc";
    const chainName = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test";

    const rpcClient = new RpcClient(rpcUrl);
    const keyPair = Keys.Ed25519.parsePrivateKey(Buffer.from(this.privateKey, "hex"));

    const deployParams = new DeployUtil.DeployParams(
      keyPair.publicKey,
      chainName,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newTransfer(
      BigInt(paymentRequest.amount),
      null,
      paymentRequest.address,
      null,
    );

    const payment = DeployUtil.standardPayment(1000000000n);
    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);

    const result = await rpcClient.putDeploy(signedDeploy);
    const transactionHash = result.deployHash;

    return {
      signature: signedDeploy.hash,
      transactionHash,
      timestamp: Date.now(),
    };
  }

  /**
   * Direct on-chain CSPR transfer (fallback when x402 is unavailable).
   */
  private async executeOnChainTransfer(
    toAddress: string,
    amount: bigint,
  ): Promise<string> {
    const casperSdk = await import("casper-js-sdk");
    const RpcClient = (casperSdk as any).RpcClient;
    const DeployUtil = (casperSdk as any).DeployUtil;
    const Keys = (casperSdk as any).Keys;

    const rpcUrl = process.env.NEXT_PUBLIC_CASPER_RPC_URL || "https://rpc.testnet.casper.network/rpc";
    const chainName = process.env.NEXT_PUBLIC_CASPER_CHAIN_NAME || "casper-test";

    const rpcClient = new RpcClient(rpcUrl);
    const keyPair = Keys.Ed25519.parsePrivateKey(Buffer.from(this.privateKey, "hex"));

    const deployParams = new DeployUtil.DeployParams(
      keyPair.publicKey,
      chainName,
      1,
      1800000,
    );

    const session = DeployUtil.ExecutableDeployItem.newTransfer(
      amount,
      null,
      toAddress,
      null,
    );

    const payment = DeployUtil.standardPayment(1000000000);
    const deploy = DeployUtil.makeDeploy(deployParams, session, payment);
    const signedDeploy = DeployUtil.signDeploy(deploy, keyPair);
    const result = await rpcClient.putDeploy(signedDeploy);

    console.log(`[x402] On-chain transfer submitted: ${result.deployHash}`);
    return result.deployHash;
  }
}

export const x402Client = new X402Client();
