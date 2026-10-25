// Scribing a scroll on the sheet: the snapshot is built from this character's resolved numbers
// and the spell-formula grants of their features (Milestone 5 S0).

import type { CasterClass } from "@hearthtable/system-spellcasting";
import {
  buildSnapshot,
  type ScrollSnapshot,
} from "@hearthtable/system-scrolls";
import type { SourcedGrant } from "@hearthtable/kernel";
import { known, type TabProps } from "./shared";

export function snapshotFor(
  props: TabProps,
  spellId: string,
  castLevel: number,
): ScrollSnapshot {
  const get = <T>(key: string) => known(props.resolved.get<T>(key));
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
    spell: (props.records.get(spellId)?.data ?? {}) as Record<string, unknown>,
    castLevel,
    characterLevel: get<number>("character.level") ?? 1,
    casters,
    grants: get<readonly SourcedGrant[]>("kernel.grants") ?? [],
    number: (key) => get<number>(key),
  });
}
