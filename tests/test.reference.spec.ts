import { describe, it, expect } from "vitest";
import dedent from "dedent";

import * as utils from "./util/reference";

// This test file is designed for getting result of remark/rehype parse without plugin

describe("reyhpe-image-hack from html source", () => {
  // *************************************
  it("process html input, 3 different way of image tag result the same", async () => {
    const input = dedent`
      <img src="image.png" alt="">
      <img src="image.png" alt=""/>
      <img src="image.png" alt="" />
    `;

    const html = String(await utils.processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="">
      <img src="image.png" alt="">
      <img src="image.png" alt="">"
    `);
  });
});

describe("reyhpe-image-hack from markdown source, no rehype-raw", () => {
  // *************************************
  it("process markdown input, first markdown image, then html image, no empty line", async () => {
    const input = dedent`
      ![](image.png)
      <img src="image.png" alt="">
    `;

    const html = String(await utils.processMd(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt="">
      </p>"
    `);
  });

  // *************************************
  it("process markdown input, first html image, then markdown image, no empty line", async () => {
    const input = dedent`
      <img src="image.png" alt="">
      ![](image.png)
    `;

    const html = String(await utils.processMd(input));

    expect(html).toMatchInlineSnapshot(`""`);
  });

  // *************************************
  it("process markdown input, first markdown image, then html image, with empty line", async () => {
    const input = dedent`
      ![](image.png)

      <img src="image.png" alt="">
    `;

    const html = String(await utils.processMd(input));

    expect(html).toMatchInlineSnapshot(`"<p><img src="image.png" alt=""></p>"`);
  });

  // *************************************
  it("process markdown input, first html image, then markdown image, with empty line", async () => {
    const input = dedent`
      <img src="image.png" alt="">

      ![](image.png)
    `;

    const html = String(await utils.processMd(input));

    expect(html).toMatchInlineSnapshot(`"<p><img src="image.png" alt=""></p>"`);
  });
});

describe("reyhpe-image-hack from markdown source, with rehype-raw", () => {
  // *************************************
  it("process markdown input, first markdown image, then html image, no empty line", async () => {
    const input = dedent`
      ![](image.png)
      <img src="image.png" alt="">
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt="">
      <img src="image.png" alt=""></p>"
    `);
  });

  // *************************************
  it("process markdown input, first html image, then markdown image, no empty line", async () => {
    const input = dedent`
      <img src="image.png" alt="">
      ![](image.png)
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="">
      ![](image.png)"
    `);
  });

  // *************************************
  it("process markdown input, first markdown image, then html image, with empty line", async () => {
    const input = dedent`
      ![](image.png)

      <img src="image.png" alt="">
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""></p>
      <img src="image.png" alt="">"
    `);
  });

  // *************************************
  it("process markdown input, first html image, then markdown image, with empty line", async () => {
    const input = dedent`
      <img src="image.png" alt="">

      ![](image.png)
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="">
      <p><img src="image.png" alt=""></p>"
    `);
  });
});
