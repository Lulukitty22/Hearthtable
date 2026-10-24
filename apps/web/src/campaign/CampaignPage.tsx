// /Campaigns/<name>: a campaign's page (Milestone 4, S5). Everyone sees its DMs and players.
// An approved account that is not a member can ask to join with the invite code (from an invite
// link, /Campaigns/<name>?invite=CODE, or typed in); a DM approves (Campaigns and Shared Data,
// Campaign membership). Members may leave. DMs see the invite code and link, the join requests,
// and member controls: remove a player, grant or revoke DM. A campaign always keeps one DM.
// Characters in campaigns arrive with S6; the DM controller (/DM) with Milestone 5.

import {
  approveJoinRequest,
  campaignIdFor,
  cancelJoinRequest,
  removeMember,
  replaceInviteCode,
  requestToJoin,
  setDm,
  watchCampaign,
  watchInviteCode,
  watchJoinRequests,
  watchOwnRequest,
  type Campaign,
  type JoinRequest,
} from "@hearthtable/storage";
import { useEffect, useState } from "react";
import { useAliases } from "../account/useAliases";
import type { Viewer } from "../account/useViewer";
import { db } from "../firebase";

export function CampaignPage({
  segment,
  viewer,
}: {
  segment: string;
  viewer: Viewer;
}) {
  const id = campaignIdFor(segment);
  const [campaign, setCampaign] = useState<Campaign | null | undefined>();
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(
    () =>
      watchCampaign(
        db,
        id,
        (c) => setCampaign(c ?? null),
        (message) => setFailure(message),
      ),
    [id],
  );
  const aliases = useAliases([
    ...(campaign?.dms ?? []),
    ...(campaign?.players ?? []),
  ]);

  if (failure)
    return (
      <main className="page">
        <div className="error-box">{failure}</div>
      </main>
    );
  if (campaign === undefined)
    return <main className="page muted">Loading…</main>;
  if (campaign === null)
    return (
      <main className="page">
        <div className="error-box">
          There is no campaign called {segment.replaceAll("_", " ")}.
        </div>
      </main>
    );

  const uid = viewer.status === "account" ? viewer.account.uid : undefined;
  const approved =
    viewer.status === "account" && viewer.account.status === "approved";
  const isDm = !!uid && approved && campaign.dms.includes(uid);
  const isMember =
    !!uid && (campaign.dms.includes(uid) || campaign.players.includes(uid));
  const name = (u: string) => aliases.get(u) ?? "…";

  return (
    <main className="page">
      <h1>{campaign.name}</h1>
      <p className="muted">
        Campaign · {campaign.dms.length} DM
        {campaign.dms.length === 1 ? "" : "s"}, {campaign.players.length} player
        {campaign.players.length === 1 ? "" : "s"}
      </p>

      <section className="panel campaign-section">
        <h2>Members</h2>
        <ul className="member-list" aria-label="Members">
          {[...campaign.dms, ...campaign.players].map((m) => (
            <Member
              key={m}
              campaign={campaign}
              member={m}
              alias={name(m)}
              uid={uid}
              isDm={isDm}
            />
          ))}
        </ul>
      </section>

      {isDm && <DmTools campaign={campaign} />}
      {!isMember && (
        <JoinBox campaign={campaign} viewer={viewer} approved={approved} />
      )}
    </main>
  );
}

function Member({
  campaign,
  member,
  alias,
  uid,
  isDm,
}: {
  campaign: Campaign;
  member: string;
  alias: string;
  uid: string | undefined;
  isDm: boolean;
}) {
  const [failure, setFailure] = useState<string | undefined>();
  const [confirming, setConfirming] = useState(false);
  const memberIsDm = campaign.dms.includes(member);
  const lastDm = memberIsDm && campaign.dms.length === 1;
  const self = member === uid;
  const run = async (write: () => Promise<string | undefined>) =>
    setFailure(await write());

  return (
    <li className="member" aria-label={alias}>
      <strong>{alias}</strong>
      <span className={`badge ${memberIsDm ? "good" : ""}`}>
        {memberIsDm ? "DM" : "player"}
      </span>
      {self && <span className="muted">(you)</span>}
      <span className="chips member-actions">
        {isDm && !memberIsDm && (
          <button
            type="button"
            className="secondary"
            onClick={() => run(() => setDm(db, campaign.id, member, true))}
          >
            Make DM
          </button>
        )}
        {isDm && memberIsDm && !lastDm && (
          <button
            type="button"
            className="secondary"
            onClick={() => run(() => setDm(db, campaign.id, member, false))}
          >
            Revoke DM
          </button>
        )}
        {isDm && !memberIsDm && !self && (
          <button
            type="button"
            className="secondary"
            onClick={() => run(() => removeMember(db, campaign.id, member))}
          >
            Remove
          </button>
        )}
        {self && !lastDm && !confirming && (
          <button
            type="button"
            className="secondary"
            onClick={() => setConfirming(true)}
          >
            Leave campaign
          </button>
        )}
        {self && confirming && (
          <>
            <span>Leave {campaign.name}?</span>
            <button
              type="button"
              className="primary danger"
              onClick={() => run(() => removeMember(db, campaign.id, member))}
            >
              Leave
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        )}
        {self && lastDm && (
          <span className="muted">
            The last DM cannot leave or give up DM; make someone else DM first.
          </span>
        )}
      </span>
      {failure && <div className="error-box">{failure}</div>}
    </li>
  );
}

function DmTools({ campaign }: { campaign: Campaign }) {
  const [code, setCode] = useState<string | undefined>();
  const [requests, setRequests] = useState<readonly JoinRequest[]>([]);
  const [failure, setFailure] = useState<string | undefined>();
  useEffect(
    () => watchInviteCode(db, campaign.id, setCode, setFailure),
    [campaign.id],
  );
  useEffect(
    () => watchJoinRequests(db, campaign.id, setRequests, setFailure),
    [campaign.id],
  );
  const aliases = useAliases(requests.map((r) => r.uid));
  const link = code
    ? `${window.location.origin}${window.location.pathname}?invite=${code}`
    : undefined;

  return (
    <section className="panel campaign-section" aria-label="DM tools">
      <h2>DM tools</h2>
      {failure && <div className="error-box">{failure}</div>}
      <h3>Invite</h3>
      <p>
        Code: <code data-testid="invite-code">{code ?? "…"}</code>
        {link && (
          <>
            {" · "}Link: <code data-testid="invite-link">{link}</code>
          </>
        )}
      </p>
      <p className="chips">
        <button
          type="button"
          className="secondary"
          onClick={async () =>
            setFailure(
              await replaceInviteCode(db, campaign.id, campaign.name, code),
            )
          }
        >
          Replace code
        </button>
        <span className="muted">
          The old code stops working. Using a code only sends a join request.
        </span>
      </p>
      <h3>Join requests ({requests.length})</h3>
      {requests.length === 0 ? (
        <p className="muted">No one is waiting to join.</p>
      ) : (
        <ul className="member-list" aria-label="Join requests">
          {requests.map((r) => {
            const alias = aliases.get(r.uid) ?? "…";
            return (
              <li key={r.uid} className="member">
                <strong>{alias}</strong>
                {r.at && (
                  <span className="muted">
                    asked {new Date(r.at).toLocaleString()}
                  </span>
                )}
                <span className="chips member-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={async () =>
                      setFailure(
                        await approveJoinRequest(db, campaign.id, r.uid),
                      )
                    }
                  >
                    Approve {alias}
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={async () =>
                      setFailure(
                        await cancelJoinRequest(db, campaign.id, r.uid),
                      )
                    }
                  >
                    Decline {alias}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function JoinBox({
  campaign,
  viewer,
  approved,
}: {
  campaign: Campaign;
  viewer: Viewer;
  approved: boolean;
}) {
  const invited =
    new URLSearchParams(window.location.search).get("invite") ?? "";
  const [code, setCode] = useState(invited);
  const [waiting, setWaiting] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const uid = viewer.status === "account" ? viewer.account.uid : undefined;
  useEffect(() => {
    if (!uid || !approved) return;
    return watchOwnRequest(db, campaign.id, uid, setWaiting, setFailure);
  }, [campaign.id, uid, approved]);

  if (!uid)
    return (
      <p className="panel campaign-section">
        {invited ? "You have an invite to this campaign. " : ""}Sign in to ask
        to join.
      </p>
    );
  if (!approved)
    return (
      <p className="panel campaign-section">
        Your account needs an administrator's approval before it can join
        campaigns.
      </p>
    );
  if (waiting)
    return (
      <p className="panel campaign-section" role="status">
        Your request to join is waiting for a DM.{" "}
        <button
          type="button"
          className="secondary"
          onClick={async () =>
            setFailure(await cancelJoinRequest(db, campaign.id, uid))
          }
        >
          Withdraw request
        </button>
        {failure && <span className="error-box">{failure}</span>}
      </p>
    );
  return (
    <form
      className="panel campaign-section entry-form"
      aria-label="Ask to join"
      onSubmit={async (e) => {
        e.preventDefault();
        const message = await requestToJoin(db, campaign.id, uid, code);
        setFailure(
          message
            ? "That invite code does not work for this campaign. Ask a DM for the current code."
            : undefined,
        );
      }}
    >
      <h2>Join {campaign.name}</h2>
      <label>
        Invite code{" "}
        <input
          type="text"
          aria-label="Invite code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
      </label>
      <p className="chips">
        <button type="submit" className="primary" disabled={!code.trim()}>
          Ask to join
        </button>
        <span className="muted">A DM approves every request.</span>
      </p>
      {failure && <div className="error-box">{failure}</div>}
    </form>
  );
}
