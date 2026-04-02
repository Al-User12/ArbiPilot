import { isAddress, isHash, type Address, type Hash } from "viem";
import { z } from "zod";

export const SupportedChainSchema = z.enum(["arbitrum-sepolia"]);
export const SupportedTokenSchema = z.enum(["USDC", "WETH"]);
export const ParsedActionSchema = z.enum(["swap", "bridge"]);

export const AddressSchema = z.custom<Address>(
  (value) => typeof value === "string" && isAddress(value),
  "Must be a valid EVM address",
);

export const HashSchema = z.custom<Hash>(
  (value) => typeof value === "string" && isHash(value),
  "Must be a valid transaction hash",
);

export const HexSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value),
  "Must be a valid hex string",
);

export const AmountStringSchema = z
  .string()
  .trim()
  .regex(/^\d+(\.\d+)?$/, "Amount must be a plain decimal string");

export const SwapIntentSchema = z
  .object({
    action: z.literal("swap"),
    chain: SupportedChainSchema,
    tokenIn: SupportedTokenSchema,
    tokenOut: SupportedTokenSchema,
    amount: AmountStringSchema,
    slippageBps: z.coerce.number().int().min(1).max(500),
  })
  .strict();

export const BridgeIntentSchema = z
  .object({
    action: z.literal("bridge"),
    chain: SupportedChainSchema,
    tokenIn: SupportedTokenSchema,
    tokenOut: SupportedTokenSchema,
    amount: AmountStringSchema,
    slippageBps: z.coerce.number().int().min(1).max(500),
  })
  .strict();

export const ParsedIntentSchema = z.discriminatedUnion("action", [
  SwapIntentSchema,
  BridgeIntentSchema,
]);

export const PlannerIntentSchema = z
  .object({
    action: ParsedActionSchema,
    chain: SupportedChainSchema,
    tokenIn: SupportedTokenSchema,
    tokenOut: SupportedTokenSchema,
    amount: AmountStringSchema,
    slippageBps: z.coerce.number().int().min(1).max(500).default(50),
  })
  .strict();

export const PlanRequestSchema = z
  .object({
    prompt: z.string().trim().min(3, "Prompt is required"),
    walletAddress: AddressSchema.optional(),
  })
  .strict();

export const ExecuteRequestSchema = z
  .object({
    walletAddress: AddressSchema,
    intent: SwapIntentSchema,
  })
  .strict();

export const RegistryRequestSchema = z
  .object({
    txHash: HashSchema.optional(),
  })
  .strict();

export const RiskPreviewSchema = z
  .object({
    level: z.enum(["low", "medium", "high"]),
    reasons: z.array(z.string()),
    checks: z.object({
      supportedPair: z.boolean(),
      sufficientBalance: z.boolean(),
      approvalRequired: z.boolean(),
      slippageBps: z.number(),
    }),
  })
  .strict();

export const PlanPreviewSchema = z
  .object({
    amountIn: z.string(),
    estimatedAmountOut: z.string(),
    minAmountOut: z.string(),
    priceImpactBps: z.number(),
  })
  .strict();

export const PlanResponseSchema = z
  .object({
    supported: z.boolean(),
    message: z.string(),
    parsedIntent: ParsedIntentSchema,
    executionPlan: z.array(z.string()),
    explanation: z.string(),
    riskPreview: RiskPreviewSchema,
    preview: PlanPreviewSchema,
    warnings: z.array(z.string()),
  })
  .strict();

const TxRequestSchema = z
  .object({
    to: AddressSchema,
    data: HexSchema,
    value: HexSchema,
    chainId: z.number().int().positive(),
  })
  .strict();

export const ExecuteResponseSchema = z
  .object({
    ok: z.boolean(),
    mode: z.enum(["router_swap", "blocked"]),
    message: z.string(),
    approvalTxRequest: TxRequestSchema.optional(),
    txRequest: TxRequestSchema.optional(),
    warnings: z.array(z.string()),
    explorerBaseUrl: z.string().url(),
  })
  .strict();

export const RegistryResolveResponseSchema = z
  .object({
    ok: z.literal(true),
    txHash: HashSchema,
    explorerLink: z.string().url(),
  })
  .strict();

export const RegistryPathResponseSchema = z
  .object({
    ok: z.literal(false),
    canExecute: z.boolean(),
    contractAddress: AddressSchema,
    explorerBaseUrl: z.string().url(),
    message: z.string(),
    notes: z.array(z.string()).optional(),
    requiredInputs: z.array(z.string()).optional(),
    command: z.string().optional(),
  })
  .strict();

export const ApiErrorResponseSchema = z
  .object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.unknown().optional(),
    }),
  })
  .strict();
