import { parseUnits } from "viem";

import type { RiskPreview, SwapIntent } from "@/lib/agent/types";
import type { BalanceSnapshot } from "@/lib/chain/balances";
import type { SwapQuote } from "@/lib/protocols/swap-quote";
import { getTokenAllowlist, isSupportedPair } from "@/lib/config/allowlist";

export function assessSwapRisk(params: {
  intent: SwapIntent;
  quote: SwapQuote;
  balances?: BalanceSnapshot | null;
}): RiskPreview {
  const { intent, quote, balances } = params;

  const reasons: string[] = [];
  let level: RiskPreview["level"] = "low";

  const supportedPair = isSupportedPair(intent.tokenIn, intent.tokenOut);
  if (!supportedPair) {
    level = "high";
    reasons.push("Token pair is outside the MVP allowlist.");
  }

  if (quote.amountOutRaw <= 0n) {
    level = "high";
    reasons.push("Quoter returned zero output for this amount.");
  }

  const approvalRequired = true; // USDC/WETH are ERC-20; router allowance is required.
  if (approvalRequired && level === "low") {
    level = "medium";
    reasons.push("Input token approval for Camelot router is required before swap.");
  }

  if (intent.slippageBps > 100) {
    level = "high";
    reasons.push("Slippage above 100 bps may increase execution risk.");
  } else if (intent.slippageBps > 50 && level === "low") {
    level = "medium";
    reasons.push("Slippage is moderate for this pair on testnet liquidity.");
  }

  const allowlist = getTokenAllowlist();
  const amountInRaw = parseUnits(intent.amount, allowlist[intent.tokenIn].decimals);
  let sufficientBalance = true;

  if (balances) {
    const available = balances[intent.tokenIn].raw;
    sufficientBalance = available >= amountInRaw;
    if (!sufficientBalance) {
      level = "high";
      reasons.push(
        `Insufficient ${intent.tokenIn} balance for requested amount (${intent.amount}).`,
      );
    }
  }

  if (reasons.length === 0) {
    reasons.push("Checks passed for pair support, non-zero quote output, and slippage bounds.");
  }

  return {
    level,
    reasons,
    checks: {
      supportedPair,
      sufficientBalance,
      approvalRequired,
      slippageBps: intent.slippageBps,
    },
  };
}
