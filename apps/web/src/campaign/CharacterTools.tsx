// Tools under a character sheet for its owner (Milestone 4, S6):
// - an account character can be copied into a campaign the owner belongs to; the copy waits for a
//   DM's approval (Campaigns and Shared Data, Character placement: copy only);
// - a campaign character can be copied back into the owner's account, 1:1, with its references
//   unchanged, so it keeps using the campaign's entries (the one-way definition gate);
// - a campaign character's owner chooses which members may control it (Delegated character
//   control). Control lets a delegate propose edits (S7) and act in play (Milestone 5).

import {
  campaignsOf,
  requestInsertion,
  setDelegates,
  watchDelegates,
  type Campaign,
} from "@hearthtable/storage";
import type { RecordEnvelope } from "@hearthtable/kernel";
import { useEffect, useState } from "react";
import {
  campaignOwnerAliasOf,
  isAlias,
  ownerAliasOf,
} from "../account/permissions";
import { useAliases } from "../account/useAliases";
import type { Viewer } from "../account/useViewer";
import { db, repository } from "../firebase";
import { childrenOf, copiedRecords, foldersIn } from "../home/entries";
import { displayNameOf, nameProblem, segmentFor } from "../home/names";
import { webPathFor } from "../routes";

export function CharacterTools({
  characterId,
  name,
  viewer,
  campaign,
}: {
  characterId: string;
  name: string;
  viewer: Viewer;
  campaign: Campaign | undefined;
}) {
  if (viewer.status !== "account" || viewer.account.status !== "approved")
    return null;
  const uid = viewer.account.uid;
  if (isAlias(viewer, ownerAliasOf(characterId)))
    return (
      <section className="panel character-tools" aria-label="Character tools">
        <CopyIntoCampaign
          characterId={characterId}
          name={name}
          uid={uid}
          alias={viewer.account.alias}
        />
      </section>
    );
  if (campaign && isAlias(viewer, campaignOwnerAliasOf(characterId)))
    return (
      <section className="panel character-tools" aria-label="Character tools">
        <CopyToAccount
          characterId={characterId}
          name={name}
          alias={viewer.account.alias}
        />
        <Control characterId={characterId} campaign={campaign} owner={uid} />
      </section>
    );
  if (campaign)
    return (
      <DelegateNote characterId={characterId} campaign={campaign} uid={uid} />
    );
  return null;
}

function CopyIntoCampaign({
  characterId,
  name,
  uid,
  alias,
}: {
  characterId: string;
  name: string;
  uid: string;
  alias: string;
}) {
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<readonly Campaign[]>();
  const [target, setTarget] = useState("");
  const [newName, setNewName] = useState(name);
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    void campaignsOf(db, uid).then((list) => {
      setCampaigns(list);
      setTarget((t) => t || (list[0]?.id ?? ""));
    });
  }, [open, uid]);

  if (!open)
    return (
      <p className="chips">
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen(true)}
        >
          Copy into a campaign…
        </button>
      </p>
    );
  const chosen = campaigns?.find((c) => c.id === target);
  const problem = nameProblem(newName, []);
  return (
    <form
      className="entry-form"
      aria-label="Copy into a campaign"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!chosen || problem) return;
        setBusy(true);
        const segment = segmentFor(chosen.name);
        const path = `campaign/${segment}/Characters/${alias}/${segmentFor(newName)}`;
        const [exists, own] = await Promise.all([
          repository.get(path as RecordEnvelope["id"]),
          repository.listUnder(characterId),
        ]);
        if (exists.ok && exists.value) {
          setBusy(false);
          return setMessage(
            `${chosen.name} already has a character of yours called ${newName.trim()}.`,
          );
        }
        if (!own.ok) {
          setBusy(false);
          return setMessage(own.errors.map((x) => x.message).join(" "));
        }
        const failure = await requestInsertion(
          db,
          chosen.id,
          uid,
          newName.trim(),
          path,
          copiedRecords(own.value, characterId, path),
        );
        setBusy(false);
        setMessage(
          failure ??
            `Asked to add ${newName.trim()} to ${chosen.name}; a DM approves it on the campaign's page.`,
        );
      }}
    >
      <h2>Copy into a campaign</h2>
      {campaigns?.length === 0 ? (
        <p className="muted">You are not in any campaign yet.</p>
      ) : (
        <>
          <label>
            Campaign{" "}
            <select
              aria-label="Campaign"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              {campaigns?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Name in the campaign{" "}
            <input
              type="text"
              aria-label="Name in the campaign"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <p className="muted">
            A 1:1 copy. A DM approves it before it joins the campaign. Your own
            account items, spells and features stay outside the campaign: lines
            using them show as missing there until the entries are imported.
          </p>
        </>
      )}
      {problem && <p className="unresolved">{problem}</p>}
      {message && <p role="status">{message}</p>}
      <p className="chips">
        <button
          type="submit"
          className="primary"
          disabled={busy || !chosen || !!problem}
        >
          Ask to add
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </p>
    </form>
  );
}

function CopyToAccount({
  characterId,
  name,
  alias,
}: {
  characterId: string;
  name: string;
  alias: string;
}) {
  const root = `account/${alias}`;
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<readonly RecordEnvelope[]>();
  const [destination, setDestination] = useState(root);
  const [newName, setNewName] = useState(name);
  const [message, setMessage] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    void repository.listUnder(root).then((r) => r.ok && setAccount(r.value));
  }, [open, root]);

  if (!open)
    return (
      <p className="chips">
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen(true)}
        >
          Copy to my account…
        </button>
      </p>
    );
  const folders = account ? foldersIn(root, account) : [root];
  const problem = nameProblem(
    newName,
    account ? childrenOf(destination, account).map((c) => c.segment) : [],
  );
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
      className="entry-form"
      aria-label="Copy to my account"
      onSubmit={async (e) => {
        e.preventDefault();
        if (problem) return;
        setBusy(true);
        const own = await repository.listUnder(characterId);
        const to = `${destination}/${segmentFor(newName)}`;
        const saved = own.ok
          ? await repository.save(copiedRecords(own.value, characterId, to))
          : own;
        setBusy(false);
        if (!saved.ok)
          return setMessage(saved.errors.map((x) => x.message).join(" "));
        window.location.assign(webPathFor(to));
      }}
    >
      <h2>Copy to my account</h2>
      <label>
        Name{" "}
        <input
          type="text"
          aria-label="Name in my account"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
      </label>
      <label>
        Into{" "}
        <select
          aria-label="Destination folder"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        >
          {folders.map((f) => (
            <option key={f} value={f}>
              {label(f)}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">
        A 1:1 copy. It keeps using this campaign's items and other entries.
      </p>
      {problem && <p className="unresolved">{problem}</p>}
      {message && <div className="error-box">{message}</div>}
      <p className="chips">
        <button type="submit" className="primary" disabled={busy || !!problem}>
          Copy
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen(false)}
        >
          Close
        </button>
      </p>
    </form>
  );
}

function Control({
  characterId,
  campaign,
  owner,
}: {
  characterId: string;
  campaign: Campaign;
  owner: string;
}) {
  const [delegates, setDelegatesState] = useState<readonly string[]>([]);
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(
    () =>
      watchDelegates(
        db,
        campaign.id,
        characterId,
        setDelegatesState,
        setFailure,
      ),
    [campaign.id, characterId],
  );
  const others = [...campaign.dms, ...campaign.players].filter(
    (m) => m !== owner,
  );
  const aliases = useAliases(others);
  return (
    <fieldset className="control">
      <legend>Who else may control this character</legend>
      {others.length === 0 && (
        <p className="muted">No one else is in this campaign yet.</p>
      )}
      {others.map((m) => (
        <label key={m} className="control-row">
          <input
            type="checkbox"
            checked={delegates.includes(m)}
            onChange={async (e) =>
              setFailure(
                await setDelegates(
                  db,
                  campaign.id,
                  characterId,
                  e.target.checked
                    ? [...delegates, m]
                    : delegates.filter((d) => d !== m),
                ),
              )
            }
          />{" "}
          {aliases.get(m) ?? "…"}
        </label>
      ))}
      <p className="muted">
        Control lets them propose edits and, later, act for this character in
        play. A DM still approves; control does not reveal private tabs.
        Unticking takes control away at once.
      </p>
      {failure && <div className="error-box">{failure}</div>}
    </fieldset>
  );
}

function DelegateNote({
  characterId,
  campaign,
  uid,
}: {
  characterId: string;
  campaign: Campaign;
  uid: string;
}) {
  const [delegates, setDelegatesState] = useState<readonly string[]>([]);
  useEffect(
    () =>
      watchDelegates(db, campaign.id, characterId, setDelegatesState, () => {}),
    [campaign.id, characterId],
  );
  if (!delegates.includes(uid)) return null;
  return (
    <p className="panel character-tools" role="note">
      <span className="badge good">You may control this character</span>{" "}
      <span className="muted">
        Its owner granted you control in {campaign.name}.
      </span>
    </p>
  );
}
