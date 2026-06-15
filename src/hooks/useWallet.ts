"use client";

import { useState, useEffect, useCallback } from "react";
import { walletService } from "@/lib/casper/wallet";
import { getAccountBalance } from "@/lib/casper/client";

interface UseWalletReturn {
  isConnected: boolean;
  publicKey: string | null;
  balance: string;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  shortenedAddress: string;
}

export function useWallet(): UseWalletReturn {
  const [state, setState] = useState(walletService.getState());

  useEffect(() => {
    const unsubscribe = walletService.subscribe(setState);
    return unsubscribe;
  }, []);

  const connect = useCallback(async () => {
    await walletService.connect();
    // Fetch balance after connecting
    const s = walletService.getState();
    if (s.publicKey) {
      const balance = await getAccountBalance(s.publicKey);
      walletService.updateBalance(balance);
    }
  }, []);

  const disconnect = useCallback(async () => {
    await walletService.disconnect();
  }, []);

  const refreshBalance = useCallback(async () => {
    const s = walletService.getState();
    if (s.publicKey) {
      try {
        const balance = await getAccountBalance(s.publicKey);
        walletService.updateBalance(balance);
      } catch (error) {
        console.error("Failed to refresh balance:", error);
      }
    }
  }, []);

  const shortenedAddress = state.publicKey
    ? `${state.publicKey.slice(0, 6)}...${state.publicKey.slice(-4)}`
    : "";

  return {
    ...state,
    connect,
    disconnect,
    refreshBalance,
    shortenedAddress,
  };
}
