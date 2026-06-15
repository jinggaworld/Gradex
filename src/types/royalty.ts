export interface RoyaltyPayment {
  id: string;
  paymentId: number;
  traderAddress: string;
  followerAddress: string;
  vaultId: string;
  profitAmount: string;
  royaltyAmount: string;
  royaltyRateBps: number;
  transactionHash: string | null;
  paymentMethod: "x402" | "onchain";
  paidAt: string;
}

export interface TraderRoyaltyStats {
  totalRoyaltiesEarned: string;
  totalRoyaltiesPaid: string;
  royaltyRateBps: number;
  paymentCount: number;
  averageRoyaltyPerFollower: string;
  topPayingFollowers: Array<{
    address: string;
    totalPaid: string;
    tradesCopied: number;
  }>;
  dailyRoyalties: Array<{
    date: string;
    amount: string;
    transactionCount: number;
  }>;
}

export interface RoyaltyRateConfig {
  traderAddress: string;
  rateBps: number;
  isCustom: boolean;
}

export interface X402EndpointConfig {
  endpointUrl: string;
  isActive: boolean;
  lastHealthCheck: string | null;
}
