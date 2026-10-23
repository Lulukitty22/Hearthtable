// Character sheets read from and saved to the local emulator. The web address is the record's
// path (user decision, 2026-10-22): /VR_Lulu/Characters/Carol_Elfnein shows the record
// account/VR_Lulu/Characters/Carol_Elfnein, and /Campaigns/<name>/… a campaign's copy.
// Tabs come from the systems: each module lists the tabs it provides (`provides.uiTabs`), and
// the app shows the tabs of the modules the ruleset enables, in a fixed order. A tab a module
// declares but this app cannot draw is shown as unavailable rather than hidden.

import { useEffect, useMemo, useState, type ComponentType } from "react";
import type { RecordEnvelope } from "@hearthtable/kernel";
import { repository } from "./firebase";
import { FeaturesTab } from "./sheet/FeaturesTab";
import { Header } from "./sheet/Header";
import { EntryProvider } from "./sheet/entries";
import { InventoryTab } from "./sheet/InventoryTab";
import { SpellsTab } from "./sheet/SpellsTab";
import { StatsTab } from "./sheet/StatsTab";
import type { TabProps } from "./sheet/shared";
import { engine, useSheet, type HistoryEntry } from "./useSheet";

/** Record path for a web address, or undefined for the home page. */
export function recordPathFor(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) return undefined;
  const [first, ...rest] = segments;
  return first?.toLowerCase() === "campaigns"
    ? ["campaign", ...rest].join("/")
    : ["account", ...segments].join("/");
}

/** Web address for a record path. */
export function webPathFor(recordPath: string): string {
  const [scope, ...rest] = recordPath.split("/");
  const segments = scope === "campaign" ? ["Campaigns", ...rest] : rest;
  return "/" + segments.map(encodeURIComponent).join("/");
}

function Home() {
  const [characters, setCharacters] = useState<
    readonly RecordEnvelope[] | undefined
  >();
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(() => {
    void repository.listUnder("account").then((r) => {
      if (r.ok) setCharacters(r.value.filter((x) => x.kind === "character"));
      else setFailure(r.errors.map((e) => e.message).join(" "));
    });
  }, []);
  return (
    <main className="page">
      <h1>Hearthtable</h1>
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
  const path = recordPathFor(window.location.pathname);
  return path ? <Sheet characterId={path} /> : <Home />;
}

function Sheet({ characterId }: { characterId: string }) {
  // Definitions come from core and the owner's own Items folder.
  const definitionPaths = useMemo(() => {
    const [scope, owner] = characterId.split("/");
    return ["core", `${scope}/${owner}/Items`];
  }, [characterId]);
  const [state, actions] = useSheet(repository, characterId, definitionPaths);
  const [tab, setTab] = useState("stats");
  const [note, setNote] = useState("");

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
  };
  const tabs = sheetTabs();
  const current = tabs.includes(tab) ? tab : (tabs[0] ?? "");
  const View = TAB_VIEWS[current]?.view;
  const notes = [...engine.issues, ...state.resolved.issues];

  return (
    <EntryProvider props={props}>
      <main className="page">
        <Header {...props} />

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
          <div className="save-bar" role="region" aria-label="Unsaved changes">
            <div className="save-bar-inner">
              {state.saveErrors.length > 0 && (
                <div
                  className="error-box"
                  style={{ flexBasis: "100%", margin: 0 }}
                >
                  Not saved: {state.saveErrors.map((e) => e.message).join(" ")}{" "}
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
                  if (await actions.save(note)) setNote("");
                }}
              >
                {state.saving ? "Saving…" : "Save"}
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
    </EntryProvider>
  );
}
