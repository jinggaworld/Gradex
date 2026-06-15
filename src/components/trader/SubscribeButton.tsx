"use client";

import { useWallet } from "@/hooks/useWallet";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Wallet, Check } from "lucide-react";

interface SubscribeButtonProps {
  traderAddress: string;
  traderName: string;
  disabled?: boolean;
}

export function SubscribeButton({
  traderAddress,
  traderName,
  disabled,
}: SubscribeButtonProps) {
  const { isConnected, connect } = useWallet();
  const router = useRouter();
  const handleClick = async () => {
    if (!isConnected) {
      await connect();
      return;
    }

    router.push(`/subscribe?trader=${traderAddress}`);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "px-6 py-3 rounded-xl font-semibold text-sm transition-all",
        disabled
          ? "bg-loss/20 text-loss/50 cursor-not-allowed"
          : "bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-600/25 hover:shadow-brand-600/40",
      )}
    >
      {disabled ? (
        "Not Recommended"
      ) : !isConnected ? (
        <span className="flex items-center gap-2">
          <Wallet className="w-4 h-4" />
          Connect to Subscribe
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <Check className="w-4 h-4" />
          Subscribe to {traderName}
        </span>
      )}
    </button>
  );
}
