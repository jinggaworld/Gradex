"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface AdjustAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  position: {
    id: string;
    traderName: string;
    currentAllocation: string;
  };
  onSaved?: () => void;
}

export function AdjustAllocationModal({
  isOpen,
  onClose,
  position,
  onSaved,
}: AdjustAllocationModalProps) {
  const [newAmount, setNewAmount] = useState(
    (BigInt(position.currentAllocation) / BigInt(10 ** 9)).toString(),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      await fetch(`/api/positions/${position.id}/allocation`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: newAmount }),
      });
      onSaved?.();
      onClose();
    } catch (error) {
      console.error("Failed to update allocation:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass-card rounded-xl p-6 w-full max-w-md mx-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Adjust Allocation</h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-elevated rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Update your CSPR allocation for {position.traderName}
        </p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            min="100"
            className="flex-1 px-4 py-2 rounded-lg bg-surface-elevated border border-border text-sm font-mono outline-none focus:border-brand-500/50"
          />
          <span className="text-sm font-medium">CSPR</span>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-border hover:bg-surface-elevated text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSubmitting}
            className="flex-1 px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
