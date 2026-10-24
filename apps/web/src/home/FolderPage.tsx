// An account's home and its folders (Milestone 4, S4): /Accounts/<Alias> and every folder under
// it. Anyone may look; the account's approved owner also gets New (folder, character, campaign,
// item, spell, feature), Copy as (a new name and a destination folder) and Delete. A new campaign
// is created in campaign storage with its creator as first DM, and a link to it is placed in the
// folder (S5; Campaigns and Shared Data, Creating a campaign). Nothing is renamed
// or moved: copying and then deleting the original is how something changes place
// (Campaigns and Shared Data, Character placement: copy only).

import type { RecordEnvelope } from "@hearthtable/kernel";
import { createCampaign, type Campaign } from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { canEditRecord } from "../account/permissions";
import type { Viewer } from "../account/useViewer";
import { useCampaign } from "../campaign/useCampaign";
import { ProposeEntry } from "./ProposeEntry";
import { db, repository } from "../firebase";
import { webPathFor } from "../routes";
import {
  childrenOf,
  copiedRecords,
  foldersIn,
  newRecords,
  NEW_KINDS,
  subtree,
  type EntryKind,
  type FolderEntry,
} from "./entries";
import { displayNameOf, nameProblem, segmentFor } from "./names";

const KIND_LABEL: Record<FolderEntry["kind"], string> = {
  folder: "Folder",
  character: "Character",
  campaign: "Campaign",
  item: "Item",
  spell: "Spell",
  feature: "Feature",
  other: "Entry",
};

/** "Home / Characters / Mages" with links, for a folder path inside an account or campaign. */
export function Breadcrumb({ path }: { path: string }) {
  const [scope, owner, ...rest] = path.split("/");
  const root = `${scope}/${owner}`;
  const crumbs = rest.map((segment, i) => ({
    path: [root, ...rest.slice(0, i + 1)].join("/"),
    name: displayNameOf(segment),
  }));
  return (
    <nav className="breadcrumb" aria-label="Folder path">
      <a href={webPathFor(root)}>
        {scope === "campaign"
          ? displayNameOf(owner ?? "")
          : `${owner ?? ""}'s home`}
      </a>
      {crumbs.map((c) => (
        <span key={c.path}>
          {" / "}
          <a href={webPathFor(c.path)}>{c.name}</a>
        </span>
      ))}
    </nav>
  );
}

/** The records of an account or campaign, reloadable after a change. */
function useScopeRecords(root: string) {
  const [records, setRecords] = useState<
    readonly RecordEnvelope[] | undefined
  >();
  const [failure, setFailure] = useState<string | undefined>();
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void repository.listUnder(root).then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setRecords(r.value);
        setFailure(undefined);
      } else setFailure(r.errors.map((e) => e.message).join(" "));
    });
    return () => {
      cancelled = true;
    };
  }, [root, generation]);
  return { records, failure, reload: () => setGeneration((g) => g + 1) };
}

export function FolderPage({ path, viewer }: { path: string; viewer: Viewer }) {
  const root = path.split("/").slice(0, 2).join("/");
  const inCampaign = path.startsWith("campaign/");
  const { campaign } = useCampaign(inCampaign ? path.split("/")[1] : undefined);
  const { records, failure, reload } = useScopeRecords(root);
  const owner = root.split("/")[1] ?? "";

  if (failure)
    return (
      <main className="page">
        <div className="error-box">{failure}</div>
      </main>
    );
  if (!records) return <main className="page muted">Loading…</main>;

  const own = records.find((r) => r.id === path);
  const children = childrenOf(path, records);
  const exists = path === root || own?.kind === "folder" || children.length > 0;
  if (!exists && !own)
    return (
      <main className="page">
        <Breadcrumb path={path} />
        <div className="error-box">There is no folder here.</div>
      </main>
    );

  const title =
    path === root
      ? `${owner}'s home`
      : String(
          (own?.data as { name?: unknown } | undefined)?.name ??
            displayNameOf(path.split("/").at(-1) ?? ""),
        );

  return (
    <main className="page">
      <Breadcrumb path={path} />
      <h1>{title}</h1>
      <FolderBody
        path={path}
        title={title}
        records={records}
        viewer={viewer}
        campaign={campaign ?? undefined}
        onChange={reload}
      />
    </main>
  );
}

/**
 * A folder's contents with New, Copy as and Delete for whoever may change them. In a campaign
 * (S7) DMs create folders and entries directly, and members propose new entries or imports from
 * their account, which a DM accepts in the review queue. `exclude` hides entries by name, such as
 * the Characters folder on a campaign's page.
 */
export function FolderBody({
  path,
  title,
  records,
  viewer,
  campaign,
  onChange,
  exclude = [],
}: {
  path: string;
  title: string;
  records: readonly RecordEnvelope[];
  viewer: Viewer;
  campaign: Campaign | undefined;
  onChange: () => void;
  exclude?: readonly string[];
}) {
  const root = path.split("/").slice(0, 2).join("/");
  const inCampaign = path.startsWith("campaign/");
  const canEdit = canEditRecord(viewer, path, campaign);
  const uid = viewer.status === "account" ? viewer.account.uid : undefined;
  const member =
    !!campaign &&
    !!uid &&
    viewer.status === "account" &&
    viewer.account.status === "approved" &&
    (campaign.dms.includes(uid) || campaign.players.includes(uid));
  const children = childrenOf(path, records).filter(
    (c) => !exclude.includes(c.segment),
  );
  const taken = childrenOf(path, records).map((c) => c.segment);
  return (
    <>
      {canEdit && uid && (
        <NewEntry
          uid={uid}
          folderPath={path}
          owner={root.split("/")[1] ?? ""}
          taken={taken}
          kinds={
            inCampaign
              ? NEW_KINDS.filter((k) => k !== "character" && k !== "campaign")
              : NEW_KINDS
          }
          onDone={onChange}
        />
      )}
      {member && campaign && uid && viewer.status === "account" && (
        <ProposeEntry
          campaign={campaign}
          uid={uid}
          alias={viewer.account.alias}
          folderPath={path}
          taken={taken}
        />
      )}
      {children.length === 0 ? (
        <p className="panel muted">This folder is empty.</p>
      ) : (
        <ul className="folder-list" aria-label={`Contents of ${title}`}>
          {children.map((entry) => (
            <EntryRow
              key={entry.path}
              entry={entry}
              records={records}
              root={root}
              canEdit={canEdit}
              onDone={onChange}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function NewEntry({
  uid,
  folderPath,
  owner,
  taken,
  kinds,
  onDone,
}: {
  uid: string;
  folderPath: string;
  owner: string;
  taken: readonly string[];
  kinds: readonly EntryKind[];
  onDone: () => void;
}) {
  const [kind, setKind] = useState<EntryKind | undefined>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [failure, setFailure] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const problem = name.trim() ? nameProblem(name, taken) : undefined;
  const reset = () => {
    setKind(undefined);
    setName("");
    setDescription("");
    setFailure(undefined);
  };

  if (!kind)
    return (
      <p className="chips new-menu">
        <span className="muted">New:</span>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            className="secondary"
            onClick={() => setKind(k)}
          >
            New {KIND_LABEL[k].toLowerCase()}
          </button>
        ))}
      </p>
    );

  const custom = kind === "item" || kind === "spell" || kind === "feature";
  return (
    <form
      className="panel entry-form"
      aria-label={`New ${KIND_LABEL[kind].toLowerCase()}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim() || problem) return;
        setBusy(true);
        if (kind === "campaign") {
          const segment = segmentFor(name);
          const made = await createCampaign(db, uid, segment, name.trim());
          if (!made.ok) {
            setBusy(false);
            return setFailure(made.message);
          }
        }
        const saved = await repository.save(
          newRecords(kind, folderPath, owner, name, description),
        );
        setBusy(false);
        if (!saved.ok)
          return setFailure(saved.errors.map((x) => x.message).join(" "));
        if (kind === "campaign")
          return window.location.assign(
            webPathFor(`campaign/${segmentFor(name)}`),
          );
        reset();
        onDone();
      }}
    >
      <h2>New {KIND_LABEL[kind].toLowerCase()}</h2>
      {kind === "character" && (
        <p className="muted">
          A blank sheet with only a name. Classes, species and abilities are
          filled in by the character creator, which comes in a later milestone.
        </p>
      )}
      {kind === "campaign" && (
        <p className="muted">
          You become its first DM. The campaign lives in shared campaign storage
          at /Campaigns/{segmentFor(name) || "Name"}; this folder gets a link to
          it.
        </p>
      )}
      {custom && (
        <p className="muted">
          A name and a description only; game details (and any bonuses) come
          with a later milestone.
        </p>
      )}
      <label>
        Name{" "}
        <input
          type="text"
          aria-label="Name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      {custom && (
        <label>
          Description
          <textarea
            aria-label="Description"
            value={description}
            rows={4}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      )}
      {problem && <p className="unresolved">{problem}</p>}
      {failure && <div className="error-box">{failure}</div>}
      <p className="chips">
        <button
          type="submit"
          className="primary"
          disabled={busy || !name.trim() || !!problem}
        >
          Create
        </button>
        <button type="button" className="secondary" onClick={reset}>
          Cancel
        </button>
      </p>
    </form>
  );
}

function EntryRow({
  entry,
  records,
  root,
  canEdit,
  onDone,
}: {
  entry: FolderEntry;
  records: readonly RecordEnvelope[];
  root: string;
  canEdit: boolean;
  onDone: () => void;
}) {
  const [action, setAction] = useState<"copy" | "delete" | undefined>();
  return (
    <li className="panel folder-entry">
      <span className="badge">{KIND_LABEL[entry.kind]}</span>
      <a className="entry-link" href={webPathFor(entry.campaign ?? entry.path)}>
        {entry.name}
      </a>
      {canEdit && !action && (
        <span className="chips entry-actions">
          <button
            type="button"
            className="secondary"
            onClick={() => setAction("copy")}
          >
            Copy as…
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setAction("delete")}
          >
            Delete…
          </button>
        </span>
      )}
      {action === "copy" && (
        <CopyAs
          entry={entry}
          records={records}
          root={root}
          onClose={() => setAction(undefined)}
          onDone={onDone}
        />
      )}
      {action === "delete" && (
        <Delete
          entry={entry}
          records={records}
          onClose={() => setAction(undefined)}
          onDone={onDone}
        />
      )}
    </li>
  );
}

function CopyAs({
  entry,
  records,
  root,
  onClose,
  onDone,
}: {
  entry: FolderEntry;
  records: readonly RecordEnvelope[];
  root: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const parent = entry.path.split("/").slice(0, -1).join("/");
  // A folder cannot be copied into itself.
  const destinations = foldersIn(root, records).filter(
    (f) =>
      f !== entry.path &&
      !f.startsWith(`${entry.path}/`) &&
      !(root.startsWith("campaign/") && f.startsWith(`${root}/Characters`)),
  );
  const [name, setName] = useState(entry.name);
  const [destination, setDestination] = useState(parent);
  const [failure, setFailure] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const taken = childrenOf(destination, records).map((c) => c.segment);
  const problem = nameProblem(name, taken);
  const label = (f: string) =>
    f === root
      ? "Home"
      : `Home / ${f
          .slice(root.length + 1)
          .split("/")
          .map(displayNameOf)
          .join(" / ")}`;

  return (
    <form
      className="entry-form inline"
      aria-label={`Copy ${entry.name} as`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (problem) return;
        setBusy(true);
        const saved = await repository.save(
          copiedRecords(
            records,
            entry.path,
            `${destination}/${segmentFor(name)}`,
          ),
        );
        setBusy(false);
        if (!saved.ok)
          return setFailure(saved.errors.map((x) => x.message).join(" "));
        onClose();
        onDone();
      }}
    >
      <label>
        New name{" "}
        <input
          type="text"
          aria-label="New name"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Into{" "}
        <select
          aria-label="Destination folder"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        >
          {destinations.map((f) => (
            <option key={f} value={f}>
              {label(f)}
            </option>
          ))}
        </select>
      </label>
      <span className="muted">
        A 1:1 copy; the original stays until you delete it.
      </span>
      {problem && <p className="unresolved">{problem}</p>}
      {failure && <div className="error-box">{failure}</div>}
      <span className="chips">
        <button type="submit" className="primary" disabled={busy || !!problem}>
          Copy
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </span>
    </form>
  );
}

function Delete({
  entry,
  records,
  onClose,
  onDone,
}: {
  entry: FolderEntry;
  records: readonly RecordEnvelope[];
  onClose: () => void;
  onDone: () => void;
}) {
  const doomed = subtree(entry.path, records);
  const [typed, setTyped] = useState("");
  const [failure, setFailure] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const folder = entry.kind === "folder";
  const inside = folder ? childrenOf(entry.path, records) : [];
  const counts = new Map<string, number>();
  for (const r of doomed)
    if (
      r.id !== entry.path &&
      ["character", "item", "spell", "feature", "folder"].includes(r.kind)
    )
      counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
  const summary = [...counts.entries()]
    .map(([k, n]) => `${n} ${k}${n === 1 ? "" : "s"}`)
    .join(", ");
  const confirmed = !folder || inside.length === 0 || typed === entry.name;

  return (
    <div
      className="entry-form inline delete-confirm"
      role="alertdialog"
      aria-label={`Delete ${entry.name}`}
    >
      <p>
        {folder && inside.length > 0
          ? `Delete ${entry.name} and everything in it (${summary})? This cannot be undone.`
          : entry.kind === "character"
            ? `Delete ${entry.name}, with its inventory, books and history? This cannot be undone.`
            : entry.kind === "campaign"
              ? `Remove the link to ${entry.name} from this folder? The campaign itself stays.`
              : `Delete ${entry.name}? This cannot be undone.`}{" "}
        Anything elsewhere that refers to it will show "Reference not found".
      </p>
      {folder && inside.length > 0 && (
        <label>
          Type <strong>{entry.name}</strong> to confirm{" "}
          <input
            type="text"
            aria-label="Folder name to confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      )}
      {failure && <div className="error-box">{failure}</div>}
      <span className="chips">
        <button
          type="button"
          className="primary danger"
          disabled={busy || !confirmed}
          onClick={async () => {
            setBusy(true);
            const deleted = await repository.deleteAll(
              doomed.map((r) => ({ id: r.id, revision: r.revision })),
            );
            setBusy(false);
            if (!deleted.ok)
              return setFailure(deleted.errors.map((x) => x.message).join(" "));
            onClose();
            onDone();
          }}
        >
          Delete
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          Cancel
        </button>
      </span>
    </div>
  );
}
