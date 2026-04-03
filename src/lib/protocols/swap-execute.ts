import {
  concatHex,
  encodeFunctionData,
  parseUnits,
  toHex,
  type Address,
} from "viem";
import { arbitrumSepolia } from "viem/chains";

import type { PreparedTxRequest, SwapIntent } from "@/lib/agent/types";
import { getArbitrumSepoliaPublicClient } from "@/lib/chain/client";
import { getCamelotContracts, getTokenAllowlist } from "@/lib/config/allowlist";
import { CHAIN_CONFIG } from "@/lib/config/chains";
import type { SwapQuote } from "@/lib/protocols/swap-quote";

const erc20AllowanceAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const swapRouterAbi = [
  {
    type: "function",
    name: "exactInput",
    // Algebra SwapRouter interface:
    // exactInput((bytes path,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum))
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "path", type: "bytes" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
  {
    type: "function",
    name: "exactInputSingle",
    // Algebra SwapRouter interface:
    // exactInputSingle((address tokenIn,address tokenOut,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 limitSqrtPrice))
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "tokenIn", type: "address" },
          { name: "tokenOut", type: "address" },
          { name: "recipient", type: "address" },
          { name: "deadline", type: "uint256" },
          { name: "amountIn", type: "uint256" },
          { name: "amountOutMinimum", type: "uint256" },
          { name: "limitSqrtPrice", type: "uint160" },
        ],
      },
    ],
    outputs: [{ name: "amountOut", type: "uint256" }],
  },
] as const;

const ALGEBRA_DEFAULT_DEPLOYER = "0x0000000000000000000000000000000000000000" as const;

function encodeAlgebraPath(routePath: string[], tokenAddressBySymbol: Record<string, `0x${string}`>) {
  if (routePath.length < 2) {
    throw new Error("Route path must contain at least 2 tokens.");
  }

  const parts: `0x${string}`[] = [];
  const first = tokenAddressBySymbol[routePath[0]];
  if (!first) {
    throw new Error(`Missing token address for ${routePath[0]}.`);
  }
  parts.push(first);

  for (let i = 1; i < routePath.length; i += 1) {
    const next = tokenAddressBySymbol[routePath[i]];
    if (!next) {
      throw new Error(`Missing token address for ${routePath[i]}.`);
    }
    parts.push(ALGEBRA_DEFAULT_DEPLOYER, next);
  }

  return concatHex(parts);
}

export interface SwapExecutionPreparation {
  mode: "router_swap" | "blocked";
  message: string;
  warnings: string[];
  approvalTxRequest?: PreparedTxRequest;
  txRequest?: PreparedTxRequest;
}

export async function isApprovalRequiredForSwap(params: {
  intent: SwapIntent;
  account: Address;
}) {
  const { intent, account } = params;
  const client = getArbitrumSepoliaPublicClient();
  const allowlist = getTokenAllowlist();
  const contracts = getCamelotContracts();

  const tokenIn = allowlist[intent.tokenIn];
  const amountInRaw = parseUnits(intent.amount, tokenIn.decimals);

  const allowance = await client.readContract({
    address: tokenIn.address,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args: [account, contracts.swapRouter],
  });

  return allowance < amountInRaw;
}

function applyFeeBuffer(value: bigint) {
  return (value * 12n) / 10n + 1n;
}

async function getPreparedFeeParams() {
  const client = getArbitrumSepoliaPublicClient();

  try {
    const estimated = await client.estimateFeesPerGas({
      chain: arbitrumSepolia,
      type: "eip1559",
    });

    if (
      typeof estimated.maxFeePerGas === "bigint" &&
      typeof estimated.maxPriorityFeePerGas === "bigint"
    ) {
      return {
        maxFeePerGas: toHex(applyFeeBuffer(estimated.maxFeePerGas)),
        maxPriorityFeePerGas: toHex(applyFeeBuffer(estimated.maxPriorityFeePerGas)),
      } satisfies Pick<PreparedTxRequest, "maxFeePerGas" | "maxPriorityFeePerGas">;
    }
  } catch {
    // Fallback to legacy gas price below.
  }

  try {
    const gasPrice = await client.getGasPrice();
    return {
      gasPrice: toHex(applyFeeBuffer(gasPrice)),
    } satisfies Pick<PreparedTxRequest, "gasPrice">;
  } catch {
    return {};
  }
}

export async function prepareDeterministicSwapExecution(params: {
  intent: SwapIntent;
  quote: SwapQuote;
  account: Address;
}): Promise<SwapExecutionPreparation> {
  const { intent, quote, account } = params;

  if (intent.action !== "swap") {
    return {
      mode: "blocked",
      message: "Only swap action can be executed in this MVP.",
      warnings: [],
    };
  }

  const client = getArbitrumSepoliaPublicClient();
  const allowlist = getTokenAllowlist();
  const contracts = getCamelotContracts();

  const tokenIn = allowlist[intent.tokenIn];
  const tokenOut = allowlist[intent.tokenOut];
  const amountInRaw = parseUnits(intent.amount, tokenIn.decimals);

  const approvalRequired = await isApprovalRequiredForSwap({ intent, account });
  const feeParams = await getPreparedFeeParams();

  const approvalTxRequest = approvalRequired
    ? {
        to: tokenIn.address,
        data: encodeFunctionData({
          abi: erc20ApproveAbi,
          functionName: "approve",
          args: [contracts.swapRouter, amountInRaw],
        }),
        value: "0x0" as const,
        chainId: CHAIN_CONFIG.id,
        ...feeParams,
      }
    : undefined;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

  const tokenAddressBySymbol = Object.fromEntries(
    Object.entries(allowlist).map(([symbol, cfg]) => [symbol, cfg.address]),
  ) as Record<string, `0x${string}`>;

  const swapCalldata =
    quote.hopCount > 1
      ? encodeFunctionData({
          abi: swapRouterAbi,
          functionName: "exactInput",
          args: [
            {
              path: encodeAlgebraPath(quote.routePath, tokenAddressBySymbol),
              recipient: account,
              deadline,
              amountIn: amountInRaw,
              amountOutMinimum: quote.minAmountOutRaw,
            },
          ],
        })
      : encodeFunctionData({
          abi: swapRouterAbi,
          functionName: "exactInputSingle",
          args: [
            {
              tokenIn: tokenIn.address,
              tokenOut: tokenOut.address,
              recipient: account,
              deadline,
              amountIn: amountInRaw,
              amountOutMinimum: quote.minAmountOutRaw,
              limitSqrtPrice: 0n,
            },
          ],
        });

  const swapTxRequest: PreparedTxRequest = {
    to: contracts.swapRouter,
    data: swapCalldata,
    value: toHex(0n),
    chainId: CHAIN_CONFIG.id,
    ...feeParams,
  };

  const warnings = [
    `Real router calldata is generated from allowlisted Camelot Sepolia router ${contracts.swapRouter}.`,
    `Selected route: ${quote.routePath.join(" -> ")} (${quote.hopCount} hop${quote.hopCount > 1 ? "s" : ""}).`,
  ];

  if (approvalRequired) {
    warnings.push(
      `ERC-20 approval tx is required before swap for ${intent.tokenIn}.`,
    );
  }

  return {
    mode: "router_swap",
    message:
      "Prepared real Camelot Sepolia swap calldata. Execute optional approval first, then swap.",
    warnings,
    approvalTxRequest,
    txRequest: swapTxRequest,
  };
}
