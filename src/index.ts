import type { Plugin } from "unified";
import type { Element, Root, RootContent, Text, ElementContent } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";
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
 * `rehype-image-hack` enhances markdown image syntax and MDX media elements (img, audio, video) by;
 *  - adding attributes,
 *  - adding figure captions,
 *  - auto-linking images to originals,
 *  - converting images to video/audio based on the file extension
 *
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

  const httpsRegex = /^https?:\/\/[^/]+/i; // HTTP or HTTPS links
  const rootRelativeRegex = /^\/[^/]+/; // Root-relative links (e.g., /image.png)
  const wwwRegex = /^www\./i; // www links
  const fileLinkRegex = /^[a-zA-Z0-9-_]+\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;
  const imageFileExtensionRegex = /\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i; // Check if the source refers to an image (by file extension)

  /**
   * Transform.
   */
  return (tree: Root): undefined => {
    // console.dir(tree, { depth: 8 });

    /**
     * visit for preparation
     *
     * remove the brackets/parentheses around the videos/audio sources since they will not be auto linked
     * mark the images as to be autolinked if there are brackets/parentheses around the source
     * mark the images/videos/audio as to be wrapped in a figure and set the captions
     * mark the images as to be converted into videos/audio based on the source extension
     *
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || !["img", "video", "audio"].includes(node.tagName)) {
        return;
      }

      // Preparation part for adding autolink ***************************************

      const isAnchorParent = parent.type === "element" && parent.tagName === "a";

      let src = node.properties.src;
      if (src) {
        const wrappers = [
          { wrapper: "bracket", raw: /\[.*\]/, encoded: /%5B.*%5D/ },
          { wrapper: "parenthesis", raw: /\(.*\)/, encoded: /%28.*%29/ },
        ];

        for (const { wrapper, raw, encoded } of wrappers) {
          const isRaw = raw.test(src);
          const isEncoded = !isRaw && encoded.test(src);

          if (isRaw || isEncoded) {
            const sliceAmount = isRaw ? 1 : 3;
            src = src.slice(sliceAmount, -sliceAmount);
            node.properties.src = src;

            const isValidAutolink =
              (imageFileExtensionRegex.test(src) && httpsRegex.test(src)) ||
              rootRelativeRegex.test(src) ||
              wwwRegex.test(src) ||
              fileLinkRegex.test(src);

            if (node.tagName === "img" && !isAnchorParent && isValidAutolink) {
              node.properties.markedAsToBeAutoLinked = wrapper as "bracket" | "parenthesis";
              break; // stop after the first match
            }
          }
        }
      }

      // Preparation part for adding figure and caption *****************************

      const alt = node.properties.alt;
      if (alt) {
        const startsWith = {
          plus: alt.startsWith("+"),
          star: alt.startsWith("*"),
          caption: alt.startsWith("caption:"),
        };

        if (startsWith.plus || startsWith.star || startsWith.caption) {
          {
            node.properties.markedAsToBeInFigure = true;

            const figcaptionText =
              startsWith.plus || startsWith.star ? alt.slice(1) : alt.slice(8);

            node.properties.captionInFigure = !startsWith.plus ? figcaptionText : undefined;
            node.properties.alt = node.tagName === "img" ? figcaptionText : undefined;
          }
        }
      }

      // Preparation part for convertion to video/audio ****************************

      const extension = getExtension(node.properties.src);
      const needsConversion = extension && (isVideoExt(extension) || isAudioExt(extension));
      if (needsConversion && node.tagName === "img") {
        node.properties.markedAsToBeConverted = true;
        node.properties.convertionString = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
      }
    });

    /**
     * unravel image elements to be converted into video/audio or to be wrapped with figure in paragraphs
     * unravel also video and audio elements parsed in a paragraph (it may happen while remark/rehype parsing)
     *
     * Mutates `children` of paragraph nodes.
     */
    visit(tree, "element", function (node, index, parent) {
      if (!parent || index === undefined || node.tagName !== "p") return;

      const newNodes: RootContent[] = [];
      let hasNonWhitespace = false;
      let currentParagraph: Element = createEmptyParagraph();

      let inSplitMode = false;
      let referenceToLastTextElement: Text | undefined;

      for (const element of node.children) {
        if (isRelevant(element)) {
          inSplitMode = true;
          const prevHasNonWhitespace = hasNonWhitespace;

          flushParagraph(); // it may toggle the hasNonWhitespace

          if (prevHasNonWhitespace) {
            newNodes.push({ type: "text", value: "\n" }, element);
          } else {
            newNodes.push(element);
          }

          flushParagraph();
        } else {
          if (element.type === "text" && inSplitMode) {
            inSplitMode = false;
            const leadingWhitespace = getLeadingWhitespace(element.value);
            element.value.replace(RE_LEADING_WHITESPACE, "");

            if (referenceToLastTextElement) {
              referenceToLastTextElement.value = referenceToLastTextElement.value.replace(
                RE_TRAILING_WHITESPACE,
                leadingWhitespace,
              );
            }
          }

          if (element.type !== "text" || element.value !== "") {
            currentParagraph.children.push(element);
            if (element.type === "text") referenceToLastTextElement = element;
          }

          if (element.type !== "text" || element.value.trim() !== "") {
            hasNonWhitespace = true;
          }
        }
      }

      flushParagraph();
      parent.children.splice(index, 1, ...newNodes);

      function createEmptyParagraph(): Element {
        return {
          type: "element",
          tagName: "p",
          properties: {},
          children: [],
        };
      }

      function flushParagraph() {
        if (hasNonWhitespace) {
          newNodes.push(currentParagraph);
        }
        hasNonWhitespace = false;
        currentParagraph = createEmptyParagraph();
      }

      function isRelevant(element: ElementContent) {
        if (element.type !== "element") return false;

        const isVideo = element.tagName === "video";
        const isAudio = element.tagName === "audio";

        const isRelevantImage = element.tagName === "img" && isMarked(element);

        const isRelevantAnchor =
          element.tagName === "a" &&
          element.children.some((child) => {
            return (
              child.type === "element" &&
              ((child.tagName === "img" && isMarked(child)) ||
                child.tagName === "video" ||
                child.tagName === "audio")
            );
          });

        return isVideo || isAudio || isRelevantImage || isRelevantAnchor;
      }

      function isMarked(el: ElementContent | undefined | null) {
        /* v8 ignore next */
        if (!el || !("properties" in el)) return false;
        return el.properties.markedAsToBeInFigure || el.properties.markedAsToBeConverted;
      }
    });

    /**
     * wrap marked images/videos/audio with <figure> element and add caption
     * convert marked images into to <video> / <audio> elements
     * add additional properties into assets utilizing the title attribute
     * add autolink for marked images
     *
     * Mutates `children` of paragraph nodes.
     */
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || !["img", "video", "audio"].includes(node.tagName)) {
        return;
      }

      // The part for adding figure and caption ****************************

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

        parent.children.splice(index, 1, figureElement);
        return index;
      }

      // The part for convertion to video/audio ****************************

      if (node.properties.markedAsToBeConverted) {
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

        parent.children.splice(index, 1, newNode);
        return index;
      }

      // The part for adding attributes utilizing title ************************

      if (node.properties.title?.includes(">")) {
        const [mainTitle, directives] = node.properties.title.split(">");
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

      // The part for adding autolink ***********************************

      if (node.properties.markedAsToBeAutoLinked) {
        const src = node.properties.src;
        const marker = node.properties.markedAsToBeAutoLinked;
        node.properties.markedAsToBeAutoLinked = undefined;

        const isFigureParent = parent.type === "element" && parent.tagName === "figure";

        if (isFigureParent && marker === "bracket") {
          // find the parent index so as the anchor covers the parent
          visitParents(tree, "element", function (targetNode, ancestors) {
            if (targetNode !== parent) return;

            const grandparent = ancestors.at(-1);
            if (
              !grandparent ||
              !("children" in grandparent) ||
              !Array.isArray(grandparent.children)
              /* v8 ignore next 3 */
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
