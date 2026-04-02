import {
  encodeFunctionData,
  parseUnits,
  toHex,
  type Address,
} from "viem";

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

export interface SwapExecutionPreparation {
  mode: "router_swap" | "blocked";
  message: string;
  warnings: string[];
  approvalTxRequest?: PreparedTxRequest;
  txRequest?: PreparedTxRequest;
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

  const allowance = await client.readContract({
    address: tokenIn.address,
    abi: erc20AllowanceAbi,
    functionName: "allowance",
    args: [account, contracts.swapRouter],
  });

  const approvalRequired = allowance < amountInRaw;

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
      }
    : undefined;

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

  const swapTxRequest: PreparedTxRequest = {
    to: contracts.swapRouter,
    data: encodeFunctionData({
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
    }),
    value: toHex(0n),
    chainId: CHAIN_CONFIG.id,
  };

  const warnings = [
    `Real router calldata is generated from allowlisted Camelot Sepolia router ${contracts.swapRouter}.`,
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
