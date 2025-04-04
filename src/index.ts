import type { Plugin } from "unified";
import type { Element, Root, RootContent, Text } from "hast";
import { CONTINUE, visit, type VisitorResult } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type PartiallyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

declare module "hast" {
  interface Properties {
    src?: string;
    title?: string;
    alt?: string;
    markedAsToBeAutoLinked?: "bracket" | "parenthesis";
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

  const RE_LEADING_WHITESPACE = /^(\s*)/;
  const RE_TRAILING_WHITESPACE = /(\s*)$/;

  function getLeadingWhitespace(text: string) {
    const match = text.match(RE_LEADING_WHITESPACE);
    /* v8 ignore next */
    return match ? match[1] : "";
  }

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

      const hasBracket3 = src && /%5B.*%5D/.test(src);
      const hasBracket1 = src && /\[.*\]/.test(src);
      if (hasBracket1 || hasBracket3) {
        node.properties.src = hasBracket1 ? src.slice(1, -1) : src.slice(3, -3);

        // mark if it is image and the parent is not anchor element
        if (node.tagName === "img" && !(parent.type === "element" && parent.tagName === "a")) {
          node.properties.markedAsToBeAutoLinked = "bracket";
        }
      }

      const hasCurlyBrace3 = src && /%28.*%29/.test(src);
      const hasCurlyBrace1 = src && /\(.*\)/.test(src);
      if (hasCurlyBrace1 || hasCurlyBrace3) {
        node.properties.src = hasCurlyBrace1 ? src.slice(1, -1) : src.slice(3, -3);

        // mark if it is image and the parent is not anchor element
        if (node.tagName === "img" && !(parent.type === "element" && parent.tagName === "a")) {
          node.properties.markedAsToBeAutoLinked = "parenthesis";
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
      const needsConversion = extension && (isVideoExt(extension) || isAudioExt(extension));
      if (needsConversion && node.tagName === "img") {
        node.properties.markedAsToBeConverted = true;
        node.properties.convertionString = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
      }
    });

    /**
     * unravels image elements to be converted into video/audio or to be wrapped with figure in paragraphs
     * unravels also video and audio elements parsed in paragraphs (it may happen while rehype parsing)
     *
     * mutates children !
     */
    visit(tree, "element", function (node, index, parent) {
      if (!parent || index === undefined || node.tagName !== "p") {
        return;
      }

      const newNodes: RootContent[] = [];
      let hasNonWhitespace = false;
      let currentParagraph: Element = {
        type: "element",
        tagName: "p",
        properties: {},
        children: [],
      };

      let happened = false;
      let referenceToLastTextElement: Text | undefined;

      function pushCurrentParagraph() {
        if (hasNonWhitespace) {
          newNodes.push(currentParagraph);
        }

        hasNonWhitespace = false;
        currentParagraph = {
          type: "element",
          tagName: "p",
          properties: {},
          children: [],
        };
      }

      for (const element of node.children) {
        const isImage = element.type === "element" && element.tagName === "img";
        const isVideo = element.type === "element" && element.tagName === "video";
        const isAudio = element.type === "element" && element.tagName === "audio";
        const isAnchorWithImage =
          element.type === "element" &&
          element.tagName === "a" &&
          element.children.length === 1 &&
          element.children[0].type === "element" &&
          element.children[0].tagName === "img";

        const subElement = isAnchorWithImage ? (element.children[0] as Element) : null;

        if (
          isVideo ||
          isAudio ||
          (isImage &&
            "properties" in element &&
            (element.properties.markedAsToBeInFigure ||
              element.properties.markedAsToBeConverted)) ||
          (subElement &&
            "properties" in subElement &&
            (subElement.properties.markedAsToBeInFigure ||
              subElement.properties.markedAsToBeConverted))
        ) {
          happened = true;
          const prevHasNonWhitespace = hasNonWhitespace;

          pushCurrentParagraph(); // it may toggle the hasNonWhitespace

          if (prevHasNonWhitespace) {
            newNodes.push({ type: "text", value: "\n" }, element);
          } else {
            newNodes.push(element);
          }

          pushCurrentParagraph();
        } else {
          if (happened && element.type === "text") {
            happened = false;
            const leadingWhitespace = getLeadingWhitespace(element.value);
            element.value.replace(RE_LEADING_WHITESPACE, "");

            if (referenceToLastTextElement) {
              referenceToLastTextElement.value = referenceToLastTextElement.value.replace(
                RE_TRAILING_WHITESPACE,
                leadingWhitespace,
              );
            }
          }
          if (!(element.type === "text" && element.value === "")) {
            currentParagraph.children.push(element);
            if (element.type === "text") referenceToLastTextElement = element;
          }

          if (!(element.type === "text" && !element.value.trim())) {
            hasNonWhitespace = true;
          }
        }
      }

      pushCurrentParagraph();
      parent.children.splice(index, 1, ...newNodes);
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
        const src = node.properties.src;
        const marker = node.properties.markedAsToBeAutoLinked;
        node.properties.markedAsToBeAutoLinked = undefined;

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
        const imageFileExtensionRegex = /\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;
        const isImageFileExtension = imageFileExtensionRegex.test(src!);

        if (isValidLink && isImageFileExtension) {
          if (
            parent.type === "element" &&
            parent.tagName === "figure" &&
            marker === "bracket"
          ) {
            // needs to find parent index, so anchor can cover the parent
            visitParents(tree, "element", function (targetNode, ancestors) {
              if (targetNode !== parent) return;

              const grandparent = ancestors.at(-1);
              if (
                !grandparent ||
                !("children" in grandparent) ||
                !Array.isArray(grandparent.children)
              ) {
                return;
              }

              const parentIndex = grandparent.children.indexOf(parent);
              if (parentIndex !== -1) {
                grandparent.children.splice(parentIndex, 1, {
                  type: "element",
                  tagName: "a",
                  properties: { href: src, target: "_blank" },
                  children: [parent],
                });
              }
            });
          } else {
            parent.children.splice(index, 1, {
              type: "element",
              tagName: "a",
              properties: { href: src, target: "_blank" },
              children: [node],
            });
          }
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
