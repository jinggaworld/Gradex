"use client";

import { cn } from "@/lib/utils";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Activity,
  Info,
} from "lucide-react";

interface TraderScoreCardProps {
  score: number;
  riskLevel: "low" | "medium" | "high";
  recommendation: "subscribe" | "caution" | "avoid";
  reasoning: string;
  redFlags: string[];
  strengths: string[];
  isLoading?: boolean;
}

export function TraderScoreCard({
  score,
  riskLevel,
  recommendation,
  reasoning,
  redFlags,
  strengths,
  isLoading,
}: TraderScoreCardProps) {
  if (isLoading) {
    return (
      <div className="glass-card rounded-xl p-6 space-y-4 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-muted" />
          <div className="h-5 w-36 bg-muted rounded" />
        </div>
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-muted rounded" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      </div>
    );
  }

  const scoreColor =
    score >= 70
      ? "text-profit"
      : score >= 40
        ? "text-yellow-400"
        : "text-loss";

  const scoreBackground =
    score >= 70
      ? "bg-profit/10 border-profit/30"
      : score >= 40
        ? "bg-yellow-400/10 border-yellow-400/30"
        : "bg-loss/10 border-loss/30";

  const recommendationIcon = () => {
    switch (recommendation) {
      case "subscribe":
        return <CheckCircle className="w-3 h-3" />;
      case "caution":
        return <AlertTriangle className="w-3 h-3" />;
      case "avoid":
        return <AlertTriangle className="w-3 h-3" />;
    }
  };

  const recommendationColor = () => {
    switch (recommendation) {
      case "subscribe":
        return "text-profit bg-profit/10";
      case "caution":
        return "text-yellow-400 bg-yellow-400/10";
      case "avoid":
        return "text-loss bg-loss/10";
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-brand-500" />
          <h3 className="text-lg font-semibold">AI Reputation Score</h3>
        </div>
        <span
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
            recommendationColor(),
          )}
        >
          {recommendationIcon()}
          {recommendation === "subscribe"
            ? "Recommended"
            : recommendation === "caution"
              ? "Caution"
              : "Avoid"}
        </span>
      </div>

      {/* Score Circle */}
      <div className="flex justify-center">
        <div
          className={cn(
            "relative w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-500",
            scoreBackground,
          )}
        >
          <span
            className={cn(
              "text-3xl font-bold font-mono transition-colors duration-500",
              scoreColor,
            )}
          >
            {score}
          </span>
          <span className="absolute -bottom-1 text-xs text-muted-foreground">
            /100
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <div className="flex items-start gap-2">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground leading-relaxed">
          {reasoning}
        </p>
      </div>

      {/* Strengths */}
      {strengths.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-profit" />
            Strengths
          </h4>
          <ul className="space-y-1">
            {strengths.map((strength, i) => (
              <li
                key={i}
                className="text-xs text-profit/80 flex items-start gap-2"
              >
                <span className="mt-0.5">•</span>
                {strength}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Red Flags */}
      {redFlags.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-loss" />
            Red Flags
          </h4>
          <ul className="space-y-1">
            {redFlags.map((flag, i) => (
              <li
                key={i}
                className="text-xs text-loss/80 flex items-start gap-2"
              >
                <span className="mt-0.5">•</span>
                {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risk Level Indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-sm text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Risk Level
        </span>
        <span
          className={cn(
            "text-sm font-semibold px-2 py-0.5 rounded",
            riskLevel === "low" && "text-profit bg-profit/10",
            riskLevel === "medium" && "text-yellow-400 bg-yellow-400/10",
            riskLevel === "high" && "text-loss bg-loss/10",
          )}
        >
          {riskLevel.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
