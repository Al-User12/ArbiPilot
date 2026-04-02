"use client";

import { useMemo, useState } from "react";
import { arbitrumSepolia } from "viem/chains";
import { useAccount, useSendTransaction, useSwitchChain } from "wagmi";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ShieldAlert, Cpu, Network, CheckCircle2, AlertTriangle, ArrowRight, Activity, Terminal } from "lucide-react";

import { CardShell } from "@/components/card-shell";
import { RegistryPanel } from "@/components/registry-panel";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { ExecuteResponseSchema, PlanResponseSchema } from "@/lib/agent/schema";
import type { ExecuteResponsePayload, PlanResponsePayload } from "@/lib/agent/types";
import { getPublicRuntimeEnv } from "@/lib/config/public-env";
import { readJsonOrThrow } from "@/lib/http/client";

function StepBadge({ number, label, status }: { number: number; label: string; status: "pending" | "active" | "completed" }) {
  const styles = {
    pending: "text-slate-500 border-slate-800 bg-slate-900/40",
    active: "text-cyan-300 border-cyan-500/50 bg-cyan-950/40 shadow-[0_0_15px_rgba(34,211,238,0.15)]",
    completed: "text-emerald-300 border-emerald-500/50 bg-emerald-950/40 shadow-[0_0_10px_rgba(52,211,153,0.1)]",
  };

  return (
    <div className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest transition-all ${styles[status]}`}>
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[10px]">
        {status === "completed" ? <CheckCircle2 size={12} className="text-emerald-400" /> : number}
      </span>
      {label}
    </div>
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
    if (!address || !plan?.supported || plan.parsedIntent.action !== "swap") return;

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

  const step1Status = plan ? "completed" : "active";
  const step2Status = Boolean(swapTxHash) ? "completed" : (plan ? "active" : "pending");
  const step3Status = Boolean(swapTxHash) ? "completed" : (executeLoading ? "active" : "pending");

  return (
    <div className="min-h-screen flex flex-col font-sans relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-900/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/10 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-slate-950/60 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
              <Cpu className="text-cyan-400" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide text-white uppercase font-display flex items-center gap-2">
                ArbiPilot <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">Beta</span>
              </h1>
              <p className="text-xs text-slate-400">Explain-Then-Execute • Arbitrum Sepolia</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {!publicEnv.walletConnectProjectId && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
                <AlertTriangle size={10} /> No WC Key
              </span>
            )}
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-6 py-10 flex flex-col gap-8 relative z-10">
        
        {/* Progress Stepper */}
        <div className="flex justify-center gap-3 overflow-x-auto pb-4 hide-scrollbar">
          <StepBadge number={1} label="Intent & Validation" status={step1Status} />
          <StepBadge number={2} label="Plan & Risk" status={step2Status} />
          <StepBadge number={3} label="Execution" status={step3Status} />
        </div>

        {/* Console / Prompt Area */}
        <section className="glass-panel rounded-3xl p-6 md:p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-transparent opacity-50" />
          
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-2xl md:text-3xl font-display font-light text-white flex items-center gap-3">
              <Sparkles className="text-cyan-400" /> What would you like to do?
            </h2>
            <p className="text-slate-400 text-sm">Natural language intent on Arbitrum. LLM parses strictly, payload generation is deterministic.</p>
          </div>

          <div className="relative group">
            <textarea
              className="w-full resize-none rounded-2xl bg-slate-900/60 border border-white/10 px-6 py-5 text-lg text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all min-h-[120px] font-sans"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. swap 10 USDC to ETH on Arbitrum with safe slippage"
            />
            <div className="absolute bottom-4 right-4 flex gap-3">
              {isConnected && !isCorrectChain && (
                 <button
                 type="button"
                 onClick={() => switchChainAsync({ chainId: arbitrumSepolia.id })}
                 disabled={isSwitching}
                 className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-5 py-2.5 text-sm font-semibold text-amber-200 transition-all hover:bg-amber-500/20 disabled:opacity-50"
               >
                 <Network size={16} /> Switch to Sepolia
               </button>
              )}
              <button
                type="button"
                onClick={handlePlan}
                disabled={planLoading || !prompt.trim()}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 text-slate-950 px-6 py-2.5 text-sm font-bold transition-all hover:bg-cyan-400 disabled:opacity-50 disabled:bg-slate-700 disabled:text-slate-400"
              >
                {planLoading ? (
                  <span className="flex items-center gap-2"><Activity size={16} className="animate-spin" /> Planning...</span>
                ) : (
                  <span className="flex items-center gap-2">Generate Plan <ArrowRight size={16} /></span>
                )}
              </button>
            </div>
          </div>
          
          {planError && !plan && (
             <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-3 text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 text-sm">
               <ShieldAlert size={18} className="text-rose-400" />
               {planError}
             </motion.div>
          )}
        </section>

        <AnimatePresence>
          {plan && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left Column: Parsed Intent & Plan Details */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <CardShell title="Security & Explanation" className="border-t-2 border-t-cyan-500/50">
                  <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed mb-6">
                    {plan.explanation}
                  </div>
                  <div className="rounded-xl bg-black/40 border border-white/5 p-4">
                    <div className="flex items-center gap-2 mb-3 text-xs uppercase tracking-widest text-slate-500">
                      <Terminal size={14} /> Execution Sequence
                    </div>
                    <ol className="space-y-2 text-sm text-slate-300 font-mono">
                      {plan.executionPlan.map((step, idx) => (
                        <li key={idx} className="flex gap-3 items-start">
                          <span className="text-cyan-600 mt-0.5">{`>`}</span> {step}
                        </li>
                      ))}
                    </ol>
                  </div>
                </CardShell>

                {/* Optional Status / Execution log below */}
                {(approvalTxHash || swapTxHash || planError) && (
                  <CardShell title="Transaction Status" className="bg-slate-900/80">
                    <div className="space-y-3 font-mono text-xs">
                      {planError && <div className="text-rose-400">Error: {planError}</div>}
                      {approvalTxHash && (
                        <div className="flex items-center justify-between text-amber-300/90 bg-amber-500/10 p-3 rounded-lg border border-amber-500/20">
                          <span>Approval Hash: {approvalTxHash.substring(0, 16)}...</span>
                          {approvalExplorerLink && <a href={approvalExplorerLink} target="_blank" rel="noreferrer" className="underline hover:text-amber-200">View</a>}
                        </div>
                      )}
                      {swapTxHash && (
                        <div className="flex items-center justify-between text-emerald-300/90 bg-emerald-500/10 p-3 rounded-lg border border-emerald-500/20">
                          <span>Swap Hash: {swapTxHash.substring(0, 16)}...</span>
                          {swapExplorerLink && <a href={swapExplorerLink} target="_blank" rel="noreferrer" className="underline hover:text-emerald-200">View</a>}
                        </div>
                      )}
                    </div>
                  </CardShell>
                )}
              </div>

              {/* Right Column: Execution Dashboard */}
              <div className="flex flex-col gap-6">
                <CardShell title="Risk & Safety Guardrails" className="border-t-2 border-t-amber-500/50 bg-amber-950/10">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`p-2 rounded-lg ${plan.riskPreview.level === 'low' ? 'bg-emerald-500/20 text-emerald-400' : plan.riskPreview.level === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      <ShieldAlert size={20} />
                    </div>
                    <div>
                      <h4 className="text-[10px] uppercase tracking-widest text-slate-400">Risk Level</h4>
                      <p className={`font-bold capitalize ${plan.riskPreview.level === 'low' ? 'text-emerald-400' : plan.riskPreview.level === 'medium' ? 'text-amber-400' : 'text-rose-400'}`}>{plan.riskPreview.level}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4 mb-6">
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                       <span className="text-slate-400">Est. Received</span>
                       <span className="font-medium text-slate-100">{plan.preview.estimatedAmountOut} <span className="text-slate-500 text-xs">{plan.parsedIntent.tokenOut}</span></span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-white/5 pb-2">
                       <span className="text-slate-400">Min. Received</span>
                       <span className="font-medium text-slate-100">{plan.preview.minAmountOut} <span className="text-slate-500 text-xs">{plan.parsedIntent.tokenOut}</span></span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-6">
                    <h4 className="text-xs uppercase tracking-widest text-slate-500">Validation Notes</h4>
                    <ul className="space-y-1.5 list-disc list-inside text-xs text-slate-400">
                      {plan.riskPreview.reasons.map((reason, idx) => (
                        <li key={idx} className="leading-snug">{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecute}
                    disabled={!isConnected || !plan?.supported || executeLoading || isSending || Boolean(swapTxHash)}
                    className="w-full relative group overflow-hidden rounded-xl bg-emerald-500 disabled:bg-slate-800 border-none py-3.5 px-4 font-bold text-slate-950 disabled:text-slate-500 shadow-[0_0_20px_rgba(52,211,153,0.2)] transition-all disabled:shadow-none hover:shadow-[0_0_30px_rgba(52,211,153,0.4)]"
                  >
                    <div className="relative z-10 flex items-center justify-center gap-2">
                      {executeLoading || isSending ? (
                         <><Activity size={18} className="animate-spin" /> Authorizing...</>
                      ) : swapTxHash ? (
                         <><CheckCircle2 size={18} /> Executed Successfully</>
                      ) : (
                         <><Sparkles size={18} /> Approve & Execute</>
                      )}
                    </div>
                    {!executeLoading && !isSending && !swapTxHash && (
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                    )}
                  </button>
                </CardShell>

                {/* Minimal Registry Panel - Kept for dev/bounty integrity but styled sleek */}
                <div className="mt-auto">
                    <RegistryPanel />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

