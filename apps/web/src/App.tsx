// Character sheets read from and saved to the local emulator. Addresses follow record paths
// (routes.ts): /Accounts/VR_Lulu/Characters/Carol_Elfnein shows the record
// account/VR_Lulu/Characters/Carol_Elfnein, and /Campaigns/<name>/… a campaign's copy. A
// character's address shows it read-only, with an Edit button for whoever may edit it; its /Edit
// address is the editor (user decision, 2026-10-24).
// Tabs come from the systems: each module lists the tabs it provides (`provides.uiTabs`), and
// the app shows the tabs of the modules the ruleset enables, in a fixed order. A tab a module
// declares but this app cannot draw is shown as unavailable rather than hidden.

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import { lookUpInvite, propose, type Campaign } from "@hearthtable/storage";
import { AccountBar } from "./account/AccountBar";
import {
  campaignOwnerAliasOf,
  canEditRecord,
  isAlias,
  ownerAliasOf,
} from "./account/permissions";
import { useViewer, type Viewer } from "./account/useViewer";
import { CampaignPage } from "./campaign/CampaignPage";
import { CharacterTools } from "./campaign/CharacterTools";
import { useCampaign, useDelegates } from "./campaign/useCampaign";
import { AdminPage } from "./admin/AdminPage";
import { db, repository } from "./firebase";
import { EntryPage } from "./home/EntryPage";
import { FolderPage } from "./home/FolderPage";
import { segmentFor } from "./home/names";
import { parseRoute, webPathFor, type View as RouteView } from "./routes";
import { FeaturesTab } from "./sheet/FeaturesTab";
import { Header } from "./sheet/Header";
import { EntryProvider } from "./sheet/entries";
import { Draggable } from "./sheet/Grid";
import { InventoryTab } from "./sheet/InventoryTab";
import { SpellsTab } from "./sheet/SpellsTab";
import { StatsTab } from "./sheet/StatsTab";
import type { TabProps } from "./sheet/shared";
import { engine, useSheet, type HistoryEntry, type Submit } from "./useSheet";

/** Joining with only a code: look up its campaign and open that page with the code filled in. */
function JoinWithCode() {
  const [code, setCode] = useState("");
  const [failure, setFailure] = useState<string | undefined>();
  return (
    <form
      className="panel entry-form"
      aria-label="Join a campaign"
      onSubmit={async (e) => {
        e.preventDefault();
        const invite = await lookUpInvite(db, code).catch(() => undefined);
        if (!invite)
          return setFailure(
            "That code does not match a campaign. Sign in first, and check the code with a DM.",
          );
        // The campaign's address comes from its name, as when it was created.
        const page = webPathFor(`campaign/${segmentFor(invite.name)}`);
        const invited = encodeURIComponent(code.trim().toUpperCase());
        window.location.assign(`${page}?invite=${invited}`);
      }}
    >
      <h2>Join a campaign</h2>
      <label>
        Invite code{" "}
        <input
          type="text"
          aria-label="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <p>
        <button type="submit" className="primary" disabled={!code.trim()}>
          Find the campaign
        </button>
      </p>
      {failure && <div className="error-box">{failure}</div>}
    </form>
  );
}

function Home() {
  const [characters, setCharacters] = useState<
    readonly RecordEnvelope[] | undefined
  >();
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(() => {
    void Promise.all([
      repository.listUnder("account"),
      repository.listUnder("campaign"),
    ]).then((lists) => {
      const failed = lists.flatMap((r) => (r.ok ? [] : r.errors));
      if (failed.length > 0)
        return setFailure(failed.map((e) => e.message).join(" "));
      setCharacters(
        lists.flatMap((r) =>
          r.ok ? r.value.filter((x) => x.kind === "character") : [],
        ),
      );
    });
  }, []);
  return (
    <main className="page">
      <h1>Hearthtable</h1>
      <JoinWithCode />
      {failure && (
        <div className="error-box">
          Could not reach the emulator. Is <code>pnpm emulators</code> running?
          <pre>{failure}</pre>
        </div>
      )}
      {characters === undefined && !failure && (
        <p className="muted">Loading characters…</p>
      )}
      {characters?.length === 0 && (
        <p className="muted">
          No characters yet. With <code>pnpm emulators</code> running, run{" "}
          <code>pnpm seed</code>.
        </p>
      )}
      <ul>
        {characters?.map((c) => (
          <li key={c.id}>
            <a className="entry-link" href={webPathFor(c.id)}>
              {String((c.data as { name?: unknown }).name ?? c.id)}
            </a>{" "}
            <span className="muted">{webPathFor(c.id)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

const TAB_VIEWS: Record<
  string,
  { label: string; order: number; view: ComponentType<TabProps> }
> = {
  stats: { label: "Stats", order: 1, view: StatsTab },
  inventory: { label: "Inventory", order: 2, view: InventoryTab },
  spells: { label: "Spells & Books", order: 3, view: SpellsTab },
  features: { label: "Features", order: 4, view: FeaturesTab },
};

function sheetTabs(): readonly string[] {
  const ids: string[] = [];
  for (const [id, manifest] of engine.registry.modules) {
    if (!engine.settings.isEnabled(id) && id !== engine.settings.ruleset.game)
      continue;
    ids.push(...(manifest.provides.uiTabs ?? []));
  }
  return ids.sort(
    (a, b) => (TAB_VIEWS[a]?.order ?? 99) - (TAB_VIEWS[b]?.order ?? 99),
  );
}

function History({ entries }: { entries: readonly HistoryEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <details className="panel notes" style={{ marginTop: 14 }}>
      <summary>History ({entries.length} saves)</summary>
      <ul>
        {entries.slice(0, 50).map((h) => (
          <li key={h.id}>
            <span className="muted">{new Date(h.at).toLocaleString()}</span> —{" "}
            {h.note ?? <span className="muted">no note</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function App() {
  const route = parseRoute(window.location.pathname);
  const viewer = useViewer();
  return (
    <>
      <AccountBar viewer={viewer} />
      {route.kind === "admin" && <AdminPage viewer={viewer} />}
      {route.kind === "home" && <Home />}
      {route.kind === "record" && (
        <RecordPage path={route.path} view={route.view} viewer={viewer} />
      )}
      {route.kind === "unknown" && <NotFound />}
    </>
  );
}

/**
 * What an address shows depends on what is stored there (Milestone 4, S4): an account's home or a
 * folder, a character sheet, a custom entry, or a link to a campaign. /Campaigns/<name> is the
 * campaign's page (S5); deeper campaign addresses open sheets.
 */
function RecordPage({
  path,
  view,
  viewer,
}: {
  path: string;
  view: RouteView;
  viewer: Viewer;
}) {
  const segments = path.split("/");
  const isAccountPath = segments[0] === "account";
  const isCampaignPage = !isAccountPath && segments.length === 2;
  const [found, setFound] = useState<
    { path: string; record: RecordEnvelope | undefined } | undefined
  >();
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(() => {
    if (segments.length <= 2) return;
    let cancelled = false;
    void repository.get(path as RecordId).then((r) => {
      if (cancelled) return;
      if (r.ok) setFound({ path, record: r.value });
      else setFailure(r.errors.map((e) => e.message).join(" "));
    });
    return () => {
      cancelled = true;
    };
  }, [path, segments.length]);

  if (isCampaignPage && segments[1])
    return <CampaignPage segment={segments[1]} viewer={viewer} />;
  if (segments.length <= 2) return <FolderPage path={path} viewer={viewer} />;
  if (failure)
    return (
      <main className="page">
        <div className="error-box">{failure}</div>
      </main>
    );
  if (found?.path !== path) return <main className="page muted">Loading…</main>;
  const kind = found.record?.kind;
  if (kind === "character")
    return isAccountPath ? (
      <Sheet characterId={path} view={view} viewer={viewer} />
    ) : (
      <CampaignSheet path={path} view={view} viewer={viewer} />
    );
  if (
    found.record &&
    (kind === "item" || kind === "spell" || kind === "feature")
  )
    return <EntryPage record={found.record} />;
  if (kind === "campaign-link") {
    const target = (found.record?.data as { campaign?: unknown }).campaign;
    if (typeof target === "string") {
      window.location.replace(webPathFor(target));
      return <main className="page muted">Opening the campaign…</main>;
    }
  }
  // A folder record, or a path with entries below it (an ordinary folder without a record).
  return <FolderPage path={path} viewer={viewer} />;
}

/** A campaign character's sheet, with its campaign (for who are DMs and members). */
function CampaignSheet({
  path,
  view,
  viewer,
}: {
  path: string;
  view: RouteView;
  viewer: Viewer;
}) {
  const { campaign } = useCampaign(path.split("/")[1]);
  return (
    <Sheet
      characterId={path}
      view={view}
      viewer={viewer}
      campaign={campaign ?? undefined}
    />
  );
}

function NotFound() {
  return (
    <main className="page">
      <div className="error-box">
        There is no page at <code>{window.location.pathname}</code>. Characters
        are at addresses like{" "}
        <code>/Accounts/VR_Lulu/Characters/Carol_Elfnein</code>; go back to the{" "}
        <a href="/">list of characters</a>.
      </div>
    </main>
  );
}

/** Above the sheet: Edit on the view-only sheet, Done while editing, or why editing is not open. */
function ModeBar({
  characterId,
  editing,
  allowed,
  proposer,
  viewer,
  dirty,
}: {
  characterId: string;
  editing: boolean;
  allowed: boolean;
  proposer: boolean;
  viewer: Viewer;
  dirty: boolean;
}) {
  // Campaign characters are edited by DMs in DM mode, entered explicitly (Campaignless and solo
  // authority: holding DM permission does not put anyone in DM mode by itself).
  const inCampaign = characterId.startsWith("campaign/");
  if (editing && (allowed || proposer))
    return (
      <div className="mode-bar">
        <span className="badge good">
          {allowed
            ? inCampaign
              ? "DM mode"
              : "Editing"
            : "Proposing changes: a DM approves them"}
        </span>
        <a
          className="secondary button-link"
          href={webPathFor(characterId)}
          onClick={(e) => {
            if (
              dirty &&
              !window.confirm("Leave without saving? Unsaved changes are lost.")
            )
              e.preventDefault();
          }}
        >
          Done
        </a>
      </div>
    );
  if (allowed || proposer)
    return (
      <div className="mode-bar">
        <a
          className="primary button-link"
          href={webPathFor(characterId, "edit")}
        >
          {allowed
            ? inCampaign
              ? "Edit in DM mode"
              : "Edit"
            : "Propose changes"}
        </a>
      </div>
    );
  if (!editing || viewer.status === "loading" || viewer.status === "signed-in")
    return null;
  const owner = ownerAliasOf(characterId);
  return (
    <p className="panel mode-bar" role="note">
      {owner
        ? `Only ${owner} can edit this character`
        : "Only the campaign's DMs can edit its characters, in DM mode"}
      {owner && viewer.status === "guest" ? "; sign in to edit your own." : "."}{" "}
      It is shown read-only.
    </p>
  );
}

function Sheet({
  characterId,
  view,
  viewer,
  campaign,
}: {
  characterId: string;
  view: RouteView;
  viewer: Viewer;
  campaign?: Campaign | undefined;
}) {
  // Definitions come from core and anywhere in the owner's account or campaign.
  const definitionPaths = useMemo(() => {
    const [scope, owner] = characterId.split("/");
    return ["core", `${scope}/${owner}`];
  }, [characterId]);
  const allowed = canEditRecord(viewer, characterId, campaign);
  // S7: a campaign character's owner, or someone they gave control, proposes changes instead;
  // a DM accepts or rejects them on the campaign page.
  const delegates = useDelegates(campaign?.id, characterId);
  const uid = viewer.status === "account" ? viewer.account.uid : undefined;
  const proposer =
    !allowed &&
    !!campaign &&
    !!uid &&
    viewer.status === "account" &&
    viewer.account.status === "approved" &&
    (campaign.dms.includes(uid) || campaign.players.includes(uid)) &&
    (isAlias(viewer, campaignOwnerAliasOf(characterId)) ||
      delegates.includes(uid));
  const editing = view === "edit";
  const canEdit = editing && (allowed || proposer);
  const submit = useCallback<Submit>(
    (changed, note) =>
      campaign && uid
        ? propose(db, campaign.id, {
            kind: "edit",
            by: uid,
            target: characterId,
            note,
            writes: changed,
            deletes: [],
          })
        : Promise.resolve("Not signed in."),
    [campaign, uid, characterId],
  );
  const [state, actions] = useSheet(
    repository,
    characterId,
    definitionPaths,
    proposer ? submit : undefined,
  );
  const [tab, setTab] = useState("stats");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  if (state.status === "loading")
    return <main className="page muted">Loading from the emulator…</main>;
  if (state.status === "failed") {
    return (
      <main className="page">
        <div className="error-box">
          Could not load from the emulator. Is <code>pnpm emulators</code>{" "}
          running?
          <pre>{state.message}</pre>
        </div>
      </main>
    );
  }
  if (state.status === "missing") {
    return (
      <main className="page">
        <div className="error-box">
          No character is stored at <code>{characterId}</code>. With{" "}
          <code>pnpm emulators</code> running, run <code>pnpm seed</code>, then
          reload, or go back to the <a href="/">list of characters</a>.
        </div>
      </main>
    );
  }

  const props: TabProps = {
    characterId,
    resolved: state.resolved,
    records: state.records,
    edit: actions.edit,
    canEdit,
  };
  const tabs = sheetTabs();
  const current = tabs.includes(tab) ? tab : (tabs[0] ?? "");
  const View = TAB_VIEWS[current]?.view;
  const notes = [...engine.issues, ...state.resolved.issues];

  return (
    <EntryProvider props={props}>
      <Draggable.Provider value={canEdit}>
        <main className="page">
          <ModeBar
            characterId={characterId}
            editing={editing}
            allowed={allowed}
            proposer={proposer}
            viewer={viewer}
            dirty={state.dirty.length > 0}
          />
          {sent && proposer && (
            <p className="panel mode-bar" role="status">
              Sent to the DM. It is saved once a DM accepts it on the campaign
              page.
            </p>
          )}
          <Header {...props} />
          {!editing && (
            <CharacterTools
              characterId={characterId}
              name={String(
                (state.records.get(characterId)?.data as { name?: unknown })
                  ?.name ?? characterId,
              )}
              viewer={viewer}
              campaign={campaign ?? undefined}
            />
          )}

          {notes.length > 0 && (
            <details className="notes" style={{ marginBottom: 12 }}>
              <summary>{notes.length} note(s) about this sheet</summary>
              <ul>
                {notes.map((n, i) => (
                  <li key={i} className={n.severity}>
                    {n.message}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <nav className="tabs" role="tablist" aria-label="Sheet sections">
            {tabs.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                className="tab"
                aria-selected={id === current}
                onClick={() => setTab(id)}
              >
                {TAB_VIEWS[id]?.label ?? id}
              </button>
            ))}
          </nav>

          <div role="tabpanel">
            {View ? (
              <View {...props} />
            ) : (
              <p className="unresolved">
                The "{current}" tab is not available in this version of the app.
              </p>
            )}
          </div>

          <History entries={state.history} />

          {(state.dirty.length > 0 || state.saveErrors.length > 0) && (
            <div
              className="save-bar"
              role="region"
              aria-label="Unsaved changes"
            >
              <div className="save-bar-inner">
                {state.saveErrors.length > 0 && (
                  <div
                    className="error-box"
                    style={{ flexBasis: "100%", margin: 0 }}
                  >
                    Not saved:{" "}
                    {state.saveErrors.map((e) => e.message).join(" ")}{" "}
                    {state.saveErrors.some((e) => e.code === "conflict") && (
                      <button
                        type="button"
                        className="secondary"
                        onClick={actions.reload}
                      >
                        Load the newer version (drops these edits)
                      </button>
                    )}
                  </div>
                )}
                <span className="muted">
                  {state.dirty.length} unsaved change
                  {state.dirty.length === 1 ? "" : "s"}
                </span>
                <input
                  type="text"
                  placeholder="Optional note, e.g. Took 34 fire damage from the dragon"
                  aria-label="Save note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button
                  type="button"
                  className="primary"
                  disabled={state.saving}
                  onClick={async () => {
                    if (await actions.save(note)) {
                      setNote("");
                      setSent(proposer);
                    }
                  }}
                >
                  {state.saving
                    ? "Sending…"
                    : proposer
                      ? "Send to the DM"
                      : "Save"}
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={actions.discard}
                  disabled={state.saving}
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </main>
      </Draggable.Provider>
    </EntryProvider>
  );
}
