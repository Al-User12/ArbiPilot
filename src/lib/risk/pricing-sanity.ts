import { formatUnits } from "viem";

import type { SwapIntent } from "@/lib/agent/types";
import { getArbitrumSepoliaPublicClient } from "@/lib/chain/client";
import type { SwapQuote } from "@/lib/protocols/swap-quote";

const aggregatorV3Abi = [
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

const STABLE_SYMBOLS = new Set(["USDC", "USDT", "DAI"]);
const DEFAULT_MAX_PRICE_DEVIATION_BPS = 3_000;

export interface PricingSanityResult {
  available: boolean;
  isOutlier: boolean;
  deviationBps?: number;
  quotedOut?: string;
  expectedOut?: string;
  message?: string;
}

function toFiniteNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function getEthUsdPrice() {
  const feed = process.env.ARBITRUM_SEPOLIA_ETH_USD_FEED_ADDRESS;
  if (!feed) {
    return null;
  }

  const client = getArbitrumSepoliaPublicClient();
  const [decimals, latest] = await Promise.all([
    client.readContract({
      address: feed as `0x${string}`,
      abi: aggregatorV3Abi,
      functionName: "decimals",
    }),
    client.readContract({
      address: feed as `0x${string}`,
      abi: aggregatorV3Abi,
      functionName: "latestRoundData",
    }),
  ]);

  const answer = latest[1];
  if (answer <= 0n) {
    return null;
  }

  const price = Number(formatUnits(answer, Number(decimals)));
  if (!Number.isFinite(price) || price <= 0) {
    return null;
  }

  return price;
}

export async function checkSwapPricingSanity(params: {
  intent: SwapIntent;
  quote: SwapQuote;
}): Promise<PricingSanityResult> {
  const { intent, quote } = params;

  const amountIn = toFiniteNumber(intent.amount);
  const quotedOut = toFiniteNumber(quote.amountOutFormatted);
  if (!amountIn || amountIn <= 0 || !quotedOut || quotedOut <= 0) {
    return { available: false, isOutlier: false };
  }

  const pairSupportedForReference =
    (intent.tokenIn === "WETH" && STABLE_SYMBOLS.has(intent.tokenOut)) ||
    (intent.tokenOut === "WETH" && STABLE_SYMBOLS.has(intent.tokenIn));
  if (!pairSupportedForReference) {
    return { available: false, isOutlier: false };
  }

  let ethUsdPrice: number | null = null;
  try {
    ethUsdPrice = await getEthUsdPrice();
  } catch {
    ethUsdPrice = null;
  }

  if (!ethUsdPrice) {
    return { available: false, isOutlier: false };
  }

  const expectedOut =
    intent.tokenIn === "WETH" ? amountIn * ethUsdPrice : amountIn / ethUsdPrice;
  if (!Number.isFinite(expectedOut) || expectedOut <= 0) {
    return { available: false, isOutlier: false };
  }

  const deviationBps = Math.round((Math.abs(quotedOut - expectedOut) / expectedOut) * 10_000);
  const maxDeviationBps = Number(process.env.MAX_PRICE_DEVIATION_BPS ?? DEFAULT_MAX_PRICE_DEVIATION_BPS);
  const isOutlier = deviationBps > maxDeviationBps;

  return {
    available: true,
    isOutlier,
    deviationBps,
    quotedOut: quote.amountOutFormatted,
    expectedOut: String(expectedOut),
    message: isOutlier
      ? `Quoted output (${quote.amountOutFormatted} ${intent.tokenOut}) deviates too much from reference price (~${expectedOut.toFixed(6)} ${intent.tokenOut}, deviation ${deviationBps} bps > limit ${maxDeviationBps} bps).`
      : undefined,
  };
}
