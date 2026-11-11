import { createPublicClient, http, type PublicClient } from "viem";
import { RPC_URL } from "../env";
import { chain } from "./chains";

let client: PublicClient | null = null;

/** Absolute RPC URL in the browser; the default is this site's /api/rpc function. */
export function rpcUrl(): string {
  if (/^https?:\/\//.test(RPC_URL)) return RPC_URL;
  if (typeof window === "undefined") return `http://localhost${RPC_URL}`;
  return new URL(RPC_URL, window.location.origin).toString();
}

export function publicClient(): PublicClient {
  if (!client) {
    client = createPublicClient({
      chain,
      // JSON-RPC batches of at most 20 calls; /api/rpc rejects batches above 25.
      transport: http(rpcUrl(), { batch: { batchSize: 20, wait: 16 }, retryCount: 2, timeout: 15_000 }),
    }) as PublicClient;
  }
  return client;
}
