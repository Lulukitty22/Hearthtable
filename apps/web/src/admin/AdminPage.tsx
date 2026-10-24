// /Admin: site administrators approve accounts waiting for approval (Campaigns and Shared Data,
// Site administration). Rules allow only an administrator to make this change.

import {
  approveAccount,
  watchPendingAccounts,
  type Account,
} from "@hearthtable/storage";
import { useEffect, useState } from "react";
import type { Viewer } from "../account/useViewer";
import { db } from "../firebase";

export function AdminPage({ viewer }: { viewer: Viewer }) {
  if (viewer.status === "loading" || viewer.status === "signed-in")
    return <main className="page muted">Loading…</main>;
  if (viewer.status !== "account" || !viewer.account.admin)
    return (
      <main className="page">
        <div className="error-box">
          This page is for site administrators. Sign in with an administrator
          account to approve accounts.
        </div>
      </main>
    );
  return <Approvals adminUid={viewer.account.uid} />;
}

function Approvals({ adminUid }: { adminUid: string }) {
  const [pending, setPending] = useState<readonly Account[] | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  const [busy, setBusy] = useState<string | undefined>();

  useEffect(
    () =>
      watchPendingAccounts(db, setPending, (message) => setFailure(message)),
    [],
  );

  return (
    <main className="page">
      <h1>Approvals</h1>
      <p className="muted">
        Accounts with an Alias that are waiting for approval. Approved accounts
        can create characters, campaigns and custom entries, and ask to join
        campaigns.
      </p>
      {failure && <div className="error-box">{failure}</div>}
      {pending === undefined && !failure && <p className="muted">Loading…</p>}
      {pending?.length === 0 && (
        <p className="panel">No accounts are waiting for approval.</p>
      )}
      {pending && pending.length > 0 && (
        <ul
          className="approval-list"
          aria-label="Accounts waiting for approval"
        >
          {pending.map((account) => (
            <li key={account.uid} className="panel">
              <strong>{account.alias}</strong>
              <span className="muted">
                {account.createdAt
                  ? `chose this Alias ${new Date(account.createdAt).toLocaleString()}`
                  : ""}
              </span>
              <button
                type="button"
                className="primary"
                disabled={busy === account.uid}
                onClick={async () => {
                  setBusy(account.uid);
                  setFailure(await approveAccount(db, adminUid, account.uid));
                  setBusy(undefined);
                }}
              >
                Approve {account.alias}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
