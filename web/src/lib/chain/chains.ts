import { defineChain, type Chain } from "viem";
import { CHAIN_ID } from "../env";

// Parameters verified against docs.robinhood.com/chain/connecting and live eth_chainId on 2026-11-10 (docs/DECISIONS.md).
export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com", apiUrl: "https://robinhoodchain.blockscout.com/api" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com", apiUrl: "https://explorer.testnet.chain.robinhood.com/api" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
  testnet: true,
});

/** Local anvil, used only by end-to-end tests. No Multicall3 there; reads fall back to plain batches. */
export const anvilLocal = defineChain({
  id: 31337,
  name: "Local anvil",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["http://127.0.0.1:8545"] } },
  testnet: true,
});

const BY_ID: Record<number, Chain> = { 4663: robinhood, 46630: robinhoodTestnet, 31337: anvilLocal };

export const chain: Chain = BY_ID[CHAIN_ID] ?? robinhood;

export function explorerUrl(kind: "address" | "tx", value: string): string | null {
  const base = chain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : null;
}

export const hasMulticall = Boolean(chain.contracts?.multicall3);
