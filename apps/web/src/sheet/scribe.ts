// Scribing a scroll on the sheet: the snapshot is built from this character's resolved numbers
// and the spell-formula grants of their features (Milestone 5 S0).

import type { CasterClass } from "@hearthtable/system-spellcasting";
import {
  buildSnapshot,
  type ScrollSnapshot,
} from "@hearthtable/system-scrolls";
import type { ResolvedCharacter, SourcedGrant } from "@hearthtable/kernel";
import { known, type TabProps } from "./shared";

export function snapshotFor(
  props: TabProps,
  spellId: string,
  castLevel: number,
): ScrollSnapshot {
  return snapshotFrom(
    props.resolved,
    (props.records.get(spellId)?.data ?? {}) as Record<string, unknown>,
    castLevel,
  );
}

/**
 * The same from a resolved character and the spell's data: also the caster's current numbers
 * and formulas when a spell is cast from a book (Milestone 5 S7).
 */
export function snapshotFrom(
  resolved: ResolvedCharacter,
  spell: Readonly<Record<string, unknown>>,
  castLevel: number,
): ScrollSnapshot {
  const get = <T>(key: string) => known(resolved.get<T>(key));
  const casters = (
    get<readonly CasterClass[]>("character.casterClasses") ?? []
  ).map((c) => {
    const dc = get<number>(`spellcasting.classes.${c.id}.dc`);
    const attack = get<number>(`spellcasting.classes.${c.id}.attack`);
    return {
      id: c.id,
      name: c.name,
      ability: c.ability,
      ...(dc !== undefined ? { dc } : {}),
      ...(attack !== undefined ? { attack } : {}),
    };
  });
  return buildSnapshot({
    spell,
    castLevel,
    characterLevel: get<number>("character.level") ?? 1,
    casters,
    grants: get<readonly SourcedGrant[]>("kernel.grants") ?? [],
    number: (key) => get<number>(key),
  });
}
