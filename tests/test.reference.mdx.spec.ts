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

  // ******************************************
  it("process markdown input, the <img> elements are in an anchor <a>", async () => {
    const input = dedent`
      <a href="https://example.com"><img src="image.png" alt="" /></a>
      <a href="https://example.com"><img src="image.png" alt="" /></a>

      <a href="https://example.com"><figure><img src="image.png" alt="" /></figure></a>

      <a href="https://example.com">
        <figure><img src="image.png" alt="" /></figure>
      </a>
    `;

    const html = await utils.processMdx(input, "mdx");

    expect(html).toMatchInlineSnapshot(`
      "<a href="https://example.com"><img src="image.png" alt=""/></a>
      <a href="https://example.com"><img src="image.png" alt=""/></a>
      <a href="https://example.com"><figure><img src="image.png" alt=""/></figure></a>
      <a href="https://example.com"><figure><img src="image.png" alt=""/></figure></a>"
    `);
  });

  // ******************************************
  it("handle basic paragraph that consists of image syntaxes", async () => {
    const input = dedent`
      See the figure below. ![*Caption](image.png) Here is the small icons ![](image1.png) ![](image2.png) 
      You see the video and sound below. ![](video.mp4)![](audio.mp3) Both video and audio tell the truth.
    `;

    const html = String(await utils.processMdx(input, "mdx"));

    expect(html).toMatchInlineSnapshot(`
      "<p>See the figure below. <img src="image.png" alt="*Caption"/> Here is the small icons <img src="image1.png" alt=""/> <img src="image2.png" alt=""/>
      You see the video and sound below. <img src="video.mp4" alt=""/><img src="audio.mp3" alt=""/> Both video and audio tell the truth.</p>"
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

  // ******************************************
  it("process markdown input, the <img> elements are in an anchor <a>", async () => {
    const input = dedent`
      <a href="https://example.com"><img src="image.png" alt="" /></a>
      <a href="https://example.com"><img src="image.png" alt="" /></a>

      <a href="https://example.com"><figure><img src="image.png" alt="" /></figure></a>

      <a href="https://example.com">
        <figure><img src="image.png" alt="" /></figure>
      </a>
    `;

    const html = await utils.processMdx(input, "md");

    expect(html).toMatchInlineSnapshot(`
      "<p>
      </p>
      <p></p>"
    `);
  });

  // ******************************************
  it("handle basic paragraph that consists of image syntaxes", async () => {
    const input = dedent`
      See the figure below. ![*Caption](image.png) Here is the small icons ![](image1.png) ![](image2.png) 
      You see the video and sound below. ![](video.mp4)![](audio.mp3) Both video and audio tell the truth.
    `;

    const html = String(await utils.processMdx(input, "md"));

    expect(html).toMatchInlineSnapshot(`
      "<p>See the figure below. <img src="image.png" alt="*Caption"/> Here is the small icons <img src="image1.png" alt=""/> <img src="image2.png" alt=""/>
      You see the video and sound below. <img src="video.mp4" alt=""/><img src="audio.mp3" alt=""/> Both video and audio tell the truth.</p>"
    `);
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

  // interesting !
  // ******************************************
  it("process markdown input, the <img> elements are in an anchor <a>", async () => {
    const input = dedent`
      <a href="https://example.com"><img src="image.png" alt="" /></a>
      <a href="https://example.com"><img src="image.png" alt="" /></a>

      <a href="https://example.com"><figure><img src="image.png" alt="" /></figure></a>

      <a href="https://example.com">
        <figure><img src="image.png" alt="" /></figure>
      </a>
    `;

    const html = String(await utils.processMdxRaw(input, "md"));

    expect(html).toMatchInlineSnapshot(`
      "<p><a href="https://example.com"><img src="image.png" alt=""/></a>
      <a href="https://example.com"><img src="image.png" alt=""/></a></p>
      <p><a href="https://example.com"></a></p><figure><a href="https://example.com"><img src="image.png" alt=""/></a></figure><p></p>
      <a href="https://example.com">
        <figure><img src="image.png" alt=""/></figure>
      </a>"
    `);
  });

  // ******************************************
  it("handle basic paragraph that consists of image syntaxes", async () => {
    const input = dedent`
      See the figure below. ![*Caption](image.png) Here is the small icons ![](image1.png) ![](image2.png) 
      You see the video and sound below. ![](video.mp4)![](audio.mp3) Both video and audio tell the truth.
    `;

    const html = String(await utils.processMdxRaw(input, "md"));

    expect(html).toMatchInlineSnapshot(`
      "<p>See the figure below. <img src="image.png" alt="*Caption"/> Here is the small icons <img src="image1.png" alt=""/> <img src="image2.png" alt=""/>
      You see the video and sound below. <img src="video.mp4" alt=""/><img src="audio.mp3" alt=""/> Both video and audio tell the truth.</p>"
    `);
  });
});
