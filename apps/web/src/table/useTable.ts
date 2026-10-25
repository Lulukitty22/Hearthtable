// A campaign's game in progress, kept current (Milestone 5 S2): the campaign, its play state
// (clock and current scene), the latest log entries, and who is present in the scene, each
// resolved like a sheet so the table can show hit points and Armor Class.

import type { RecordEnvelope } from "@hearthtable/kernel";
import { isInScene, sceneKindOf, type SceneData } from "@hearthtable/play";
import {
  campaignIdFor,
  watchLog,
  watchPlayState,
  type LogEntry,
  type PlayState,
} from "@hearthtable/storage";
import { useEffect, useMemo, useState } from "react";
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
  /** "Wizard 12 / Artificer 3", when the classes resolve. */
  readonly classes?: string;
}

const isCharacter = (r: RecordEnvelope) => r.kind === "character";
const under = (id: string, path: string) =>
  id === path || id.startsWith(`${path}/`);

function participant(
  definitions: readonly RecordEnvelope[],
  own: readonly RecordEnvelope[],
  path: string,
  npc: boolean,
): Participant {
  const data = own.find((r) => r.id === path)?.data as
    { name?: unknown } | undefined;
  const resolved = engine.resolve(
    [...definitions, ...own].filter((r) => r.kind !== "history"),
  );
  const value = <T>(key: string) => {
    const v = resolved.get<T>(key);
    return v.kind === "known" ? v.value : undefined;
  };
  const state = value<{ current: number }>("hit-points.state");
  const max = value<number>("hit-points.max");
  const ac = value<number>("armor-class.total");
  const classes =
    value<readonly { name: string; level: number }[]>("character.classes");
  const portrait = readPortrait(data);
  return {
    path,
    name: String(data?.name ?? path.split("/").at(-1)),
    npc,
    ...(portrait ? { portrait } : {}),
    ...(state
      ? {
          hp: { current: state.current, ...(max !== undefined ? { max } : {}) },
        }
      : {}),
    ...(ac !== undefined ? { ac } : {}),
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

  const scene = useMemo(
    () => (state ? records?.find((r) => r.id === state.scene) : undefined),
    [records, state],
  );

  const participants = useMemo((): readonly Participant[] | undefined => {
    if (!records || !core || !state) return undefined;
    const characters = records.filter(isCharacter);
    const definitions = [
      ...core,
      ...records.filter(
        (r) => !isInScene(r.id) && !characters.some((c) => under(r.id, c.id)),
      ),
    ];
    const ownRecords = (path: string) =>
      records.filter((r) => under(r.id, path));
    // Downtime: every campaign character (Characters/<Alias>/<Name>); any scene: NPCs placed in it.
    const present = [
      ...(sceneKindOf(state.scene) === "downtime"
        ? characters
            .filter(
              (c) =>
                c.id.startsWith(`${campaignPath}/Characters/`) &&
                c.id.split("/").length === 5,
            )
            .map((c) => ({ path: c.id as string, npc: false }))
        : []),
      ...characters
        .filter((c) => c.id.startsWith(`${state.scene}/`))
        .map((c) => ({ path: c.id as string, npc: true })),
    ];
    return present.map((p) =>
      participant(definitions, ownRecords(p.path), p.path, p.npc),
    );
  }, [records, core, state, campaignPath]);

  return {
    id,
    campaignPath,
    campaign,
    state,
    scene: scene as (RecordEnvelope & { data: SceneData }) | undefined,
    log,
    participants,
    failure: failure ?? campaignFailure,
  };
}
