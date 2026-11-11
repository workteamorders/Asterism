import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors/injected";
import { mock } from "wagmi/connectors/mock";
import { E2E, E2E_ACCOUNT } from "../env";
import { chain } from "./chains";
import { rpcUrl } from "./client";

/**
 * Wallet connection only. Reads go through viem's public client (lib/chain/client.ts).
 * EIP-6963 discovery (multiInjectedProviderDiscovery) lists every installed browser wallet by name.
 */
export function makeWagmiConfig() {
  const connectors = E2E && E2E_ACCOUNT ? [mock({ accounts: [E2E_ACCOUNT], features: { reconnect: true, defaultConnected: e2eWasConnected() } })] : [injected({ shimDisconnect: true })];
  return createConfig({
    chains: [chain],
    connectors,
    multiInjectedProviderDiscovery: !E2E,
    ssr: true,
    transports: { [chain.id]: http(rpcUrl()) },
  });
}

/** End-to-end tests only: behave like a wallet that already authorised this site after the first connection. */
function e2eWasConnected(): boolean {
  try {
    return typeof window !== "undefined" && Boolean(window.localStorage.getItem("wagmi.recentConnectorId"));
  } catch {
    return false;
  }
}
