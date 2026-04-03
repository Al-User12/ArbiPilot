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
  symbol: string;
  raw: bigint;
  formatted: string;
}

export type BalanceSnapshot = Record<string, TokenBalance>;

export async function getBalancesSnapshot(account: Address): Promise<BalanceSnapshot> {
  const client = getArbitrumSepoliaPublicClient();
  const allowlist = getTokenAllowlist();
  const tokenEntries = Object.entries(allowlist);

  const rawBalances = await Promise.all(
    tokenEntries.map(([, token]) =>
      client.readContract({
        address: token.address,
        abi: erc20BalanceAbi,
        functionName: "balanceOf",
        args: [account],
      }),
    ),
  );

  return tokenEntries.reduce<BalanceSnapshot>((acc, [symbol, token], index) => {
    const raw = rawBalances[index];
    acc[symbol] = {
      symbol,
      raw,
      formatted: formatUnits(raw, token.decimals),
    };
    return acc;
  }, {});
}
