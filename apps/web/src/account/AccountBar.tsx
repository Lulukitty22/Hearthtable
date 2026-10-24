// The strip at the top of every page: sign in with Google, choose an Alias, and see whether the
// account is waiting for administrator approval. Guests and pending accounts browse public
// content like everyone else (Campaigns and Shared Data, Guest viewing and accounts).

import { aliasProblem, claimAlias } from "@hearthtable/storage";
import { useState } from "react";
import { db } from "../firebase";
import { signInWithGoogle, signOutOfGoogle, type Viewer } from "./useViewer";

export function AccountBar({ viewer }: { viewer: Viewer }) {
  const [failure, setFailure] = useState<string | undefined>();

  const signIn = async () => setFailure(await signInWithGoogle());
  const signOutButton = (
    <button
      type="button"
      className="secondary"
      onClick={() => void signOutOfGoogle()}
    >
      Sign out
    </button>
  );

  return (
    <div className="account-area">
      <div className="account-bar" role="region" aria-label="Account">
        <a className="account-home" href="/">
          Hearthtable
        </a>
        <span className="account-status">
          {viewer.status === "loading" && <span className="muted">…</span>}
          {viewer.status === "guest" && (
            <>
              <span className="muted">Browsing as a guest</span>
              <button
                type="button"
                className="primary"
                onClick={() => void signIn()}
              >
                Sign in with Google
              </button>
            </>
          )}
          {(viewer.status === "signed-in" || viewer.status === "no-alias") && (
            <>
              <span className="muted">Signed in</span>
              {signOutButton}
            </>
          )}
          {viewer.status === "account" && (
            <>
              <strong data-testid="account-alias">
                {viewer.account.alias}
              </strong>
              <a
                className="entry-link"
                href={`/Accounts/${encodeURIComponent(viewer.account.alias)}`}
              >
                My home
              </a>
              {viewer.account.admin && (
                <>
                  <span className="badge good">administrator</span>
                  <a className="entry-link" href="/Admin">
                    Approvals
                  </a>
                </>
              )}
              {viewer.account.status === "pending" ? (
                <span className="badge warn">awaiting approval</span>
              ) : (
                <span className="badge good">approved</span>
              )}
              {signOutButton}
            </>
          )}
          {viewer.status === "failed" && (
            <>
              <span className="unresolved">Could not load your account</span>
              {signOutButton}
            </>
          )}
        </span>
      </div>
      {failure && <div className="error-box">Sign-in failed: {failure}</div>}
      {viewer.status === "failed" && (
        <div className="error-box">{viewer.message}</div>
      )}
      {viewer.status === "no-alias" && <AliasForm uid={viewer.uid} />}
      {viewer.status === "account" && viewer.account.status === "pending" && (
        <p className="panel account-note" role="status">
          Your account is waiting for an administrator's approval. Until then
          you can browse public campaigns, characters and items, but not create
          anything or join campaigns.
        </p>
      )}
    </div>
  );
}

function AliasForm({ uid }: { uid: string }) {
  const [alias, setAlias] = useState("");
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<string | undefined>();
  const trimmed = alias.trim();
  const problem = trimmed ? aliasProblem(trimmed) : undefined;

  return (
    <form
      className="panel alias-form"
      aria-label="Choose your Alias"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!trimmed || problem) return;
        setBusy(true);
        const result = await claimAlias(db, uid, trimmed);
        setBusy(false);
        setRefusal(result.ok ? undefined : result.message);
      }}
    >
      <h2>Choose your Alias</h2>
      <p>
        Your Alias is your public name on Hearthtable and part of the address of
        everything you make, for example{" "}
        <code>/{trimmed || "Your_Alias"}/Characters/…</code>. Your Google name
        and email are never shown.
      </p>
      <p className="muted">
        4–32 letters, digits, underscores (_) and hyphens (-). Capitals do not
        make a different Alias, and _ and - count as the same, but the capitals
        you type are kept.{" "}
        <strong>An Alias cannot be changed once chosen.</strong>
      </p>
      <div className="alias-row">
        <input
          type="text"
          aria-label="Alias"
          value={alias}
          maxLength={40}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setAlias(e.target.value);
            setRefusal(undefined);
          }}
        />
        <button
          type="submit"
          className="primary"
          disabled={busy || !trimmed || !!problem}
        >
          {busy ? "Saving…" : trimmed ? `Choose ${trimmed}` : "Choose"}
        </button>
      </div>
      {problem && <p className="unresolved">{problem}</p>}
      {refusal && <div className="error-box">{refusal}</div>}
    </form>
  );
}
