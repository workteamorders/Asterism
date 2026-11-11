"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { isDeployed } from "../chain/deployment";
import { readLauncherConfig, readLauncherState, readOwnedIds, readUser } from "../chain/reads";

export function useLauncherConfig() {
  return useQuery({ queryKey: ["launcher-config"], queryFn: readLauncherConfig, enabled: isDeployed, staleTime: Infinity, retry: 2 });
}

export function useLauncherState() {
  return useQuery({ queryKey: ["launcher-state"], queryFn: readLauncherState, enabled: isDeployed, refetchInterval: 12_000, retry: 2 });
}

export function useUserState(account: Address | undefined) {
  return useQuery({
    queryKey: ["user", account],
    queryFn: () => readUser(account as Address),
    enabled: isDeployed && Boolean(account),
    refetchInterval: 15_000,
  });
}

export function useOwnedIds(account: Address | undefined) {
  return useQuery({
    queryKey: ["owned", account],
    queryFn: () => readOwnedIds(account as Address),
    enabled: isDeployed && Boolean(account),
    refetchInterval: 20_000,
  });
}
