export interface CasperWalletInfo {
  isConnected: boolean;
  publicKey: string | null;
  activeKey: string | null;
  balance: string;
}

export interface DeployResult {
  deployHash: string;
  blockHash?: string;
  status: "pending" | "success" | "failed";
  errorMessage?: string;
  cost?: string;
}

export interface VaultContractState {
  totalDeposits: string;
  totalWithdrawals: string;
  totalCopiedVolume: string;
  followerCount: number;
  traderShare: string;
  performanceFees: string;
  isPaused: boolean;
}
