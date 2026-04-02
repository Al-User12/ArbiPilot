import nextEnv from "@next/env";
import { SDK } from "agent0-sdk";
import { isAddress, isHex } from "viem";

const { loadEnvConfig } = nextEnv;
const REGISTRY_CHAIN_ID = 421614;

function usage() {
  console.log(
    [
      "Usage:",
      "  npm run register:agent -- --name \"ArbiPilot\" --description \"Explain-Then-Execute swap agent\" [--image https://...]",
      "",
      "Required env:",
      "  ARBITRUM_SEPOLIA_RPC_URL",
      "  REGISTRY_CONTRACT_ADDRESS",
      "  REGISTRY_EXPLORER_BASE_URL",
      "  REGISTRY_SIGNER_PRIVATE_KEY",
    ].join("\n"),
  );
}

function getArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : undefined;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value.trim();
}

async function main() {
  loadEnvConfig(process.cwd());

  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    return;
  }

  const name = getArg("--name") ?? "ArbiPilot";
  const description =
    getArg("--description") ??
    "Explain-Then-Execute Arbitrum Sepolia swap agent with deterministic allowlisted execution.";
  const image = getArg("--image");

  const rpcUrl = requireEnv("ARBITRUM_SEPOLIA_RPC_URL");
  const registryAddress = requireEnv("REGISTRY_CONTRACT_ADDRESS");
  const explorerBaseUrl = requireEnv("REGISTRY_EXPLORER_BASE_URL");
  const privateKey = requireEnv("REGISTRY_SIGNER_PRIVATE_KEY");

  if (!isAddress(registryAddress)) {
    throw new Error("REGISTRY_CONTRACT_ADDRESS must be a valid EVM address.");
  }

  if (!isHex(privateKey) || privateKey.length !== 66) {
    throw new Error("REGISTRY_SIGNER_PRIVATE_KEY must be a 32-byte hex private key.");
  }

  const registryOverrides = {
    [REGISTRY_CHAIN_ID]: {
      IDENTITY: registryAddress,
    },
  };

  const sdk = new SDK({
    chainId: REGISTRY_CHAIN_ID,
    rpcUrl,
    privateKey,
    registryOverrides,
  });

  const agent = sdk.createAgent(name, description, image);
  agent.setActive(true);
  agent.setX402Support(false);

  if (process.env.NEXT_PUBLIC_APP_URL) {
    agent.setMetadata({
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      project: "ArbiPilot",
      environment: "arbitrum-sepolia",
    });
  }

  console.log("Submitting Agent0 registerOnChain transaction...");

  const tx = await agent.registerOnChain();
  const txHash = tx.hash;
  console.log(`Tx hash: ${txHash}`);
  console.log(`Explorer: ${explorerBaseUrl.replace(/\/$/, "")}/tx/${txHash}`);

  const mined = await tx.waitConfirmed({ timeoutMs: 240_000, confirmations: 1 });

  if (mined.result.agentId) {
    console.log(`Agent ID: ${mined.result.agentId}`);
  }

  if (mined.result.agentURI) {
    console.log(`Agent URI: ${mined.result.agentURI}`);
  }

  console.log("Registration confirmed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Registration failed: ${message}`);
  process.exit(1);
});
