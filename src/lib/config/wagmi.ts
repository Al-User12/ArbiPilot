import { arbitrumSepolia } from "viem/chains";
import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";

import { getPublicRuntimeEnv } from "@/lib/config/public-env";

const publicEnv = getPublicRuntimeEnv();

const connectors = [injected()];

if (publicEnv.walletConnectProjectId) {
  connectors.push(
    walletConnect({
      projectId: publicEnv.walletConnectProjectId,
      showQrModal: true,
    }),
  );
}

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors,
  transports: {
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});
