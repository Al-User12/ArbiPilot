"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { useState } from "react";

function truncateAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-0 overflow-hidden rounded-full border border-white/10 bg-[#18181b] shadow-sm">
        <div className="flex items-center gap-2 pl-3 pr-2 py-1.5 text-xs font-semibold text-slate-200">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse-slow"></div>
          {truncateAddress(address)}
        </div>
        <div className="h-4 w-px bg-white/10 mx-1"></div>
        <button
          type="button"
          onClick={() => disconnect()}
          className="flex items-center justify-center p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 transition-colors"
          title="Disconnect"
        >
          <LogOut size={14} />
        </button>
      </div>
    );
  }

  const primaryConnector = connectors.find(c => c.id === 'injected') || connectors[0];
  const secondaryConnectors = connectors.filter(c => c.uid !== primaryConnector?.uid);

  return (
    <div className="relative group">
      <div className="flex items-center">
        {primaryConnector && (
          <button
            type="button"
            onClick={() => connect({ connector: primaryConnector })}
            disabled={isPending}
            className="flex items-center gap-2 rounded-l-full border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-50 shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-colors disabled:opacity-50 border-r-0 backdrop-blur-md"
          >
            <Wallet size={14} className="text-cyan-400" />
            <span>Connect {primaryConnector.name}</span>
          </button>
        )}
        
        {secondaryConnectors.length > 0 && (
          <button 
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center justify-center rounded-r-full border border-cyan-500/30 bg-cyan-500/5 hover:bg-cyan-500/20 px-2 py-2 text-cyan-400 transition-colors backdrop-blur-md"
          >
           <ChevronDown size={14} />
          </button>
        )}
      </div>

      {secondaryConnectors.length > 0 && dropdownOpen && (
        <div className="absolute top-full right-0 mt-2 w-48 rounded-xl border border-white/10 bg-[#09090b]/90 backdrop-blur-xl shadow-2xl overflow-hidden py-1 z-50 animate-fade-in-up">
          {secondaryConnectors.map((connector) => (
            <button
              key={connector.uid}
              type="button"
              onClick={() => {
                connect({ connector });
                setDropdownOpen(false);
              }}
              disabled={isPending}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors text-left"
            >
              <Wallet size={12} className="text-slate-500" />
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

