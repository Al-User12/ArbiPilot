import { NextResponse } from "next/server";

import { CHAIN_CONFIG } from "@/lib/config/chains";
import { getEnvHealth } from "@/lib/config/env";
import { createRegistryRegistrationPlan } from "@/lib/registry/register-agent";

export async function GET() {
  const envHealth = getEnvHealth();

  let registryStatus: {
    canExecute: boolean;
    message: string;
  } | null = null;

  try {
    const plan = createRegistryRegistrationPlan();
    registryStatus = {
      canExecute: plan.canExecute,
      message: plan.message,
    };
  } catch {
    registryStatus = null;
  }

  return NextResponse.json({
    ok: envHealth.ok,
    service: "ArbiPilot",
    chain: CHAIN_CONFIG,
    now: new Date().toISOString(),
    missingEnv: envHealth.missing,
    deploymentReady: envHealth.ok,
    integrationStatus: {
      planner: "real",
      quote: "real-testnet-camelot-quoter",
      execution: "real-testnet-camelot-router",
      registry: registryStatus?.canExecute
        ? "real-agent0-sdk-script-ready"
        : "real-agent0-sdk-path-needs-signer",
    },
    mockedComponents: [],
    registry: registryStatus,
  });
}
