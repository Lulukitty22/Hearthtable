// Milestone 2's single page: Carol's sheet, read from and saved to the local emulator.
// Tabs come from the systems: each module lists the tabs it provides (`provides.uiTabs`), and
// the app shows the tabs of the modules the ruleset enables, in a fixed order. A tab a module
// declares but this app cannot draw is shown as unavailable rather than hidden.

import { useState, type ComponentType } from "react";
import { repository } from "./firebase";
import { FeaturesTab } from "./sheet/FeaturesTab";
import { Header } from "./sheet/Header";
import { InventoryTab } from "./sheet/InventoryTab";
import { SpellsTab } from "./sheet/SpellsTab";
import { StatsTab } from "./sheet/StatsTab";
import type { TabProps } from "./sheet/shared";
import { engine, useSheet, type HistoryEntry } from "./useSheet";

const CHARACTER_ID = "account/vrlulu/carol_elfnein";
const DEFINITION_PATHS = ["core", "account/vrlulu"] as const;

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
  const [state, actions] = useSheet(repository, CHARACTER_ID, DEFINITION_PATHS);
  const [tab, setTab] = useState("stats");
  const [note, setNote] = useState("");

  if (state.status === "loading")
    return <main className="page muted">Loading Carol from the emulator…</main>;
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
          Carol is not in the emulator yet. With <code>pnpm emulators</code>{" "}
          running, run <code>pnpm seed</code>, then reload.
        </div>
      </main>
    );
  }

  const props: TabProps = {
    characterId: CHARACTER_ID,
    resolved: state.resolved,
    records: state.records,
    edit: actions.edit,
  };
  const tabs = sheetTabs();
  const current = tabs.includes(tab) ? tab : (tabs[0] ?? "");
  const View = TAB_VIEWS[current]?.view;
  const notes = [...engine.issues, ...state.resolved.issues];

  return (
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
  );
}
