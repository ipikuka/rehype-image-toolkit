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

  // *************************************
  it("process html input", async () => {
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

    const output = String(await utils.processHtml(input));

    expect(output).toBe(input);
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

  // ******************************************
  it("process markdown input, the <img> elements are in an anchor <a>", async () => {
    const input = dedent`
      <a href="https://example.com"><img src="image.png" alt="" /></a>
      <a href="https://example.com"><img src="image.png" alt="" /></a>

      <a href="https://example.com"><figure><img src="image.png" alt="" /></figure></a>
    `;

    const html = String(await utils.processMd(input));

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

    const html = String(await utils.processMd(input));

    expect(html).toMatchInlineSnapshot(`
      "<p>See the figure below. <img src="image.png" alt="*Caption"> Here is the small icons <img src="image1.png" alt=""> <img src="image2.png" alt="">
      You see the video and sound below. <img src="video.mp4" alt=""><img src="audio.mp3" alt=""> Both video and audio tell the truth.</p>"
    `);
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

  // *************************************
  it("process markdown input, image first", async () => {
    const input = dedent`
      <img alt="*Image Caption" src="image.png">
      <video alt="*Video Caption" src="video.mp4"></video>
      <audio alt="*Audio Caption" src="audio.mp3"></audio>
      <p>hello</p>
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<img alt="*Image Caption" src="image.png">
      <video alt="*Video Caption" src="video.mp4"></video>
      <audio alt="*Audio Caption" src="audio.mp3"></audio>
      <p>hello</p>"
    `);
  });

  // *************************************
  it("process markdown input, video first --> causes wrap with p", async () => {
    const input = dedent`
      <video alt="*Video Caption" src="video.mp4"></video>
      <img alt="*Image Caption" src="image.png">
      <audio alt="*Audio Caption" src="audio.mp3"></audio>
      <p>hello</p>
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><video alt="*Video Caption" src="video.mp4"></video>
      <img alt="*Image Caption" src="image.png">
      <audio alt="*Audio Caption" src="audio.mp3"></audio></p>
      <p>hello</p>"
    `);
  });

  // *************************************
  it("process markdown input, all html with blank lines, image first", async () => {
    const input = dedent`
      <img alt="*Image Caption" src="image.png">

      <video alt="*Video Caption" src="video.mp4"></video>

      <audio alt="*Audio Caption" src="audio.mp3"></audio>

      <p>hello</p>
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<img alt="*Image Caption" src="image.png">
      <p><video alt="*Video Caption" src="video.mp4"></video></p>
      <p><audio alt="*Audio Caption" src="audio.mp3"></audio></p>
      <p>hello</p>"
    `);
  });

  // *************************************
  it("process markdown input, all html with blank lines, video first", async () => {
    const input = dedent`
      <video alt="*Video Caption" src="video.mp4"></video>

      <img alt="*Image Caption" src="image.png">

      <audio alt="*Audio Caption" src="audio.mp3"></audio>

      <p>hello</p>
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><video alt="*Video Caption" src="video.mp4"></video></p>
      <img alt="*Image Caption" src="image.png">
      <p><audio alt="*Audio Caption" src="audio.mp3"></audio></p>
      <p>hello</p>"
    `);
  });

  // ******************************************
  it("process markdown input, the <img> elements are in an anchor <a>", async () => {
    const input = dedent`
      <a href="https://example.com"><img src="image.png" alt="" /></a>
      <a href="https://example.com"><img src="image.png" alt="" /></a>

      <a href="https://example.com"><figure><img src="image.png" alt="" /></figure></a>
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><a href="https://example.com"><img src="image.png" alt=""></a>
      <a href="https://example.com"><img src="image.png" alt=""></a></p>
      <p><a href="https://example.com"></a></p><figure><a href="https://example.com"><img src="image.png" alt=""></a></figure><p></p>"
    `);
  });

  // ******************************************
  it("handle basic paragraph that consists of image syntaxes", async () => {
    const input = dedent`
      See the figure below. ![*Caption](image.png) Here is the small icons ![](image1.png) ![](image2.png) 
      You see the video and sound below. ![](video.mp4)![](audio.mp3) Both video and audio tell the truth.
    `;

    const html = String(await utils.processMdRaw(input));

    expect(html).toMatchInlineSnapshot(`
      "<p>See the figure below. <img src="image.png" alt="*Caption"> Here is the small icons <img src="image1.png" alt=""> <img src="image2.png" alt="">
      You see the video and sound below. <img src="video.mp4" alt=""><img src="audio.mp3" alt=""> Both video and audio tell the truth.</p>"
    `);
  });
});
