const RPC_URL = process.env.NEXT_PUBLIC_CASPER_RPC_URL || "https://rpc.testnet.casper.network/rpc";

let clientInstance: any = null;

export async function getRpcClient() {
  if (!clientInstance) {
    const casperSdk = await import("casper-js-sdk");
    const RpcClient = (casperSdk as any).RpcClient;
    clientInstance = new RpcClient(RPC_URL);
  }
  return clientInstance;
}

export async function getAccountBalance(publicKey: string): Promise<string> {
  try {
    const client = await getRpcClient();
    const result = await client.getLatestBalance(publicKey);
    return result?.balance_value?.toString() || "0";
  } catch (error) {
    console.error("Failed to fetch balance:", error);
    return "0";
  }
}

export async function getAccountInfo(publicKey: string) {
  try {
    const client = await getRpcClient();
    const result = await client.getAccountInfo(null, { publicKey });
    return result;
  } catch (error) {
    console.error("Failed to fetch account info:", error);
    return null;
  }
}

export async function getDeployResult(deployHash: string) {
  try {
    const client = await getRpcClient();
    const result = await client.getDeploy(deployHash);
    return result;
  } catch (error) {
    console.error("Failed to fetch deploy:", error);
    return null;
  }
}

export async function submitDeploy(deploy: any) {
  try {
    const client = await getRpcClient();
    const result = await client.putDeploy(deploy);
    return result;
  } catch (error) {
    console.error("Failed to submit deploy:", error);
    throw error;
  }
}

export async function waitForDeploy(
  deployHash: string,
  maxRetries = 30
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await getDeployResult(deployHash);
      if (result?.execution_results?.length > 0) {
        const execResult = result.execution_results[0].result;
        if (execResult.Success) return true;
        if (execResult.Failure) {
          console.error(`[Deploy] Failed: ${execResult.Failure.error_message}`);
          return false;
        }
      }
    } catch {
      // Not yet finalized
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  console.error(`[Deploy] ${deployHash} not finalized after ${maxRetries} retries`);
  return false;
}
