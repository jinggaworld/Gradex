"use client";

import { useState } from "react";
import { Share2, Check, Link } from "lucide-react";

interface ShareButtonProps {
  traderName: string;
  traderAddress: string;
  vaultId?: string;
}

export function ShareButton({
  traderName,
  traderAddress,
}: ShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/traders/${traderAddress}`;
  const shareText = `Check out ${traderName} on Gradex — AI-verified social trading on Casper Network! 🚀`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitterShare = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      "_blank",
    );
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass-card border border-border hover:bg-surface-elevated text-xs transition-all"
      >
        <Share2 className="w-3 h-3" />
        Share
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 z-20 glass-card rounded-lg border border-border shadow-xl overflow-hidden">
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-profit" />
              ) : (
                <Link className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={handleTwitterShare}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-surface-elevated transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Share on X
            </button>
          </div>
        </>
      )}
    </div>
  );
}
