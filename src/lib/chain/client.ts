import { createPublicClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";

import { getServerEnv } from "@/lib/config/env";

let client: ReturnType<typeof createPublicClient> | null = null;

export function getArbitrumSepoliaPublicClient() {
  if (client) {
    return client;
  }

  const env = getServerEnv();

  client = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(env.ARBITRUM_SEPOLIA_RPC_URL),
  });

  return client;
}
