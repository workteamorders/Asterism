import type { Status } from "./chain/reads";

export function statusLabel(s: Status): string {
  switch (s) {
    case "NotStarted":
      return "Not started";
    case "Sale":
      return "Sale open";
    case "AwaitingFinalization":
      return "Awaiting finalization";
    case "Trading":
      return "Trading";
    case "Refunding":
      return "Refunds open";
  }
}
