import { arbitrumSepolia } from "viem/chains";

export const CHAIN_CONFIG = {
  key: "arbitrum-sepolia",
  id: arbitrumSepolia.id,
  name: arbitrumSepolia.name,
  nativeSymbol: arbitrumSepolia.nativeCurrency.symbol,
  explorerBaseUrl: arbitrumSepolia.blockExplorers?.default.url ?? "https://sepolia.arbiscan.io",
} as const;
