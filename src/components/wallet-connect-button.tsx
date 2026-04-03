"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {truncateAddress(address)}
        </div>
        <button
          type="button"
          onClick={() => disconnect()}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm text-slate-200 hover:border-cyan-300/40"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          onClick={() => connect({ connector })}
          disabled={isPending}
          className="rounded-xl border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm font-medium text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-60"
        >
          Connect {connector.name}
        </button>
      ))}
    </div>
  );
}
