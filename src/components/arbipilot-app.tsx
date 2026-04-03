"use client";

import { memo, useMemo, useState, useRef, useEffect } from "react";
import { arbitrumSepolia } from "viem/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { Sparkles, ShieldAlert, CheckCircle2, AlertTriangle, Activity, Info, ShieldCheck, ChevronRight, ListOrdered, ArrowRight, Hexagon } from "lucide-react";

import { CardShell } from "@/components/card-shell";
import { RegistryPanel } from "@/components/registry-panel";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { ExecuteResponseSchema, PlanResponseSchema } from "@/lib/agent/schema";
import type { ExecuteResponsePayload, PlanResponsePayload } from "@/lib/agent/types";
import { getPublicRuntimeEnv } from "@/lib/config/public-env";
import { readJsonOrThrow } from "@/lib/http/client";

const publicEnv = getPublicRuntimeEnv();

const StepBadge = memo(function StepBadge({
  number,
  label,
  status,
}: {
  number: number;
  label: string;
  status: "pending" | "active" | "completed";
}) {
  const isCompleted = status === "completed";
  const isActive = status === "active";

  return (
    <div className={`flex items-center gap-2 ${isActive ? "text-slate-100" : isCompleted ? "text-emerald-400" : "text-slate-500"}`}>
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium border ${isActive ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]" : isCompleted ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-white/[0.05] border-white/[0.05] text-slate-500"}`}>
        {isCompleted ? <CheckCircle2 size={14} /> : number}
      </span>
      <span className="text-sm font-medium">{label}</span>
      {number < 3 && <ChevronRight size={14} className="ml-2 text-slate-600" />}
    </div>
  );
});

export function ArbiPilotApp() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const { sendTransactionAsync, isPending: isSending } = useSendTransaction();

  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<PlanResponsePayload | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [executeLoading, setExecuteLoading] = useState(false);
  const [executionInfo, setExecutionInfo] = useState<ExecuteResponsePayload | null>(null);
  const [approvalTxHash, setApprovalTxHash] = useState<`0x${string}` | null>(null);
  const [swapTxHash, setSwapTxHash] = useState<`0x${string}` | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isCorrectChain = chainId === arbitrumSepolia.id;

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [prompt]);

  const approvalExplorerLink = useMemo(() => {
    if (!approvalTxHash || !executionInfo?.explorerBaseUrl) return null;
    return `${executionInfo.explorerBaseUrl}/tx/${approvalTxHash}`;
  }, [approvalTxHash, executionInfo?.explorerBaseUrl]);

  const swapExplorerLink = useMemo(() => {
    if (!swapTxHash || !executionInfo?.explorerBaseUrl) return null;
    return `${executionInfo.explorerBaseUrl}/tx/${swapTxHash}`;
  }, [swapTxHash, executionInfo?.explorerBaseUrl]);

  async function handlePlan() {
    if (!prompt.trim()) return;
    setPlanError(null);
    setExecutionInfo(null);
    setApprovalTxHash(null);
    setSwapTxHash(null);
    setPlanLoading(true);

    try {
      const res = await fetch("/api/agent/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, walletAddress: address }),
      });
      const data = await readJsonOrThrow(res, PlanResponseSchema);
      setPlan(data);
      if (!data.supported) setPlanError(data.message);
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Network error while planning");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleExecute() {
    if (!address || !plan?.supported || plan.parsedIntent.action !== "swap") return;

    setExecuteLoading(true);
    setPlanError(null);
    setApprovalTxHash(null);
    setSwapTxHash(null);

    try {
      if (!isCorrectChain) await switchChainAsync({ chainId: arbitrumSepolia.id });

      const res = await fetch("/api/agent/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, intent: plan.parsedIntent }),
      });

      const data = await readJsonOrThrow(res, ExecuteResponseSchema);
      setExecutionInfo(data);

      if (!data.ok || !data.txRequest) {
        setPlanError(data.message || "Failed to generate transaction payload.");
        return;
      }

      if (data.approvalTxRequest) {
        setApprovalTxHash(await sendTransactionAsync({
          to: data.approvalTxRequest.to,
          data: data.approvalTxRequest.data,
          value: BigInt(data.approvalTxRequest.value),
          chainId: data.approvalTxRequest.chainId,
        }));
      }

      setSwapTxHash(await sendTransactionAsync({
        to: data.txRequest.to,
        data: data.txRequest.data,
        value: BigInt(data.txRequest.value),
        chainId: data.txRequest.chainId,
      }));
    } catch (error) {
      setPlanError(error instanceof Error ? error.message : "Execution declined or failed");
    } finally {
      setExecuteLoading(false);
    }
  }

  const step1Status = plan ? "completed" : "active";
  const step2Status = Boolean(swapTxHash) ? "completed" : (plan ? "active" : "pending");
  const step3Status = Boolean(swapTxHash) ? "completed" : (executeLoading ? "active" : "pending");

  return (
    <div className="min-h-screen flex flex-col font-sans relative selection:bg-cyan-500/30 selection:text-white">

      <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#030305]/82 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="text-cyan-400 opacity-90 drop-shadow-[0_0_6px_rgba(34,211,238,0.35)] animate-subtle-spin">
              <Hexagon size={24} strokeWidth={1.5} />
            </div>
            <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              ArbiPilot <span className="bg-white/10 text-[9px] uppercase font-bold text-slate-300 px-1.5 py-0.5 rounded-[4px] tracking-widest border border-white/[0.05]">SYS.01</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {!publicEnv.walletConnectProjectId && (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-amber-500 pr-4 border-r border-white/10">
                <AlertTriangle size={14} /> WC Unconfigured
              </span>
            )}
            <WalletConnectButton />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 py-12 flex flex-col gap-10">

        {/* Hero Narrative & Positioning */}
        {!plan && (
          <div className="max-w-3xl flex flex-col gap-6 pt-10 pb-6">
            <h2
              className="text-[2.5rem] md:text-[3.25rem] font-medium tracking-tight text-white leading-[1.15] drop-shadow-sm animate-fade-in-up"
              style={{ animationDelay: "40ms" }}
            >
              Share your intent.<br className="hidden md:block" />
              <span className="text-slate-400 font-light">We&apos;ll craft the optimal execution strategy.</span>
            </h2>
            <p
              className="text-[1.1rem] text-slate-400/90 leading-[1.7] max-w-2xl font-light tracking-wide lg:pr-8 animate-fade-in-up"
              style={{ animationDelay: "120ms" }}
            >
              ArbiPilot turns your natural language into a highly secure, deterministic blueprint. We verify the risks and explain every step transparently, long before you are ever asked to sign a transaction.
            </p>
            
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-6 border-t border-white/[0.04] text-[13px] text-slate-400 font-medium animate-fade-in-up"
              style={{ animationDelay: "200ms" }}
            >
              <div className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500/80 shadow-[0_0_5px_rgba(34,211,238,0.3)]" /> 1. Connect Wallet</div>
              <div className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-cyan-500/80 shadow-[0_0_5px_rgba(34,211,238,0.3)]" /> 2. Share Intent</div>
              <div className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_5px_rgba(52,211,153,0.3)]" /> 3. Review Plan</div>
              <div className="flex items-center gap-2.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/80 shadow-[0_0_5px_rgba(52,211,153,0.3)]" /> 4. Authorize Action</div>
            </div>
          </div>
        )}

        {plan && (
          <div className="flex justify-center md:justify-start">
            <div className="flex items-center gap-2 overflow-x-auto pb-4 hide-scrollbar">
              <StepBadge number={1} label="Intent Analysis" status={step1Status} />
              <StepBadge number={2} label="Plan & Risk" status={step2Status} />
              <StepBadge number={3} label="Onchain Execution" status={step3Status} />
            </div>
          </div>
        )}

        <div className="relative rounded-[24px] bg-[#09090b]/44 border border-white/[0.06] shadow-[0_10px_36px_rgba(0,0,0,0.38)] p-2 flex flex-col mt-4 backdrop-blur-md">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-[24px] pointer-events-none" />
          <div className="relative bg-[#030305]/60 rounded-[18px] border border-white/[0.04] p-6 lg:p-8 flex flex-col gap-5 shadow-inner">
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
                What do you want to achieve?
              </h2>
              <p className="text-slate-400 text-sm font-light">Describe your objective simply. The system will structure a secure strategy for your review.</p>
            </div>

            <div className="relative group flex flex-col md:flex-row gap-4 items-end bg-white/[0.03] rounded-2xl p-2 pl-4 border border-white/[0.06] focus-within:border-cyan-500/50 focus-within:bg-white/[0.05] transition-[border-color,background-color] duration-200 shadow-[inset_0_1px_3px_rgba(0,0,0,0.42)]">
              <textarea
                ref={textareaRef}
                rows={1}
                className="w-full resize-none bg-transparent border-none py-3 text-lg text-slate-200 placeholder:text-slate-500/70 focus:outline-none focus:ring-0 leading-relaxed caret-cyan-400 font-light"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. I want to swap 10 USDC for WETH while keeping slippage low..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handlePlan();
                  }
                }}
              />
              <div className="shrink-0 flex gap-2">
                {isConnected && !isCorrectChain && (
                  <button
                    onClick={() => switchChainAsync({ chainId: arbitrumSepolia.id })}
                    disabled={isSwitching}
                    className="h-12 px-5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition-colors"
                  >
                    Switch to Sepolia
                  </button>
                )}
                <button
                  onClick={handlePlan}
                  disabled={planLoading || !prompt.trim()}
                  className="h-12 px-6 rounded-xl bg-white text-black font-semibold text-sm hover:bg-slate-200 disabled:bg-white/10 disabled:text-slate-500 disabled:shadow-none transition-[background-color,transform,color] duration-200 flex items-center gap-2 shadow-[0_2px_10px_rgba(255,255,255,0.13)] active:scale-[0.99]"
                >
                  {planLoading ? <Activity size={18} className="animate-spin" /> : <>Draft Strategy <ArrowRight size={16} /></>}
                </button>
              </div>
            </div>

            {planError && !plan && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 p-4 flex items-start gap-3 text-rose-400">
                <ShieldAlert size={20} className="shrink-0 mt-0.5" />
                <div className="text-sm">{planError}</div>
              </div>
            )}
          </div>
        </div>

        {plan && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in-up mt-4">

            <div className="flex flex-col gap-6">
              <CardShell title="Execution Strategy" subtitle="Understanding your intent and resolving a deterministic path.">
                <div className="text-sm text-slate-300 leading-relaxed mb-6 bg-white/[0.02] p-4 rounded-xl border border-white/[0.05]">
                  {plan.explanation}
                </div>

                <h4 className="text-xs uppercase tracking-widest text-slate-500 mb-3 font-semibold flex items-center gap-2">
                  <ListOrdered size={14} /> Step-by-Step Blueprint
                </h4>
                <div className="space-y-3">
                  {plan.executionPlan.map((step, idx) => (
                    <div key={idx} className="flex gap-4 items-center bg-white/[0.02] border border-white/[0.04] p-3 rounded-xl shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.05] text-[10px] font-medium text-slate-400">
                        {idx + 1}
                      </div>
                      <span className="text-sm text-slate-300 font-mono">{step}</span>
                    </div>
                  ))}
                </div>
              </CardShell>

              <div className="opacity-80 hover:opacity-100 transition-opacity">
                <RegistryPanel />
              </div>
            </div>

            <div className="flex flex-col gap-6">
              <CardShell title="Pre-Execution Guardrails" subtitle="Safety validation and guaranteed execution parameters.">
                <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)] mb-6">
                  <div className="flex items-center gap-3">
                    <ShieldCheck size={24} className={plan.riskPreview.level === 'low' ? 'text-emerald-500' : 'text-amber-500'} />
                    <div>
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Network Risk Rating</div>
                      <div className="text-lg font-semibold text-slate-200 capitalize">{plan.riskPreview.level}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]">
                    <div className="text-xs font-semibold text-slate-500 mb-1">Estimated Output</div>
                    <div className="text-2xl font-semibold text-slate-100">{plan.preview.estimatedAmountOut} <span className="text-sm text-slate-500">{plan.parsedIntent.tokenOut}</span></div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_2px_rgba(255,255,255,0.02)]">
                    <div className="text-xs font-semibold text-slate-500 mb-1">Minimum Guaranteed</div>
                    <div className="text-xl font-medium text-slate-300 mt-1">{plan.preview.minAmountOut} <span className="text-sm text-slate-500">{plan.parsedIntent.tokenOut}</span></div>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Validation Checks</div>
                  <ul className="space-y-2">
                    {plan.riskPreview.reasons.map((reason, idx) => (
                      <li key={idx} className="flex gap-2.5 text-sm text-slate-300 bg-white/[0.02] p-2.5 rounded-lg border border-white/[0.02]">
                        <Info size={16} className="shrink-0 text-cyan-500 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handleExecute}
                  disabled={!isConnected || !plan?.supported || executeLoading || isSending || Boolean(swapTxHash)}
                  className="w-full h-14 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-white/10 text-black font-semibold text-[15px] transition-[background-color,transform,color] duration-200 flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(16,185,129,0.26),inset_0_1px_1px_rgba(255,255,255,0.32)] disabled:shadow-none disabled:text-slate-500 active:scale-[0.99] group/exec"
                >
                  {executeLoading || isSending ? (
                    <><Activity size={18} className="animate-spin text-emerald-900 group-hover/exec:text-emerald-950 transition-colors" /> Awaiting Signature...</>
                  ) : swapTxHash ? (
                    <><CheckCircle2 size={18} className="text-emerald-900 group-hover/exec:text-emerald-950 transition-colors" /> Transaction Broadcasted</>
                  ) : (
                    <><Sparkles size={18} className="text-emerald-900 group-hover/exec:text-emerald-950 transition-colors" /> Approve & Execute Transaction</>
                  )}
                </button>

                {(approvalTxHash || swapTxHash || planError) && (
                  <div className="mt-6 flex flex-col gap-2 pt-6 border-t border-white/[0.05]">
                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-1">Transaction Summary</div>
                    {planError && <div className="p-3 text-sm text-rose-400 bg-rose-500/10 rounded-lg border border-rose-500/20 shadow-[inset_0_1px_4px_rgba(0,0,0,0.2)]">{planError}</div>}
                    {approvalTxHash && (
                      <div className="p-3 text-sm flex justify-between items-center bg-[#09090b]/80 border border-white/[0.04] shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] rounded-lg text-slate-300">
                        <span>Approval TX: <span className="font-mono text-xs text-slate-400">{approvalTxHash.substring(0, 12)}...</span></span>
                        {approvalExplorerLink && <a href={approvalExplorerLink} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors">Verify</a>}
                      </div>
                    )}
                    {swapTxHash && (
                      <div className="p-3 text-sm flex justify-between items-center bg-[#09090b]/80 border border-white/[0.04] shadow-[inset_0_1px_4px_rgba(0,0,0,0.3)] rounded-lg text-slate-300">
                        <span>Swap TX: <span className="font-mono text-xs text-slate-400">{swapTxHash.substring(0, 12)}...</span></span>
                        {swapExplorerLink && <a href={swapExplorerLink} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 hover:underline transition-colors">Verify</a>}
                      </div>
                    )}
                  </div>
                )}
              </CardShell>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
