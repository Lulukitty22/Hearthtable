// A campaign's game in progress, kept current (Milestone 5 S2 and S3): the campaign, its play
// state (clock and current scene), the latest log entries, who is present in the scene, and in an
// encounter its turn state, each participant's initiative and budget, and the NPC templates the
// DM can deploy. Characters are resolved like sheets, so the table shows hit points, Armor Class
// and initiative bonuses.

import type { RecordEnvelope } from "@hearthtable/kernel";
import {
  isInScene,
  sceneKindOf,
  turnOrder,
  type InitiativeEntry,
  type Moment,
  type SceneData,
} from "@hearthtable/play";
import {
  campaignIdFor,
  watchEncounter,
  watchLog,
  watchParticipants,
  watchPlayState,
  type EncounterState,
  type LogEntry,
  type ParticipantState,
  type PlayState,
} from "@hearthtable/storage";
import type { ActiveEffectRow } from "@hearthtable/system-active-effects";
import type { ConditionRow } from "@hearthtable/system-conditions";
import { useEffect, useMemo, useState } from "react";
import { gameTimeRecord, momentOf } from "../play/gameTime";
import { useCampaign } from "../campaign/useCampaign";
import { db, repository } from "../firebase";
import { readPortrait, type PortraitData } from "../sheet/Portrait";
import { engine } from "../useSheet";

export interface Participant {
  readonly path: string;
  readonly name: string;
  /** An NPC instance placed in the scene, rather than a campaign character. */
  readonly npc: boolean;
  readonly portrait?: PortraitData;
  readonly hp?: { readonly current: number; readonly max?: number };
  readonly ac?: number;
  readonly initiativeBonus?: number;
  /** "Wizard 12 / Artificer 3", when the classes resolve. */
  readonly classes?: string;
  /** Effects that are on, and those whose time is up but are not yet cleared. */
  readonly effects: readonly ActiveEffectRow[];
  /** Conditions in force, including those another includes and going down. */
  readonly conditions: readonly ConditionRow[];
  /** Why the character is Incapacitated, when it is. */
  readonly incapacitated?: string;
}

/** An NPC template the DM can deploy: its records and its initiative bonus. */
export interface Template {
  readonly path: string;
  readonly name: string;
  readonly records: readonly RecordEnvelope[];
  readonly initiativeBonus: number;
  /** From core (`core/NPCs`) rather than this campaign. */
  readonly core: boolean;
}

const isCharacter = (r: RecordEnvelope) => r.kind === "character";
const under = (id: string, path: string) =>
  id === path || id.startsWith(`${path}/`);

function resolveCharacter(
  definitions: readonly RecordEnvelope[],
  own: readonly RecordEnvelope[],
  path: string,
  npc: boolean,
  now?: Moment,
): Participant {
  const data = own.find((r) => r.id === path)?.data as
    { name?: unknown } | undefined;
  const resolved = engine.resolve([
    ...[...definitions, ...own].filter((r) => r.kind !== "history"),
    ...(now ? [gameTimeRecord(now)] : []),
  ]);
  const value = <T>(key: string) => {
    const v = resolved.get<T>(key);
    return v.kind === "known" ? v.value : undefined;
  };
  const state = value<{ current: number }>("hit-points.state");
  const max = value<number>("hit-points.max");
  const ac = value<number>("armor-class.total");
  const initiativeBonus = value<number>("initiative.total");
  const classes =
    value<readonly { name: string; level: number }[]>("character.classes");
  const portrait = readPortrait(data);
  const effects = (
    value<readonly ActiveEffectRow[]>("active-effects.list") ?? []
  ).filter((e) => e.status === "active" || e.status === "ended");
  const conditions = value<readonly ConditionRow[]>("conditions.list") ?? [];
  const incapacitated = conditions.find((c) => c.breaksConcentration);
  return {
    effects,
    conditions,
    ...(incapacitated
      ? {
          incapacitated:
            incapacitated.origin === "included"
              ? (incapacitated.because ?? incapacitated.name)
              : incapacitated.name,
        }
      : {}),
    path,
    name: String(data?.name ?? path.split("/").at(-1)?.replaceAll("_", " ")),
    npc,
    ...(portrait ? { portrait } : {}),
    ...(state
      ? {
          hp: { current: state.current, ...(max !== undefined ? { max } : {}) },
        }
      : {}),
    ...(ac !== undefined ? { ac } : {}),
    ...(initiativeBonus !== undefined ? { initiativeBonus } : {}),
    ...(classes?.length
      ? { classes: classes.map((c) => `${c.name} ${c.level}`).join(" / ") }
      : {}),
  };
}

export function useTable(segment: string) {
  const id = campaignIdFor(segment);
  const campaignPath = `campaign/${segment}`;
  const { campaign, failure: campaignFailure } = useCampaign(segment);
  const [state, setState] = useState<PlayState | null | undefined>();
  const [log, setLog] = useState<readonly LogEntry[]>([]);
  const [records, setRecords] = useState<
    readonly RecordEnvelope[] | undefined
  >();
  const [core, setCore] = useState<readonly RecordEnvelope[] | undefined>();
  const [encounter, setEncounter] = useState<EncounterState | undefined>();
  const [entries, setEntries] = useState<readonly ParticipantState[]>([]);
  const [failure, setFailure] = useState<string | undefined>();

  useEffect(
    () => watchPlayState(db, id, (s) => setState(s ?? null), setFailure),
    [id],
  );
  useEffect(() => watchLog(db, id, setLog, setFailure), [id]);
  useEffect(
    () => repository.watchUnder(campaignPath, setRecords, setFailure),
    [campaignPath],
  );
  useEffect(() => {
    let cancelled = false;
    void repository.listUnder("core").then((r) => {
      if (cancelled) return;
      if (r.ok) setCore(r.value);
      else setFailure(r.errors.map((e) => e.message).join("\n"));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const scenePath = state?.scene;
  const inEncounter = !!scenePath && sceneKindOf(scenePath) === "encounter";
  useEffect(() => {
    if (!scenePath || !inEncounter) return;
    const stops = [
      watchEncounter(db, id, scenePath, setEncounter, setFailure),
      watchParticipants(db, id, scenePath, setEntries, setFailure),
    ];
    return () => {
      for (const stop of stops) stop();
      setEncounter(undefined);
      setEntries([]);
    };
  }, [id, scenePath, inEncounter]);

  const scene = useMemo(
    () => (state ? records?.find((r) => r.id === state.scene) : undefined),
    [records, state],
  );
  const moment = momentOf(state, encounter);
  const nowClock = moment?.clock;
  const nowStep = moment?.step;

  // Everyone who could be at the table, resolved: campaign characters and this scene's NPCs.
  const people = useMemo(() => {
    if (!records || !core || !state) return undefined;
    const now =
      nowClock !== undefined && nowStep !== undefined
        ? { clock: nowClock, step: nowStep }
        : undefined;
    const characters = records.filter(isCharacter);
    const definitions = [
      ...core.filter((r) => !r.id.startsWith("core/NPCs/")),
      ...records.filter(
        (r) => !isInScene(r.id) && !characters.some((c) => under(r.id, c.id)),
      ),
    ];
    const own = (path: string, from: readonly RecordEnvelope[]) =>
      from.filter((r) => under(r.id, path));
    const campaignCharacters = characters.filter(
      (c) =>
        c.id.startsWith(`${campaignPath}/Characters/`) &&
        c.id.split("/").length === 5,
    );
    const sceneNpcs = characters.filter((c) =>
      c.id.startsWith(`${state.scene}/`),
    );
    const map = new Map<string, Participant>();
    for (const c of campaignCharacters)
      map.set(
        c.id,
        resolveCharacter(definitions, own(c.id, records), c.id, false, now),
      );
    for (const c of sceneNpcs)
      map.set(
        c.id,
        resolveCharacter(definitions, own(c.id, records), c.id, true, now),
      );

    // Templates: campaign/<C>/NPCs/<Name> and core/NPCs/<Name>.
    const templates: Template[] = [
      ...characters.filter(
        (c) =>
          c.id.startsWith(`${campaignPath}/NPCs/`) &&
          c.id.split("/").length === 4,
      ),
      ...core.filter(
        (c) =>
          isCharacter(c) &&
          c.id.startsWith("core/NPCs/") &&
          c.id.split("/").length === 3,
      ),
    ].map((t) => {
      const from = t.id.startsWith("core/") ? core : records;
      const template = own(t.id, from);
      const resolved = resolveCharacter(definitions, template, t.id, true);
      return {
        path: t.id,
        name: resolved.name,
        records: template,
        initiativeBonus: resolved.initiativeBonus ?? 0,
        core: t.id.startsWith("core/"),
      };
    });
    return {
      map,
      campaignCharacters: campaignCharacters.map((c) => c.id as string),
      sceneNpcs: sceneNpcs.map((c) => c.id as string),
      templates,
    };
  }, [records, core, state, campaignPath, nowClock, nowStep]);

  const initiative = useMemo(() => {
    const m = new Map<string, InitiativeEntry & { detail: string }>();
    for (const e of entries) if (e.initiative) m.set(e.path, e.initiative);
    return m;
  }, [entries]);

  const order = useMemo(
    () =>
      encounter
        ? turnOrder(encounter.participants, initiative, encounter.order)
        : undefined,
    [encounter, initiative],
  );

  const participants = useMemo((): readonly Participant[] | undefined => {
    if (!people || !state) return undefined;
    const paths =
      sceneKindOf(state.scene) === "downtime"
        ? [...people.campaignCharacters, ...people.sceneNpcs]
        : (order ?? []);
    return paths.flatMap((p) => {
      const found = people.map.get(p);
      return found ? [found] : [];
    });
  }, [people, state, order]);

  // The conditions a DM can apply, from core.
  const conditionKinds = useMemo(
    () =>
      (core ?? [])
        .filter((r) => r.kind === "condition")
        .map((r) => ({
          ref: r.id as string,
          name: String((r.data as { name?: unknown }).name ?? r.id),
          levels: (r.data as { levels?: unknown }).levels === true,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [core],
  );

  return {
    id,
    campaignPath,
    conditionKinds,
    campaign,
    state,
    scene: scene as (RecordEnvelope & { data: SceneData }) | undefined,
    log,
    participants,
    people,
    encounter,
    entries,
    initiative,
    order,
    now: moment,
    failure: failure ?? campaignFailure,
  };
}
