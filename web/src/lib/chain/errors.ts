import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from "viem";

const REVERTS: Record<string, string> = {
  SaleNotOpen: "The sale is not open right now.",
  InvalidAmount: "Enter at least 1 whole token.",
  TxCapExceeded: "That is more than one transaction can buy.",
  WalletCapExceeded: "That would put this wallet over its limit.",
  SoldOut: "Not enough tokens are left in the sale for that amount.",
  InsufficientPayment: "The ETH sent does not cover the price.",
  AlreadyFinalized: "The launch is already finalized.",
  NotFinalizable: "The launch cannot be finalized at this moment.",
  NothingToWithdraw: "The treasury share has already been sent.",
  RefundNotOpen: "Refunds are only open if the launch was not finalized in time.",
  NothingToRefund: "This wallet has nothing to refund.",
  NotRevealer: "Only the revealer can do that.",
  NotRevealable: "The reveal cannot happen at this moment.",
  BadSecret: "That secret does not match the published commitment.",
  TransferFailed: "An ETH transfer was rejected by the receiving address.",
  Reentrancy: "The call was rejected as re-entrant.",
  TradingClosed: "Transfers open when the launch is finalized.",
  NotNftOwner: "This wallet does not hold that asterism.",
  InvalidName: "Use up to 48 letters, numbers, spaces and . , ! ? ' - only.",
  TransferFromIncorrectOwner: "This wallet no longer holds that asterism.",
  TransferToNonERC721ReceiverImplementer: "That address is a contract that cannot receive NFTs.",
  TokenDoesNotExist: "That asterism does not exist right now.",
};

export interface Explained {
  title: string;
  detail: string;
  /** Whether the person's funds or assets could have moved. */
  fundsMoved: false | "unknown";
  rejected: boolean;
}

/** Turns a viem error into a plain explanation: what happened, whether funds moved, what to do. */
export function explain(err: unknown, stage: "simulate" | "sign" | "confirm" | "read"): Explained {
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected) return { title: "Request declined", detail: "You declined the request in your wallet. Nothing was sent.", fundsMoved: false, rejected: true };
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName ?? "";
      return {
        title: stage === "simulate" ? "This would fail" : "Transaction reverted",
        detail: REVERTS[name] ?? (revert.shortMessage || "The contract rejected the call."),
        fundsMoved: false,
        rejected: false,
      };
    }
    if (/insufficient funds/i.test(err.message)) {
      return { title: "Not enough ETH", detail: "This wallet does not have enough ETH for the price plus gas.", fundsMoved: false, rejected: false };
    }
    return {
      title: stage === "read" ? "Could not read the chain" : "Something went wrong",
      detail: err.shortMessage,
      fundsMoved: stage === "confirm" ? "unknown" : false,
      rejected: false,
    };
  }
  return { title: "Something went wrong", detail: err instanceof Error ? err.message : String(err), fundsMoved: stage === "confirm" ? "unknown" : false, rejected: false };
}
