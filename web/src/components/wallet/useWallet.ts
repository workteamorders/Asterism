"use client";

import { useCallback } from "react";
import { useConnection, useDisconnect, useSwitchChain, useWalletClient } from "wagmi";
import { chain } from "@/lib/chain/chains";
import { useGates } from "../providers/Providers";

/** One place for wallet state: connected address, whether it is on the right chain, and helpers. */
export function useWallet() {
  const connection = useConnection();
  const { data: walletClient } = useWalletClient();
  const switcher = useSwitchChain();
  const disconnect = useDisconnect();
  const { openConnect } = useGates();
  const address = connection.status === "connected" ? connection.address : undefined;
  const wrongChain = Boolean(address) && connection.chainId !== chain.id;
  const switchChain = useCallback(() => switcher.mutateAsync({ chainId: chain.id }), [switcher]);
  return {
    address,
    status: connection.status,
    connectorName: connection.connector?.name,
    wrongChain,
    walletClient,
    connect: openConnect,
    switchChain,
    switching: switcher.isPending,
    disconnect: () => disconnect.mutate(),
  };
}
