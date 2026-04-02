import type { Address } from "viem";

export type SupportedChain = "arbitrum-sepolia";
export type SupportedToken = "USDC" | "WETH";
export type RiskLevel = "low" | "medium" | "high";

export interface SwapIntent {
  action: "swap";
  chain: SupportedChain;
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amount: string;
  slippageBps: number;
}

export interface BridgeIntent {
  action: "bridge";
  chain: SupportedChain;
  tokenIn: SupportedToken;
  tokenOut: SupportedToken;
  amount: string;
  slippageBps: number;
}

export type ParsedIntent = SwapIntent | BridgeIntent;

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export interface RiskPreview {
  level: RiskLevel;
  reasons: string[];
  checks: {
    supportedPair: boolean;
    sufficientBalance: boolean;
    approvalRequired: boolean;
    slippageBps: number;
  };
}

export interface PlanPreview {
  amountIn: string;
  estimatedAmountOut: string;
  minAmountOut: string;
  priceImpactBps: number;
}

export interface PlanResponsePayload {
  supported: boolean;
  message: string;
  parsedIntent: ParsedIntent;
  executionPlan: string[];
  explanation: string;
  riskPreview: RiskPreview;
  preview: PlanPreview;
  warnings: string[];
}

export interface PreparedTxRequest {
  to: Address;
  data: `0x${string}`;
  value: `0x${string}`;
  chainId: number;
}

export interface ExecuteResponsePayload {
  ok: boolean;
  mode: "router_swap" | "blocked";
  message: string;
  approvalTxRequest?: PreparedTxRequest;
  txRequest?: PreparedTxRequest;
  warnings: string[];
  explorerBaseUrl: string;
}
