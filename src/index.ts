import type { Plugin } from "unified";

import type { Element, Root, RootContent, Text, ElementContent } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { whitespace } from "hast-util-whitespace";
import { parse as split } from "space-separated-tokens";
import type { MdxJsxFlowElementHast } from "mdast-util-mdx-jsx";

import { appendStyle, getExtension } from "./utils/index.js";
import {
  composeAttributeValueExpressionLiteral,
  composeAttributeValueExpressionStyle,
  updateOrAddMdxAttribute,
} from "./utils/util.mdxjsx.js";

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

declare module "mdast-util-mdx-jsx" {
  interface MdxJsxFlowElementHastData {
    markedAsToBeAutoLinked?: "bracket" | "parenthesis";
    markedAsToBeInFigure?: boolean;
    captionInFigure?: string;
    markedAsToBeConverted?: boolean;
    convertionString?: string;
  }
  interface MdxJsxTextElementHastData {
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

const htmlToReactAttrMap: Record<string, string> = {
  // Global
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  readonly: "readOnly",
  autofocus: "autoFocus",
  crossorigin: "crossOrigin",
  spellcheck: "spellCheck",
  contenteditable: "contentEditable",
  inputmode: "inputMode",
  enterkeyhint: "enterKeyHint",
  accesskey: "accessKey",

  // <img>
  srcset: "srcSet",
  usemap: "useMap",
  referrerpolicy: "referrerPolicy",
  fetchpriority: "fetchPriority",
  elementtiming: "elementTiming",
  ismap: "isMap",
  longdesc: "longDesc",

  // <video> / <audio>
  autoplay: "autoPlay",
  playsinline: "playsInline",
  controlslist: "controlsList",
  disablepictureinpicture: "disablePictureInPicture",
  disableremoteplayback: "disableRemotePlayback",

  // <a>
  hreflang: "hrefLang",
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

  const httpsRegex = /^https?:\/\/[^/]+/i; // HTTP or HTTPS links
  const rootRelativeRegex = /^\/[^/]+/; // Root-relative links (e.g., /image.png)
  const wwwRegex = /^www\./i; // www links
  const fileLinkRegex = /^[a-zA-Z0-9-_]+\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;
  const imageFileExtensionRegex = /\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i; // Check if the source refers to an image (by file extension)

  const SRC_WRAPPERS: {
    wrapper: "bracket" | "parenthesis";
    regex: RegExp;
  }[] = [
    { wrapper: "bracket", regex: /\[.*\]/ },
    { wrapper: "parenthesis", regex: /\(.*\)/ },
  ] as const;

  // TODO: support svg
  // look at https://www.npmjs.com/package/hast-util-properties-to-mdx-jsx-attributes

  /**
   * Transform.
   */
  return (tree: Root): undefined => {
    // console.log before preperation
    console.dir(tree, { depth: 12 });

    /**
     * preparation visit on Element
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

      // Preparation part for adding figure and caption *****************************

      const alt = node.properties.alt;

      if (alt) {
        const startsWith = {
          plus: alt.startsWith("+"),
          star: alt.startsWith("*"),
          caption: alt.startsWith("caption:"),
        };

        if (startsWith.plus || startsWith.star || startsWith.caption) {
          const isFigureParent = parent.type === "element" && parent.tagName === "figure";
          if (!isFigureParent) node.properties.markedAsToBeInFigure = true;

          const figcaptionText =
            startsWith.plus || startsWith.star ? alt.slice(1) : alt.slice(8);

          node.properties.captionInFigure = !startsWith.plus ? figcaptionText : undefined;
          node.properties.alt = node.tagName === "img" ? figcaptionText : undefined;
        }
      }

      // Preparation part for adding autolink ***************************************

      const src_ = node.properties.src;
      let src = typeof src_ === "string" ? decodeURI(src_) : undefined;

      if (src) {
        for (const { wrapper, regex } of SRC_WRAPPERS) {
          if (regex.test(src)) {
            src = src.slice(1, -1);
            node.properties.src = src;

            const isValidAutolink =
              (imageFileExtensionRegex.test(src) && httpsRegex.test(src)) ||
              rootRelativeRegex.test(src) ||
              wwwRegex.test(src) ||
              fileLinkRegex.test(src);

            if (node.tagName === "img" && isValidAutolink) {
              const isAnchorParent = parent.type === "element" && parent.tagName === "a";
              const isFigurable = node.properties.markedAsToBeInFigure;

              if (!isAnchorParent || (isFigurable && wrapper === "parenthesis")) {
                node.properties.markedAsToBeAutoLinked = wrapper;
              }

              break; // stop after the first match
            }
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
     * preparation visit on MdxJsxFlowElement and MdxJsxTextElement
     *
     * remove the brackets/parentheses around the videos/audio sources since they will not be auto linked
     * mark the images as to be autolinked if there are brackets/parentheses around the source
     * mark the images/videos/audio as to be wrapped in a figure and set the captions
     * mark the images as to be converted into videos/audio based on the source extension
     *
     */
    visit(
      tree,
      ["mdxJsxFlowElement", "mdxJsxTextElement"],
      function (node, index, parent): VisitorResult {
        /* v8 ignore next 3 */
        if (!parent || index === undefined) return;

        if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;

        if (!node.name || !["img", "video", "Video", "audio"].includes(node.name)) {
          return;
        }

        // start collecting data with empty object
        node.data ??= {};

        // Preparation part for adding figure and caption *****************************

        const altAttribute = node.attributes.find(
          (attr) => attr.type === "mdxJsxAttribute" && attr.name === "alt",
        );

        const alt = typeof altAttribute?.value === "string" ? altAttribute.value : undefined;

        if (altAttribute && alt) {
          const startsWith = {
            plus: alt.startsWith("+"),
            star: alt.startsWith("*"),
            caption: alt.startsWith("caption:"),
          };

          if (startsWith.plus || startsWith.star || startsWith.caption) {
            const isFigureParent =
              (parent.type === "mdxJsxFlowElement" || parent.type === "mdxJsxTextElement") &&
              parent.name === "figure";

            if (!isFigureParent) node.data.markedAsToBeInFigure = true;

            const figcaptionText =
              startsWith.plus || startsWith.star ? alt.slice(1) : alt.slice(8);

            node.data.captionInFigure = !startsWith.plus ? figcaptionText : undefined;
            altAttribute.value = node.name === "img" ? figcaptionText : undefined;
          }
        }

        // Preparation part for adding autolink ***************************************

        const srcAttribute = node.attributes.find(
          (attr) => attr.type === "mdxJsxAttribute" && attr.name === "src",
        );

        const src_ = typeof srcAttribute?.value === "string" ? srcAttribute.value : undefined;
        let src = typeof src_ === "string" ? decodeURI(src_) : undefined;

        if (srcAttribute && src) {
          for (const { wrapper, regex } of SRC_WRAPPERS) {
            if (regex.test(src)) {
              src = src.slice(1, -1);
              srcAttribute.value = src;

              const isValidAutolink =
                (imageFileExtensionRegex.test(src) && httpsRegex.test(src)) ||
                rootRelativeRegex.test(src) ||
                wwwRegex.test(src) ||
                fileLinkRegex.test(src);

              if (node.name === "img" && isValidAutolink) {
                const isAnchorParent =
                  (parent.type === "mdxJsxFlowElement" ||
                    parent.type === "mdxJsxTextElement") &&
                  parent.name === "a";

                const isFigurable = node.data?.markedAsToBeInFigure;

                if (!isAnchorParent || (isFigurable && wrapper === "parenthesis")) {
                  node.data.markedAsToBeAutoLinked = wrapper;
                }
                break; // stop after the first match
              }
            }
          }
        }

        // Preparation part for convertion to video/audio ****************************

        if (srcAttribute && typeof srcAttribute.value === "string") {
          const extension = getExtension(srcAttribute.value);
          const needsConversion = extension && (isVideoExt(extension) || isAudioExt(extension));

          if (needsConversion && node.name === "img") {
            node.data.markedAsToBeConverted = true;
            node.data.convertionString = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
          }
        }

        // if `node.data` is still empty than set it as undefined
        if (Object.keys(node.data).length === 0) {
          node.data = undefined;
        }
      },
    );

    /**
     * unravelling visit on <p> elements looking Element, MdxJsxFlowElement and MdxJsxTextElement
     *
     * unravel images to be converted into videos/audio or to be wrapped with figure in paragraphs
     * unravel also videos/audio wrapped with a paragraph (it may happen while remark/rehype parsing)
     *
     * Mutates `children` of paragraph nodes.
     */
    visit(tree, "element", function (node, index, parent) {
      if (!parent || index === undefined || node.tagName !== "p") return;

      const newNodes: RootContent[] = [];
      let currentParagraph: Element = createEmptyParagraph();

      for (const element of node.children) {
        if (isRelevantElement(element) || isRelevantMdxJsxElement(element)) {
          flushParagraph();
          newNodes.push(element);
        } else {
          currentParagraph.children.push(element);
        }
      }

      flushParagraph();

      // filter empty paragraphs
      const filtered = newNodes.filter((n) => {
        return !(n.type === "element" && n.tagName === "p" && n.children.every(whitespace));
      });

      // trim the text on edges
      filtered.forEach((n) => {
        n.type === "element" && n.tagName === "p" && trimParagraphEdges(n);
      });

      // insert new line between each nodes
      const inserted = insertBetween(filtered, { type: "text", value: "\n" });

      parent.children.splice(index, 1, ...inserted);

      function insertBetween(arr: RootContent[], element: Text): RootContent[] {
        return arr.flatMap((item, index) =>
          index < arr.length - 1 ? [item, element] : [item],
        );
      }

      function flushParagraph() {
        newNodes.push(currentParagraph);
        currentParagraph = createEmptyParagraph();
      }

      function createEmptyParagraph(): Element {
        return {
          type: "element",
          tagName: "p",
          properties: {},
          children: [],
        };
      }

      function trimParagraphEdges(paragraph: Element) {
        const first = paragraph.children[0];
        const last = paragraph.children[paragraph.children.length - 1];

        if (first?.type === "text") {
          first.value = first.value.replace(/^[ ]+/, "");
        }

        if (last?.type === "text") {
          last.value = last.value.replace(/[ ]+$/, "");
        }
      }

      function isRelevantElement(element: ElementContent) {
        if (element.type !== "element") return false;

        const isVideo = element.tagName === "video";
        const isAudio = element.tagName === "audio";
        const isFigure = element.tagName === "figure";

        const isRelevantImage = element.tagName === "img" && isMarkedElement(element);

        const isRelevantAnchor =
          element.tagName === "a" &&
          element.children.some((child) => {
            return (
              child.type === "element" &&
              ((child.tagName === "img" && isMarkedElement(child)) ||
                child.tagName === "video" ||
                child.tagName === "audio" ||
                child.tagName === "figure")
            );
          });

        return isVideo || isAudio || isFigure || isRelevantImage || isRelevantAnchor;
      }

      function isMarkedElement(el: ElementContent | undefined | null) {
        /* v8 ignore next */
        if (!el || !("properties" in el)) return false;
        return el.properties.markedAsToBeInFigure || el.properties.markedAsToBeConverted;
      }

      function isRelevantMdxJsxElement(element: ElementContent) {
        if (element.type !== "mdxJsxFlowElement" && element.type !== "mdxJsxTextElement")
          return false;

        const isVideo = element.name === "video";
        const isAudio = element.name === "audio";
        const isFigure = element.name === "figure";

        const isRelevantImage = element.name === "img" && isMarkedMdxJsxElement(element);

        const isRelevantAnchor =
          element.name === "a" &&
          element.children.some((child) => {
            return (
              (child.type === "mdxJsxFlowElement" || child.type === "mdxJsxTextElement") &&
              ((child.name === "img" && isMarkedMdxJsxElement(child)) ||
                child.name === "video" ||
                child.name === "audio" ||
                child.name === "figure")
            );
          });

        return isVideo || isAudio || isFigure || isRelevantImage || isRelevantAnchor;
      }

      function isMarkedMdxJsxElement(el: ElementContent | undefined | null) {
        /* v8 ignore next */
        if (!el || !("attributes" in el)) return false;
        return el.data?.markedAsToBeInFigure || el.data?.markedAsToBeConverted;
      }
    });

    // console.log before application; after preperation
    console.dir(tree, { depth: 12 });

    /**
     * application visit on Element
     *
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

      // The application part for adding figure and caption ****************************

      if (node.properties.markedAsToBeInFigure) {
        const caption = node.properties.captionInFigure;

        const figcaptionElement: Element = {
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: caption! }],
        };

        const figureElement: Element = {
          type: "element",
          tagName: "figure",
          properties: {},
          children: !caption
            ? [node]
            : settings.figureCaptionPosition === "above"
              ? [figcaptionElement, node]
              : [node, figcaptionElement],
        };

        node.properties.markedAsToBeInFigure = undefined;
        node.properties.captionInFigure = undefined;

        parent.children.splice(index, 1, figureElement);
        return index;
      } else if (node.properties.captionInFigure) {
        const caption = node.properties.captionInFigure;

        const figcaptionElement: Element = {
          type: "element",
          tagName: "figcaption",
          properties: {},
          children: [{ type: "text", value: caption! }],
        };

        if (settings.figureCaptionPosition === "above") {
          parent.children.unshift(figcaptionElement);
        } else {
          parent.children.push(figcaptionElement);
        }

        node.properties.captionInFigure = undefined;
      }

      // The application part for convertion to video/audio ****************************

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

      // The application part for adding attributes utilizing title ************************

      if (node.properties.title?.includes(">")) {
        const [mainTitle, directives] = node.properties.title.split(">");
        node.properties.title = mainTitle.trim() || undefined;

        const attrs = split(directives);
        attrs.forEach((attr) => {
          if (attr.startsWith("#")) {
            node.properties.id = attr.slice(1);
          } else if (attr.startsWith(".")) {
            if (Array.isArray(node.properties.className)) {
              node.properties.className.push(attr.slice(1));
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
                node.properties.style = appendStyle(node.properties.style, `${key}:${value}`);
              }
            } else if (key === "style") {
              node.properties.style = appendStyle(
                node.properties.style,
                value.replaceAll("~", " "),
              );
            } else {
              node.properties[key] = value;
            }
          } else if (attr.includes("x")) {
            const [width, height] = attr.split("x");

            [width, height].forEach((value, i) => {
              if (!value) return;

              const key = i === 0 ? "width" : "height";
              const match = value.match(/^(\d+)(?:px)?$/);
              if (match) {
                node.properties[key] = Number(match[1]);
              } else {
                node.properties.style = appendStyle(node.properties.style, `${key}:${value}`);
              }
            });
          } else {
            node.properties[attr] = true;
          }
        });
      }

      // The application part for adding autolink ***********************************

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
            const isGrandparentAnchor =
              grandparent?.type === "element" && grandparent.tagName === "a";

            if (
              !grandparent ||
              !("children" in grandparent) ||
              !Array.isArray(grandparent.children)
              /* v8 ignore next 3 */
            ) {
              return;
            }

            const parentIndex = grandparent.children.indexOf(parent);
            if (parentIndex !== -1 && !isGrandparentAnchor) {
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

    /**
     * application visit on MdxJsxFlowElement and MdxJsxTextElement
     *
     * wrap marked images/videos/audio with <figure> element and add caption
     * convert marked images into to <video> / <audio> elements
     * add additional properties into assets utilizing the title attribute
     * add autolink for marked images
     *
     * Mutates `children` of paragraph nodes.
     */
    visit(
      tree,
      ["mdxJsxFlowElement", "mdxJsxTextElement"],
      function (node, index, parent): VisitorResult {
        /* v8 ignore next 3 */
        if (!parent || index === undefined) return;

        if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;

        if (!node.name || !["img", "video", "Video", "audio"].includes(node.name)) {
          return;
        }

        // The application part for adding figure and caption ****************************

        if (node.data?.markedAsToBeInFigure) {
          const caption = node.data.captionInFigure;

          const figcaptionElement: MdxJsxFlowElementHast = {
            type: "mdxJsxFlowElement",
            name: "figcaption",
            attributes: [],
            children: [{ type: "text", value: caption! }],
          };

          const figureElement: MdxJsxFlowElementHast = {
            type: "mdxJsxFlowElement",
            name: "figure",
            attributes: [],
            children: !caption
              ? [node]
              : settings.figureCaptionPosition === "above"
                ? [figcaptionElement, node]
                : [node, figcaptionElement],
          };

          node.data.markedAsToBeInFigure = undefined;
          node.data.captionInFigure = undefined;

          parent.children.splice(index, 1, figureElement);
          return index;
        } else if (node.data?.captionInFigure) {
          const caption = node.data.captionInFigure;

          const figcaptionElement: MdxJsxFlowElementHast = {
            type: "mdxJsxFlowElement",
            name: "figcaption",
            attributes: [],
            children: [{ type: "text", value: caption! }],
          };

          if (settings.figureCaptionPosition === "above") {
            parent.children.unshift(figcaptionElement);
          } else {
            parent.children.push(figcaptionElement);
          }

          node.data.captionInFigure = undefined;
        }

        // The application part for convertion to video/audio ****************************

        if (node.data?.markedAsToBeConverted) {
          const [newTagName, extension] = node.data.convertionString!.split("/");
          node.data.markedAsToBeConverted = undefined;
          node.data.convertionString = undefined;

          const srcAttribute = node.attributes.find(
            (attr) => attr.type === "mdxJsxAttribute" && attr.name === "src",
          );

          const src = srcAttribute?.value;

          node.attributes = node.attributes.filter(
            (attr) =>
              attr.type === "mdxJsxAttribute" && attr.name !== "src" && attr.name !== "alt",
          );

          const attributes = structuredClone(node.attributes);

          if (settings.alwaysAddControlsForVideos && newTagName === "video") {
            attributes.push({
              type: "mdxJsxAttribute",
              name: "controls",
              value: "true",
            });
          }

          if (settings.alwaysAddControlsForAudio && newTagName === "audio") {
            attributes.push({
              type: "mdxJsxAttribute",
              name: "controls",
              value: "true",
            });
          }

          const newNode: MdxJsxFlowElementHast = {
            type: "mdxJsxFlowElement",
            name: newTagName,
            attributes,
            children: [
              {
                type: "mdxJsxFlowElement",
                name: "source",
                attributes: [
                  {
                    type: "mdxJsxAttribute",
                    name: "src",
                    value: src,
                  },
                  {
                    type: "mdxJsxAttribute",
                    name: "type",
                    value: mimeTypesMap[extension],
                  },
                ],
                children: [],
              },
            ],
          };

          parent.children.splice(index, 1, newNode);
          return index;
        }

        // The application part for adding attributes utilizing title ************************

        const titleAttribute = node.attributes.find(
          (attr) => attr.type === "mdxJsxAttribute" && attr.name === "title",
        );

        if (
          titleAttribute?.type === "mdxJsxAttribute" &&
          typeof titleAttribute.value === "string"
        ) {
          const title = titleAttribute.value;
          if (title.includes(">")) {
            const [mainTitle, directives] = title.split(">");
            titleAttribute.value = mainTitle.trim() || undefined;

            const attrs = split(directives);
            if (attrs.length) {
              const attributes = structuredClone(node.attributes);

              attrs.forEach((attr) => {
                if (attr.startsWith("#")) {
                  updateOrAddMdxAttribute(attributes, "id", attr.slice(1));
                } else if (attr.startsWith(".")) {
                  updateOrAddMdxAttribute(attributes, "className", attr.slice(1));
                } else if (attr.includes("=")) {
                  const [key, value] = attr.split("=");
                  if (key === "width" || key === "height") {
                    const match = value.match(/^(\d+)(?:px)?$/);
                    if (match) {
                      updateOrAddMdxAttribute(attributes, key, Number(match[1]));
                    } else {
                      updateOrAddMdxAttribute(
                        attributes,
                        "style",
                        composeAttributeValueExpressionStyle(`${key}:${value}`),
                      );
                    }
                  } else if (key === "style") {
                    updateOrAddMdxAttribute(
                      attributes,
                      key,
                      composeAttributeValueExpressionStyle(value.replaceAll("~", " ")),
                    );
                  } else {
                    updateOrAddMdxAttribute(attributes, htmlToReactAttrMap[key] || key, value);
                  }
                } else if (attr.includes("x")) {
                  const [width, height] = attr.split("x");

                  if (width) {
                    const matchWidth = width.match(/^(\d+)(?:px)?$/);
                    if (matchWidth) {
                      updateOrAddMdxAttribute(attributes, "width", Number(matchWidth[1]));
                    } else {
                      updateOrAddMdxAttribute(
                        attributes,
                        "style",
                        composeAttributeValueExpressionStyle(`width:${width}`),
                      );
                    }
                  }

                  if (height) {
                    const matchHeight = height.match(/^(\d+)(?:px)?$/);
                    if (matchHeight) {
                      updateOrAddMdxAttribute(attributes, "height", Number(matchHeight[1]));
                    } else {
                      updateOrAddMdxAttribute(
                        attributes,
                        "style",
                        composeAttributeValueExpressionStyle(`height:${height}`),
                      );
                    }
                  }
                } else {
                  // updateOrAddMdxAttribute(attributes, attr, null);
                  updateOrAddMdxAttribute(
                    attributes,
                    htmlToReactAttrMap[attr] || attr,
                    composeAttributeValueExpressionLiteral(true),
                  );
                }
              });

              node.attributes = structuredClone(attributes);
            }
          }
        }

        // The application part for adding autolink ***********************************

        if (node.data?.markedAsToBeAutoLinked) {
          const srcAttribute = node.attributes.find(
            (a) => a.type === "mdxJsxAttribute" && a.name === "src",
          );
          const src = srcAttribute?.value;
          const marker = node.data.markedAsToBeAutoLinked;
          node.data.markedAsToBeAutoLinked = undefined;

          const isFigureParent =
            parent.type === "mdxJsxFlowElement" && parent.name === "figure";

          if (isFigureParent && marker === "bracket") {
            // find the parent index so as the anchor covers the parent
            visitParents(tree, "mdxJsxFlowElement", function (targetNode, ancestors) {
              if (targetNode !== parent) return;

              const grandparent = ancestors.at(-1);
              const isGrandparentAnchor =
                grandparent?.type === "mdxJsxFlowElement" && grandparent.name === "a";

              if (
                !grandparent ||
                !("children" in grandparent) ||
                !Array.isArray(grandparent.children)
                /* v8 ignore next 3 */
              ) {
                return;
              }

              const parentIndex = grandparent.children.indexOf(parent);
              if (parentIndex !== -1 && !isGrandparentAnchor) {
                grandparent.children.splice(parentIndex, 1, {
                  type: "mdxJsxFlowElement",
                  name: "a",
                  attributes: [
                    {
                      type: "mdxJsxAttribute",
                      name: "href",
                      value: src,
                    },
                    {
                      type: "mdxJsxAttribute",
                      name: "target",
                      value: "_blank",
                    },
                  ],
                  children: [parent],
                });
              }
            });
          } else {
            parent.children.splice(index, 1, {
              type: "mdxJsxFlowElement",
              name: "a",
              attributes: [
                {
                  type: "mdxJsxAttribute",
                  name: "href",
                  value: src,
                },
                {
                  type: "mdxJsxAttribute",
                  name: "target",
                  value: "_blank",
                },
              ],
              children: [node],
            });
          }
        }
      },
    );

    // console.log after application
    console.dir(tree, { depth: 12 });
  };
};

export default plugin;
