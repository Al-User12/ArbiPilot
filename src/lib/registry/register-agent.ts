import "server-only";

import type { Hash } from "viem";

import { getServerEnv } from "@/lib/config/env";

export interface RegistryRegistrationPlan {
  canExecute: boolean;
  contractAddress: `0x${string}`;
  explorerBaseUrl: string;
  message: string;
  notes: string[];
  requiredInputs?: string[];
  command?: string;
}

export function createRegistryRegistrationPlan(): RegistryRegistrationPlan {
  const env = getServerEnv();
  const canExecute = Boolean(env.REGISTRY_SIGNER_PRIVATE_KEY);

  if (!canExecute) {
    return {
      canExecute: false,
      contractAddress: env.REGISTRY_CONTRACT_ADDRESS,
      explorerBaseUrl: env.REGISTRY_EXPLORER_BASE_URL,
      message:
        "Agent0 SDK registration path is ready, but REGISTRY_SIGNER_PRIVATE_KEY is not configured.",
      requiredInputs: [
        "REGISTRY_SIGNER_PRIVATE_KEY (32-byte hex private key for the registration wallet)",
      ],
      notes: [
        "Registration execution uses scripts/register-agent.mjs with official agent0-sdk.",
        "No manual ABI or function signature guessing is used in the registration script.",
      ],
      command:
        'npm run register:agent -- --name "ArbiPilot" --description "Explain-Then-Execute swap agent on Arbitrum Sepolia"',
    };
  }

  return {
    canExecute: true,
    contractAddress: env.REGISTRY_CONTRACT_ADDRESS,
    explorerBaseUrl: env.REGISTRY_EXPLORER_BASE_URL,
    message: "Agent0 SDK registration is ready to execute via script.",
    notes: [
      "Execution path uses official agent0-sdk registerOnChain().",
      "Identity registry address is passed via registryOverrides for chain 421614.",
      "Script waits for confirmation and prints tx hash + explorer link.",
    ],
    command:
      'npm run register:agent -- --name "ArbiPilot" --description "Explain-Then-Execute swap agent on Arbitrum Sepolia"',
  };
}

export function resolveRegistryTxLink(txHash: Hash): string {
  const env = getServerEnv();
  return `${env.REGISTRY_EXPLORER_BASE_URL.replace(/\/$/, "")}/tx/${txHash}`;
}
