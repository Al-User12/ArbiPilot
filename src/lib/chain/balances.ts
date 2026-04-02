import { formatUnits, type Address } from "viem";

import { getArbitrumSepoliaPublicClient } from "@/lib/chain/client";
import { getTokenAllowlist } from "@/lib/config/allowlist";

const erc20BalanceAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface TokenBalance {
  symbol: "USDC" | "WETH";
  raw: bigint;
  formatted: string;
}

export interface BalanceSnapshot {
  USDC: TokenBalance;
  WETH: TokenBalance;
}

export async function getBalancesSnapshot(account: Address): Promise<BalanceSnapshot> {
  const client = getArbitrumSepoliaPublicClient();
  const allowlist = getTokenAllowlist();

  const [usdcRaw, wethRaw] = await Promise.all([
    client.readContract({
      address: allowlist.USDC.address,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [account],
    }),
    client.readContract({
      address: allowlist.WETH.address,
      abi: erc20BalanceAbi,
      functionName: "balanceOf",
      args: [account],
    }),
  ]);

  return {
    USDC: {
      symbol: "USDC",
      raw: usdcRaw,
      formatted: formatUnits(usdcRaw, allowlist.USDC.decimals),
    },
    WETH: {
      symbol: "WETH",
      raw: wethRaw,
      formatted: formatUnits(wethRaw, allowlist.WETH.decimals),
    },
  };
}
