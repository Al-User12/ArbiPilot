import { getServerEnv } from "@/lib/config/env";

export const MAX_SAFE_SLIPPAGE_BPS = 300;

export type SupportedTokenSymbol = string;

export type TokenConfig = {
  symbol: string;
  decimals: number;
  isNative: false;
  address: `0x${string}`;
};

export type CamelotContracts = {
  chainId: 421614;
  swapRouter: `0x${string}`;
  quoter: `0x${string}`;
};

const DEFAULT_USDC_ARB_SEPOLIA: `0x${string}` =
  "0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7";
const DEFAULT_WETH_ARB_SEPOLIA: `0x${string}` =
  "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73";
const DEFAULT_CAMELOT_SWAP_ROUTER: `0x${string}` =
  "0x171B925C51565F5D2a7d8C494ba3188D304EFD93";
const DEFAULT_CAMELOT_QUOTER: `0x${string}` =
  "0xe49ef2F48539EA7498605CC1B3a242042cb5FC83";

function parseExtraTokenAllowlist(raw: string | undefined) {
  if (!raw) {
    return {} as Record<string, TokenConfig>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<
      string,
      {
        address?: unknown;
        decimals?: unknown;
      }
    >;
    const normalized: Record<string, TokenConfig> = {};

    for (const [symbol, value] of Object.entries(parsed)) {
      const normalizedSymbol = symbol.trim().toUpperCase();
      if (!/^[A-Z0-9._-]{2,15}$/.test(normalizedSymbol)) {
        continue;
      }

      if (typeof value?.address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value.address)) {
        continue;
      }

      const decimals =
        typeof value.decimals === "number" && Number.isInteger(value.decimals)
          ? value.decimals
          : Number.NaN;
      if (!Number.isFinite(decimals) || decimals < 0 || decimals > 36) {
        continue;
      }

      normalized[normalizedSymbol] = {
        symbol: normalizedSymbol,
        decimals,
        isNative: false,
        address: value.address as `0x${string}`,
      };
    }

    return normalized;
  } catch {
    return {} as Record<string, TokenConfig>;
  }
}

export function getTokenAllowlist() {
  let usdcAddress: `0x${string}` = DEFAULT_USDC_ARB_SEPOLIA;
  let wethAddress: `0x${string}` = DEFAULT_WETH_ARB_SEPOLIA;

  try {
    const env = getServerEnv();
    if (env.ARBITRUM_SEPOLIA_USDC_ADDRESS) {
      usdcAddress = env.ARBITRUM_SEPOLIA_USDC_ADDRESS;
    }
    if (env.ARBITRUM_SEPOLIA_WETH_ADDRESS) {
      wethAddress = env.ARBITRUM_SEPOLIA_WETH_ADDRESS;
    }
  } catch {
    // Health route and static rendering may call this without fully configured env.
  }

  const allowlist: Record<string, TokenConfig> = {
    USDC: {
      symbol: "USDC",
      decimals: 18,
      isNative: false,
      address: usdcAddress,
    },
    WETH: {
      symbol: "WETH",
      decimals: 18,
      isNative: false,
      address: wethAddress,
    },
  };

  const extra = parseExtraTokenAllowlist(process.env.ARBITRUM_SEPOLIA_EXTRA_TOKENS_JSON);
  for (const [symbol, cfg] of Object.entries(extra)) {
    allowlist[symbol] = cfg;
  }

  return allowlist;
}

export function getCamelotContracts(): CamelotContracts {
  let swapRouter = DEFAULT_CAMELOT_SWAP_ROUTER;
  let quoter = DEFAULT_CAMELOT_QUOTER;

  try {
    const env = getServerEnv();
    if (env.CAMELOT_SEPOLIA_SWAP_ROUTER_ADDRESS) {
      swapRouter = env.CAMELOT_SEPOLIA_SWAP_ROUTER_ADDRESS;
    }
    if (env.CAMELOT_SEPOLIA_QUOTER_ADDRESS) {
      quoter = env.CAMELOT_SEPOLIA_QUOTER_ADDRESS;
    }
  } catch {
    // Allow route health checks before full env exists.
  }

  return {
    chainId: 421614,
    swapRouter,
    quoter,
  };
}

export function isSupportedPair(tokenIn: SupportedTokenSymbol, tokenOut: SupportedTokenSymbol) {
  const allowlist = getTokenAllowlist();
  return tokenIn !== tokenOut && tokenIn in allowlist && tokenOut in allowlist;
}
