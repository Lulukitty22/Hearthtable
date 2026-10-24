// The public Alias of each account id, read from `/accounts/{uid}` (readable by anyone). Campaign
// member lists hold account ids only, so names always come from the accounts themselves.

import { readAccount } from "@hearthtable/storage";
import { doc, getDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../firebase";

export function useAliases(
  uids: readonly string[],
): ReadonlyMap<string, string> {
  const [aliases, setAliases] = useState<ReadonlyMap<string, string>>(
    new Map(),
  );
  const key = [...new Set(uids)].sort().join(",");
  useEffect(() => {
    let cancelled = false;
    const wanted = key ? key.split(",") : [];
    void Promise.all(
      wanted.map(async (uid) => {
        const snap = await getDoc(doc(db, "accounts", uid)).catch(
          () => undefined,
        );
        return [uid, readAccount(uid, snap?.data())?.alias ?? uid] as const;
      }),
    ).then((pairs) => {
      if (!cancelled) setAliases(new Map(pairs));
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return aliases;
}
