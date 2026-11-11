"use client";

import { useState } from "react";
import { encodePacked, isHex, keccak256, type Hex } from "viem";
import { deployment, isDeployed } from "@/lib/chain/deployment";
import { useLauncherConfig, useLauncherState } from "@/lib/hooks/chain";
import { Button } from "../button/Button";
import { Field } from "../field/Field";
import { Notice } from "../notice/Notice";
import { Readout } from "../readout/Readout";
import styles from "./Rules.module.css";

/** Checks a published secret against the on-chain commitment, and the seed against secret + entropy. All local. */
export function VerifyReveal() {
  const cfg = useLauncherConfig();
  const st = useLauncherState();
  const [secret, setSecret] = useState("");
  const [result, setResult] = useState<null | { commitOk: boolean; seedOk: boolean | null; hash: Hex }>(null);
  const [touched, setTouched] = useState(false);
  const valid = isHex(secret.trim()) && secret.trim().length === 66;
  const commit = cfg.data?.revealCommit ?? deployment.params?.revealCommit;

  const check = () => {
    setTouched(true);
    if (!valid || !commit) return;
    const s = secret.trim() as Hex;
    const hash = keccak256(encodePacked(["bytes32"], [s]));
    const seedOk = st.data?.revealed ? keccak256(encodePacked(["bytes32", "bytes32"], [s, st.data.entropy])) === st.data.seed : null;
    setResult({ commitOk: hash.toLowerCase() === commit.toLowerCase(), seedOk, hash });
  };

  if (!isDeployed) {
    return (
      <Notice tone="info" title="Available after deployment">
        This tool compares a secret with the commitment stored in the launcher. There is no commitment until the contracts are deployed.
      </Notice>
    );
  }

  return (
    <form
      className={styles.verify}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        check();
      }}
    >
      <Readout rows={[{ key: "Commitment on-chain", value: commit ?? "Reading…" }]} stack />
      <Field
        label="Published secret"
        mono
        spellCheck={false}
        autoComplete="off"
        placeholder="0x followed by 64 hex characters"
        value={secret}
        onChange={(e) => {
          setSecret(e.target.value);
          setResult(null);
        }}
        onBlur={() => setTouched(true)}
        error={touched && secret && !valid ? "A secret is 0x followed by exactly 64 hex characters." : undefined}
        help="Computed in your browser: keccak256(secret) must equal the commitment. Nothing is sent anywhere."
      />
      <Button variant="secondary" type="submit" icon="reticle">
        Check the secret
      </Button>
      {result ? (
        <Notice tone={result.commitOk ? "success" : "danger"} title={result.commitOk ? "The secret matches the commitment" : "The secret does not match"}>
          keccak256(secret) = {result.hash}.{" "}
          {result.seedOk === null ? "The seed is not revealed yet." : result.seedOk ? "The on-chain seed equals keccak256(secret, entropy)." : "The on-chain seed does not equal keccak256(secret, entropy)."}
        </Notice>
      ) : null}
    </form>
  );
}
