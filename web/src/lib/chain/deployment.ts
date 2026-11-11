import raw from "@/generated/deployment.json";
import type { Address, Hex } from "viem";

export interface DeploymentParams {
  name: string;
  symbol: string;
  mintPriceWei: string;
  walletCap: number;
  txCap: number;
  saleStart: number;
  saleEnd: number;
  finalizeWindowSeconds: number;
  revealWindowSeconds: number;
  treasury: Address;
  revealCommit: Hex;
  weth: Address;
  uniswapV2Factory: Address;
}

export interface Deployment {
  chainId: number;
  network: string;
  explorer: string;
  deployedAtBlock: number;
  addresses: { renderer: Address; launcher: Address; token: Address; mirror: Address; sink: Address } | null;
  params: DeploymentParams | null;
  auditReportUrl: string;
}

export const deployment = raw as unknown as Deployment;
export const isDeployed = deployment.addresses !== null;

/** Proposed defaults shown, labelled EXAMPLE, before anything is deployed. */
export const EXAMPLE_PARAMS = {
  maxSupplyTokens: 2222,
  saleBps: 6000,
  liquidityProceedsBps: 6667,
  treasuryProceedsBps: 3333,
  saleCap: 1333,
  walletCap: 10,
  txCap: 5,
} as const;
