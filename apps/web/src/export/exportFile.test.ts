import { describe, expect, it } from "vitest";
import { exportHtml } from "./exportFile";

describe("the exported file", () => {
  const html = exportHtml(
    "campaign/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein",
    'Carol "Elf" <Elfnein>',
    "http://localhost:5173",
  );

  it("frames the character's sheet-only address at the app's origin", () => {
    expect(html).toContain(
      'src="http://localhost:5173/Campaigns/Riverbed_of_Strings/Characters/VR_Lulu/Carol_Elfnein/Export"',
    );
  });

  it("escapes the character's name", () => {
    expect(html).toContain("Carol &quot;Elf&quot; &lt;Elfnein&gt;");
    expect(html).not.toContain("<Elfnein>");
  });
});
