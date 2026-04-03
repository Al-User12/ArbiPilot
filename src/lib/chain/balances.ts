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

export interface BalanceSnapshot {
  tokens: Record<string, TokenBalance>;
  nativeEthRaw: bigint;
  nativeEthFormatted: string;
}

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
  const nativeEthRaw = await client.getBalance({ address: account });

  const tokenBalances = tokenEntries.reduce<Record<string, TokenBalance>>((acc, [symbol, token], index) => {
    const raw = rawBalances[index];
    acc[symbol] = {
      symbol,
      raw,
      formatted: formatUnits(raw, token.decimals),
    };
    return acc;
  }, {});

  return {
    tokens: tokenBalances,
    nativeEthRaw,
    nativeEthFormatted: formatUnits(nativeEthRaw, 18),
  };
}
