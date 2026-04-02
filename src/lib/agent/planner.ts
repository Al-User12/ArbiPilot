import "server-only";

import { PlannerIntentSchema } from "@/lib/agent/schema";
import type { ParsedIntent } from "@/lib/agent/types";
import { getAtxpOpenAIClient, getAtxpRuntimeConfig } from "@/lib/agent/atxp-client";

const PLANNER_SYSTEM_PROMPT = `You are a strict parser for an Arbitrum MVP agent.
Output JSON only. No markdown, no commentary.
Schema:
{
  "action": "swap" | "bridge",
  "chain": "arbitrum-sepolia",
  "tokenIn": "USDC" | "WETH",
  "tokenOut": "USDC" | "WETH",
  "amount": "decimal string",
  "slippageBps": number (1-500)
}
Rules:
- Only parse user intent; do not include addresses, calldata, or contracts.
- If user asks bridge, use action="bridge".
- Default chain to "arbitrum-sepolia".
- Default slippageBps to 50 when user says safe slippage or omits slippage.
- Token aliases: ETH must be normalized to WETH.
- Use uppercase token symbols.
- amount must be decimal string with no commas.`;

function normalizeTokenSymbol(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const upper = value.toUpperCase();
  if (upper === "ETH") {
    return "WETH";
  }

  return upper;
}

function normalizePlannerJson(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const candidate = raw as Record<string, unknown>;

  return {
    action:
      typeof candidate.action === "string" ? candidate.action.toLowerCase() : candidate.action,
    chain: typeof candidate.chain === "string" ? candidate.chain.toLowerCase() : candidate.chain,
    tokenIn: normalizeTokenSymbol(candidate.tokenIn),
    tokenOut: normalizeTokenSymbol(candidate.tokenOut),
    amount: typeof candidate.amount === "number" ? String(candidate.amount) : candidate.amount,
    slippageBps:
      typeof candidate.slippageBps === "string"
        ? Number(candidate.slippageBps)
        : candidate.slippageBps,
  };
}

function extractContent(rawContent: unknown) {
  if (typeof rawContent === "string") {
    return rawContent;
  }

  if (Array.isArray(rawContent)) {
    const textPart = rawContent.find(
      (part) => typeof part === "object" && part !== null && "text" in part,
    ) as { text?: unknown } | undefined;

    if (typeof textPart?.text === "string") {
      return textPart.text;
    }
  }

  return null;
}

export async function planUserPrompt(prompt: string): Promise<ParsedIntent> {
  const client = getAtxpOpenAIClient();
  const atxp = getAtxpRuntimeConfig();

  let completion: {
    choices?: Array<{
      message?: { content?: unknown };
    }>;
  };

  try {
    completion = await client.chat.completions.create({
      model: atxp.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: PLANNER_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown planner provider error";
    throw new Error(`ATXP planner request failed: ${message}`);
  }

  const content = extractContent(completion.choices?.[0]?.message?.content);

  if (!content) {
    throw new Error("Planner returned empty content.");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(content);
  } catch {
    throw new Error("Planner did not return valid JSON.");
  }

  const normalized = normalizePlannerJson(parsedJson);
  const intent = PlannerIntentSchema.parse(normalized);

  return intent;
}
