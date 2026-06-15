export interface Vault {
  id: string;
  vaultContractHash: string;
  traderAddress: string;
  name: string;
  description: string;
  totalAllocated: string;
  totalFollowers: number;
  minAllocation: string;
  maxAllocation: string;
  performanceFee: number;
  subscriptionFee: string;
  frequency: "per_trade" | "daily" | "weekly" | "monthly";
  isActive: boolean;
  createdAt: Date;
  strategy: string;
  riskLevel: "low" | "medium" | "high";
  roi30d: number;
  roi7d: number;
  drawdown: number;
}

export interface CopyPosition {
  id: string;
  followerAddress: string;
  vaultId: string;
  allocatedAmount: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: number;
  isActive: boolean;
  autoCompound: boolean;
  maxDrawdown: number;
  subscribedAt: Date;
  lastCopyTradeAt?: Date;
  totalProfitsDistributed: string;
  totalRoyaltiesPaid: string;
}

export interface CopyTrade {
  id: string;
  vaultId: string;
  traderAddress: string;
  followerAddress: string;
  originalTxHash: string;
  copiedTxHash?: string;
  dex: string;
  action: "buy" | "sell";
  token: string;
  tokenAmount: string;
  csprAmount: string;
  price: string;
  proportionalAmount: string;
  status: "pending" | "executed" | "failed";
  executedAt?: Date;
  profit?: string;
}
