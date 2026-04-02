import { parseUnits } from "viem";

import type { ParsedIntent, ValidationResult } from "@/lib/agent/types";
import { MAX_SAFE_SLIPPAGE_BPS } from "@/lib/config/allowlist";

const MAX_ALLOWED_AMOUNT = 1_000_000;

export function validateParsedIntent(intent: ParsedIntent): ValidationResult {
  if (intent.action === "bridge") {
    return {
      ok: false,
      reason: "Bridge intent recognized but not supported in this MVP.",
    };
  }

  if (intent.chain !== "arbitrum-sepolia") {
    return { ok: false, reason: "Only arbitrum-sepolia is supported." };
  }

  if (!isPlainPositiveDecimal(intent.amount)) {
    return { ok: false, reason: "Amount must be a positive decimal value." };
  }

  const amountAsNumber = Number(intent.amount);
  if (!Number.isFinite(amountAsNumber) || amountAsNumber <= 0) {
    return { ok: false, reason: "Amount must be greater than zero." };
  }

  if (amountAsNumber > MAX_ALLOWED_AMOUNT) {
    return {
      ok: false,
      reason: `Amount is above safety limit (${MAX_ALLOWED_AMOUNT}).`,
    };
  }

  if (intent.tokenIn === intent.tokenOut) {
    return { ok: false, reason: "tokenIn and tokenOut must be different." };
  }

  if (intent.slippageBps <= 0 || intent.slippageBps > MAX_SAFE_SLIPPAGE_BPS) {
    return {
      ok: false,
      reason: `Slippage must be between 1 and ${MAX_SAFE_SLIPPAGE_BPS} bps.`,
    };
  }

  try {
    parseUnits(intent.amount, intent.tokenIn === "USDC" ? 6 : 18);
  } catch {
    return { ok: false, reason: "Amount precision is invalid for selected token." };
  }

  return { ok: true };
}

function isPlainPositiveDecimal(value: string): boolean {
  return /^\d+(\.\d+)?$/.test(value.trim());
}

