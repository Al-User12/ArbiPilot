import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { arbitrumSepolia } from "viem/chains";

import { getPublicRuntimeEnv } from "@/lib/config/public-env";

const publicEnv = getPublicRuntimeEnv();

export const wagmiConfig = getDefaultConfig({
  appName: "ArbiPilot",
  projectId: publicEnv.walletConnectProjectId ?? "YOUR_PROJECT_ID",
  chains: [arbitrumSepolia],
  ssr: true,
});
