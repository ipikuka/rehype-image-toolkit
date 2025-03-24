import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

import { processMdRawFirst } from "./util/index";

describe("reyhpe-image-hack, with markdown sources", () => {
  // ******************************************
  it("xxx", async () => {
    const input = dedent`
      ![](image.png)

      <img src="image.png" alt="">
    `;

    const html = String(await processMdRawFirst(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""></p>
      <img src="image.png" alt="">"
    `);

    expect(await prettier.format(html, { parser: "mdx" })).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""></p>
      <img src="image.png" alt="">
      "
    `);
  });
});
