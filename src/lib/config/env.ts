import { isAddress, isHex } from "viem";
import { z } from "zod";

const atxpEnvSchema = z.object({
  ATXP_API_KEY: z.string().min(1, "ATXP_API_KEY is required"),
  OPENAI_BASE_URL: z.string().url().default("https://llm.atxp.ai/v1"),
  OPENAI_MODEL: z.string().min(1, "OPENAI_MODEL is required"),
});

const serverEnvSchema = z.object({
  ATXP_API_KEY: z.string().min(1, "ATXP_API_KEY is required"),
  OPENAI_BASE_URL: z.string().url().default("https://llm.atxp.ai/v1"),
  OPENAI_MODEL: z.string().min(1, "OPENAI_MODEL is required"),
  ARBITRUM_SEPOLIA_RPC_URL: z.string().url("ARBITRUM_SEPOLIA_RPC_URL must be a URL"),
  NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: z
    .string()
    .min(1, "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required"),
  REGISTRY_CONTRACT_ADDRESS: z.custom<`0x${string}`>(
    (value) => typeof value === "string" && isAddress(value),
    "REGISTRY_CONTRACT_ADDRESS must be a valid address",
  ),
  REGISTRY_EXPLORER_BASE_URL: z.string().url("REGISTRY_EXPLORER_BASE_URL must be a URL"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a URL"),
  ARBITRUM_SEPOLIA_USDC_ADDRESS: z
    .custom<`0x${string}`>(
      (value) => typeof value === "string" && isAddress(value),
      "ARBITRUM_SEPOLIA_USDC_ADDRESS must be a valid address",
    )
    .optional(),
  ARBITRUM_SEPOLIA_WETH_ADDRESS: z
    .custom<`0x${string}`>(
      (value) => typeof value === "string" && isAddress(value),
      "ARBITRUM_SEPOLIA_WETH_ADDRESS must be a valid address",
    )
    .optional(),
  CAMELOT_SEPOLIA_SWAP_ROUTER_ADDRESS: z
    .custom<`0x${string}`>(
      (value) => typeof value === "string" && isAddress(value),
      "CAMELOT_SEPOLIA_SWAP_ROUTER_ADDRESS must be a valid address",
    )
    .optional(),
  CAMELOT_SEPOLIA_QUOTER_ADDRESS: z
    .custom<`0x${string}`>(
      (value) => typeof value === "string" && isAddress(value),
      "CAMELOT_SEPOLIA_QUOTER_ADDRESS must be a valid address",
    )
    .optional(),
  REGISTRY_SIGNER_PRIVATE_KEY: z
    .string()
    .refine((value) => isHex(value) && value.length === 66, {
      message: "REGISTRY_SIGNER_PRIVATE_KEY must be a 32-byte hex private key",
    })
    .optional(),
});

export type AtxpEnv = z.infer<typeof atxpEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedAtxpEnv: AtxpEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

export function getAtxpEnv(): AtxpEnv {
  if (cachedAtxpEnv) {
    return cachedAtxpEnv;
  }

  const parsed = atxpEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const flattened = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid ATXP environment: ${flattened}`);
  }

  cachedAtxpEnv = parsed.data;
  return cachedAtxpEnv;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) {
    return cachedServerEnv;
  }

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const flattened = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server environment: ${flattened}`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

export function getEnvHealth() {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (parsed.success) {
    return {
      ok: true,
      missing: [] as string[],
    };
  }

  return {
    ok: false,
    missing: parsed.error.issues.map((issue) => issue.path.join(".")),
  };
}
