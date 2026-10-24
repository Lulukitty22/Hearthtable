// Proposing campaign library entries (Milestone 4, S7; Campaigns and Shared Data, Publication and
// approval): a member proposes a new entry made from blank, or imports a copy of one of their own
// account's entries, into the campaign folder they are looking at. A DM accepts or rejects it in
// the review queue. The proposal carries the whole entry, so it is not limited by today's form,
// which only fills in a name and a description.

import type { RecordEnvelope } from "@hearthtable/kernel";
import { propose, type Campaign } from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { db, repository } from "../firebase";
import { copiedRecords, newRecords } from "./entries";
import { nameProblem, segmentFor } from "./names";

type Kind = "item" | "spell" | "feature";
const KINDS: readonly Kind[] = ["item", "spell", "feature"];

export function ProposeEntry({
  campaign,
  uid,
  alias,
  folderPath,
  taken,
}: {
  campaign: Campaign;
  uid: string;
  alias: string;
  folderPath: string;
  taken: readonly string[];
}) {
  const [mode, setMode] = useState<"new" | "import" | undefined>();
  const [kind, setKind] = useState<Kind>("item");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [mine, setMine] = useState<readonly RecordEnvelope[]>();
  const [source, setSource] = useState("");
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode !== "import") return;
    void repository.listUnder(`account/${alias}`).then((r) => {
      if (!r.ok) return;
      const entries = r.value.filter((x) =>
        (KINDS as readonly string[]).includes(x.kind),
      );
      setMine(entries);
      setSource((s) => s || (entries[0]?.id ?? ""));
    });
  }, [mode, alias]);

  const reset = () => {
    setMode(undefined);
    setName("");
    setDescription("");
    setSource("");
  };
  if (!mode)
    return (
      <p className="chips new-menu">
        <span className="muted">Propose to the DMs:</span>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode("new")}
        >
          Propose a new entry
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setMode("import")}
        >
          Import from my account
        </button>
        {message && <span role="status">{message}</span>}
      </p>
    );

  const chosen = mine?.find((r) => r.id === source);
  const shownName =
    name ||
    String((chosen?.data as { name?: unknown } | undefined)?.name ?? "");
  const problem = shownName.trim() ? nameProblem(shownName, taken) : undefined;
  const writes = (): RecordEnvelope[] => {
    const path = `${folderPath}/${segmentFor(shownName)}`;
    if (mode === "import" && chosen)
      return copiedRecords([chosen], chosen.id, path);
    return newRecords(kind, folderPath, "", shownName, description);
  };

  return (
    <form
      className="panel entry-form"
      aria-label={
        mode === "new" ? "Propose a new entry" : "Import from my account"
      }
      onSubmit={async (e) => {
        e.preventDefault();
        if (!shownName.trim() || problem || (mode === "import" && !chosen))
          return;
        setBusy(true);
        const target = `${folderPath}/${segmentFor(shownName)}`;
        const failure = await propose(db, campaign.id, {
          kind: "entry",
          by: uid,
          target,
          note: "",
          writes: writes(),
          deletes: [],
        });
        setBusy(false);
        if (failure) return setMessage(failure);
        reset();
        setMessage(`Proposed ${shownName.trim()}; a DM accepts or rejects it.`);
      }}
    >
      <h2>
        {mode === "new" ? "Propose a new entry" : "Import from my account"}
      </h2>
      {mode === "new" ? (
        <>
          <label>
            Kind{" "}
            <select
              aria-label="Kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name{" "}
            <input
              type="text"
              aria-label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Description
            <textarea
              aria-label="Description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </>
      ) : mine?.length === 0 ? (
        <p className="muted">Your account has no items, spells or features.</p>
      ) : (
        <>
          <label>
            Entry{" "}
            <select
              aria-label="Entry from my account"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setName("");
              }}
            >
              {mine?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.kind}:{" "}
                  {String((r.data as { name?: unknown }).name ?? r.id)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name in the campaign{" "}
            <input
              type="text"
              aria-label="Name in the campaign"
              value={shownName}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="muted">
            The campaign gets its own copy; your account keeps the original.
          </p>
        </>
      )}
      <p className="muted">It goes into this folder once a DM accepts it.</p>
      {problem && <p className="unresolved">{problem}</p>}
      {message && <div className="error-box">{message}</div>}
      <p className="chips">
        <button
          type="submit"
          className="primary"
          disabled={busy || !shownName.trim() || !!problem}
        >
          Propose
        </button>
        <button type="button" className="secondary" onClick={reset}>
          Cancel
        </button>
      </p>
    </form>
  );
}
