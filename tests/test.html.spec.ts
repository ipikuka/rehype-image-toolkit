import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

import { processHtml } from "./util";

describe("reyhpe-image-hack, with html sources", () => {
  // *************************************
  it("process html input, preserve basic html <img>, <video>, and <audio>", async () => {
    const input = dedent`
      <img src="image.png" alt="alt">
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="alt">
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>"
    `);
  });

  // *************************************
  it("process html input, handle figure and caption", async () => {
    const input = dedent`
      <img src="image.png" alt="^Image Caption">
      <img src="image.png" alt="@Image Alt">
    `;

    const html = String(await processHtml(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <img src="image.png" alt="Image Caption" />
        <figcaption>Image Caption</figcaption>
      </figure>
      <figure><img src="image.png" alt="Image Alt" /></figure>
      "
    `);
  });

  // *************************************
  it("process html input, handle figure and caption in paragraph", async () => {
    const input = dedent`
      <p><img src="image.png" alt="^Image Caption"><img src="image.png" alt="@Image Alt"></p>
    `;

    const html = String(await processHtml(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <img src="image.png" alt="Image Caption" />
        <figcaption>Image Caption</figcaption>
      </figure>
      <figure><img src="image.png" alt="Image Alt" /></figure>
      "
    `);
  });

  // *************************************
  it("process html input, handle indentations and whitespaces", async () => {
    const input = dedent`
      <h4>Title</h4>
      <p>
        <img src="image.png" alt="^Image Caption">
      </p>
      <img src="image.png" alt="@Image Alt">
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<h4>Title</h4>
      <figure><img src="image.png" alt="Image Caption"><figcaption>Image Caption</figcaption></figure>
      <figure><img src="image.png" alt="Image Alt"></figure>"
    `);
  });

  // *************************************
  it("process html input, handle autolink", async () => {
    const input = dedent`
      <img src="[image.png]" alt="alt">
      <img src="(image.png)" alt="alt">

      <img src="[image.png]" alt="^caption">
      <img src="(image.png)" alt="^caption">
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<a href="image.png" target="_blank"><img src="image.png" alt="alt"></a>
      <a href="image.png" target="_blank"><img src="image.png" alt="alt"></a>

      <a href="image.png" target="_blank"><figure><img src="image.png" alt="caption"><figcaption>caption</figcaption></figure></a>
      <figure><a href="image.png" target="_blank"><img src="image.png" alt="caption"></a><figcaption>caption</figcaption></figure>"
    `);
  });

  // *************************************
  it("process html input, example in the README", async () => {
    const input = dedent`
      <p>
        It adds autolink.
        <img src="[https://example.com/image.png]" alt="alt"/>
      </p>
      <p>
        It adds caption.
        <img src="image.png" alt="^Image Caption"/>
      </p>
      <p>
        It adds attributes.
        <img src="image.png" title="title > 60x60"/>
      </p>
    `;

    const html = String(await processHtml(input));

    expect(html).toMatchInlineSnapshot(`
      "<p>
        It adds autolink.
        <a href="https://example.com/image.png" target="_blank"><img src="https://example.com/image.png" alt="alt"></a>
      </p>
      <p>
        It adds caption.
      </p>
      <figure><img src="image.png" alt="Image Caption"><figcaption>Image Caption</figcaption></figure>
      <p>
        It adds attributes.
        <img src="image.png" title="title" width="60" height="60">
      </p>"
    `);
  });
});
