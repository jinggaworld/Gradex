import { waitForDeploy, submitDeploy as clientSubmitDeploy } from "./client";

export async function submitDeploy(
  deploy: any,
  privateKey?: string
): Promise<string> {
  const casperSdk = await import("casper-js-sdk");

  let signedDeploy = deploy;
  if (privateKey) {
    const Keys = (casperSdk as any).Keys;
    const DeployUtil = (casperSdk as any).DeployUtil;
    const keyPair = Keys.Ed25519.parsePrivateKey(
      Buffer.from(privateKey, "hex")
    );
    signedDeploy = DeployUtil.signDeploy(deploy, keyPair);
  }

  return clientSubmitDeploy(signedDeploy);
}

export { waitForDeploy };
