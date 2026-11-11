import type { Abi, Address, PublicClient } from "viem";
import { publicClient } from "./client";

/** The minimal shape of a contract write, shared by simulation, gas estimation and signing. */
export interface WriteRequest {
  address: Address;
  abi: Abi | readonly unknown[];
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

type SimArgs = Parameters<PublicClient["simulateContract"]>[0];
type GasArgs = Parameters<PublicClient["estimateContractGas"]>[0];

/** eth_call simulation. Throws (with the decoded revert) if the call would fail. */
export async function simulateWrite(req: WriteRequest, account: Address): Promise<WriteRequest> {
  await publicClient().simulateContract({ ...req, account } as unknown as SimArgs);
  return req;
}

export async function estimateFee(req: WriteRequest, account: Address): Promise<bigint | null> {
  try {
    const c = publicClient();
    const [gas, price] = await Promise.all([c.estimateContractGas({ ...req, account } as unknown as GasArgs), c.getGasPrice()]);
    return gas * price;
  } catch {
    return null;
  }
}
