import { formatUnits, parseUnits } from "viem";

import type { SwapIntent } from "@/lib/agent/types";
import { getArbitrumSepoliaPublicClient } from "@/lib/chain/client";
import { getCamelotContracts, getTokenAllowlist, isSupportedPair } from "@/lib/config/allowlist";

const quoterAbi = [
  {
    type: "function",
    name: "quoteExactInputSingle",
    // Official Algebra Quoter signature:
    // quoteExactInputSingle(address,address,uint256,uint160) returns (uint256,uint16)
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenIn", type: "address" },
      { name: "tokenOut", type: "address" },
      { name: "amountIn", type: "uint256" },
      { name: "limitSqrtPrice", type: "uint160" },
    ],
    outputs: [
      { name: "amountOut", type: "uint256" },
      { name: "fee", type: "uint16" },
    ],
  },
] as const;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export interface SwapQuote {
  adapter: "camelot-quoter";
  amountInRaw: bigint;
  amountOutRaw: bigint;
  minAmountOutRaw: bigint;
  amountInFormatted: string;
  amountOutFormatted: string;
  minAmountOutFormatted: string;
  priceImpactBps: number;
  poolFeeBps: number;
}

export interface SwapQuoteAdapter {
  name: string;
  getQuote: (intent: SwapIntent) => Promise<SwapQuote>;
}

class CamelotQuoterAdapter implements SwapQuoteAdapter {
  name = "camelot-quoter" as const;

  async getQuote(intent: SwapIntent): Promise<SwapQuote> {
    if (!isSupportedPair(intent.tokenIn, intent.tokenOut)) {
      throw new Error("Unsupported pair for Camelot quote adapter");
    }

    const client = getArbitrumSepoliaPublicClient();
    const allowlist = getTokenAllowlist();
    const contracts = getCamelotContracts();

    const tokenIn = allowlist[intent.tokenIn];
    const tokenOut = allowlist[intent.tokenOut];

    const amountInRaw = parseUnits(intent.amount, tokenIn.decimals);

    const { result } = await client.simulateContract({
      address: contracts.quoter,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [tokenIn.address, tokenOut.address, amountInRaw, 0n],
      account: ZERO_ADDRESS,
    });

    const [amountOutRaw, fee] = result;
    const minAmountOutRaw = (amountOutRaw * BigInt(10_000 - intent.slippageBps)) / 10_000n;

    return {
      adapter: "camelot-quoter",
      amountInRaw,
      amountOutRaw,
      minAmountOutRaw,
      amountInFormatted: formatUnits(amountInRaw, tokenIn.decimals),
      amountOutFormatted: formatUnits(amountOutRaw, tokenOut.decimals),
      minAmountOutFormatted: formatUnits(minAmountOutRaw, tokenOut.decimals),
      priceImpactBps: 0,
      poolFeeBps: Number(fee),
    };
  }
}

const camelotQuoterAdapter = new CamelotQuoterAdapter();

export async function getSwapQuote(intent: SwapIntent): Promise<SwapQuote> {
  return camelotQuoterAdapter.getQuote(intent);
}
