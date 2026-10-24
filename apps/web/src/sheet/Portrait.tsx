// A character's portrait (Milestone 4, S11; Campaigns and Shared Data, Portrait uploads): an
// uploaded image (PNG, JPEG, WebP or GIF up to 2 MB, kept as uploaded) or a link to one. It is
// part of the sheet, so choosing one is an ordinary edit: it is saved with the sheet (or sent to
// a DM, for a player's campaign character). An uploaded file goes to Cloud Storage at once, under
// the character's path; files are never deleted automatically, because copies share them.

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { useState } from "react";
import { storage } from "../firebase";
import type { Data, TabProps } from "./shared";

export interface PortraitData {
  readonly source: "upload" | "link";
  readonly url: string;
  /** For an upload, where the file is stored. */
  readonly path?: string;
}

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_BYTES = 2 * 1024 * 1024;

export function readPortrait(data: unknown): PortraitData | undefined {
  const p = (data as { portrait?: Partial<PortraitData> } | undefined)
    ?.portrait;
  return p &&
    typeof p.url === "string" &&
    (p.source === "upload" || p.source === "link")
    ? (p as PortraitData)
    : undefined;
}

export function Portrait(props: TabProps) {
  const { characterId, records, canEdit, edit } = props;
  const data = records.get(characterId)?.data as Data | undefined;
  const portrait = readPortrait(data);
  const name = String(data?.["name"] ?? characterId);
  const [link, setLink] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const set = (next: PortraitData | undefined) =>
    edit(characterId, (d) => {
      const { portrait: _old, ...rest } = d;
      return next ? { ...rest, portrait: { ...next } } : rest;
    });

  const image = portrait ? (
    <img className="portrait" src={portrait.url} alt={`Portrait of ${name}`} />
  ) : canEdit ? (
    <div className="portrait portrait-empty">No portrait</div>
  ) : null;
  if (!canEdit) return image;

  return (
    <div className="portrait-edit">
      {image}
      <div className="portrait-controls">
        <label className="secondary button-link">
          Upload a portrait
          <input
            type="file"
            aria-label="Upload a portrait"
            accept={TYPES.join(",")}
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (!TYPES.includes(file.type))
                return setStatus("Use a PNG, JPEG, WebP or GIF image.");
              if (file.size > MAX_BYTES)
                return setStatus("That image is over 2 MB.");
              setStatus("Uploading…");
              try {
                const path = `portraits/${characterId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
                const stored = await uploadBytes(ref(storage, path), file, {
                  contentType: file.type,
                });
                const url = await getDownloadURL(stored.ref);
                set({ source: "upload", url, path });
                setStatus(undefined);
              } catch (error) {
                setStatus(
                  `Could not upload: ${error instanceof Error ? error.message : String(error)}`,
                );
              }
            }}
          />
        </label>
        <span className="chips">
          <input
            type="text"
            aria-label="Image link"
            placeholder="https://… image link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <button
            type="button"
            className="secondary"
            disabled={!/^https?:\/\/\S+$/.test(link.trim())}
            onClick={() => {
              set({ source: "link", url: link.trim() });
              setLink("");
            }}
          >
            Use link
          </button>
          {portrait && (
            <button
              type="button"
              className="secondary"
              onClick={() => set(undefined)}
            >
              Remove portrait
            </button>
          )}
        </span>
        {status && <span role="status">{status}</span>}
      </div>
    </div>
  );
}
