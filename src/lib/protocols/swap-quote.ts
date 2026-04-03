import { formatUnits, parseUnits } from "viem";

import type { SupportedToken, SwapIntent } from "@/lib/agent/types";
import { getArbitrumSepoliaPublicClient } from "@/lib/chain/client";
import { getCamelotContracts, getTokenAllowlist } from "@/lib/config/allowlist";

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
  routePath: SupportedToken[];
  hopCount: number;
}

export interface SwapQuoteAdapter {
  name: string;
  getQuote: (intent: SwapIntent) => Promise<SwapQuote>;
}

class CamelotQuoterAdapter implements SwapQuoteAdapter {
  name = "camelot-quoter" as const;

  private generateRouteCandidates(
    symbols: SupportedToken[],
    tokenIn: SupportedToken,
    tokenOut: SupportedToken,
    maxHops: number,
  ) {
    const routes: SupportedToken[][] = [];

    function dfs(current: SupportedToken, path: SupportedToken[]) {
      const hopCount = path.length - 1;
      if (hopCount > maxHops) {
        return;
      }
      if (current === tokenOut) {
        routes.push([...path]);
        return;
      }
      for (const next of symbols) {
        if (path.includes(next)) {
          continue;
        }
        dfs(next, [...path, next]);
      }
    }

    dfs(tokenIn, [tokenIn]);

    return routes
      .filter((route) => route[route.length - 1] === tokenOut)
      .sort((a, b) => a.length - b.length);
  }

  private async quoteSingleHop(
    tokenInAddress: `0x${string}`,
    tokenOutAddress: `0x${string}`,
    amountInRaw: bigint,
  ) {
    const client = getArbitrumSepoliaPublicClient();
    const contracts = getCamelotContracts();

    const { result } = await client.simulateContract({
      address: contracts.quoter,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [tokenInAddress, tokenOutAddress, amountInRaw, 0n],
      account: ZERO_ADDRESS,
    });

    return result;
  }

  async getQuote(intent: SwapIntent): Promise<SwapQuote> {
    const allowlist = getTokenAllowlist();
    if (!(intent.tokenIn in allowlist) || !(intent.tokenOut in allowlist)) {
      throw new Error(`Unsupported token pair: ${intent.tokenIn} -> ${intent.tokenOut}.`);
    }

    const tokenIn = allowlist[intent.tokenIn];
    const tokenOut = allowlist[intent.tokenOut];
    const amountInRaw = parseUnits(intent.amount, tokenIn.decimals);

    const candidates = this.generateRouteCandidates(
      Object.keys(allowlist) as SupportedToken[],
      intent.tokenIn,
      intent.tokenOut,
      3,
    );
    if (candidates.length === 0) {
      throw new Error(`No route candidates available for ${intent.tokenIn} -> ${intent.tokenOut}.`);
    }

    let best:
      | {
          amountOutRaw: bigint;
          feeBps: number;
          routePath: SupportedToken[];
        }
      | null = null;

    for (const routePath of candidates) {
      try {
        let currentAmount = amountInRaw;
        let accumulatedFeeBps = 0;

        for (let i = 0; i < routePath.length - 1; i += 1) {
          const from = allowlist[routePath[i]];
          const to = allowlist[routePath[i + 1]];
          const [hopAmountOutRaw, hopFee] = await this.quoteSingleHop(
            from.address,
            to.address,
            currentAmount,
          );

          if (hopAmountOutRaw <= 0n) {
            currentAmount = 0n;
            break;
          }

          currentAmount = hopAmountOutRaw;
          accumulatedFeeBps += Number(hopFee);
        }

        if (currentAmount <= 0n) {
          continue;
        }

        if (!best || currentAmount > best.amountOutRaw) {
          best = {
            amountOutRaw: currentAmount,
            feeBps: accumulatedFeeBps,
            routePath,
          };
        }
      } catch {
        // Route candidate is not viable; continue with next candidate.
      }
    }

    if (!best) {
      throw new Error(
        `No viable swap route found for ${intent.tokenIn} -> ${intent.tokenOut} on Camelot Sepolia.`,
      );
    }

    const amountOutRaw = best.amountOutRaw;
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
      poolFeeBps: best.feeBps,
      routePath: best.routePath,
      hopCount: best.routePath.length - 1,
    };
  }
}

const camelotQuoterAdapter = new CamelotQuoterAdapter();

export async function getSwapQuote(intent: SwapIntent): Promise<SwapQuote> {
  return camelotQuoterAdapter.getQuote(intent);
}
