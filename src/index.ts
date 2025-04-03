import type { Plugin } from "unified";
import type { Element, Root } from "hast";
import { CONTINUE, visit, type VisitorResult } from "unist-util-visit";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type PartiallyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

declare module "hast" {
  interface Properties {
    src?: string;
    title?: string;
    alt?: string;
    markedAsToBeAutoLinked?: boolean;
    markedAsToBeInFigure?: boolean;
    captionInFigure?: string;
    markedAsToBeConverted?: boolean;
    convertionString?: string;
  }
}

export type ImageHackOptions = {
  figureCaptionPosition?: "above" | "below";
  alwaysAddControlsForVideos?: boolean;
  alwaysAddControlsForAudio?: boolean;
};

const DEFAULT_SETTINGS: ImageHackOptions = {
  figureCaptionPosition: "below",
  alwaysAddControlsForVideos: false,
  alwaysAddControlsForAudio: false,
};

type PartiallyRequiredImageHackOptions = Prettify<
  PartiallyRequired<
    ImageHackOptions,
    "figureCaptionPosition" | "alwaysAddControlsForVideos" | "alwaysAddControlsForAudio"
  >
>;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const video = {
  a: "autoplay",
  c: "controls",
  l: "loop",
  m: "muted",
  s: "src",
  w: "width",
  h: "height",
  p: "poster",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const audio = {
  a: "autoplay",
  c: "controls",
  l: "loop",
  m: "muted",
  s: "src",
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const img = {
  a: "alt",
  s: "src",
  ss: "srcset",
  sz: "sizes",
  w: "width",
  h: "height",
  l: "loading",
};

const videoMimeTypes: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

const audioMimeTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
};

const mimeTypesMap = { ...videoMimeTypes, ...audioMimeTypes };

const videoExtensions = Object.keys(videoMimeTypes);
const audioExtensions = Object.keys(audioMimeTypes);

const isVideoExt = (ext: string) => videoExtensions.indexOf(ext) >= 0;
const isAudioExt = (ext: string) => audioExtensions.indexOf(ext) >= 0;

/**
 *
 * Function to get the file extension from a link / source
 *
 */
const getExtension = (src: string | undefined): string | undefined => {
  // Match the file extension; consider may has a trailing query or hash
  const RE = /\.([a-zA-Z0-9]+)(?=[?#]|$)/i;

  const match = src?.match(RE);

  return match?.[1];
};

/**
 *
 * enhance markdown image syntax and MDX media elements (img, audio, video) by adding attributes,
 * figure captions, auto-linking to originals, supporting extended syntax for rich media and
 * converting images to video/audio based on the file extension.
 */
const plugin: Plugin<[ImageHackOptions?], Root> = (options) => {
  const settings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    options,
  ) as PartiallyRequiredImageHackOptions;

  /**
   * Transform.
   */
  return (tree: Root): undefined => {
    // console.dir(tree, { depth: 8 });

    /**
     * visit for preperation
     *
     * removes the brackets around the videos/audio sources since they will not be auto linked
     * marks the images as to be auto linked if there are brackets around the source
     * marks the images/videos/audio as to be wrapped in a figure and set/remove the captions
     * marks the images as to be converted into videos/audio based on the source extension
     *
     * doesn't mutates the children
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || !["img", "video", "audio"].includes(node.tagName)) {
        return;
      }

      const src = node.properties.src;

      const hasBracket = src && /%5B.*%5D/.test(src);
      if (hasBracket) {
        node.properties.src = src.slice(3, -3);

        // mark if it is image and the parent is not anchor element
        if (node.tagName === "img" && !(parent.type === "element" && parent.tagName === "a")) {
          node.properties.markedAsToBeAutoLinked = true;
        }
      }

      const alt = node.properties.alt;
      const startsWithPlus = alt?.startsWith("+");
      const startsWithStar = alt?.startsWith("*");
      const startsWithCaption = alt?.startsWith("caption:");
      const needsCaption = startsWithCaption || startsWithStar || startsWithPlus;

      if (alt && needsCaption) {
        node.properties.markedAsToBeInFigure = true;

        const figcaptionText = startsWithStar || startsWithPlus ? alt.slice(1) : alt.slice(8);
        if (!startsWithPlus) node.properties.captionInFigure = figcaptionText;

        if (node.tagName === "img") {
          node.properties.alt = figcaptionText;
        } else {
          node.properties.alt = undefined;
        }
      }

      const extension = getExtension(node.properties.src);
      if (extension && node.tagName === "img") {
        const needsConversion = isVideoExt(extension) || isAudioExt(extension);

        if (needsConversion) {
          node.properties.markedAsToBeConverted = true;
          node.properties.convertionString = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
        }
      }
    });

    /**
     * unravels image elements to be converted into video/audio or to be wrapped with figure in paragraphs
     *
     * mutates children !
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || node.tagName !== "p") {
        return;
      }

      let elementToBeUnraveled: Element | undefined;

      for (let i = 0; i < node.children.length; i++) {
        const element = node.children[i];

        const isLastChild = i === node.children.length - 1;

        if (element.type === "element" && element.tagName === "img") {
          if (element.properties.markedAsToBeInFigure) {
            if (isLastChild) {
              elementToBeUnraveled ??= element;
            } else {
              element.properties.markedAsToBeInFigure = undefined;
              element.properties.captionInFigure = undefined;
            }
          }

          if (element.properties.markedAsToBeConverted) {
            if (isLastChild) {
              elementToBeUnraveled ??= element;
            } else {
              element.properties.markedAsToBeConverted = undefined;
              element.properties.convertionString = undefined;
            }
          }
        } else if (element.type === "element" && element.tagName === "a") {
          const subElement = element.children[0];

          if (subElement.type === "element" && subElement.tagName === "img") {
            if (subElement.properties.markedAsToBeInFigure) {
              if (isLastChild) {
                elementToBeUnraveled ??= element;
              } else {
                subElement.properties.markedAsToBeInFigure = undefined;
                subElement.properties.captionInFigure = undefined;
              }
            }

            if (subElement.properties.markedAsToBeConverted) {
              if (isLastChild) {
                elementToBeUnraveled ??= element;
                /* v8 ignore next 4 */
              } else {
                subElement.properties.markedAsToBeConverted = undefined;
                subElement.properties.convertionString = undefined;
              }
            }
          }
        }
      }

      if (elementToBeUnraveled) {
        if (node.children.length === 1) {
          // replace the node paragraph with the image
          parent.children.splice(index, 1, elementToBeUnraveled);
        } else {
          // move the image after node paragraph
          parent.children.splice(index + 1, 0, elementToBeUnraveled);
          // remove the image from node paragraph
          node.children.pop();
        }
      }
    });

    /**
     * wraps marked images/videos/audio with <figure> element and add caption
     *
     * mutates children !
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || !["img", "video", "audio"].includes(node.tagName)) {
        return;
      }

      if (node.properties.markedAsToBeInFigure) {
        const caption = node.properties.captionInFigure;

        const figcaptionElement =
          caption === undefined
            ? undefined
            : ({
                type: "element",
                tagName: "figcaption",
                properties: {},
                children: [{ type: "text", value: caption }],
              } as Element);

        const figureElement: Element = {
          type: "element",
          tagName: "figure",
          properties: {},
          children: figcaptionElement
            ? settings.figureCaptionPosition === "above"
              ? [figcaptionElement, node]
              : [node, figcaptionElement]
            : [node],
        };

        node.properties.markedAsToBeInFigure = undefined;
        node.properties.captionInFigure = undefined;

        // replace the image with figure element
        parent.children.splice(index, 1, figureElement);
      }
    });

    /**
     * converts marked images into to <video> / <audio> elements
     *
     * mutates children !
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || node.tagName !== "img") {
        return;
      }

      const marked = node.properties.markedAsToBeConverted;
      if (!marked) return CONTINUE;

      const [newTagName, extension] = node.properties.convertionString!.split("/");
      node.properties.markedAsToBeConverted = undefined;
      node.properties.convertionString = undefined;

      const src = node.properties.src;
      node.properties.src = undefined;
      node.properties.alt = undefined;

      const properties = structuredClone(node.properties);

      if (settings.alwaysAddControlsForVideos && newTagName === "video") {
        properties["controls"] = true;
      }

      if (settings.alwaysAddControlsForAudio && newTagName === "audio") {
        properties["controls"] = true;
      }

      const newNode: Element = {
        type: "element",
        tagName: newTagName,
        properties,
        children: [
          {
            type: "element",
            tagName: "source",
            properties: {
              src,
              type: mimeTypesMap[extension],
            },
            children: [],
          },
        ],
      };

      // replace the image with the transformed node
      parent.children.splice(index, 1, newNode);
    });

    /**
     * adds additional properties into assets utilizing the title attribute
     * adds auto link for images not videos and audio
     *
     * doesn't mutate the children
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || !["img", "video", "audio"].includes(node.tagName)) {
        return;
      }

      const title = node.properties.title;
      if (title?.includes(">")) {
        const [mainTitle, directives] = title.split(">");
        node.properties.title = mainTitle.trim() || undefined;

        const attrs = directives.trim().split(" ").filter(Boolean);
        attrs.forEach((attr) => {
          if (attr.startsWith("#")) {
            node.properties.id = attr.slice(1);
          } else if (attr.startsWith(".")) {
            /* v8 ignore next 4 */
            if (Array.isArray(node.properties.className)) {
              node.properties.className.push(attr.slice(1));
            } else if (typeof node.properties.className === "string") {
              node.properties.className = [node.properties.className, attr.slice(1)];
            } else {
              node.properties.className = [attr.slice(1)];
            }
          } else if (attr.includes("=")) {
            const [key, value] = attr.split("=");
            if (key === "width" || key === "height") {
              const match = value.match(/^(\d+)(?:px)?$/);
              if (match) {
                node.properties[key] = Number(match[1]);
              } else {
                node.properties.style = (node.properties.style || "") + `${key}:${value};`;
              }
            } else if (key === "style") {
              node.properties.style = (node.properties.style || "") + `${value};`;
            } else {
              node.properties[key] = value;
            }
          } else if (attr.includes("x")) {
            const [width, height] = attr.split("x");

            if (width) {
              const matchWidth = width.match(/^(\d+)(?:px)?$/);
              if (matchWidth) {
                node.properties["width"] = Number(matchWidth[1]);
              } else {
                node.properties.style = (node.properties.style || "") + `width:${width};`;
              }
            }

            if (height) {
              const matchHeight = height.match(/^(\d+)(?:px)?$/);
              if (matchHeight) {
                node.properties["height"] = Number(matchHeight[1]);
              } else {
                node.properties.style = (node.properties.style || "") + `height:${height};`;
              }
            }
          } else {
            node.properties[attr] = true;
          }
        });
      }

      if (node.properties.markedAsToBeAutoLinked) {
        node.properties.markedAsToBeAutoLinked = undefined;
        const src = node.properties.src;

        const httpsRegex = /^https?:\/\/[^/]+/i; // HTTP or HTTPS links
        const rootRelativeRegex = /^\/[^/]+/; // Root-relative links (e.g., /image.png)
        const wwwRegex = /^www\./i; // www links
        const fileLinkRegex = /^[a-zA-Z0-9-_]+\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;

        // Check if the src matches any of the types
        const isValidLink =
          httpsRegex.test(src!) ||
          rootRelativeRegex.test(src!) ||
          wwwRegex.test(src!) ||
          fileLinkRegex.test(src!);

        // Check if the source refers to an image (by file extension)
        const imageFileRegex = /\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;
        const isImage = imageFileRegex.test(src!);

        if (isValidLink && isImage) {
          parent.children[index] = {
            type: "element",
            tagName: "a",
            properties: { href: src, target: "_blank" },
            children: [node],
          };
        }
      }
    });

    // visit(tree, "mdxJsxFlowElement", function (node, index, parent): VisitorResult {
    //   /* v8 ignore next 3 */
    //   if (!parent || index === undefined || node.type !== "mdxJsxFlowElement") {
    //     return;
    //   }

    //   // handle for mdx elements in MDX format
    // });
  };
};

export default plugin;
