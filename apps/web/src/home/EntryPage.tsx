// A custom item, spell or feature opened from a folder: its name, description and fields. Game
// details for custom entries come with the character creator milestone (user decision,
// 2026-10-24); until then a custom entry grants nothing.

import type { RecordEnvelope } from "@hearthtable/kernel";
import { AllFields } from "../sheet/Grid";
import { Breadcrumb } from "./FolderPage";

export function EntryPage({ record }: { record: RecordEnvelope }) {
  const data = record.data as { name?: unknown; description?: unknown };
  return (
    <main className="page">
      <Breadcrumb path={record.id.split("/").slice(0, -1).join("/")} />
      <h1>{String(data.name ?? record.id)}</h1>
      <p className="muted">
        {record.kind[0]?.toUpperCase()}
        {record.kind.slice(1)}
        {record.source.status === "homebrew" ? " · custom" : ""}
      </p>
      {typeof data.description === "string" && (
        <p className="panel entry-description">{data.description}</p>
      )}
      <AllFields record={record} />
    </main>
  );
}
