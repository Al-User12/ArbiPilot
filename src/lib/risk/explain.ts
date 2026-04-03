import type { RiskPreview, SwapIntent } from "@/lib/agent/types";
import type { SwapQuote } from "@/lib/protocols/swap-quote";

export function buildSwapExplanation(params: {
  intent: SwapIntent;
  quote: SwapQuote;
  risk: RiskPreview;
}): string {
  const { intent, quote, risk } = params;
  const routeDescription = `${quote.routePath.join(" -> ")} (${quote.hopCount} hop${quote.hopCount > 1 ? "s" : ""})`;

  return [
    `You requested a ${intent.amount} ${intent.tokenIn} -> ${intent.tokenOut} swap on Arbitrum Sepolia.`,
    `Camelot Quoter estimated output is ${quote.amountOutFormatted} ${intent.tokenOut} with minimum ${quote.minAmountOutFormatted} at ${intent.slippageBps} bps slippage.`,
    `Route auto-detected from allowlisted pairs: ${routeDescription}.`,
    `Execution uses allowlisted Camelot router calldata only; the LLM does not pick contracts or calldata.`,
    `Risk level is ${risk.level.toUpperCase()} based on pair support, balance sufficiency, approval requirement, and slippage checks.`,
  ].join(" ");
}
