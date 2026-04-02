import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { RegistryRequestSchema } from "@/lib/agent/schema";
import {
  createRegistryRegistrationPlan,
  resolveRegistryTxLink,
} from "@/lib/registry/register-agent";
import { getErrorMessage, jsonError } from "@/lib/http/errors";

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const input = RegistryRequestSchema.parse(rawBody);

    if (input.txHash) {
      return NextResponse.json({
        ok: true,
        txHash: input.txHash,
        explorerLink: resolveRegistryTxLink(input.txHash),
      });
    }

    const plan = createRegistryRegistrationPlan();

    return NextResponse.json({
      ok: false,
      canExecute: plan.canExecute,
      contractAddress: plan.contractAddress,
      explorerBaseUrl: plan.explorerBaseUrl,
      message: plan.message,
      notes: plan.notes,
      requiredInputs: plan.requiredInputs,
      command: plan.command,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid request payload", error.issues);
    }

    const message = getErrorMessage(error, "Unexpected registry error");

    if (
      message.startsWith("Invalid server environment:") ||
      message.startsWith("Invalid ATXP environment:")
    ) {
      return jsonError(500, "CONFIG_ERROR", message);
    }

    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
