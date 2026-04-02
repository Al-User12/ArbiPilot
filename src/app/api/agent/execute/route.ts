import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ExecuteRequestSchema } from "@/lib/agent/schema";
import type { ExecuteResponsePayload } from "@/lib/agent/types";
import { validateParsedIntent } from "@/lib/agent/validator";
import { CHAIN_CONFIG } from "@/lib/config/chains";
import { getSwapQuote } from "@/lib/protocols/swap-quote";
import { prepareDeterministicSwapExecution } from "@/lib/protocols/swap-execute";
import { getErrorMessage, jsonError } from "@/lib/http/errors";

function buildBlockedResponse(message: string, warnings: string[] = []): ExecuteResponsePayload {
  return {
    ok: false,
    mode: "blocked",
    message,
    warnings,
    explorerBaseUrl: CHAIN_CONFIG.explorerBaseUrl,
  };
}

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const input = ExecuteRequestSchema.parse(rawBody);

    const validation = validateParsedIntent(input.intent);
    if (!validation.ok) {
      return NextResponse.json(buildBlockedResponse(validation.reason ?? "Validation failed"), {
        status: 400,
      });
    }

    const quote = await getSwapQuote(input.intent);

    const execution = await prepareDeterministicSwapExecution({
      intent: input.intent,
      quote,
      account: input.walletAddress,
    });

    if (execution.mode === "blocked" || !execution.txRequest) {
      return NextResponse.json(
        buildBlockedResponse(execution.message, execution.warnings),
        { status: 400 },
      );
    }

    const response: ExecuteResponsePayload = {
      ok: true,
      mode: execution.mode,
      message: execution.message,
      approvalTxRequest: execution.approvalTxRequest,
      txRequest: execution.txRequest,
      warnings: execution.warnings,
      explorerBaseUrl: CHAIN_CONFIG.explorerBaseUrl,
    };

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid request payload", error.issues);
    }

    const message = getErrorMessage(error, "Unexpected execution error");

    if (
      message.startsWith("Invalid server environment:") ||
      message.startsWith("Invalid ATXP environment:")
    ) {
      return jsonError(500, "CONFIG_ERROR", message);
    }

    return jsonError(500, "INTERNAL_ERROR", message);
  }
}
