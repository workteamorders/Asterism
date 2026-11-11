"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { makeWagmiConfig } from "@/lib/chain/wagmi";
import { readPref, writePref } from "@/lib/storage";
import { ToastProvider } from "../toast/Toaster";
import { RiskNotice } from "./RiskNotice";
import { ConnectDialog } from "../wallet/ConnectDialog";

interface Geo {
  country: string | null;
  viewOnly: boolean;
  checked: boolean;
}

interface Gates {
  geo: Geo;
  /** Runs fn after the one-time risk notice has been accepted. */
  needRisk: (fn: () => void) => void;
  openConnect: () => void;
}

const GatesCtx = createContext<Gates>({ geo: { country: null, viewOnly: false, checked: false }, needRisk: (fn) => fn(), openConnect: () => {} });

export function useGates(): Gates {
  return useContext(GatesCtx);
}

const RISK_KEY = "risk-accepted-v1";

export function Providers({ children }: { children: ReactNode }) {
  const [config] = useState(makeWagmiConfig);
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, staleTime: 5_000 } } }));
  const [geo, setGeo] = useState<Geo>({ country: null, viewOnly: false, checked: false });
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/geo", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { country?: string | null; viewOnly?: boolean } | null) => {
        if (alive) setGeo({ country: d?.country ?? null, viewOnly: Boolean(d?.viewOnly), checked: true });
      })
      .catch(() => {
        if (alive) setGeo((g) => ({ ...g, checked: true }));
      });
    return () => {
      alive = false;
    };
  }, []);

  const needRisk = useCallback((fn: () => void) => {
    if (readPref(RISK_KEY) === "yes") fn();
    else setPending(() => fn);
  }, []);

  const gates = useMemo<Gates>(() => ({ geo, needRisk, openConnect: () => setConnectOpen(true) }), [geo, needRisk]);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <GatesCtx.Provider value={gates}>
            {children}
            <RiskNotice
              open={pending !== null}
              onCancel={() => setPending(null)}
              onAccept={() => {
                writePref(RISK_KEY, "yes");
                const fn = pending;
                setPending(null);
                fn?.();
              }}
            />
            <ConnectDialog open={connectOpen} onClose={() => setConnectOpen(false)} />
          </GatesCtx.Provider>
        </ToastProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
