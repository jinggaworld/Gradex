import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCSPR(amount: string | bigint, decimals = 9): string {
  const num = typeof amount === "string" ? BigInt(amount) : amount;
  const sign = num < 0n ? "-" : "";
  const abs = num < 0n ? -num : num;
  const whole = abs / BigInt(10 ** decimals);
  const fraction = abs % BigInt(10 ** decimals);
  return `${sign}${whole}.${fraction.toString().padStart(decimals, "0").slice(0, 4)}`;
}

export function parseCSPR(amount: string): bigint {
  const [whole = "0", fraction = ""] = amount.split(".");
  const padded = fraction.padEnd(9, "0").slice(0, 9);
  return BigInt(whole) * BigInt(10 ** 9) + BigInt(padded || "0");
}

export function shortenAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCurrency(value: string, decimals = 2): string {
  const num = Number(value) / 10 ** 9;
  return num.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}
