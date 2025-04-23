import { describe, it, expect } from "vitest";
import dedent from "dedent";
import * as prettier from "prettier";

import { processMd, processMdRawFirst } from "./util/index";

describe("reyhpe-image-hack, with markdown sources", () => {
  // ******************************************
  it("handle basic images and transformation to videos/audio", async () => {
    const input = dedent`
      ![]()

      ![](image.png)

      ![](video.mp4)

      ![](audio.mp3)

      ![](unknown.xxx)

      ![](invalid)
    `;

    const html = String(await processMd(input));

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="" alt=""></p>
      <p><img src="image.png" alt=""></p>
      <video><source src="video.mp4" type="video/mp4"></video>
      <audio><source src="audio.mp3" type="audio/mpeg"></audio>
      <p><img src="unknown.xxx" alt=""></p>
      <p><img src="invalid" alt=""></p>"
    `);
  });

  // ******************************************
  it("handle basic paragraph that consists of images to be transformed to videos/audio", async () => {
    const input = dedent`
      See the figure below. ![^Caption](image.png) Here is the small icons ![](image1.png) ![](image2.png) 
      You see the video and sound below. ![](video.mp4)![](audio.mp3) Both video and audio tell the truth.
    `;

    const html = String(await processMd(input));

    expect(html).toMatchInlineSnapshot(`
      "<p>See the figure below.</p>
      <figure><img src="image.png" alt="Caption"><figcaption>Caption</figcaption></figure>
      <p>Here is the small icons <img src="image1.png" alt=""> <img src="image2.png" alt="">
      You see the video and sound below.</p>
      <video><source src="video.mp4" type="video/mp4"></video>
      <audio><source src="audio.mp3" type="audio/mpeg"></audio>
      <p>Both video and audio tell the truth.</p>"
    `);
  });

  // ******************************************
  it("handle unwrap images or keep inline videos/audio in paragraph", async () => {
    const input = dedent`
      ![&](image.png)
      
      ![&]([image.png])
      
      ![&]((image.png))

      ![~](video.mp4)
      
      ![~](audio.mp3)
    `;

    const html = String(await processMd(input));

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="">
      <a href="image.png" target="_blank"><img src="image.png" alt=""></a>
      <a href="image.png" target="_blank"><img src="image.png" alt=""></a>
      <p><video><source src="video.mp4" type="video/mp4"></video></p>
      <p><audio><source src="audio.mp3" type="audio/mpeg"></audio></p>"
    `);
  });

  // ******************************************
  it("handle unwrap <img> or keep inline <video>, <audio> in paragraph", async () => {
    const input = dedent`
      <p><img src="image.png" alt="&"/></p>
      <p><img src="[image.png]" alt="&"/></p>
      <p><img src="(image.png)" alt="&"/></p>

      <p><img src="video.mp4" alt="~"/></p>
      <p><img src="audio.mp3" alt="~"/></p>
      <p><a href="#"><img src="video.mp4" alt="~"/></a></p>
      <p><a href="#"><img src="audio.mp3" alt="~"/></a></p>

      <p><video src="video.mp4" alt="~"/></p>
      <p><audio src="audio.mp3" alt="~"/></p>
      <p><a href="#"><video src="video.mp4" alt="~"/></a></p>
      <p><a href="#"><audio src="audio.mp3" alt="~"/></a></p>
    `;

    const html = String(await processMdRawFirst(input));

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="">
      <a href="image.png" target="_blank"><img src="image.png" alt=""></a>
      <a href="image.png" target="_blank"><img src="image.png" alt=""></a>
      <p><video><source src="video.mp4" type="video/mp4"></video></p>
      <p><audio><source src="audio.mp3" type="audio/mpeg"></audio></p>
      <p><a href="#"><video><source src="video.mp4" type="video/mp4"></video></a></p>
      <p><a href="#"><audio><source src="audio.mp3" type="audio/mpeg"></audio></a></p>
      <p><video src="video.mp4"></video></p>
      <p><audio src="audio.mp3"></audio></p>
      <p><a href="#"><video src="video.mp4"></video></a></p>
      <p><a href="#"><audio src="audio.mp3"></audio></a></p>"
    `);
  });

  // ******************************************
  it("check the behavior of conversion and default extraction without any other directives ", async () => {
    const input = dedent`
      <p><img src="video.mp4"/></p>
      <p><img src="audio.mp3"/></p>
      <p><a href="#"><img src="video.mp4"/></a></p>
      <p><a href="#"><img src="audio.mp3"/></a></p>

      <p><video src="video.mp4"/></p>
      <p><audio src="audio.mp3"/></p>
      <p><a href="#"><video src="video.mp4"/></a></p>
      <p><a href="#"><audio src="audio.mp3"/></a></p>
    `;

    const html = String(await processMdRawFirst(input));

    expect(html).toMatchInlineSnapshot(`
      "<video><source src="video.mp4" type="video/mp4"></video>
      <audio><source src="audio.mp3" type="audio/mpeg"></audio>
      <a href="#"><video><source src="video.mp4" type="video/mp4"></video></a>
      <a href="#"><audio><source src="audio.mp3" type="audio/mpeg"></audio></a>
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>
      <a href="#"><video src="video.mp4"></video></a>
      <a href="#"><audio src="audio.mp3"></audio></a>"
    `);
  });

  // ******************************************
  it("handle adding caption for images", async () => {
    const input = dedent`
      ![@Hello](image.png)

      ![f:Hello](image.png)

      ![^Hello](image.png)

      ![c:Hello](image.png)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello" /></figure>
      <figure><img src="image.png" alt="Hello" /></figure>
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

    expect(html).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello"></figure>
      <figure><img src="image.png" alt="Hello"></figure>
      <figure><img src="image.png" alt="Hello"><figcaption>Hello</figcaption></figure>
      <figure><img src="image.png" alt="Hello"><figcaption>Hello</figcaption></figure>"
    `);
  });

  // ******************************************
  it("handle adding caption above for images", async () => {
    const input = dedent`
      ![@Hello](image.png)

      ![^Hello](image.png)

      ![c:Hello](image.png)
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

    expect(html).toMatchInlineSnapshot(`
      "<figure><img src="image.png" alt="Hello"></figure>
      <figure><figcaption>Hello</figcaption><img src="image.png" alt="Hello"></figure>
      <figure><figcaption>Hello</figcaption><img src="image.png" alt="Hello"></figure>"
    `);
  });

  // ******************************************
  it("handle adding caption for videos", async () => {
    const input = dedent`
      ![@Hello](video.mp4)

      ![^Hello](video.mp4)

      ![c:Hello](video.mp4)
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

    expect(html).toMatchInlineSnapshot(`
      "<figure><video><source src="video.mp4" type="video/mp4"></video></figure>
      <figure><video><source src="video.mp4" type="video/mp4"></video><figcaption>Hello</figcaption></figure>
      <figure><video><source src="video.mp4" type="video/mp4"></video><figcaption>Hello</figcaption></figure>"
    `);
  });

  // ******************************************
  it("handle adding caption for audio", async () => {
    const input = dedent`
      ![@Hello](audio.mp3)

      ![^Hello](audio.mp3)

      ![c:Hello](audio.mp3)
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

    expect(html).toMatchInlineSnapshot(`
      "<figure><audio><source src="audio.mp3" type="audio/mpeg"></audio></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"></audio><figcaption>Hello</figcaption></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"></audio><figcaption>Hello</figcaption></figure>"
    `);
  });

  // ******************************************
  it("handle transformation to videos/audio, the last element", async () => {
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

    expect(html).toMatchInlineSnapshot(`
      "<p>Here is the video</p>
      <video title="title"><source src="video.mp4" type="video/mp4"></video>
      <p>Here is the audio</p>
      <audio title="title"><source src="audio.mp3" type="audio/mpeg"></audio>"
    `);
  });

  // ******************************************
  it("handle adding caption for images/videos/audio, the last element", async () => {
    const input = dedent`
      Here is the image ![^Caption of the image](image.png "title")

      Here is the video ![^Caption of the video](video.mp4 "title")

      Here is the audio ![^Caption of the audio](audio.mp3 "title")
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

    expect(html).toMatchInlineSnapshot(`
      "<p>Here is the image</p>
      <figure><img src="image.png" alt="Caption of the image" title="title"><figcaption>Caption of the image</figcaption></figure>
      <p>Here is the video</p>
      <figure><video title="title"><source src="video.mp4" type="video/mp4"></video><figcaption>Caption of the video</figcaption></figure>
      <p>Here is the audio</p>
      <figure><audio title="title"><source src="audio.mp3" type="audio/mpeg"></audio><figcaption>Caption of the audio</figcaption></figure>"
    `);
  });

  // ******************************************
  it("handle transformation to videos/audio, in th middle", async () => {
    const input = dedent`
      Hi ![](image.png "title") text

      Hi ![](video.mp4 "title") text

      Hi ![](audio.mp3 "title") text
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>Hi <img src="image.png" alt="" title="title" /> text</p>
      <p>Hi</p>
      <video title="title"><source src="video.mp4" type="video/mp4" /></video>
      <p>text</p>
      <p>Hi</p>
      <audio title="title"><source src="audio.mp3" type="audio/mpeg" /></audio>
      <p>text</p>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<p>Hi <img src="image.png" alt="" title="title"> text</p>
      <p>Hi</p>
      <video title="title"><source src="video.mp4" type="video/mp4"></video>
      <p>text</p>
      <p>Hi</p>
      <audio title="title"><source src="audio.mp3" type="audio/mpeg"></audio>
      <p>text</p>"
    `);
  });

  // ******************************************
  it("handle adding caption, in the middle", async () => {
    const input = dedent`
      Hi ![^Caption of the image](image.png "title") text

      Hi ![^Caption of the video](video.mp4 "title") text

      Hi ![^Caption of the audio](audio.mp3 "title") text
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>Hi</p>
      <figure>
        <img src="image.png" alt="Caption of the image" title="title" />
        <figcaption>Caption of the image</figcaption>
      </figure>
      <p>text</p>
      <p>Hi</p>
      <figure>
        <video title="title"><source src="video.mp4" type="video/mp4" /></video>
        <figcaption>Caption of the video</figcaption>
      </figure>
      <p>text</p>
      <p>Hi</p>
      <figure>
        <audio title="title"><source src="audio.mp3" type="audio/mpeg" /></audio>
        <figcaption>Caption of the audio</figcaption>
      </figure>
      <p>text</p>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<p>Hi</p>
      <figure><img src="image.png" alt="Caption of the image" title="title"><figcaption>Caption of the image</figcaption></figure>
      <p>text</p>
      <p>Hi</p>
      <figure><video title="title"><source src="video.mp4" type="video/mp4"></video><figcaption>Caption of the video</figcaption></figure>
      <p>text</p>
      <p>Hi</p>
      <figure><audio title="title"><source src="audio.mp3" type="audio/mpeg"></audio><figcaption>Caption of the audio</figcaption></figure>
      <p>text</p>"
    `);
  });

  // ******************************************
  it("handle basic html <img>, <video>, and <audio>", async () => {
    const input = dedent`
      <img alt="Image Alt" src="image.png">
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<img alt="Image Alt" src="image.png" />
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<img alt="Image Alt" src="image.png">
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>"
    `);
  });

  // ******************************************
  it("handle basic html <img>, <video>, and <audio>, extract audio/video from paragraph due to blank lines", async () => {
    const input = dedent`
      <img alt="Image Alt" src="image.png">

      <video src="video.mp4"></video>

      <audio src="audio.mp3"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<img alt="Image Alt" src="image.png" />
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<img alt="Image Alt" src="image.png">
      <video src="video.mp4"></video>
      <audio src="audio.mp3"></audio>"
    `);
  });

  // ******************************************
  it("handle adding caption, in html <img>, <video>, and <audio>", async () => {
    const input = dedent`
      <img alt="^Image Caption" src="image.png">
      <video alt="^Video Caption" src="video.mp4"></video>
      <audio alt="^Audio Caption" src="audio.mp3"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <img alt="Image Caption" src="image.png" />
        <figcaption>Image Caption</figcaption>
      </figure>
      <figure>
        <video src="video.mp4"></video>
        <figcaption>Video Caption</figcaption>
      </figure>
      <figure>
        <audio src="audio.mp3"></audio>
        <figcaption>Audio Caption</figcaption>
      </figure>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<figure><img alt="Image Caption" src="image.png"><figcaption>Image Caption</figcaption></figure>
      <figure><video src="video.mp4"></video><figcaption>Video Caption</figcaption></figure>
      <figure><audio src="audio.mp3"></audio><figcaption>Audio Caption</figcaption></figure>"
    `);
  });

  // ******************************************
  it("handle adding caption, in html <img>, <video>, and <audio>, extract audio/video from paragraph due to blank lines", async () => {
    const input = dedent`
      <img alt="^Image Caption" src="image.png">

      <video alt="^Video Caption" src="video.mp4"></video>

      <audio alt="^Audio Caption" src="audio.mp3"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure>
        <img alt="Image Caption" src="image.png" />
        <figcaption>Image Caption</figcaption>
      </figure>
      <figure>
        <video src="video.mp4"></video>
        <figcaption>Video Caption</figcaption>
      </figure>
      <figure>
        <audio src="audio.mp3"></audio>
        <figcaption>Audio Caption</figcaption>
      </figure>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<figure><img alt="Image Caption" src="image.png"><figcaption>Image Caption</figcaption></figure>
      <figure><video src="video.mp4"></video><figcaption>Video Caption</figcaption></figure>
      <figure><audio src="audio.mp3"></audio><figcaption>Audio Caption</figcaption></figure>"
    `);
  });

  // ******************************************
  it("handle adding figure with no caption, in html <img>, <video>, and <audio>", async () => {
    const input = dedent`
      <img alt="@" src="image.png">

      <video alt="@" src="video.mp4"></video>

      <audio alt="@" src="audio.mp3"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<figure><img alt="" src="image.png" /></figure>
      <figure><video src="video.mp4"></video></figure>
      <figure><audio src="audio.mp3"></audio></figure>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<figure><img alt="" src="image.png"></figure>
      <figure><video src="video.mp4"></video></figure>
      <figure><audio src="audio.mp3"></audio></figure>"
    `);
  });

  // ******************************************
  it("handle adding figure for images/videos/audio in blockquotes", async () => {
    const input = dedent`
      > Here is the image. ![^Image Caption](image.png)
      >
      > Here is the video. ![^Video Caption](video.mp4)
      >
      > Here is the audio. ![^Audio Caption](audio.mp3)
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

    expect(html).toMatchInlineSnapshot(`
      "<blockquote>
      <p>Here is the image.</p>
      <figure><img src="image.png" alt="Image Caption"><figcaption>Image Caption</figcaption></figure>
      <p>Here is the video.</p>
      <figure><video controls><source src="video.mp4" type="video/mp4"></video><figcaption>Video Caption</figcaption></figure>
      <p>Here is the audio.</p>
      <figure><audio controls><source src="audio.mp3" type="audio/mpeg"></audio><figcaption>Audio Caption</figcaption></figure>
      </blockquote>"
    `);
  });

  // ******************************************
  it("handle adding figure for html images/videos/audio in blockquotes", async () => {
    const input = dedent`
      > Here is the image. <img src="image.png" alt="^Image Caption">
      >
      > Here is the video. <img src="video.mp4" alt="^Video Caption">
      >
      > Here is the audio. <img src="audio.mp3" alt="^Audio Caption">
    `;

    const html = String(
      await processMdRawFirst(input, {
        alwaysAddControlsForVideos: true,
        alwaysAddControlsForAudio: true,
        figureCaptionPosition: "above",
      }),
    );

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<blockquote>
        <p>Here is the image.</p>
        <figure>
          <figcaption>Image Caption</figcaption>
          <img src="image.png" alt="Image Caption" />
        </figure>
        <p>Here is the video.</p>
        <figure>
          <figcaption>Video Caption</figcaption>
          <video controls><source src="video.mp4" type="video/mp4" /></video>
        </figure>
        <p>Here is the audio.</p>
        <figure>
          <figcaption>Audio Caption</figcaption>
          <audio controls><source src="audio.mp3" type="audio/mpeg" /></audio>
        </figure>
      </blockquote>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<blockquote>
      <p>Here is the image.</p>
      <figure><figcaption>Image Caption</figcaption><img src="image.png" alt="Image Caption"></figure>
      <p>Here is the video.</p>
      <figure><figcaption>Video Caption</figcaption><video controls><source src="video.mp4" type="video/mp4"></video></figure>
      <p>Here is the audio.</p>
      <figure><figcaption>Audio Caption</figcaption><audio controls><source src="audio.mp3" type="audio/mpeg"></audio></figure>
      </blockquote>"
    `);
  });

  // ******************************************
  it("handle html <image>, <video> and <audio> in blockquotes", async () => {
    const input = dedent`
      > Here is the image. <img alt="^Image Caption" src="image.png">
      >
      > Here is the video. <video alt="^Video Caption" src="video.mp4"></video>
      >
      > Here is the audio. <audio alt="^Audio Caption" src="audio.mp3"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<blockquote>
        <p>Here is the image.</p>
        <figure>
          <img alt="Image Caption" src="image.png" />
          <figcaption>Image Caption</figcaption>
        </figure>
        <p>Here is the video.</p>
        <figure>
          <video src="video.mp4"></video>
          <figcaption>Video Caption</figcaption>
        </figure>
        <p>Here is the audio.</p>
        <figure>
          <audio src="audio.mp3"></audio>
          <figcaption>Audio Caption</figcaption>
        </figure>
      </blockquote>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<blockquote>
      <p>Here is the image.</p>
      <figure><img alt="Image Caption" src="image.png"><figcaption>Image Caption</figcaption></figure>
      <p>Here is the video.</p>
      <figure><video src="video.mp4"></video><figcaption>Video Caption</figcaption></figure>
      <p>Here is the audio.</p>
      <figure><audio src="audio.mp3"></audio><figcaption>Audio Caption</figcaption></figure>
      </blockquote>"
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

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt="alt" title="title" id="image-id" class="image-class" style="width:2rem;height:1rem;"></p>
      <video title="title" id="video-id" class="video-class" width="200" height="100"><source src="video.mp4" type="video/mp4"></video>
      <audio title="title" id="audio-id" class="audio-class" autoplay><source src="audio.mp3" type="audio/mpeg"></audio>"
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

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="image.png" alt="alt" title="title" width="400" height="300" loading="lazy">
      <img src="image.png" alt="alt" title="title" style="width:50%;height:3rem;"></p>"
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

    expect(html).toMatchInlineSnapshot(`
      "<video title="title" width="400" height="300" autoplay muted poster="image.png"><source src="video.mp4" type="video/mp4"></video>
      <video style="width:70%;max-width:500px;" controls autoplay loop><source src="video.mp4" type="video/mp4"></video>
      <video style="height:70%;max-width:500px;" controls autoplay loop><source src="video.mp4" type="video/mp4"></video>
      <video autoplay loop style="max-width:500px;height:70%;" controls><source src="video.mp4" type="video/mp4"></video>
      <video autoplay loop style="max-width:500px;width:70%;" controls><source src="video.mp4" type="video/mp4"></video>"
    `);
  });

  // ******************************************
  it("additional properties in html elements <img>, <video> and <audio>", async () => {
    const input = dedent`
      <img src="image.png" alt="" title="title > style=color:red;padding:5px~10px">
      <img src="image.png" alt="" style="border:none" title="> style=color:red;padding:5px~10px">
      <img src="image.png" loading="eager" title="title > loading=lazy data-xyz=true">
      <video src="image.png" class="ex1" title="title > .new"></video>
      <audio src="image.png" class="ex1 ex2" title="title > .new"></audio>
    `;

    const html = String(await processMdRawFirst(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<img
        src="image.png"
        alt=""
        title="title"
        style="color: red; padding: 5px 10px"
      />
      <img
        src="image.png"
        alt=""
        style="border: none; color: red; padding: 5px 10px"
      />
      <img src="image.png" loading="lazy" title="title" data-xyz="true" />
      <video src="image.png" class="ex1 new" title="title"></video>
      <audio src="image.png" class="ex1 ex2 new" title="title"></audio>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<img src="image.png" alt="" title="title" style="color:red;padding:5px 10px;">
      <img src="image.png" alt="" style="border:none;color:red;padding:5px 10px;">
      <img src="image.png" loading="lazy" title="title" data-xyz="true">
      <video src="image.png" class="ex1 new" title="title"></video>
      <audio src="image.png" class="ex1 ex2 new" title="title"></audio>"
    `);
  });

  // ******************************************
  it("handle transformation to videos/audio already wrapped with a link ", async () => {
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

    expect(html).toMatchInlineSnapshot(`
      "<p><a href="https://example.com"><img src="image.png" alt=""></a></p>
      <a href="https://example.com"><video><source src="video.mp4" type="video/mp4"></video></a>
      <a href="https://example.com"><audio><source src="audio.mp3" type="audio/mpeg"></audio></a>"
    `);
  });

  // ******************************************
  it("handle transformation to videos/audio; and handle adding figure already wrapped with a link ", async () => {
    const input = dedent`
      [![@](image.png)](https://example.com)

      [![@](video.mp4)](https://example.com)

      [![@](audio.mp3)](https://example.com)
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

    expect(html).toMatchInlineSnapshot(`
      "<a href="https://example.com"><figure><img src="image.png" alt=""></figure></a>
      <a href="https://example.com"><figure><video><source src="video.mp4" type="video/mp4"></video></figure></a>
      <a href="https://example.com"><figure><audio><source src="audio.mp3" type="audio/mpeg"></audio></figure></a>"
    `);
  });

  // ******************************************
  it("handle adding autolink for images, using brackets", async () => {
    const input = dedent`
      ![]([image.png]) 
      
      ![@alt]([image.png])

      ![^caption]([image.png])
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <a href="image.png" target="_blank"><img src="image.png" alt="" /></a>
      </p>
      <a href="image.png" target="_blank"
        ><figure><img src="image.png" alt="alt" /></figure
      ></a>
      <a href="image.png" target="_blank"
        ><figure>
          <img src="image.png" alt="caption" />
          <figcaption>caption</figcaption>
        </figure></a
      >
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<p><a href="image.png" target="_blank"><img src="image.png" alt=""></a></p>
      <a href="image.png" target="_blank"><figure><img src="image.png" alt="alt"></figure></a>
      <a href="image.png" target="_blank"><figure><img src="image.png" alt="caption"><figcaption>caption</figcaption></figure></a>"
    `);
  });

  // ******************************************
  it("handle adding autolink for images, using parentheses", async () => {
    const input = dedent`
      ![]((image.png)) 
      
      ![@alt]((image.png))

      ![^caption]((image.png))
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>
        <a href="image.png" target="_blank"><img src="image.png" alt="" /></a>
      </p>
      <figure>
        <a href="image.png" target="_blank"><img src="image.png" alt="alt" /></a>
      </figure>
      <figure>
        <a href="image.png" target="_blank"><img src="image.png" alt="caption" /></a>
        <figcaption>caption</figcaption>
      </figure>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<p><a href="image.png" target="_blank"><img src="image.png" alt=""></a></p>
      <figure><a href="image.png" target="_blank"><img src="image.png" alt="alt"></a></figure>
      <figure><a href="image.png" target="_blank"><img src="image.png" alt="caption"></a><figcaption>caption</figcaption></figure>"
    `);
  });

  // ******************************************
  it("does NOT add autolink which is already wrapped with a link", async () => {
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

    expect(html).toMatchInlineSnapshot(
      `"<p><a href="https://example.com"><img src="image.png" alt="alt"></a></p>"`,
    );
  });

  // ******************************************
  it("does NOT add autolink which is already wrapped with a link, in the middle", async () => {
    const input = dedent`
      Hi [![@alt]([image.png])](https://example.com) text

      Hi [![^alt]([image.png])](https://example.com) text
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>Hi</p>
      <a href="https://example.com"
        ><figure><img src="image.png" alt="alt" /></figure
      ></a>
      <p>text</p>
      <p>Hi</p>
      <a href="https://example.com"
        ><figure>
          <img src="image.png" alt="alt" />
          <figcaption>alt</figcaption>
        </figure></a
      >
      <p>text</p>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<p>Hi</p>
      <a href="https://example.com"><figure><img src="image.png" alt="alt"></figure></a>
      <p>text</p>
      <p>Hi</p>
      <a href="https://example.com"><figure><img src="image.png" alt="alt"><figcaption>alt</figcaption></figure></a>
      <p>text</p>"
    `);
  });

  // ******************************************
  it("does NOT add autolink, but add caption; which is already wrapped with a link", async () => {
    const input = dedent`
      [![@alt]([image.png])](https://example.com)

      [![f:alt]([image.png])](https://example.com)

      [![^alt]([image.png])](https://example.com)

      [![c:alt]([image.png])](https://example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<a href="https://example.com"
        ><figure><img src="image.png" alt="alt" /></figure
      ></a>
      <a href="https://example.com"
        ><figure><img src="image.png" alt="alt" /></figure
      ></a>
      <a href="https://example.com"
        ><figure>
          <img src="image.png" alt="alt" />
          <figcaption>alt</figcaption>
        </figure></a
      >
      <a href="https://example.com"
        ><figure>
          <img src="image.png" alt="alt" />
          <figcaption>alt</figcaption>
        </figure></a
      >
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<a href="https://example.com"><figure><img src="image.png" alt="alt"></figure></a>
      <a href="https://example.com"><figure><img src="image.png" alt="alt"></figure></a>
      <a href="https://example.com"><figure><img src="image.png" alt="alt"><figcaption>alt</figcaption></figure></a>
      <a href="https://example.com"><figure><img src="image.png" alt="alt"><figcaption>alt</figcaption></figure></a>"
    `);
  });

  // ******************************************
  it("does NOT autolink for videos/audio, just remove brackets from the source", async () => {
    const input = dedent`
      ![]([video.mp4])

      ![]([audio.mp3])

      ![@]((video.mp4))

      ![@]((audio.mp3))
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
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<video><source src="video.mp4" type="video/mp4"></video>
      <audio><source src="audio.mp3" type="audio/mpeg"></audio>
      <figure><video><source src="video.mp4" type="video/mp4"></video></figure>
      <figure><audio><source src="audio.mp3" type="audio/mpeg"></audio></figure>"
    `);
  });

  // ******************************************
  it("does NOT add autolink for images/videos/audio in an anchor link, just remove brackets from the source", async () => {
    const input = dedent`
      [![@]([video.mp4])](www.example.com)

      [![@]([audio.mp3])](www.example.com)

      [![@]([image.png]) ![@]([video.mp4]) ![@]([video.mp3])](www.example.com)

      [![]([image.png]) ![]([video.mp4]) ![]([video.mp3])](www.example.com)
    `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<a href="www.example.com"
        ><figure>
          <video><source src="video.mp4" type="video/mp4" /></video></figure
      ></a>
      <a href="www.example.com"
        ><figure>
          <audio><source src="audio.mp3" type="audio/mpeg" /></audio></figure
      ></a>
      <a href="www.example.com"
        ><figure><img src="image.png" alt="" /></figure>
        <figure>
          <video><source src="video.mp4" type="video/mp4" /></video>
        </figure>
        <figure>
          <audio><source src="video.mp3" type="audio/mpeg" /></audio></figure
      ></a>
      <a href="www.example.com"
        ><img src="image.png" alt="" />
        <video><source src="video.mp4" type="video/mp4" /></video>
        <audio><source src="video.mp3" type="audio/mpeg" /></audio
      ></a>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<a href="www.example.com"><figure><video><source src="video.mp4" type="video/mp4"></video></figure></a>
      <a href="www.example.com"><figure><audio><source src="audio.mp3" type="audio/mpeg"></audio></figure></a>
      <a href="www.example.com"><figure><img src="image.png" alt=""></figure> <figure><video><source src="video.mp4" type="video/mp4"></video></figure> <figure><audio><source src="video.mp3" type="audio/mpeg"></audio></figure></a>
      <a href="www.example.com"><img src="image.png" alt=""> <video><source src="video.mp4" type="video/mp4"></video> <audio><source src="video.mp3" type="audio/mpeg"></audio></a>"
    `);
  });

  // ******************************************
  it("does NOT add autolink for relative links", async () => {
    const input = dedent`
    ![]([../image.jpeg])

    ![^Hello]([../image.jpeg])
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

    expect(html).toMatchInlineSnapshot(`
      "<p><img src="../image.jpeg" alt=""></p>
      <figure><img src="../image.jpeg" alt="Hello"><figcaption>Hello</figcaption></figure>"
    `);
  });

  // ******************************************
  it("example in the README", async () => {
    const input = dedent`
    It converts images to audio/videos. ![](video.mp4)

    It adds autolink. ![alt]([https://example.com/image.png])

    It adds caption. ![^Image Caption](image.png)

    It adds attributes. ![](video.mp4 "title > 640x480 autoplay")
  `;

    const html = String(await processMd(input));

    expect(await prettier.format(html, { parser: "html" })).toMatchInlineSnapshot(`
      "<p>It converts images to audio/videos.</p>
      <video><source src="video.mp4" type="video/mp4" /></video>
      <p>
        It adds autolink.
        <a href="https://example.com/image.png" target="_blank"
          ><img src="https://example.com/image.png" alt="alt"
        /></a>
      </p>
      <p>It adds caption.</p>
      <figure>
        <img src="image.png" alt="Image Caption" />
        <figcaption>Image Caption</figcaption>
      </figure>
      <p>It adds attributes.</p>
      <video title="title" width="640" height="480" autoplay>
        <source src="video.mp4" type="video/mp4" />
      </video>
      "
    `);

    expect(html).toMatchInlineSnapshot(`
      "<p>It converts images to audio/videos.</p>
      <video><source src="video.mp4" type="video/mp4"></video>
      <p>It adds autolink. <a href="https://example.com/image.png" target="_blank"><img src="https://example.com/image.png" alt="alt"></a></p>
      <p>It adds caption.</p>
      <figure><img src="image.png" alt="Image Caption"><figcaption>Image Caption</figcaption></figure>
      <p>It adds attributes.</p>
      <video title="title" width="640" height="480" autoplay><source src="video.mp4" type="video/mp4"></video>"
    `);
  });
});
