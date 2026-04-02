import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { PlanRequestSchema } from "@/lib/agent/schema";
import { planUserPrompt } from "@/lib/agent/planner";
import type { ParsedIntent, PlanResponsePayload } from "@/lib/agent/types";
import { validateParsedIntent } from "@/lib/agent/validator";
import { getBalancesSnapshot } from "@/lib/chain/balances";
import { getSwapQuote } from "@/lib/protocols/swap-quote";
import { buildSwapExplanation } from "@/lib/risk/explain";
import { assessSwapRisk } from "@/lib/risk/risk-engine";
import { getErrorMessage, jsonError } from "@/lib/http/errors";

function buildUnsupportedResponse(intent: ParsedIntent, message: string): PlanResponsePayload {
  return {
    supported: false,
    message,
    parsedIntent: intent,
    executionPlan: [
      "Intent recognized and validated.",
      "Execution halted because this action is out of MVP scope.",
    ],
    explanation: message,
    riskPreview: {
      level: "high",
      reasons: [message],
      checks: {
        supportedPair: false,
        sufficientBalance: false,
        approvalRequired: false,
        slippageBps: intent.slippageBps,
      },
    },
    preview: {
      amountIn: intent.amount,
      estimatedAmountOut: "0",
      minAmountOut: "0",
      priceImpactBps: 0,
    },
    warnings: ["Unsupported action for MVP."],
  };
}

function toPlanErrorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid request payload", error.issues);
  }

  const message = getErrorMessage(error, "Unexpected planning error");

  if (
    message.startsWith("Invalid server environment:") ||
    message.startsWith("Invalid ATXP environment:")
  ) {
    return jsonError(500, "CONFIG_ERROR", message);
  }

  if (message.startsWith("ATXP planner request failed:")) {
    return jsonError(502, "PLANNER_ERROR", message);
  }

  return jsonError(500, "INTERNAL_ERROR", message);
}

export async function POST(request: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return jsonError(400, "INVALID_JSON", "Request body must be valid JSON.");
    }

    const input = PlanRequestSchema.parse(rawBody);

    const intent = await planUserPrompt(input.prompt);
    const validation = validateParsedIntent(intent);

    if (!validation.ok) {
      return NextResponse.json(
        buildUnsupportedResponse(intent, validation.reason ?? "Unsupported intent"),
      );
    }

    if (intent.action !== "swap") {
      return NextResponse.json(
        buildUnsupportedResponse(intent, "Only swap is supported in this MVP."),
      );
    }

    const quote = await getSwapQuote(intent);

    const balances = input.walletAddress
      ? await getBalancesSnapshot(input.walletAddress)
      : null;

    const risk = assessSwapRisk({
      intent,
      quote,
      balances,
    });

    const explanation = buildSwapExplanation({
      intent,
      quote,
      risk,
    });

    const response: PlanResponsePayload = {
      supported: true,
      message: "Plan created successfully.",
      parsedIntent: intent,
      executionPlan: [
        "Step 1: Parse prompt to strict JSON intent via ATXP-hosted model.",
        "Step 2: Validate chain/token/amount/slippage using deterministic allowlists.",
        "Step 3: Query Camelot Sepolia Quoter on-chain for real output preview.",
        "Step 4: Prepare deterministic router calldata from allowlisted contracts.",
      ],
      explanation,
      riskPreview: risk,
      preview: {
        amountIn: quote.amountInFormatted,
        estimatedAmountOut: quote.amountOutFormatted,
        minAmountOut: quote.minAmountOutFormatted,
        priceImpactBps: quote.priceImpactBps,
      },
      warnings: [
        "Quote is contract-backed via Camelot Quoter on Arbitrum Sepolia.",
        "Execution is restricted to allowlisted Camelot router + token addresses only.",
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    return toPlanErrorResponse(error);
  }
}
