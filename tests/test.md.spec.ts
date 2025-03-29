import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

import { processMd, processMdRawFirst } from "./util/index";

describe("reyhpe-image-hack, with markdown sources", () => {
  // ******************************************
  it("handle basic images / videos / audio", async () => {
    const input = dedent`
      ![]()

      ![](image.png)

      ![](video.mp4)

      ![](audio.mp3)

      ![](unknown.xxx)

      ![](invalid)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p><img src="" alt="" /></p>
      <p><img src="image.png" alt="" /></p>
      <video><source src="video.mp4" type="video/mp4" /></video>
      <audio><source src="audio.mp3" type="audio/mpeg" /></audio>
      <p><img src="unknown.xxx" alt="" /></p>
      <p><img src="invalid" alt="" /></p>
      "
    `);
  });

  // ******************************************
  it("handle caption for images", async () => {
    const input = dedent`
      ![+Hello](image.png)

      ![*Hello](image.png)

      ![caption:Hello](image.png)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello" /></figure>
      <figure>
        <img src="image.png" alt="Hello" />
        <figcaption>Hello</figcaption>
      </figure>
      <figure>
        <img src="image.png" alt="Hello" />
        <figcaption>Hello</figcaption>
      </figure>
      "
    `);
  });

  // ******************************************
  it("handle caption above", async () => {
    const input = dedent`
      ![+Hello](image.png)

      ![*Hello](image.png)

      ![caption:Hello](image.png)
    `;

    const html = String(await processMd(input, { figureCaptionPosition: "above" }));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello" /></figure>
      <figure>
        <figcaption>Hello</figcaption>
        <img src="image.png" alt="Hello" />
      </figure>
      <figure>
        <figcaption>Hello</figcaption>
        <img src="image.png" alt="Hello" />
      </figure>
      "
    `);
  });

  // ******************************************
  it("handle caption for videos", async () => {
    const input = dedent`
      ![+Hello](video.mp4)

      ![*Hello](video.mp4)

      ![caption:Hello](video.mp4)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <video><source src="video.mp4" type="video/mp4" /></video>
      </figure>
      <figure>
        <video><source src="video.mp4" type="video/mp4" /></video>
        <figcaption>Hello</figcaption>
      </figure>
      <figure>
        <video><source src="video.mp4" type="video/mp4" /></video>
        <figcaption>Hello</figcaption>
      </figure>
      "
    `);
  });

  // ******************************************
  it("handle caption for audio", async () => {
    const input = dedent`
      ![+Hello](audio.mp3)

      ![*Hello](audio.mp3)

      ![caption:Hello](audio.mp3)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <audio><source src="audio.mp3" type="audio/mpeg" /></audio>
      </figure>
      <figure>
        <audio><source src="audio.mp3" type="audio/mpeg" /></audio>
        <figcaption>Hello</figcaption>
      </figure>
      <figure>
        <audio><source src="audio.mp3" type="audio/mpeg" /></audio>
        <figcaption>Hello</figcaption>
      </figure>
      "
    `);
  });

  // ******************************************
  it("handle transform for videos / audio, if it is last element in a paragraph", async () => {
    const input = dedent`
      Here is the video ![alt will be disregarded](video.mp4 "title")

      Here is the audio ![alt will be disregarded](audio.mp3 "title")
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>Here is the video</p>
      <video title="title"><source src="video.mp4" type="video/mp4" /></video>
      <p>Here is the audio</p>
      <audio title="title"><source src="audio.mp3" type="audio/mpeg" /></audio>
      "
    `);
  });

  // ******************************************
  it("handle caption for images / videos / audio, if it is last element in a paragraph", async () => {
    const input = dedent`
      Here is the image ![*Caption of the image](image.png "title")

      Here is the video ![*Caption of the video](video.mp4 "title")

      Here is the audio ![*Caption of the audio](audio.mp3 "title")
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>Here is the image</p>
      <figure>
        <img src="image.png" alt="Caption of the image" title="title" />
        <figcaption>Caption of the image</figcaption>
      </figure>
      <p>Here is the video</p>
      <figure>
        <video title="title"><source src="video.mp4" type="video/mp4" /></video>
        <figcaption>Caption of the video</figcaption>
      </figure>
      <p>Here is the audio</p>
      <figure>
        <audio title="title"><source src="audio.mp3" type="audio/mpeg" /></audio>
        <figcaption>Caption of the audio</figcaption>
      </figure>
      "
    `);
  });

  // ******************************************
  it("does NOT add caption and NOT transform, since it is NOT the last element in a paragraph", async () => {
    const input = dedent`
      ![*Caption of the image](image.png "title") blocked text

      ![*Caption of the video](video.mp4 "title") blocked text

      ![*Caption of the audio](audio.mp3 "title") blocked text
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <img src="image.png" alt="Caption of the image" title="title" /> blocked text
      </p>
      <p>
        <img src="video.mp4" alt="Caption of the video" title="title" /> blocked text
      </p>
      <p>
        <img src="audio.mp3" alt="Caption of the audio" title="title" /> blocked text
      </p>
      "
    `);
  });

  // TODO
  // ******************************************
  it("handle caption, in html <img>, <video>, and <audio>", async () => {
    const input = dedent`
      <img alt="*Image Caption" src="image.png">

      <video alt="*Video Caption" src="image.png">

      <audio alt="*Audio Caption" src="image.png">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <img alt="Image Caption" src="image.png" />
        <figcaption>Image Caption</figcaption>
      </figure>
      <figure>
        <video src="image.png">
          <figure>
            <audio src="image.png"></audio>
            <figcaption>Audio Caption</figcaption>
          </figure>
        </video>
        <figcaption>Video Caption</figcaption>
      </figure>
      "
    `);
  });

  // delete
  // ******************************************
  it("handle caption, in html <video>", async () => {
    const input = dedent`
      <video alt="*Video Caption" src="video.mp4">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <video src="video.mp4"></video>
        <figcaption>Video Caption</figcaption>
      </figure>
      "
    `);
  });

  // delete
  // ******************************************
  it("handle caption, in html <audio>", async () => {
    const input = dedent`
      <audio alt="*Audio Caption" src="audio.mp3">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <audio src="audio.mp3"></audio>
        <figcaption>Audio Caption</figcaption>
      </figure>
      "
    `);
  });

  // TODO
  // ******************************************
  it("handle figure with no caption, in html <img>, <video>, and <audio>", async () => {
    const input = dedent`
      <img alt="+" src="image.png">

      <video alt="+" src="video.mp4">

      <audio alt="+" src="audio.mp3">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><img alt="" src="image.png" /></figure>
      <figure>
        <video src="video.mp4">
          <figure><audio src="audio.mp3"></audio></figure>
        </video>
      </figure>
      "
    `);
  });

  // delete
  // ******************************************
  it("handle figure with no caption, in html <video>", async () => {
    const input = dedent`
      <video alt="+" src="video.mp4">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><video src="video.mp4"></video></figure>
      "
    `);
  });

  // delete
  // ******************************************
  it("handle figure with no caption, in html <audio>", async () => {
    const input = dedent`
      <audio alt="+" src="audio.mp3">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><audio src="audio.mp3"></audio></figure>
      "
    `);
  });

  // ******************************************
  it("handle images / videos / audio in blockquotes", async () => {
    const input = dedent`
      > Here is the image. ![*Image Caption](image.png)
      >
      > Here is the video. ![*Video Caption](video.mp4)
      >
      > Here is the audio. ![*Audio Caption](audio.mp3)
    `;

    const html = String(
      await processMdRawFirst(input, {
        alwaysAddControlsForVideos: true,
        alwaysAddControlsForAudio: true,
      }),
    );

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<blockquote>
        <p>Here is the image.</p>
        <figure>
          <img src="image.png" alt="Image Caption" />
          <figcaption>Image Caption</figcaption>
        </figure>
        <p>Here is the video.</p>
        <figure>
          <video controls><source src="video.mp4" type="video/mp4" /></video>
          <figcaption>Video Caption</figcaption>
        </figure>
        <p>Here is the audio.</p>
        <figure>
          <audio controls><source src="audio.mp3" type="audio/mpeg" /></audio>
          <figcaption>Audio Caption</figcaption>
        </figure>
      </blockquote>
      "
    `);
  });

  // TODO
  // ******************************************
  it("handle images / videos / audio in blockquotes", async () => {
    const input = dedent`
      > Here is the image. <img alt="*Image Caption" src="image.png">
      >
      > Here is the video. <video alt="*Video Caption" src="video.mp4">
      >
      > Here is the audio. <audio alt="*Audio Caption" src="audio.mp3">
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<blockquote>
        <p>Here is the image.</p>
        <figure>
          <img alt="Image Caption" src="image.png" />
          <figcaption>Image Caption</figcaption>
        </figure>
        <p>
          Here is the video.
          <figure>
            <video src="video.mp4"></video>
            <figcaption>Video Caption</figcaption>
          </figure>
        </p>
        <p>
          Here is the audio.
          <figure>
            <audio src="audio.mp3"></audio>
            <figcaption>Audio Caption</figcaption>
          </figure>
        </p>
      </blockquote>
      "
    `);
  });

  // ******************************************
  it("add attributes in title", async () => {
    const input = dedent`
      ![alt](image.png "title > #image-id .image-class width=2rem height=1rem")

      ![alt](video.mp4 "title > #video-id .video-class width=200 height=100")

      ![alt](audio.mp3 "title > #audio-id .audio-class autoplay")
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <img
          src="image.png"
          alt="alt"
          title="title"
          id="image-id"
          class="image-class"
          style="width: 2rem; height: 1rem"
        />
      </p>
      <video title="title" id="video-id" class="video-class" width="200" height="100">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <audio title="title" id="audio-id" class="audio-class" autoplay>
        <source src="audio.mp3" type="audio/mpeg" />
      </audio>
      "
    `);
  });

  // ******************************************
  it("simple image size", async () => {
    const input = dedent`
      ![alt](image.png "title > 400x300 loading=lazy")
      ![alt](image.png "title > 50%x3rem")
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <img
          src="image.png"
          alt="alt"
          title="title"
          width="400"
          height="300"
          loading="lazy"
        />
        <img
          src="image.png"
          alt="alt"
          title="title"
          style="width: 50%; height: 3rem"
        />
      </p>
      "
    `);
  });

  // ******************************************
  it("simple video size and additional properties", async () => {
    const input = dedent`
      ![](video.mp4 "title > 400x300 autoplay muted poster=image.png")

      ![](video.mp4 "> 70%x controls autoplay loop style=max-width:500px")

      ![](video.mp4 "> x70% controls autoplay loop style=max-width:500px")
      
      ![](video.mp4 "> autoplay loop style=max-width:500px x70% controls")

      ![](video.mp4 "> autoplay loop style=max-width:500px 70%x controls")
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<video title="title" width="400" height="300" autoplay muted poster="image.png">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video style="width: 70%; max-width: 500px" controls autoplay loop>
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video style="height: 70%; max-width: 500px" controls autoplay loop>
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video autoplay loop style="max-width: 500px; height: 70%" controls>
        <source src="video.mp4" type="video/mp4" />
      </video>
      <video autoplay loop style="max-width: 500px; width: 70%" controls>
        <source src="video.mp4" type="video/mp4" />
      </video>
      "
    `);
  });

  // ******************************************
  it("handle transformation videos / audio wrapped with a link ", async () => {
    const input = dedent`
      [![](image.png)](https://example.com)

      [![](video.mp4)](https://example.com)

      [![](audio.mp3)](https://example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <a href="https://example.com"><img src="image.png" alt="" /></a>
      </p>
      <a href="https://example.com"
        ><video><source src="video.mp4" type="video/mp4" /></video
      ></a>
      <a href="https://example.com"
        ><audio><source src="audio.mp3" type="audio/mpeg" /></audio
      ></a>
      "
    `);
  });

  // ******************************************
  it("handle transformation videos / audio; and handle caption; already wrapped with a link ", async () => {
    const input = dedent`
      [![+](image.png)](https://example.com)

      [![+](video.mp4)](https://example.com)

      [![+](audio.mp3)](https://example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<a href="https://example.com"
        ><figure><img src="image.png" alt="" /></figure
      ></a>
      <a href="https://example.com"
        ><figure>
          <video><source src="video.mp4" type="video/mp4" /></video></figure
      ></a>
      <a href="https://example.com"
        ><figure>
          <audio><source src="audio.mp3" type="audio/mpeg" /></audio></figure
      ></a>
      "
    `);
  });

  // ******************************************
  it("handle auto link for images", async () => {
    const input = dedent`
      ![]([image.png]) ![+alt]([image.jpeg])

      ![*Caption]([image.png] "> 60x60")
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <a href="image.png" target="_blank"><img src="image.png" alt="" /></a>
      </p>
      <figure>
        <a href="image.jpeg" target="_blank"><img src="image.jpeg" alt="alt" /></a>
      </figure>
      <figure>
        <a href="image.png" target="_blank"
          ><img src="image.png" alt="Caption" width="60" height="60"
        /></a>
        <figcaption>Caption</figcaption>
      </figure>
      "
    `);
  });

  // ******************************************
  it("do NOT add auto link which is already wrapped with a link", async () => {
    const input = dedent`
      [![alt]([image.png])](https://example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <a href="https://example.com"><img src="image.png" alt="alt" /></a>
      </p>
      "
    `);
  });

  // ******************************************
  it("do NOT add auto link which is already wrapped with a link, (no caption since not the last)", async () => {
    const input = dedent`
      [![+alt]([image.png])](https://example.com) blocked text

      [![*alt]([image.png])](https://example.com) blocked text
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <a href="https://example.com"><img src="image.png" alt="alt" /></a> blocked
        text
      </p>
      <p>
        <a href="https://example.com"><img src="image.png" alt="alt" /></a> blocked
        text
      </p>
      "
    `);
  });

  // TODO, normally does nod add auto link if the parent as an anchor, but here the parent is figure
  // ******************************************
  it("do NOT add auto link, but add caption; which is already wrapped with a link", async () => {
    const input = dedent`
      [![+alt]([image.png])](https://example.com)

      [![*alt]([image.png])](https://example.com)

      [![caption:alt]([image.png])](https://example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<a href="https://example.com"
        ><figure>
          <a href="image.png" target="_blank"
            ><img src="image.png" alt="alt"
          /></a></figure
      ></a>
      <a href="https://example.com"
        ><figure>
          <a href="image.png" target="_blank"><img src="image.png" alt="alt" /></a>
          <figcaption>alt</figcaption>
        </figure></a
      >
      <a href="https://example.com"
        ><figure>
          <a href="image.png" target="_blank"><img src="image.png" alt="alt" /></a>
          <figcaption>alt</figcaption>
        </figure></a
      >
      "
    `);
  });

  // ******************************************
  it("do NOT auto link for videos / audio, just remove brackets from the source", async () => {
    const input = dedent`
      ![]([video.mp4])

      ![]([audio.mp3])

      ![+]([video.mp4])

      ![+]([audio.mp3])

      [![+]([video.mp4])](www.example.com)

      [![+]([audio.mp3])](www.example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<video><source src="video.mp4" type="video/mp4" /></video>
      <audio><source src="audio.mp3" type="audio/mpeg" /></audio>
      <figure>
        <video><source src="video.mp4" type="video/mp4" /></video>
      </figure>
      <figure>
        <audio><source src="audio.mp3" type="audio/mpeg" /></audio>
      </figure>
      <a href="www.example.com"
        ><figure>
          <video><source src="video.mp4" type="video/mp4" /></video></figure
      ></a>
      <a href="www.example.com"
        ><figure>
          <audio><source src="audio.mp3" type="audio/mpeg" /></audio></figure
      ></a>
      "
    `);
  });

  // ******************************************
  it("do NOT add auto link for relative links", async () => {
    const input = dedent`
    ![]([../image.jpeg])

    ![*Hello]([../image.jpeg])
  `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p><img src="../image.jpeg" alt="" /></p>
      <figure>
        <img src="../image.jpeg" alt="Hello" />
        <figcaption>Hello</figcaption>
      </figure>
      "
    `);
  });
});
