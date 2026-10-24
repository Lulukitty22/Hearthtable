// The campaign a page belongs to, kept current.

import {
  campaignIdFor,
  watchCampaign,
  watchDelegates,
  type Campaign,
} from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { db } from "../firebase";

/** undefined while loading, null when there is no such campaign. */
export function useCampaign(segment: string | undefined) {
  const [campaign, setCampaign] = useState<Campaign | null | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(() => {
    if (!segment) return;
    return watchCampaign(
      db,
      campaignIdFor(segment),
      (c) => setCampaign(c ?? null),
      setFailure,
    );
  }, [segment]);
  return { campaign, failure };
}

/** Who may control a campaign character besides its owner (S6), kept current. */
export function useDelegates(
  campaign: string | undefined,
  characterPath: string,
): readonly string[] {
  const [delegates, setDelegates] = useState<readonly string[]>([]);
  useEffect(() => {
    if (!campaign) return;
    return watchDelegates(db, campaign, characterPath, setDelegates, () => {});
  }, [campaign, characterPath]);
  return delegates;
}
