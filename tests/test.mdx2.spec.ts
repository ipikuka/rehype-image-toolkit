import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

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

  // TODO fix the last element within anchor not to be autolinked
  // ******************************************
  it("MDX source, handle autolinks", async () => {
    const input = dedent`
      ![]([image.png])

      ![]((image.png))

      handle ![]([image.png]) ![]((image.png)) in a paragraph

      do not autolink [![]([image.png])](https://example.com)

      <img src="[image.png]" alt="" />

      <img src="(image.png)" alt="" />

      <img src="[image.png]" alt="" /> text

      <img src="(image.png)" alt="" /> text

      handle <img src="[image.png]" alt="" /> <img src="(image.png)" alt="" /> in a paragraph

      do not autolink <a href="https://example.com"><img src="[image.png]" alt="" /></a>
    `;

    expect(await processMdxRaw(input, "md")).toMatchInlineSnapshot(`
      "<p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>
      <p>do not autolink <a href="https://example.com"><img src="image.png" alt=""/></a></p>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>
      <p>do not autolink <a href="https://example.com"><img src="image.png" alt=""/></a></p>"
    `);

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(`
      "<p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>
      <p>do not autolink <a href="https://example.com"><img src="image.png" alt=""/></a></p>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <a href="image.png" target="_blank"><img src="image.png" alt=""/></a>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p><a href="image.png" target="_blank"><img src="image.png" alt=""/></a> text</p>
      <p>handle <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> <a href="image.png" target="_blank"><img src="image.png" alt=""/></a> in a paragraph</p>
      <p>do not autolink <a href="https://example.com"><a href="image.png" target="_blank"><img src="image.png" alt=""/></a></a></p>"
    `);
  });

  // ******************************************
  it("MDX source, handle caption for images", async () => {
    const input = dedent`
      ![+Hello](image.png)

      ![*Hello](image.png)

      ![caption:Hello](image.png)

      <img src="image.png" alt="+Hello" />

      <img src="image.png" alt="*Hello" />

      <img src="image.png" alt="caption:Hello" />
    `;

    expect(await processMdxRaw(input, "md")).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello"/></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"/></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>"
    `);

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello"/></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"/></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"/><figcaption>Hello</figcaption></figure>"
    `);
  });

  // ******************************************
  it("MDX source, handle caption for videos and images to be converted into videos", async () => {
    const input = dedent`
      ![+Hello](video.mp4)

      ![*Hello](video.mp4)

      ![caption:Hello](video.mp4)

      <img src="video.mp4" alt="+Hello" />

      <img src="video.mp4" alt="*Hello" />

      <img src="video.mp4" alt="caption:Hello" />

      <video src="video.mp4" alt="+Hello"></video>

      <video src="video.mp4" alt="*Hello"></video>

      <video src="video.mp4" alt="caption:Hello"></video>
    `;

    expect(await processMdxRaw(input, "md")).toMatchInlineSnapshot(`
      "<figure><video><source src="video.mp4" type="video/mp4"/></video></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video src="video.mp4"></video></figure>
      <figure><video src="video.mp4"></video><figcaption>Hello</figcaption></figure>
      <figure><video src="video.mp4"></video><figcaption>Hello</figcaption></figure>"
    `);

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(`
      "<figure><video><source src="video.mp4" type="video/mp4"/></video></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"/></video><figcaption>Hello</figcaption></figure>
      <figure><video src="video.mp4"></video></figure>
      <figure><video src="video.mp4"></video><figcaption>Hello</figcaption></figure>
      <figure><video src="video.mp4"></video><figcaption>Hello</figcaption></figure>"
    `);
  });

  // ******************************************
  it("MDX source, handle caption for audio and images to be converted into audio", async () => {
    const input = dedent`
      ![+Hello](audio.mp3)

      ![*Hello](audio.mp3)

      ![caption:Hello](audio.mp3)

      <img src="audio.mp3" alt="+Hello" />

      <img src="audio.mp3" alt="*Hello" />

      <img src="audio.mp3" alt="caption:Hello" />

      <audio src="audio.mp3" alt="+Hello"></audio>

      <audio src="audio.mp3" alt="*Hello"></audio>

      <audio src="audio.mp3" alt="caption:Hello"></audio>
    `;

    expect(await processMdxRaw(input, "md")).toMatchInlineSnapshot(`
      "<figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio src="audio.mp3"></audio></figure>
      <figure><audio src="audio.mp3"></audio><figcaption>Hello</figcaption></figure>
      <figure><audio src="audio.mp3"></audio><figcaption>Hello</figcaption></figure>"
    `);

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(`
      "<figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"/></audio><figcaption>Hello</figcaption></figure>
      <figure><audio src="audio.mp3"></audio></figure>
      <figure><audio src="audio.mp3"></audio><figcaption>Hello</figcaption></figure>
      <figure><audio src="audio.mp3"></audio><figcaption>Hello</figcaption></figure>"
    `);
  });

  // TODO handle name casing like autoplay autoPlay
  // ******************************************
  it("MDX source, handle adding attributes utilizing title attribute", async () => {
    const input = dedent`
      ![](image.png "title > width=2rem height=1rem")
      <img src="image.png" alt="" title="title > width=2rem height=1rem" />

      ![](image.png "> 400x300 loading=lazy")
      <img src="image.png" alt="" title="> 400x300 loading=lazy" />

      ![](image.png "title > 50%x3rem")
      <img src="image.png" alt="" title="title > 50%x3rem" />

      ![](video.mp4 "title > width=200 height=100 muted")
      <img src="video.mp4" alt="" title="title > width=200 height=100 muted" />
      <video src="video.mp4" alt="" title="title > width=200 height=100 muted"></video>

      ![](audio.mp3 "title > #audio-id .audio-class autoplay")
      <img src="audio.mp3" alt="" title="title > #audio-id .audio-class autoPlay" />
      <audio src="audio.mp3" alt="" title="title > #audio-id .audio-class autoPlay"></audio>
    `;

    expect(await prettier.format(await processMdxRaw(input, "md"), { parser: "html" }))
      .toMatchInlineSnapshot(`
      "<p>
        <img src="image.png" alt="" title="title" style="width: 2rem; height: 1rem" />
        <img src="image.png" alt="" title="title" style="width: 2rem; height: 1rem" />
      </p>
      <p>
        <img src="image.png" alt="" width="400" height="300" loading="lazy" />
        <img src="image.png" alt="" width="400" height="300" loading="lazy" />
      </p>
      <p>
        <img src="image.png" alt="" title="title" style="width: 50%; height: 3rem" />
        <img src="image.png" alt="" title="title" style="width: 50%; height: 3rem" />
      </p>
      <video title="title" width="200" height="100" muted="">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video title="title" width="200" height="100" muted="">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video
        src="video.mp4"
        alt=""
        title="title"
        width="200"
        height="100"
        muted=""
      ></video>
      <audio title="title" id="audio-id" class="audio-class" autoplay="">
        <source src="audio.mp3" type="audio/mpeg" />
      </audio>
      <audio title="title" id="audio-id" class="audio-class" autoplay="">
        <source src="audio.mp3" type="audio/mpeg" />
      </audio>
      <audio
        src="audio.mp3"
        alt=""
        title="title"
        id="audio-id"
        class="audio-class"
        autoplay=""
      ></audio>
      "
    `);

    expect(await prettier.format(await processMdx(input, "mdx"), { parser: "html" }))
      .toMatchInlineSnapshot(`
      "<p>
        <img src="image.png" alt="" title="title" style="width: 2rem; height: 1rem" />
      </p>
      <img src="image.png" alt="" title="title" style="width: 2rem; height: 1rem" />
      <p><img src="image.png" alt="" width="400" height="300" loading="lazy" /></p>
      <img src="image.png" alt="" width="400" height="300" loading="lazy" />
      <p>
        <img src="image.png" alt="" title="title" style="width: 50%; height: 3rem" />
      </p>
      <img src="image.png" alt="" title="title" style="width: 50%; height: 3rem" />
      <video title="title" width="200" height="100" muted="">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video title="title" width="200" height="100" muted="">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video
        src="video.mp4"
        alt=""
        title="title"
        width="200"
        height="100"
        muted=""
      ></video>
      <audio title="title" id="audio-id" class="audio-class" autoplay="">
        <source src="audio.mp3" type="audio/mpeg" />
      </audio>
      <audio title="title" id="audio-id" class="audio-class" autoplay="">
        <source src="audio.mp3" type="audio/mpeg" />
      </audio>
      <audio
        src="audio.mp3"
        alt=""
        title="title"
        id="audio-id"
        class="audio-class"
        autoplay=""
      ></audio>
      "
    `);
  });

  // ******************************************
  it("MDX source, trial for MDX component for the style", async () => {
    const input = dedent`
      <img src="image.png" alt="" hidden={true} style={{backgroundColor: "red", padding: 5 + "px"}} title="title > style=padding:10px~20px;border-bottom:2px~solid~red;" />
    `;

    expect(await processMdx(input, "mdx")).toMatchInlineSnapshot(
      `"<img src="image.png" alt="" hidden="" style="background-color:red;padding:10px 20px;border-bottom:2px solid red" title="title"/>"`,
    );
  });
});
