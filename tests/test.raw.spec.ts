import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

import { processRawFirst } from "./util/index";

describe("reyhpe-image-hack with rehype-raw (html nodes in markdown) ", () => {
  it("xxx", async () => {
    const input = dedent`
      <img src="image.png" alt="" />
    `;

    const html = String(await processRawFirst(input));

    expect(await prettier.format(html, { parser: "mdx" })).toMatchInlineSnapshot(`
      "<img src="image.png" alt="">
      "
    `);
  });
});
