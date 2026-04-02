"use client";

import { useState } from "react";
import { z } from "zod";

import { CardShell } from "@/components/card-shell";
import {
  ApiErrorResponseSchema,
  RegistryPathResponseSchema,
  RegistryResolveResponseSchema,
} from "@/lib/agent/schema";

const RegistryPanelResponseSchema = z.union([
  RegistryResolveResponseSchema,
  RegistryPathResponseSchema,
]);

type RegistryPanelResponse = z.infer<typeof RegistryPanelResponseSchema>;

async function readRegistryResponse(response: Response): Promise<RegistryPanelResponse> {
  const raw = await response.json();

  if (!response.ok) {
    const parsedError = ApiErrorResponseSchema.safeParse(raw);
    if (parsedError.success) {
      throw new Error(`${parsedError.data.error.code}: ${parsedError.data.error.message}`);
    }

    throw new Error("Registry request failed with an unrecognized payload.");
  }

  const parsed = RegistryPanelResponseSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Registry API returned an invalid response shape.");
  }

  return parsed.data;
}

export function RegistryPanel() {
  const [txHash, setTxHash] = useState("");
  const [response, setResponse] = useState<RegistryPanelResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadRegistryPath() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/registry/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const data = await readRegistryResponse(res);
      setResponse(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registry request failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitTxHash() {
    if (!txHash.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/registry/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txHash: txHash.trim() }),
      });

      const data = await readRegistryResponse(res);
      setResponse(data);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Registry request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CardShell
      title="Registry Path"
      subtitle="Agent0 SDK registration runbook for Arbitrum Sepolia identity submission"
    >
      <div className="space-y-3 text-sm text-slate-300">
        <div className="flex flex-col gap-2 md:flex-row">
          <input
            value={txHash}
            onChange={(event) => setTxHash(event.target.value)}
            placeholder="Optional: paste registry tx hash"
            className="w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-cyan-400/60"
          />
          <button
            type="button"
            onClick={submitTxHash}
            disabled={loading || !txHash.trim()}
            className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 font-medium text-cyan-100 disabled:opacity-50"
          >
            Resolve Tx
          </button>
          <button
            type="button"
            onClick={loadRegistryPath}
            disabled={loading}
            className="rounded-xl border border-white/20 px-3 py-2 text-slate-200 disabled:opacity-50"
          >
            Load Path
          </button>
        </div>

        {error ? <p className="text-rose-300">{error}</p> : null}

        {response?.ok ? (
          <a
            href={response.explorerLink}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-300 underline"
          >
            Registry explorer link: {response.explorerLink}
          </a>
        ) : null}

        {response && !response.ok ? (
          <div className="space-y-2">
            <p className="text-slate-100">{response.message}</p>
            <p className="text-slate-300">Contract: {response.contractAddress}</p>
            <p>
              Status:{" "}
              <span className={response.canExecute ? "text-emerald-200" : "text-amber-200"}>
                {response.canExecute ? "Executable" : "Needs inputs"}
              </span>
            </p>

            {response.command ? (
              <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs text-slate-200">
                {response.command}
              </p>
            ) : null}

            {response.notes?.length ? (
              <div>
                <p className="text-slate-200">Notes:</p>
                <ul className="list-disc pl-5 text-slate-400">
                  {response.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {response.requiredInputs?.length ? (
              <div>
                <p className="text-slate-200">Required Inputs:</p>
                <ul className="list-disc pl-5 text-slate-400">
                  {response.requiredInputs.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}
