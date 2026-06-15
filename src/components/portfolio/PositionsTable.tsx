"use client";

import { useState } from "react";
import { cn, formatCSPR, shortenAddress } from "@/lib/utils";
import {
  Copy,
  ExternalLink,
  Settings,
  XCircle,
  MoreHorizontal,
} from "lucide-react";
import { AdjustAllocationModal } from "./AdjustAllocationModal";

interface Position {
  id: string;
  traderName: string;
  traderAddress: string;
  vaultName: string;
  allocatedAmount: string;
  currentValue: string;
  pnl: string;
  pnlPercentage: number;
  isActive: boolean;
  autoCompound: boolean;
  subscribedAt: string;
  lastCopyTradeAt: string | null;
}

interface PositionsTableProps {
  positions: Position[];
  onRefresh: () => void;
}

export function PositionsTable({ positions, onRefresh }: PositionsTableProps) {
  const [actionMenu, setActionMenu] = useState<string | null>(null);
  const [adjustModal, setAdjustModal] = useState<Position | null>(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-3 px-2 text-muted-foreground font-medium">
                Trader
              </th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                Allocated
              </th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                Current
              </th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                PnL
              </th>
              <th className="text-center py-3 px-2 text-muted-foreground font-medium">
                Auto
              </th>
              <th className="text-right py-3 px-2 text-muted-foreground font-medium">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const pnl = BigInt(pos.pnl || "0");
              const isProfitable = pnl >= 0n;

              return (
                <tr
                  key={pos.id}
                  className="border-b border-border/50 hover:bg-surface-elevated/50 transition-colors"
                >
                  <td className="py-4 px-2">
                    <div>
                      <p className="font-medium">{pos.traderName}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {shortenAddress(pos.traderAddress)}
                      </p>
                    </div>
                  </td>
                  <td className="py-4 px-2 text-right font-mono">
                    {formatCSPR(pos.allocatedAmount)}
                  </td>
                  <td className="py-4 px-2 text-right font-mono">
                    {formatCSPR(pos.currentValue)}
                  </td>
                  <td className="py-4 px-2 text-right">
                    <span
                      className={cn(
                        "font-mono font-medium",
                        isProfitable ? "text-profit" : "text-loss",
                      )}
                    >
                      {isProfitable ? "+" : ""}
                      {formatCSPR(pos.pnl)}
                    </span>
                    <span
                      className={cn(
                        "text-xs ml-1",
                        pos.pnlPercentage >= 0 ? "text-profit" : "text-loss",
                      )}
                    >
                      ({pos.pnlPercentage >= 0 ? "+" : ""}
                      {pos.pnlPercentage.toFixed(2)}%)
                    </span>
                  </td>
                  <td className="py-4 px-2 text-center">
                    <span
                      className={cn(
                        "inline-block w-2 h-2 rounded-full",
                        pos.autoCompound
                          ? "bg-brand-500"
                          : "bg-muted-foreground/30",
                      )}
                    />
                  </td>
                  <td className="py-4 px-2 text-right relative">
                    <button
                      onClick={() =>
                        setActionMenu(actionMenu === pos.id ? null : pos.id)
                      }
                      className="p-1 rounded hover:bg-surface-elevated transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>

                    {actionMenu === pos.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setActionMenu(null)}
                        />
                        <div className="absolute right-0 mt-2 w-48 z-20 glass-card rounded-lg border border-border shadow-xl overflow-hidden">
                          <button
                            onClick={() => {
                              setAdjustModal(pos);
                              setActionMenu(null);
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors"
                          >
                            <Settings className="w-4 h-4" />
                            Adjust Allocation
                          </button>
                          <button className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors">
                            <Copy className="w-4 h-4" />
                            View Copy Trades
                          </button>
                          <button
                            onClick={() => {
                              if (
                                confirm(
                                  `Unsubscribe from ${pos.traderName}?`,
                                )
                              ) {
                                // Handle unsubscribe
                              }
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-loss hover:bg-surface-elevated transition-colors border-t border-border"
                          >
                            <XCircle className="w-4 h-4" />
                            Unsubscribe
                          </button>
                        </div>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Adjust Allocation Modal */}
      {adjustModal && (
        <AdjustAllocationModal
          isOpen={!!adjustModal}
          onClose={() => setAdjustModal(null)}
          position={{
            id: adjustModal.id,
            traderName: adjustModal.traderName,
            currentAllocation: adjustModal.allocatedAmount,
          }}
          onSaved={onRefresh}
        />
      )}
    </>
  );
}
