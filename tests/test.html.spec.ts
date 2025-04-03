import { describe, it, expect } from "vitest";
import dedent from "dedent";
// import * as prettier from "prettier";

import { processHtml } from "./util";

describe("reyhpe-image-hack, with html sources", () => {
  // TODO
  // *************************************
  it("process html input, example in the README", async () => {
    const input = dedent`
      <p>
        It adds autolink.
        <img src="[https://example.com/image.png]" alt="alt">
      </p>
      <p>
        It adds caption.
        <img src="image.png" alt="*Image Caption">
      </p>
      <p>
        It adds attributes.
        <img src="image.png" title="> 60x60">
      </p>
  `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<p>
        It adds autolink.
        <img src="[https://example.com/image.png]" alt="alt">
      </p>
      <p>
        It adds caption.
        <img src="image.png" alt="Image Caption">
      </p>
      <p>
        It adds attributes.
        <img src="image.png" width="60" height="60">
      </p>"
    `);
  });
});

describe("reyhpe-image-hack, simple", () => {
  const output =
    '"<figure><img src="image.png" alt="Image Caption"><figcaption>Image Caption</figcaption></figure>"';

  // *************************************
  it("process html input, simple image", async () => {
    const input = dedent`
      <img src="image.png" alt="*Image Caption">
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(output);
  });

  // *************************************
  it("process html input, example in the README", async () => {
    const input = dedent`
      <p><img src="image.png" alt="*Image Caption"></p>
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(output);
  });

  // TODO
  // *************************************
  it("process html input, example in the README", async () => {
    const input = dedent`
      <h4>Title</h4>
      <p>
        <img src="image.png" alt="*Image Caption">
      </p>
      <img src="image.png" alt="+Image Alt">
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<h4>Title</h4>
      <p>
        <img src="image.png" alt="Image Caption">
      </p>
      <figure><img src="image.png" alt="Image Alt"></figure>"
    `);
  });
});
