// Running downtime when the DM enters the time that passed (Milestone 5 S5; Turns, Encounters and
// Time, "Downtime"): the approved activities run in order for that long; each one that finishes
// applies its module's result to its character at the moment it finished, one that runs out of
// time keeps its progress or gives what its module says, and everything is logged. The DM's view
// also applies Hit Point Dice the players rolled after a Short Rest.

import type { RecordEnvelope, RecordId } from "@hearthtable/kernel";
import {
  activityType,
  formatDuration,
  runDowntime,
  type CharacterData,
  type QueuedActivity,
} from "@hearthtable/play";
import { updateActivities, type Activity } from "@hearthtable/storage";
import { db, repository } from "../firebase";
import type { Participant } from "./useTable";

const errorsOf = (r: { errors: readonly { message: string }[] }) =>
  r.errors.map((e) => e.message).join("\n");

/** Runs the queue for `elapsed` seconds starting at `clock`. Returns an error message or nothing. */
export async function runActivities(
  campaign: string,
  activities: readonly Activity[],
  people: ReadonlyMap<string, Participant>,
  uid: string,
  clock: number,
  elapsed: number,
): Promise<string | undefined> {
  const queue: QueuedActivity[] = activities.map((a) => ({
    id: a.id,
    character: a.character,
    type: a.type,
    seconds: a.seconds,
    progress: a.progress,
    status: a.status,
    ...(a.waitsFor ? { waitsFor: a.waitsFor } : {}),
  }));
  const results = runDowntime(queue, elapsed);
  if (results.length === 0) return undefined;

  // Each character's record, changed step by step in the order things happened.
  const records = new Map<string, RecordEnvelope>();
  const data = new Map<string, CharacterData>();
  for (const path of new Set(
    results.map((r) => queue.find((q) => q.id === r.id)?.character as string),
  )) {
    const got = await repository.get(path as RecordId);
    if (!got.ok) return errorsOf(got);
    if (got.value) {
      records.set(path, got.value);
      data.set(path, got.value.data as CharacterData);
    }
  }

  const updates: { id: string; change: Record<string, unknown> }[] = [];
  const logs: { by: string; clock: number; text: string }[] = [];
  const name = (path: string) =>
    people.get(path)?.name ?? path.split("/").at(-1) ?? path;
  for (const r of [...results].sort((a, b) => a.at - b.at)) {
    const a = activities.find((x) => x.id === r.id) as Activity;
    const type = activityType(a.type);
    const current = data.get(a.character);
    const person = people.get(a.character);
    if (!type || !current || !person) continue;
    const hp =
      (current["hitPoints"] as { current?: number } | undefined)?.current ?? 0;
    const facts = {
      name: person.name,
      hpCurrent: hp,
      hpMax: person.hp?.max,
      pools: person.pools,
    };
    const at = clock + r.at;
    if (r.state === "done") {
      const out = type.finish(facts, current, at);
      data.set(a.character, out.data);
      updates.push({
        id: a.id,
        change: {
          status: "done",
          progress: a.seconds,
          ...(out.spendHitDice ? { spend: "open" } : {}),
        },
      });
      logs.push({
        by: uid,
        clock: at,
        text: `${name(a.character)} finished ${type.name}: ${out.summary}.`,
      });
    } else if (r.state === "continues") {
      updates.push({ id: a.id, change: { progress: a.progress + r.ran } });
      logs.push({
        by: uid,
        clock: at,
        text: `${name(a.character)}'s ${type.name} continues next downtime (${formatDuration(a.progress + r.ran)} of ${formatDuration(a.seconds)} done).`,
      });
    } else if (r.state === "interrupted") {
      const out = type.unfinished?.(a.progress + r.ran, facts, current, at);
      if (out) data.set(a.character, out.data);
      updates.push({
        id: a.id,
        change: {
          status: "interrupted",
          progress: a.progress + r.ran,
          ...(out?.spendHitDice ? { spend: "open" } : {}),
        },
      });
      logs.push({
        by: uid,
        clock: at,
        text: `${name(a.character)}'s ${type.name} stopped after ${formatDuration(a.progress + r.ran)}: ${out ? out.summary : "no benefit"}.`,
      });
    } else if (r.state === "waiting") {
      logs.push({
        by: uid,
        clock: at,
        text: `${name(a.character)}'s ${type.name} is still waiting for another activity to finish.`,
      });
    }
  }

  const changed = [...data].flatMap(([path, d]) => {
    const record = records.get(path);
    return record && d !== record.data ? [{ ...record, data: d }] : [];
  });
  if (changed.length) {
    const saved = await repository.save(changed);
    if (!saved.ok) return errorsOf(saved);
  }
  return updateActivities(db, campaign, updates, logs);
}

/** Applies Hit Point Dice rolled since the DM's view last looked, once each. */
export async function applyRolls(
  campaign: string,
  activity: Activity,
  person: Participant,
): Promise<string | undefined> {
  const fresh = activity.rolls.slice(activity.applied);
  if (fresh.length === 0) return undefined;
  const got = await repository.get(person.path as RecordId);
  if (!got.ok) return errorsOf(got);
  if (!got.value) return undefined;
  const d = got.value.data as Record<string, unknown>;
  const hp = (d["hitPoints"] as { current?: number; temporary?: number }) ?? {};
  const gained = fresh.reduce((n, r) => n + r.total, 0);
  const max = person.hp?.max;
  const current = (hp.current ?? 0) + gained;
  const spent = {
    ...((d["hitPointDice"] as { spent?: Record<string, number> })?.spent ?? {}),
  };
  for (const r of fresh) spent[String(r.die)] = (spent[String(r.die)] ?? 0) + 1;
  const saved = await repository.save([
    {
      ...got.value,
      data: {
        ...d,
        hitPoints: {
          ...hp,
          current: max !== undefined ? Math.min(max, current) : current,
        },
        hitPointDice: { spent },
      },
    },
  ]);
  if (!saved.ok) return errorsOf(saved);
  return updateActivities(db, campaign, [
    { id: activity.id, change: { applied: activity.applied + fresh.length } },
  ]);
}
