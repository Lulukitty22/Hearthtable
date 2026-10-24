// The campaign a page belongs to, kept current.

import {
  campaignIdFor,
  watchCampaign,
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
