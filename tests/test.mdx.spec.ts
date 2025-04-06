import { describe, it, expect } from "vitest";
import dedent from "dedent";
// import * as prettier from "prettier";

import { processMdx, processMdxRaw } from "./util/index.mdx";

describe("reyhpe-image-hack, with MDX sources", () => {
  // ******************************************
  it("Basic MDX source", async () => {
    const input = dedent`
      <h2>Hi</h2>

      ![](image.png)

      <img src="image.png" alt="" />
    `;

    expect(await processMdxRaw(input, "md")).toMatchInlineSnapshot(`
      "<h2>Hi</h2>
      <p><img src="image.png" alt=""/></p>
      <img src="image.png" alt=""/>"
    `);

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(`
      "<h2>Hi</h2>
      <p><img src="image.png" alt=""/></p>
      <img src="image.png" alt=""/>"
    `);
  });

  // TODO handle mdxJsxFlowElement
  // ******************************************
  it("MDX source, handle autolinks", async () => {
    const input = dedent`
      ![]([image.png])

      ![]((image.png))

      handle ![]([image.png]) ![]((image.png)) in a paragraph

      <img src="[image.png]" alt="" />

      <img src="(image.png)" alt="" />

      <img src="[image.png]" alt="" /> text

      <img src="(image.png)" alt="" /> text

      handle <img src="[image.png]" alt="" /> <img src="(image.png)" alt="" /> in a paragraph
    `;

    expect(await processMdxRaw(input, "md")).toMatchInlineSnapshot(`
      "<p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>"
    `);

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(`
      "<p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>"
    `);
  });
});

// for reference

// const mdxJsxFlowElement = {
//   type: "mdxJsxFlowElement",
//   name: "img",
//   attributes: [
//     {
//       type: "mdxJsxAttribute",
//       name: "src",
//       value: "image.png",
//     },
//     {
//       type: "mdxJsxAttribute",
//       name: "alt",
//       value: "",
//     },
//   ],
//   data: { _mdxExplicitJsx: true },
//   children: [],
// };
