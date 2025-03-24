import { describe, it, expect } from "vitest";
import dedent from "dedent";

import * as utils from "./util/reference.mdx";

// This test file is designed for getting result of mdx parse without plugin

describe("reyhpe-image-hack from MDX source, format mdx", () => {
  // *************************************
  it("process MDX input, first markdown image, then html image, no empty line", async () => {
    const input = dedent`
      ![](image.png)
      <img src="image.png" alt="" />
      <Image src="image.jpg" alt="" />
    `;

    const html = await utils.processMdx(input, "mdx");

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""/></p>
      <img src="image.png" alt=""/>
      <img src="image.jpg" alt=""/>"
    `);
  });

  // *************************************
  it("process MDX input, first html image, then markdown image, no empty line", async () => {
    const input = dedent`
      <Image src="image.jpg" alt="" />
      <img src="image.png" alt="" />
      ![](image.png)
    `;

    const html = await utils.processMdx(input, "mdx");

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.jpg" alt=""/>
      <img src="image.png" alt=""/>
      <p><img src="image.png" alt=""/></p>"
    `);
  });

  // *************************************
  it("process MDX input, first markdown image, then html image, with empty line", async () => {
    const input = dedent`
      ![](image.png)

      <img src="image.png" alt="" />

      <Image src="image.jpg" alt="" />
    `;

    const html = await utils.processMdx(input, "mdx");

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""/></p>
      <img src="image.png" alt=""/>
      <img src="image.jpg" alt=""/>"
    `);
  });

  // *************************************
  it("process MDX input, first html image, then markdown image, with empty line", async () => {
    const input = dedent`
      <Image src="image.jpg" alt="" />

      <img src="image.png" alt="" />

      ![](image.png)
    `;

    const html = await utils.processMdx(input, "mdx");

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.jpg" alt=""/>
      <img src="image.png" alt=""/>
      <p><img src="image.png" alt=""/></p>"
    `);
  });
});

describe("reyhpe-image-hack from MDX source, format md", () => {
  // *************************************
  it("process MDX input, first markdown image, then html image, no empty line", async () => {
    const input = dedent`
      ![](image.png)
      <img src="image.png" alt="">
      <Image src="image.jpg" alt="" />
    `;

    const html = await utils.processMdx(input, "md");

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""/>

      </p>"
    `);
  });

  // *************************************
  it("process MDX input, first html image, then markdown image, no empty line", async () => {
    const input = dedent`
      <Image src="image.jpg" alt="" />
      <img src="image.png" alt="">
      ![](image.png)
    `;

    const html = await utils.processMdx(input, "md");

    expect(html).toMatchInlineSnapshot(`""`);
  });

  // *************************************
  it("process MDX input, first markdown image, then html image, with empty line", async () => {
    const input = dedent`
      ![](image.png)

      <img src="image.png" alt="">

      <Image src="image.jpg" alt="" />
    `;

    const html = await utils.processMdx(input, "md");

    expect(html).toMatchInlineSnapshot(`"<p><img src="image.png" alt=""/></p>"`);
  });

  // *************************************
  it("process MDX input, first html image, then markdown image, with empty line", async () => {
    const input = dedent`
      <Image src="image.jpg" alt="" />

      <img src="image.png" alt="">

      ![](image.png)
    `;

    const html = await utils.processMdx(input, "md");

    expect(html).toMatchInlineSnapshot(`"<p><img src="image.png" alt=""/></p>"`);
  });
});

describe("reyhpe-image-hack from MDX source, format md, with rehype-raw", () => {
  // *************************************
  it("process MDX input, first markdown image, then html image, no empty line", async () => {
    const input = dedent`
      ![](image.png)
      <img src="image.png" alt="">
      <Image src="image.jpg" alt="" />
    `;

    const html = await utils.processMdxRaw(input, "md");

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""/>
      <img src="image.png" alt=""/>
      <img src="image.jpg" alt=""/></p>"
    `);
  });

  // *************************************
  it("process MDX input, first html image, then markdown image, no empty line", async () => {
    const input = dedent`
      <Image src="image.jpg" alt="" />
      <img src="image.png" alt="">
      ![](image.png)
    `;

    const html = await utils.processMdxRaw(input, "md");

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.jpg" alt=""/>
      <img src="image.png" alt=""/>
      ![](image.png)"
    `);
  });

  // *************************************
  it("process MDX input, first markdown image, then html image, with empty line", async () => {
    const input = dedent`
      ![](image.png)

      <img src="image.png" alt="">

      <Image src="image.jpg" alt="" />
    `;

    const html = await utils.processMdxRaw(input, "md");

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt=""/></p>
      <img src="image.png" alt=""/>
      <img src="image.jpg" alt=""/>"
    `);
  });

  // *************************************
  it("process MDX input, first html image, then markdown image, with empty line", async () => {
    const input = dedent`
      <Image src="image.jpg" alt="" />  
    
      <img src="image.png" alt="">

      ![](image.png)
    `;

    const html = await utils.processMdxRaw(input, "md");

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.jpg" alt=""/>  
      <img src="image.png" alt=""/>
      <p><img src="image.png" alt=""/></p>"
    `);
  });
});
