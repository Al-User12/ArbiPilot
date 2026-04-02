import { getServerEnv } from "@/lib/config/env";

export const MAX_SAFE_SLIPPAGE_BPS = 300;

export type SupportedTokenSymbol = "USDC" | "WETH";

export type TokenConfig = {
  symbol: SupportedTokenSymbol;
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

  const allowlist: Record<SupportedTokenSymbol, TokenConfig> = {
    USDC: {
      symbol: "USDC",
      decimals: 6,
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
  return (
    (tokenIn === "WETH" && tokenOut === "USDC") ||
    (tokenIn === "USDC" && tokenOut === "WETH")
  );
}
