import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

import { processFromMd } from "./util/index";

describe("reyhpe-image-hack, with markdown sources", () => {
  // ******************************************
  it("xxx", async () => {
    const input = dedent`
      ![](image.png)
    `;

    const html = String(await processFromMd(input));

    expect(html).toMatchInlineSnapshot(`"<p><img src="image.png" alt=""></p>"`);

    expect(await prettier.format(html, { parser: "mdx" })).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""></p>
      "
    `);
  });
});
