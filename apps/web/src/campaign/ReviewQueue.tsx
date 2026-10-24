// The DM review queue (Milestone 4, S7) on a campaign's page. DMs see every proposal with what it
// would change and accept or reject it; accepting saves exactly the proposed records (refused as a
// conflict if they changed since) with a history entry for a character, then deletes what the
// proposal deletes. Members see their own proposals and can withdraw them.

import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  differences,
  removeProposal,
  watchProposals,
  type Campaign,
  type Proposal,
} from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { useAliases } from "../account/useAliases";
import { db, repository } from "../firebase";
import { historyRecord } from "../history";
import { webPathFor } from "../routes";

const WHAT: Record<Proposal["kind"], string> = {
  edit: "Changes to",
  delete: "Delete",
  replace: "Replace",
  entry: "New entry",
};

const nameOf = (r: RecordEnvelope | undefined) =>
  String((r?.data as { name?: unknown } | undefined)?.name ?? "");

export function ReviewQueue({
  campaign,
  uid,
  isDm,
  dmAlias,
  onAccepted,
}: {
  campaign: Campaign;
  uid: string;
  isDm: boolean;
  dmAlias: string;
  onAccepted: () => void;
}) {
  const [proposals, setProposals] = useState<readonly Proposal[]>([]);
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(
    () => watchProposals(db, campaign.id, uid, isDm, setProposals, setFailure),
    [campaign.id, uid, isDm],
  );
  const authors = useAliases(proposals.map((p) => p.by));

  if (proposals.length === 0 && !failure && !isDm) return null;
  return (
    <section
      className="panel campaign-section"
      aria-label={isDm ? "Review queue" : "Your proposals"}
    >
      <h2>
        {isDm ? "Review queue" : "Your proposals"} ({proposals.length})
      </h2>
      {failure && <div className="error-box">{failure}</div>}
      {proposals.length === 0 && (
        <p className="muted">Nothing is waiting for a DM.</p>
      )}
      <ul className="member-list" aria-label="Proposals">
        {proposals.map((p) => (
          <ProposalRow
            key={p.id}
            proposal={p}
            author={authors.get(p.by) ?? "…"}
            campaign={campaign}
            isDm={isDm}
            own={p.by === uid}
            dmAlias={dmAlias}
            onAccepted={onAccepted}
          />
        ))}
      </ul>
    </section>
  );
}

function ProposalRow({
  proposal: p,
  author,
  campaign,
  isDm,
  own,
  dmAlias,
  onAccepted,
}: {
  proposal: Proposal;
  author: string;
  campaign: Campaign;
  isDm: boolean;
  own: boolean;
  dmAlias: string;
  onAccepted: () => void;
}) {
  const [current, setCurrent] = useState<ReadonlyMap<string, RecordEnvelope>>();
  const [failure, setFailure] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void repository.listUnder(p.target).then((r) => {
      if (!cancelled && r.ok)
        setCurrent(new Map(r.value.map((x) => [x.id as string, x])));
    });
    return () => {
      cancelled = true;
    };
  }, [p.target]);

  const targetName =
    nameOf(current?.get(p.target)) ||
    nameOf(p.writes.find((w) => w.id === p.target)) ||
    p.target.split("/").at(-1)?.replaceAll("_", " ");
  const character = p.kind !== "entry";

  const accept = async () => {
    setBusy(true);
    const now = new Date().toISOString();
    const writes = [...p.writes];
    if (character && p.kind !== "delete") {
      const origin = current?.get(p.target)?.origin ??
        p.writes[0]?.origin ?? { scope: "campaign" as const };
      writes.push(
        historyRecord(
          p.target,
          origin,
          p.writes.map((w) => w.id),
          `${WHAT[p.kind]} proposed by ${author}${p.note ? `: ${p.note}` : ""}; accepted by ${dmAlias}.`,
          now,
        ),
      );
    }
    if (writes.length > 0) {
      const saved = await repository.save(writes, { now });
      if (!saved.ok) {
        setBusy(false);
        return setFailure(
          saved.errors.some((e) => e.code === "conflict")
            ? "This changed after it was proposed, so it cannot be applied as it is. Reject it and ask for a new proposal."
            : saved.errors.map((e) => e.message).join(" "),
        );
      }
    }
    if (p.deletes.length > 0) {
      const deleted = await repository.deleteAll(p.deletes);
      if (!deleted.ok) {
        setBusy(false);
        return setFailure(deleted.errors.map((e) => e.message).join(" "));
      }
    }
    setFailure(await removeProposal(db, campaign.id, p.id));
    setBusy(false);
    onAccepted();
  };

  return (
    <li
      className="member proposal"
      aria-label={`${WHAT[p.kind]} ${targetName}`}
    >
      <strong>
        {WHAT[p.kind]}{" "}
        {p.kind === "delete" ? (
          targetName
        ) : (
          <a className="entry-link" href={webPathFor(p.target)}>
            {targetName}
          </a>
        )}
      </strong>
      <span className="muted">from {author}</span>
      {p.note && <span>“{p.note}”</span>}
      <span className="chips member-actions">
        {isDm && (
          <button
            type="button"
            className="primary"
            disabled={busy}
            onClick={() => void accept()}
          >
            Accept
          </button>
        )}
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={async () =>
            setFailure(await removeProposal(db, campaign.id, p.id))
          }
        >
          {own && !isDm ? "Withdraw" : "Reject"}
        </button>
      </span>
      <ul className="proposal-details">
        {p.kind === "delete" && (
          <li>{p.deletes.length} records: the sheet, its tabs and history</li>
        )}
        {p.kind === "replace" && (
          <li>
            With a new copy: {p.writes.length} records written,{" "}
            {p.deletes.length} removed
          </li>
        )}
        {p.kind === "entry" &&
          p.writes.map((w) => (
            <li key={w.id}>
              {w.kind} “{nameOf(w)}” at <code>{webPathFor(w.id)}</code>
              {typeof (w.data as { description?: unknown }).description ===
                "string" && (
                <>: {(w.data as { description: string }).description}</>
              )}
            </li>
          ))}
        {p.kind === "edit" &&
          p.writes.map((w) =>
            differences(current?.get(w.id)?.data, w.data).map((line) => (
              <li key={`${w.id}:${line}`}>
                <span className="muted">
                  {w.id.slice(p.target.length + 1) || "Sheet"}
                </span>{" "}
                {line}
              </li>
            )),
          )}
      </ul>
      {failure && <div className="error-box">{failure}</div>}
    </li>
  );
}
