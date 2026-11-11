/** Public build-time configuration. Secrets never live here (see functions/ for server-only values). */
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? "4663");
/** Read RPC. Defaults to this site's /api/rpc Pages Function, which keeps the provider key on the server. */
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "/api/rpc";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asterism.example";
export const AUDIT_REPORT_URL = process.env.NEXT_PUBLIC_AUDIT_REPORT_URL ?? "";
/** End-to-end tests only: enables the mock wallet connector. Never set in production builds. */
export const E2E = process.env.NEXT_PUBLIC_E2E === "1";
export const E2E_ACCOUNT = (process.env.NEXT_PUBLIC_E2E_ACCOUNT ?? "") as `0x${string}` | "";
