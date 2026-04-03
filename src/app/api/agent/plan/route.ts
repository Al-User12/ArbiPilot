import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { PlanRequestSchema } from "@/lib/agent/schema";
import { planUserPrompt } from "@/lib/agent/planner";
import type { ParsedIntent, PlanResponsePayload } from "@/lib/agent/types";
import { validateParsedIntent } from "@/lib/agent/validator";
import { getBalancesSnapshot } from "@/lib/chain/balances";
import { getSwapQuote } from "@/lib/protocols/swap-quote";
import { isApprovalRequiredForSwap } from "@/lib/protocols/swap-execute";
import { buildSwapExplanation } from "@/lib/risk/explain";
import { checkSwapPricingSanity } from "@/lib/risk/pricing-sanity";
import { assessSwapRisk } from "@/lib/risk/risk-engine";
import { getErrorMessage, jsonError } from "@/lib/http/errors";

function isInformationalPrompt(prompt: string) {
  const value = prompt.toLowerCase();

  const infoHints = [
    "ca ",
    "contract address",
    "token address",
    "alamat kontrak",
    "alamat token",
    "berapa ca",
    "what is ca",
  ];

  const executionHints = [
    "swap",
    "bridge",
    "tukar",
    "convert",
    "sell",
    "buy",
    " from ",
    " to ",
    "->",
  ];

  const hasInfoHint = infoHints.some((hint) => value.includes(hint));
  const hasExecutionHint = executionHints.some((hint) => value.includes(hint));

  return hasInfoHint && !hasExecutionHint;
}

function mapValidationMessage(prompt: string, message: string) {
  const lower = message.toLowerCase();
  const hasNumber = /\d/.test(prompt);

  if (
    (lower.includes("amount must be greater than zero") ||
      lower.includes("amount must be a positive decimal value")) &&
    isInformationalPrompt(prompt)
  ) {
    return "This looks like an informational prompt (for example, asking for a token contract address). This MVP currently supports swap planning only. Example: swap 10 USDC to WETH.";
  }

  if (
    (lower.includes("amount must be greater than zero") ||
      lower.includes("amount must be a positive decimal value")) &&
    !hasNumber
  ) {
    return "Swap amount was not detected. Please include a numeric amount, for example: swap 10 USDC to WETH.";
  }

  return message;
}

function mapPlannerParseErrorMessage(prompt: string, error: ZodError) {
  const lowerPrompt = prompt.toLowerCase();
  const hasSwapHint =
    lowerPrompt.includes("swap") ||
    lowerPrompt.includes("buy") ||
    lowerPrompt.includes("sell") ||
    lowerPrompt.includes(" to ") ||
    lowerPrompt.includes(" for ");

  const hasAmountIssue = error.issues.some((issue) => issue.path.includes("amount"));
  const hasTokenIssue =
    error.issues.some((issue) => issue.path.includes("tokenIn")) ||
    error.issues.some((issue) => issue.path.includes("tokenOut"));

  if (hasSwapHint && hasAmountIssue) {
    return "Swap amount was not detected. Please include a numeric amount, for example: swap 1 WETH to USDC.";
  }

  if (hasSwapHint && hasTokenIssue) {
    return "Token symbols were not recognized. Please use uppercase symbols from the supported allowlist, for example: swap 1 WETH to USDC.";
  }

  return "I could not parse a complete swap intent. Try: swap 1 WETH to USDC with 50 bps slippage.";
}

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

    const parsedInput = PlanRequestSchema.safeParse(rawBody);
    if (!parsedInput.success) {
      return jsonError(400, "VALIDATION_ERROR", "Invalid request payload", parsedInput.error.issues);
    }

    const input = parsedInput.data;

    let intent: ParsedIntent;
    try {
      intent = await planUserPrompt(input.prompt);
    } catch (error) {
      if (error instanceof ZodError) {
        return jsonError(
          400,
          "VALIDATION_ERROR",
          mapPlannerParseErrorMessage(input.prompt, error),
          error.issues,
        );
      }
      throw error;
    }

    const validation = validateParsedIntent(intent);

    if (!validation.ok) {
      const mappedMessage = mapValidationMessage(
        input.prompt,
        validation.reason ?? "Unsupported intent",
      );

      return NextResponse.json(
        buildUnsupportedResponse(intent, mappedMessage),
      );
    }

    if (intent.action !== "swap") {
      return NextResponse.json(
        buildUnsupportedResponse(intent, "Only swap is supported in this MVP."),
      );
    }

    let quote: Awaited<ReturnType<typeof getSwapQuote>>;
    try {
      quote = await getSwapQuote(intent);
    } catch (error) {
      return NextResponse.json(
        buildUnsupportedResponse(
          intent,
          getErrorMessage(
            error,
            `No viable route found for ${intent.tokenIn} -> ${intent.tokenOut} on allowlisted pools.`,
          ),
        ),
      );
    }

    const pricingSanity = await checkSwapPricingSanity({ intent, quote });
    if (pricingSanity.available && pricingSanity.isOutlier) {
      return NextResponse.json(
        buildUnsupportedResponse(
          intent,
          pricingSanity.message ??
            "Quoted output deviates too much from reference price. Execution is blocked for protection.",
        ),
      );
    }

    const balances = input.walletAddress
      ? await getBalancesSnapshot(input.walletAddress)
      : null;

    let approvalRequired = false;
    if (input.walletAddress) {
      try {
        approvalRequired = await isApprovalRequiredForSwap({
          intent,
          account: input.walletAddress,
        });
      } catch {
        approvalRequired = false;
      }
    }

    const risk = assessSwapRisk({
      intent,
      quote,
      balances,
      approvalRequired,
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
        ...(pricingSanity.available || !pricingSanity.message
          ? []
          : [pricingSanity.message]),
      ],
    };

    return NextResponse.json(response);
  } catch (error) {
    return toPlanErrorResponse(error);
  }
}
