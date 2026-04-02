"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet, LogOut } from "lucide-react";

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
      <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 pl-3 rounded-full border border-emerald-500/20 backdrop-blur-md shadow-[0_0_15px_rgba(52,211,153,0.05)]">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-300">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow"></div>
          {truncateAddress(address)}
        </div>
        <button
          type="button"
          onClick={() => disconnect()}
          className="ml-2 flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 hover:text-rose-400 transition-colors text-slate-400"
          title="Disconnect"
        >
          <LogOut size={14} />
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
          className="flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-5 py-2.5 text-sm font-semibold text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all hover:bg-cyan-900/60 hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(34,211,238,0.15)] disabled:opacity-60"
        >
          <Wallet size={16} className="text-cyan-400" />
          <span>Connect {connector.name}</span>
        </button>
      ))}
    </div>
  );
}

