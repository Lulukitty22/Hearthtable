// The live HTML sheet export (Milestone 4, S10; Campaigns and Shared Data, Live character-sheet
// exports). The downloaded file is a small page that frames the app's sheet-only address for one
// character (`…/<character>/Export`), so it always shows the character's current saved data, needs
// the app to be reachable, and offers no way into the rest of the app. It points at the path the
// character had when exported; if the character is later deleted or copied elsewhere and removed,
// the export says so instead of following it.
//
// Framing the hosted page, rather than running the sheet inside the downloaded file, keeps it on
// the app's own address: a downloaded file's `file://` page cannot sign in with Firebase, while the
// framed page can (needed once privacy arrives; Architecture and Hosting, Exported files).

import { webPathFor } from "../routes";

const escape = (text: string) =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** The exported file's HTML for the character at `path`, served by the app at `origin`. */
export function exportHtml(path: string, name: string, origin: string): string {
  const src = `${origin}${webPathFor(path, "export")}`;
  const title = `${name} (Hearthtable)`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="hearthtable-export" content="${escape(path)}">
<style>
  html, body { margin: 0; height: 100%; background: #15110d; color: #eadfc8;
    font: 15px/1.45 "Segoe UI", system-ui, sans-serif; }
  iframe { display: block; width: 100%; height: 100%; border: 0; }
  noscript, .offline { display: block; padding: 16px; }
</style>
</head>
<body>
<iframe src="${escape(src)}" title="${escape(name)}"></iframe>
<noscript>This live character sheet loads from ${escape(origin)} and needs that address to be reachable.</noscript>
</body>
</html>
`;
}

/** Downloads the export for the character at `path`. */
export function downloadExport(path: string, name: string) {
  const blob = new Blob([exportHtml(path, name, window.location.origin)], {
    type: "text/html",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name.replace(/[\\/:*?"<>|]/g, "_")} - Hearthtable.html`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
