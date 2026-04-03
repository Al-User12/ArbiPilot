"use client";

import { useMemo, useState } from "react";
import { arbitrumSepolia } from "viem/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";

import { CardShell } from "@/components/card-shell";
import { RegistryPanel } from "@/components/registry-panel";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { ExecuteResponseSchema, PlanResponseSchema } from "@/lib/agent/schema";
import type { ExecuteResponsePayload, PlanResponsePayload } from "@/lib/agent/types";
import { getPublicRuntimeEnv } from "@/lib/config/public-env";
import { readJsonOrThrow } from "@/lib/http/client";

function Badge({ label, tone }: { label: string; tone: "real" | "testnet" }) {
  const className = {
    real: "border-emerald-300/40 bg-emerald-500/10 text-emerald-100",
    testnet: "border-cyan-300/40 bg-cyan-500/10 text-cyan-100",
  }[tone];

  return (
    <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${className}`}>
      {label}
    </span>
  );
}

function StepBadge({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.14em] ${
        active
          ? "border-cyan-300/60 bg-cyan-500/20 text-cyan-100"
          : "border-white/15 bg-white/5 text-slate-400"
      }`}
    >
      {label}
    </span>
  );
}

export function ArbiPilotApp() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();

  const [prompt, setPrompt] = useState("swap 10 USDC to ETH on Arbitrum with safe slippage");
  const [plan, setPlan] = useState<PlanResponsePayload | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executionInfo, setExecutionInfo] = useState<ExecuteResponsePayload | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | null>(null);
  const [swapTxHash, setSwapTxHash] = useState<`0x${string}` | null>(null);

  const isCorrectChain = chainId === arbitrumSepolia.id;
  const publicEnv = getPublicRuntimeEnv();

  const approvalExplorerLink = useMemo(() => {
    if (!approvalTxHash || !executionInfo?.explorerBaseUrl) return null;
    return `${executionInfo.explorerBaseUrl}/tx/${approvalTxHash}`;
  }, [approvalTxHash, executionInfo?.explorerBaseUrl]);

  const swapExplorerLink = useMemo(() => {
    if (!swapTxHash || !executionInfo?.explorerBaseUrl) return null;
    return `${executionInfo.explorerBaseUrl}/tx/${swapTxHash}`;
  }, [swapTxHash, executionInfo?.explorerBaseUrl]);

  async function handlePlan() {
    setPlanError(null);
    setExecutionInfo(null);
    setApprovalTxHash(null);
    setSwapTxHash(null);
    setPlanLoading(true);

    try {
      const res = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          walletAddress: address,
        }),
      });

      const data = await readJsonOrThrow(res, PlanResponseSchema);

      setPlan(data);
      if (!data.supported) {
        setPlanError(data.message);
      }
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Unexpected planning error");
      setPlan(null);
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleExecute() {
    if (!address || !plan?.supported || plan.parsedIntent.action !== "swap") {
      return;
    }

    setExecuteLoading(true);
    setPlanError(null);
    setApprovalTxHash(null);
    setSwapTxHash(null);

    try {
      if (!isCorrectChain) {
        await switchChainAsync({ chainId: arbitrumSepolia.id });
      }

      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          intent: plan.parsedIntent,
        }),
      });

      const data = await readJsonOrThrow(res, ExecuteResponseSchema);
      setExecutionInfo(data);

      if (!data.ok || !data.txRequest) {
        setPlanError(data.message || "Execution payload generation failed.");
        return;
      }

      if (data.approvalTxRequest) {
        const approvalHash = await sendTransactionAsync({
          to: data.approvalTxRequest.to,
          data: data.approvalTxRequest.data,
          value: BigInt(data.approvalTxRequest.value),
          chainId: data.approvalTxRequest.chainId,
        });

        setApprovalTxHash(approvalHash);
      }

      const swapHash = await sendTransactionAsync({
        to: data.txRequest.to,
        data: data.txRequest.data,
        value: BigInt(data.txRequest.value),
        chainId: data.txRequest.chainId,
      });

      setSwapTxHash(swapHash);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Execution failed");
    } finally {
      setExecuteLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,116,144,0.22),rgba(2,6,23,1)_45%)] px-4 py-8 text-slate-100 md:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-cyan-300/20 bg-slate-950/70 p-5 backdrop-blur-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-cyan-300/80">Arbitrum Agentic Bounty Demo</p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight">ArbiPilot</h1>
              <p className="mt-2 text-sm text-slate-300">
                Explain first, validate strictly, then execute deterministic allowlisted swaps on Arbitrum Sepolia.
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Wallet status: {isConnected ? "Connected" : "Disconnected"} | Chain: {isCorrectChain ? "Arbitrum Sepolia" : "Wrong network"}
              </p>
            </div>
            <WalletConnectButton />
          </div>

          {!publicEnv.walletConnectProjectId ? (
            <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              WalletConnect is not configured. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID for QR-based mobile wallets.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            <Badge label="LLM PARSER (REAL)" tone="real" />
            <Badge label="QUOTE (TESTNET REAL)" tone="testnet" />
            <Badge label="EXECUTION (TESTNET REAL)" tone="testnet" />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <StepBadge label="1. Parse + Validate" active={Boolean(plan)} />
            <StepBadge label="2. Explain + Risk" active={Boolean(plan?.explanation)} />
            <StepBadge label="3. Execute" active={Boolean(swapTxHash)} />
          </div>
        </header>

        <CardShell
          title="Trust Boundaries"
          subtitle="LLM can parse intent only. It cannot select addresses, targets, or calldata."
        >
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-300">
            <li>Supported action: swap only.</li>
            <li>Supported chain: arbitrum-sepolia only.</li>
            <li>Supported tokens: USDC and WETH only (ETH alias is normalized to WETH).</li>
            <li>Execution payload is deterministic code-path output.</li>
          </ul>
        </CardShell>

        <CardShell title="Prompt" subtitle="Natural language input for swap intent parsing">
          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
            />
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePlan}
                disabled={planLoading || !prompt.trim()}
                className="rounded-xl border border-cyan-300/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
              >
                {planLoading ? "Planning..." : "Generate Plan"}
              </button>
              {!isCorrectChain && isConnected ? (
                <button
                  type="button"
                  onClick={() => switchChainAsync({ chainId: arbitrumSepolia.id })}
                  disabled={isSwitching}
                  className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 disabled:opacity-50"
                >
                  Switch to Arbitrum Sepolia
                </button>
              ) : null}
            </div>
          </div>
        </CardShell>

        <section className="grid gap-4 md:grid-cols-3">
          <CardShell title="Intent">
            {plan ? (
              <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs text-slate-200">
                {JSON.stringify(plan.parsedIntent, null, 2)}
              </pre>
            ) : (
              <p className="text-sm text-slate-500">No plan yet.</p>
            )}
          </CardShell>

          <CardShell title="Execution Plan">
            {plan ? (
              <ol className="space-y-2 text-sm text-slate-200">
                {plan.executionPlan.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-slate-500">No plan yet.</p>
            )}
          </CardShell>

          <CardShell title="Risk Preview">
            {plan ? (
              <div className="space-y-3 text-sm text-slate-200">
                <p>
                  Level: <span className="font-semibold uppercase">{plan.riskPreview.level}</span>
                </p>
                <p>
                  Est. Out: {plan.preview.estimatedAmountOut} {plan.parsedIntent.tokenOut}
                </p>
                <p>
                  Min Out: {plan.preview.minAmountOut} {plan.parsedIntent.tokenOut}
                </p>
                <ul className="list-disc pl-5 text-slate-400">
                  {plan.riskPreview.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No risk preview yet.</p>
            )}
          </CardShell>
        </section>

        <CardShell title="Explain">
          <p className="text-sm leading-relaxed text-slate-300">
            {plan?.explanation ?? "Explanation appears after planning."}
          </p>
        </CardShell>

        <CardShell title="Execute" subtitle="User-approved deterministic execution payload">
          <div className="space-y-3 text-sm text-slate-300">
            <button
              type="button"
              onClick={handleExecute}
              disabled={!isConnected || !plan?.supported || executeLoading || isSending}
              className="rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-2 font-semibold text-emerald-100 disabled:opacity-50"
            >
              {executeLoading || isSending ? "Executing..." : "Approve (if needed) & Execute Swap"}
            </button>

            {executionInfo ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <p className="font-medium text-slate-100">{executionInfo.message}</p>
                {executionInfo.warnings.length ? (
                  <ul className="mt-2 list-disc pl-5 text-slate-400">
                    {executionInfo.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {approvalTxHash ? (
              <div className="rounded-xl border border-amber-300/30 bg-amber-500/10 p-3">
                <p className="text-amber-100">Approval Tx Hash: {approvalTxHash}</p>
                {approvalExplorerLink ? (
                  <a
                    href={approvalExplorerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-amber-300 underline"
                  >
                    Open approval in explorer
                  </a>
                ) : null}
              </div>
            ) : null}

            {swapTxHash ? (
              <div className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 p-3">
                <p className="text-cyan-100">Swap Tx Hash: {swapTxHash}</p>
                {swapExplorerLink ? (
                  <a
                    href={swapExplorerLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-300 underline"
                  >
                    Open swap in explorer
                  </a>
                ) : null}
              </div>
            ) : null}

            {planError ? <p className="text-rose-300">{planError}</p> : null}
          </div>
        </CardShell>

        <RegistryPanel />
      </div>
    </main>
  );
}
