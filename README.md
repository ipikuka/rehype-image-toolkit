### [Become a sponsor](https://github.com/sponsors/ipikuka) 🚀

If you find **`rehype-image-toolkit`** useful in your projects, consider supporting my work.  
Your sponsorship means a lot 💖

Be the **first sponsor** and get featured here and on [my sponsor wall](https://github.com/sponsors/ipikuka).  
Thank you for supporting open source! 🙌

# rehype-image-toolkit

[![npm version][badge-npm-version]][url-npm-package]
[![npm downloads][badge-npm-download]][url-npm-package]
[![publish to npm][badge-publish-to-npm]][url-publish-github-actions]
[![code-coverage][badge-codecov]][url-codecov]
[![type-coverage][badge-type-coverage]][url-github-package]
[![typescript][badge-typescript]][url-typescript]
[![license][badge-license]][url-license]

This package is a **[unified][unified]** (**[rehype][rehype]**) plugin that **enhances Markdown image syntax `![]()` and Markdown/MDX media elements (`<img>`, `<audio>`, `<video>`) by;** 
+ auto-linking bracketed or parenthesized image URLs,
+ wrapping them in `<figure>` with optional caption `<figcaption>`,
+ unwrapping images/videos/audio from paragraph,
+ parsing directives in title for styling and adding attributes,
+ dynamically converting images into `<video>` or `<audio>` elements based on file extension.

**[unified][unified]** is a project that transforms content with abstract syntax trees (ASTs) using the new parser **[micromark][micromark]**. **[remark][remark]** adds support for markdown to unified. **[mdast][mdast]** is the Markdown Abstract Syntax Tree (AST) which is a specification for representing markdown in a syntax tree. **[rehype][rehype]** is a tool that transforms HTML with plugins. **[hast][hast]** stands for HTML Abstract Syntax Tree (HAST) that rehype uses.

Markdown natively supports images but lacks built-in syntax for videos and audio. **`rehype-image-toolkit`** extends image syntax, automatically transforming it into `<video>` or `<audio>` elements based on file extensions, supporting additional attributes, providing custom directives for autolink to originals, wrapping media with `<figure>` and adding caption `<figcaption>`, and unwrapping media from paragraph.

## When should I use this?

**From what I’ve seen, most Remark and Rehype plugins that handle Markdown images apply their features globally, without offering much flexibility. In some cases, I need more control—certain images should be excluded from these transformations.** For example, I might **NOT** want every image to be wrapped in a `<figure>`, include a caption, be automatically linked to its source, or unwrapping from paragraph.

**That's why each feature in `rehype-image-toolkit` is individually controllable via directives. Its most distinct advantage over other remark/rehype plugins.**

I designed **`rehype-image-toolkit`** as an all-in-one solution, bringing together all essential image-related features for markdown and MDX in a **single toolkit**.

**`rehype-image-toolkit`** is ideal for:
+ **adding videos/audio using Markdown image syntax** – No need for HTML or custom MDX components.
+ **styling and adding attributes to images/videos/audio** – Easily add classes, IDs, styles, and other attributes.
+ **adding `<figure>` and caption** – Easily wrap in a `<figure>` element with an optional caption `<figcaption>`.
+ **unwrapping media from paragraph** – Control which images/videos/audio to be or NOT to be extracted from paragraph.
+ **adding autolink to the original image** - Control which images to be automatically linked to their original source.

## Installation

This package is suitable for ESM only. In Node.js (version 16+), install with npm:

```bash
npm install rehype-image-toolkit
```

or

```bash
yarn add rehype-image-toolkit
```

## Usage with markdown source

Say we have the following markdown file, `example.md`:\
*(pay attention to directives)*

```markdown
It ensures adding videos/audio using image syntax. ![](video.mp4) 

It adds autolink to original. ![alt]([https://example.com/image.png])

It adds figure and caption. ![^Image Caption](image.png)

It unwraps images from paragraph ![&alt](image.png)

It adds attributes. ![](video.mp4 "title > 640x480 autoplay")
```

Our module, `example.js`, looks as follows:

```javascript
import { read } from "to-vfile";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeImageToolkit from "rehype-image-toolkit";
import rehypeStringify from "rehype-stringify";

main();

async function main() {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeImageToolkit)
    .use(rehypeStringify)
    .process(await read("example.md"));

  console.log(String(file));
}
```

Now, running `node example.js` you will see.

```html
<p>It ensures adding videos/audio using image syntax.</p>
<video>
  <source src="video.mp4" type="video/mp4" />
</video>
<p>
  It adds autolink to original.
  <a href="https://example.com/image.png" target="_blank">
    <img src="https://example.com/image.png" alt="alt"/>
  </a>
</p>
<p>It adds figure and caption.</p>
<figure>
  <img src="image.png" alt="Image Caption" />
  <figcaption>Image Caption</figcaption>
</figure>
<p>It unwraps images from paragraph</p>
<img src="image.png" alt="alt" />
<p>It adds attributes.</p>
<video title="title" width="640" height="480" autoplay>
  <source src="video.mp4" type="video/mp4" />
</video>
```

Without **`rehype-image-toolkit`** the output would be:

```html
<p>It ensures adding videos/audio using image syntax. <img src="video.mp4" alt=""></p>
<p>It adds autolink to original. <img src="%5Bhttps://example.com/image.png%5D" alt="alt"></p>
<p>It adds figure and caption. <img src="image.png" alt="^Image Caption"></p>
<p>It unwraps images from paragraph <img src="image.png" alt="&#x26;alt"></p>
<p>It adds attributes. <img src="video.mp4" alt="" title="title > 640x480 autoplay"></p>
```

**`rehype-image-toolkit` also works with references in markdown.**

```markdown
![cat image][reference-image] meows ![~][reference-audio]

[reference-image]: [image.png] "cat image"
[reference-audio]: audio.mp3 "> autoplay"
```

will produce *(pay attention to brackets around the src of the image; and title directive and tilda `~` inline directive for the audio)*:

```html
<p>
  <a href="image.png" target="_blank">
    <img src="image.png" alt="cat image" />
  </a> meows
  <audio autoplay>
    <source src="audio.mp3" type="audio/mpeg" />
  </audio>
</p>
```

## Usage with html source

Actually, you don't need to use **`rehype-image-toolkit`** for html sources since you can write direct html structure for adding figure and caption, adding attributes and wrapping assets with an anchor link. But anyway, **I've wanted to support that features for html sources as well.**

Say `example.html` looks as follows:\
*(pay attention to directives)*

```html
<p>
  It adds autolink to original.
  <img src="[https://example.com/image.png]" alt="alt"/>
</p>
<p>
  It adds figure and caption.
  <img src="image.png" alt="^Image Caption"/>
</p>
<p>
  It adds attributes.
  <img src="image.png" title="title > 60x60"/>
</p>
<p>
  It unwraps videos/audio from paragraph by default.
  <video src="video.mp4"></video>
</p>
<p>
  It keeps videos/audio in paragraph via tilda directive.
  <video src="video.mp4" alt="~"></video>
</p>
```

Our module, `example.js`, looks as follows:

```javascript
import { read } from "to-vfile";
import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeImageToolkit from "rehype-image-toolkit";
import rehypeStringify from "rehype-stringify";

main();

async function main() {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeImageToolkit)
    .use(rehypeStringify)
    .process(await read("example.md"));

  console.log(String(file));
}
```

Now, running `node example.js` you will see.

```html
<p>
  It adds autolink to original.
  <a href="https://example.com/image.png" target="_blank">
    <img src="https://example.com/image.png" alt="alt">
  </a>
</p>
<p>
  It adds figure and caption.
</p>
<figure>
  <img src="image.png" alt="Image Caption">
  <figcaption>Image Caption</figcaption>
</figure>
<p>
  It adds attributes.
  <img src="image.png" title="title" width="60" height="60">
</p>
<p>
  It unwraps videos/audio from paragraph by default.
</p>
<video src="video.mp4"></video>
<p>
  It keeps videos/audio in paragraph via tilda directive.
  <video src="video.mp4"></video>
</p>
```

## Features

### Convert image syntax to videos/audio

Markdown lacks built-in support for video and audio, only providing image syntax. **`rehype-image-toolkit`** repurposes the image syntax to render video/audio elements based on file extensions.

+ `![](example.mp4)` is transformed into `<video>` element

```html
<video>
  <source src="example.mp4" type="video/mp4">
</video>
```

+ `![](example.mp3)` is transformed into `<audio>` element

```html
<audio>
  <source src="example.mp3" type="audio/mpeg">
</audio>
```

Since `<video>` and `<audio>` are block-level elements by default, **`rehype-image-toolkit`** unwraps them from paragraphs, splitting the text or other content around their original positions. If you don't want a video/audio to be extracted from paragraph use **tilda `~`** in the begining of alt text **`![~](example.mp3)`**. It may be useful if you want an audio to be an inline element within paragraph in support of CSS.

### Use the `title` attribute to customize images, videos, and audio

As you know, Markdown’s image syntax supports an optional **`title`** attribute: **`![](image.png "title")`**

**`rehype-image-toolkit`** extends this by recognizing custom directives after **greater operator (`>`)** in title.

```markdown
![](my-video.mp4 "Video Title > controls autoplay loop .classname #id width=640 height=480")
```

**`width` and `hight` attributes must be in pixel unit**

You can use `px` or just number for example `320` or `320px`. The CSS units other than pixel will go to the style attribute.

```markdown
![](my-image.png "Image Title > width=640 height=480")
![](my-image.png "Image Title > width=640px height=480px")
![](my-image.png "Image Title > width=50% height=2rem") --> this will set the style attribute rather than width and height
```

**If no title is needed, start with just greater operator (`>`).**

```markdown
![](my-video.mov "> width=30rem height=20rem poster=image.png")
```

**Directives must be separated by a single space, with no spaces within attribute values and no quotes.**

```markdown
![](my-video.mp4 "My Title > .classname style=width:640px;height:480px; controls")

![image alt](foo.jpg "> #id .class width=30px height=20px")
```

**There is a simple syntax for width and hight, using lowercase "x" character in the middle**.\
*In this syntax, the pixel units should be a number, do not use `px`.*

```markdown
// Both dimension
![alt](image.png "> 640x480")

// Both dimension WRONG!
![alt](image.png "> 640pxx480px") X WRONG!

// Only width
![alt](image.png "> 640x")

// Only height
![alt](image.png "> x480")

// Both dimension, other than px unit will go to the style attribute
![alt](image.png "> 50%x10rem")
```

The width and height attributes on images are treated specially. When used without a unit, the unit is assumed to be pixels. However, any of the CSS unit identifiers can be used. There shouldn't be any space between the number and the unit. 

### Create an autolink for images (Explicit Autolink)

**Wrap the link of the source in brackets or parentheses.** It is valid for only if the image source starts with protokol-like links like **`http://`**, web sites start with **`www.`**, root relative links start with a slash **`/`** and if just an image name like **`image.png`**.

```markdown
### pay attention to additional brackets around the link
![alt]([http://example.com/image.png] "title")

### pay attention to additional parentheses around the link
![alt]((http://example.com/image.png) "title")
```
will produce the same output below:
```html
<p>
  <a href="http://example.com/image.png">
    <img src="http://example.com/image.png" alt="alt" title="title">
  </a>
</p>
```

Wrapping the source attribute with brackets or parentheses produces mostly the same behavior/output, but only differs in case the image is wrapped in a `<figure>` element.
+ Wrapping the source attribute **with brackets** provides autolinking for whole `<figure>` element including caption.
+ Wrapping the source attribute **with parentheses** provides autolinking for only the `<img>` element in the `<figure>`.

```markdown
![^caption]([image.png])
![^caption]((image.png))
```
will produce:
```html
<a href="image.png" target="_blank">
  <figure>
    <img src="image.png" alt="caption">
    <figcaption>caption</figcaption>
  </figure>
</a>
<figure>
  <a href="image.png" target="_blank">
    <img src="image.png" alt="caption">
  </a>
  <figcaption>caption</figcaption>
</figure>
```

if you want to set different target for the `<figure>` and for the `<img>` inside, you can wrap the `src` attribute with **parentheses**, not brackets, and use the formal link syntax of markdown together:
```markdown
[![^caption]((image.png))](https://example.com)
```
will produce:
```html
<a href="https://example.com">
  <figure>
    <a href="image.png" target="_blank">
      <img src="image.png" alt="Caption" />
    </a>
    <figcaption>Caption</figcaption>
  </figure>
</a>
```

According to the HTML specification, **anchor elements cannot be nested**. Despite being invalid, browsers try to render this gracefully. The actual behavior can differ slightly between browsers, but in most modern browsers like Chrome, Firefox, and Safari:
+ The inner `<a href="image.png" target="_blank">` wrapping the `<img>` will take precedence when clicking directly on the image.
+ Clicking directly on the `<img>` will open `image.png` in a new tab (because of `target="_blank"`).
+ Clicking outside the image but still inside the outer `<a>` (e.g., on the `figcaption`) will follow the outer link (`https://example.com`).

### Add caption for images/videos/audio (Explicit Figure)

Add a **caret `^`** special directive at the start of the **alt** attribute in order to wrap the media asset with `<figure>` element and add a caption `<figcaption>`.

Since `<figure>` is block-level element by default, **`rehype-image-toolkit`** unwraps it from paragraphs, splitting the text or other content around their original position. There is no choice not to be extracted!

```markdown
![^Caption of the image](image.png "title")
```

will produce the html output:

```html
<figure>
  <img src="image.png" alt="Caption of the image" title="title" />
  <figcaption>Caption of the image</figcaption>
</figure>
```

Add a **double caret `^^`** special directive at the start of the **alt** attribute in order to only wrap the asset with `<figure>` element but NOT to include a caption.

```markdown
![^^alt](image.png "title")

![^^](video.mp4 "title")
```

will produce the html output *(notice there is no caption)*:

```html
<figure>
  <img src="image.png" alt="alt" title="title" />
</figure>
<figure>
  <video title="title">
    <source src="video.mp4" type="video/mp4">
  </video>
</figure>
```

If you want just a regular inline image, do not use any **`^`** directive in the begining of **alt** attribute.

```markdown
![This image won't be within a figure element](image.png)
```

### Add caption for images/videos/audio (Implicit Figure)

There is an option **`implicitFigure`** for adding an image/video/audio into `<figure>` and adding a caption `<figcaption>`. If you set **`{implicitFigure: true}`** in the options, an image will be rendered as a figure without any directive in the content **if it is alone in the paragraph** . The image’s alt text will be used as the caption. This feature is aligned with [pandoc markdown implicit figure](https://pandoc.org/MANUAL.html#extension-implicit_figures).

```markdown
## Assume you set `{implicitFigure: true}`

![This will be the caption in figure element](image.png)
```

If you just want a regular inline image, when you set **`{implicitFigure: true}`**, just make sure it is not the only thing in the paragraph or put a **tilda `~`** or **ampersand `&`** directives in the start of **alt** attribute, since these directives have priority:

```markdown
## Assume you set `{implicitFigure: true}`

### This image won't be a `<figure>` and stay in the paragraph as inline content

![~alt](image.png)

### This image won't be a `<figure>`, but it is going to be unwrapped from paragraph

![&alt](image.png)
```

Just I want to stress again that if you want the image be in a `<figure>` you can use directive **`caret ^`** in the start of **alt** for explicit figure, as explained in the previous. No matter what the image is alone or not.

### Unwrap images from paragraph

Add a **ampersand `&`** special directive at the start of the **alt** attribute in order to unwrap the image from paragraph. Sometime you may want to unwrap images without adding it in a `<figure>`. This directive ensures the image is extracted without adding it in a figure.

```markdown
![&](image.png)

![&alt](image.png)
```

### Keep videos/audio inline in paragraph

Add a **tilda `~`** special directive at the start of the **alt** attribute in order to keep videos/audio in a paragraph. This is helpful when you want these elements to remain inline in the paragraph. Normally, **`rehype-image-toolkit`** unwraps videos/audio from paragraph by default.

```markdown
Here is the cat voice ![~](cat.mp3). So nice !
```

## Summary table of directives

*to be created (a PR is welcome).*

## Options

All options are **optional** and have **default values**.

```typescript
type ImageToolkitOptions = {
  explicitAutolink?: boolean; // default is "true"
  explicitFigure?: boolean, // default is "true"
  implicitFigure?: boolean; // default is "false"
  figureCaptionPosition?: "above" | "below"; // default is "below"
  addControlsForVideos?: boolean; // default is "false"
  addControlsForAudio?: boolean; // default is "false"
  enableMdxJsx?: boolean; // default is "true"
};

use(rehypeImageToolkit, ImageToolkitOptions);
```

#### explicitAutolink

It is a **boolean** option which is for enabling or disabling **ExplicitAutolink** feature.

By default, it is `true`. See more explanation about **ExplicitAutolink** [here](https://github.com/ipikuka/rehype-image-toolkit#create-an-autolink-for-images-explicit-autolink).

```javascript
use(rehypeImageToolkit, {
  explicitAutolink: false,
});
```

This will disable autolinking to original, removing the directive **brackets** or **parentheses** in the **src** attribute.

```markdown
![alt]([image.png])
```

will produce standard image element without wrapping with an anchor `<image src="image.png" alt="alt">`.

#### explicitFigure

It is a **boolean** option which is for enabling or disabling **ExplicitFigure** feature.

By default, it is `true`. See more explanation about **ExplicitFigure** [here](https://github.com/ipikuka/rehype-image-toolkit#add-caption-for-imagesvideosaudio-explicit-figure).

```javascript
use(rehypeImageToolkit, {
  explicitFigure: false,
});
```

This will disable adding `<figure>` and caption, removing the directive **caret `^`** in the **alt** attribute.

```markdown
![^caption](image.png)
```

will produce standard image element without figure and caption `<image src="image.png" alt="caption">`.

#### implicitFigure

It is a **boolean** option which is for enabling or disabling **ImplicitFigure** feature.

By default, it is `false`. See more explanation about **ImplicitFigure** [here](https://github.com/ipikuka/rehype-image-toolkit#add-caption-for-imagesvideosaudio-implicit-figure).

```markdown
## Assume you set `{implicitFigure: true}`

![This will be the caption in figure element](image.png)
```

#### figureCaptionPosition

It is a **"above" | "below"** union string option which is for placing the caption below or above of the asset.

By default, it is `below`.

```javascript
use(rehypeImageToolkit, {
  figureCaptionPosition: "above",
});
```

Now, the caption will be the above of the asset.

#### addControlsForVideos

It is a **boolean** option which is for adding **`controls`** property to `video` elements by default. 

By default, it is `false`.

```javascript
use(rehypeImageToolkit, {
  addControlsForVideos: true,
});
```

Now, video elements, like `![](example.mp4)`, will have `controls` attribute by default.

```html
<video controls>
  <source src="example.mp4" type="video/mp4">
</video>
```

#### addControlsForAudio

It is a **boolean** option which is for adding **`controls`** property to `audio` elements by default. 

By default, it is `false`.

```javascript
use(rehypeImageToolkit, {
  addControlsForAudio: true,
});
```

Now, audio elements, like `![](example.mp43)`, will have `controls` attribute by default.

```html
<audio controls>
  <source src="example.mp3" type="audio/mpeg">
</audio>
```

#### enableMdxJsx

It is a **boolean** option which is for enabling or disabling **MdxJsx Elements** within MDX. 

As you know, the html-like (jsx) syntax in MDX contents are not `HTML` elements, actually `MdxJsx` elements. If you don't want the plugin process html-like (jsx) syntax in the MDX document, set the `enableMdxJsx` to **`{enableMdxJsx: false}`**.

> **Another consideration:** if your content is pure Markdown (markdown + HTML syntax) and not MDX, set `enableMdxJsx` to **`{enableMdxJsx: false}`**. This prevents the plugin from searching for `MdxJsx` elements, resulting in faster rendering.

By default, it is `true`.

```javascript
use(rehypeImageToolkit, {
  enableMdxJsx: false,
});
```

This will cause the plugin doesn't touch `MdxJsx` elements within MDX contents.

```markdown
![^caption](image.png)

<img src="image.png" alt="^caption"/>
```

will produce only first one is processed:

```html
<figure>
  <img src="image.png" alt="caption"/>
  <figcaption>caption</figcaption>
</figure>
<img src="image.png" alt="^caption"/>
```

if you keep `enableMdxJsx` is `true`, the result would be:

```html
<figure>
  <img src="image.png" alt="caption"/>
  <figcaption>caption</figcaption>
</figure>
<figure>
  <img src="image.png" alt="caption"/>
  <figcaption>caption</figcaption>
</figure>
```

### Examples:

## Syntax tree

This plugin modifies the `hast` (HTML abstract syntax tree).

## Types

This package is fully typed with [TypeScript][url-typescript]. The plugin exports the type `ImageToolkitOptions`.

## Compatibility

This plugin works with `rehype-parse` version 1+, `rehype-stringify` version 1+, `rehype` version 1+, and unified version `4+`.

## Security

Use of **`rehype-image-toolkit`** involves rehype (hast), but doesn't lead to cross-site scripting (XSS) attacks.

## My Plugins

I like to contribute the Unified / Remark / MDX ecosystem, so I recommend you to have a look my plugins.

### My Remark Plugins

- [`remark-flexible-code-titles`](https://www.npmjs.com/package/remark-flexible-code-titles)
  – Remark plugin to add titles or/and containers for the code blocks with customizable properties
- [`remark-flexible-containers`](https://www.npmjs.com/package/remark-flexible-containers)
  – Remark plugin to add custom containers with customizable properties in markdown
- [`remark-ins`](https://www.npmjs.com/package/remark-ins)
  – Remark plugin to add `ins` element in markdown
- [`remark-flexible-paragraphs`](https://www.npmjs.com/package/remark-flexible-paragraphs)
  – Remark plugin to add custom paragraphs with customizable properties in markdown
- [`remark-flexible-markers`](https://www.npmjs.com/package/remark-flexible-markers)
  – Remark plugin to add custom `mark` element with customizable properties in markdown
- [`remark-flexible-toc`](https://www.npmjs.com/package/remark-flexible-toc)
  – Remark plugin to expose the table of contents via `vfile.data` or via an option reference
- [`remark-mdx-remove-esm`](https://www.npmjs.com/package/remark-mdx-remove-esm)
  – Remark plugin to remove import and/or export statements (mdxjsEsm)

### My Rehype Plugins

- [`rehype-pre-language`](https://www.npmjs.com/package/rehype-pre-language)
  – Rehype plugin to add language information as a property to `pre` element
- [`rehype-highlight-code-lines`](https://www.npmjs.com/package/rehype-highlight-code-lines)
  – Rehype plugin to add line numbers to code blocks and allow highlighting of desired code lines
- [`rehype-code-meta`](https://www.npmjs.com/package/rehype-code-meta)
  – Rehype plugin to copy `code.data.meta` to `code.properties.metastring`
- [`rehype-image-toolkit`](https://www.npmjs.com/package/rehype-image-toolkit)
  – Rehype plugin to enhance Markdown image syntax `![]()` and Markdown/MDX media elements (`<img>`, `<audio>`, `<video>`) by auto-linking bracketed or parenthesized image URLs, wrapping them in `<figure>` with optional captions, unwrapping images/videos/audio from paragraph, parsing directives in title for styling and adding attributes, and dynamically converting images into `<video>` or `<audio>` elements based on file extension.

### My Recma Plugins

- [`recma-mdx-escape-missing-components`](https://www.npmjs.com/package/recma-mdx-escape-missing-components)
  – Recma plugin to set the default value `() => null` for the Components in MDX in case of missing or not provided so as not to throw an error
- [`recma-mdx-change-props`](https://www.npmjs.com/package/recma-mdx-change-props)
  – Recma plugin to change the `props` parameter into the `_props` in the `function _createMdxContent(props) {/* */}` in the compiled source in order to be able to use `{props.foo}` like expressions. It is useful for the `next-mdx-remote` or `next-mdx-remote-client` users in `nextjs` applications.
- [`recma-mdx-change-imports`](https://www.npmjs.com/package/recma-mdx-change-imports)
  – Recma plugin to convert import declarations for assets and media with relative links into variable declarations with string URLs, enabling direct asset URL resolution in compiled MDX.
- [`recma-mdx-import-media`](https://www.npmjs.com/package/recma-mdx-import-media)
  – Recma plugin to turn media relative paths into import declarations for both markdown and html syntax in MDX.
- [`recma-mdx-import-react`](https://www.npmjs.com/package/recma-mdx-import-react)
  – Recma plugin to ensure getting `React` instance from the arguments and to make the runtime props `{React, jsx, jsxs, jsxDev, Fragment}` is available in the dynamically imported components in the compiled source of MDX.
- [`recma-mdx-html-override`](https://www.npmjs.com/package/recma-mdx-html-override)
  – Recma plugin to allow selected raw HTML elements to be overridden via MDX components.
- [`recma-mdx-interpolate`](https://www.npmjs.com/package/recma-mdx-interpolate)
  – Recma plugin to enable interpolation of identifiers wrapped in curly braces within the `alt`, `src`, `href`, and `title` attributes of markdown link and image syntax in MDX.

## License

[MIT License](./LICENSE) © ipikuka

[unified]: https://github.com/unifiedjs/unified
[micromark]: https://github.com/micromark/micromark
[remark]: https://github.com/remarkjs/remark
[remarkplugins]: https://github.com/remarkjs/remark/blob/main/doc/plugins.md
[mdast]: https://github.com/syntax-tree/mdast
[rehype]: https://github.com/rehypejs/rehype
[rehypeplugins]: https://github.com/rehypejs/rehype/blob/main/doc/plugins.md
[hast]: https://github.com/syntax-tree/hast
[rehype-highlight]: https://github.com/rehypejs/rehype-highlight

[badge-npm-version]: https://img.shields.io/npm/v/rehype-image-toolkit
[badge-npm-download]:https://img.shields.io/npm/dt/rehype-image-toolkit
[url-npm-package]: https://www.npmjs.com/package/rehype-image-toolkit
[url-github-package]: https://github.com/ipikuka/rehype-image-toolkit

[badge-license]: https://img.shields.io/github/license/ipikuka/rehype-image-toolkit
[url-license]: https://github.com/ipikuka/rehype-image-toolkit/blob/main/LICENSE

[badge-publish-to-npm]: https://github.com/ipikuka/rehype-image-toolkit/actions/workflows/publish.yml/badge.svg
[url-publish-github-actions]: https://github.com/ipikuka/rehype-image-toolkit/actions/workflows/publish.yml

[badge-typescript]: https://img.shields.io/npm/types/rehype-image-toolkit
[url-typescript]: https://www.typescriptlang.org

[badge-codecov]: https://codecov.io/gh/ipikuka/rehype-image-toolkit/graph/badge.svg?token=5qXNZ8iuYV
[url-codecov]: https://codecov.io/gh/ipikuka/rehype-image-toolkit

[badge-type-coverage]: https://img.shields.io/badge/dynamic/json.svg?label=type-coverage&prefix=%E2%89%A5&suffix=%&query=$.typeCoverage.atLeast&uri=https%3A%2F%2Fraw.githubusercontent.com%2Fipikuka%2Frehype-image-toolkit%2Fmain%2Fpackage.json