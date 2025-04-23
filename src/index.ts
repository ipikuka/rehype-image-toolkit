import type { Plugin } from "unified";

import type { MdxJsxFlowElementHast, MdxJsxTextElementHast } from "mdast-util-mdx-jsx";
import type { Element, Root, RootContent, Text, ElementContent, Doctype } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { whitespace } from "hast-util-whitespace";
import { parse as split } from "space-separated-tokens";

import { appendStyle, getExtension, parseAltDirective } from "./utils/index.js";
import {
  getMdxJsxAttributeValue,
  updateOrAddMdxJsxAttribute,
  composeMdxJsxAttributeValueExpressionLiteral,
  composeMdxJsxAttributeValueExpressionStyle,
  getMdxJsxAttribute,
  removeMdxJsxAttribute,
} from "./utils/util.mdxjsx.js";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type PartiallyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

declare module "hast" {
  interface Properties {
    src?: string;
    title?: string;
    alt?: string;
    directiveAutolink?: "bracket" | "parenthesis";
    directiveFigure?: boolean;
    directiveCaption?: string;
    directiveConversion?: string;
    directiveTitle?: string;
    directiveUnwrap?: boolean;
    directiveInline?: boolean;
  }
}

declare module "mdast-util-mdx-jsx" {
  interface MdxJsxFlowElementHastData {
    directiveAutolink?: "bracket" | "parenthesis";
    directiveFigure?: boolean;
    directiveCaption?: string;
    directiveConversion?: string;
    directiveTitle?: string;
    directiveUnwrap?: boolean;
    directiveInline?: boolean;
  }

  interface MdxJsxTextElementHastData {
    directiveAutolink?: "bracket" | "parenthesis";
    directiveFigure?: boolean;
    directiveCaption?: string;
    directiveConversion?: string;
    directiveTitle?: string;
    directiveUnwrap?: boolean;
    directiveInline?: boolean;
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
 *  - adding style and attributes,
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

  function isFigureElement(
    node: Root | Element | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): node is Element {
    return node.type === "element" && node.tagName === "figure";
  }

  function isAnchorElement(
    node: Root | Element | MdxJsxTextElementHast | MdxJsxFlowElementHast | ElementContent,
  ): node is Element {
    return node.type === "element" && node.tagName === "a";
  }

  function isParagraphElement(
    node: Root | Doctype | ElementContent | RootContent,
  ): node is Element {
    return node.type === "element" && node.tagName === "p";
  }

  function isMdxJsxElement(node: Root | ElementContent | Doctype | ElementContent) {
    return node?.type === "mdxJsxTextElement" || node?.type === "mdxJsxFlowElement";
  }

  function isAnchorMdxJsxElement(
    node: Root | ElementContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): node is MdxJsxTextElementHast | MdxJsxFlowElementHast {
    return isMdxJsxElement(node) && node.name === "a";
  }

  function isFigureMdxJsxElement(
    node: Root | ElementContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): boolean {
    return isMdxJsxElement(node) && node.name === "figure";
  }

  function isParagraphMdxJsxFlowElement(
    node: Root | RootContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): node is MdxJsxFlowElementHast {
    return node?.type === "mdxJsxFlowElement" && node.name === "p";
  }

  // TODO: support svg
  // look at https://www.npmjs.com/package/hast-util-properties-to-mdx-jsx-attributes

  /**
   * Transform.
   */
  return (tree: Root): undefined => {
    // console.log before preperation
    // console.dir(tree, { depth: 12 });

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

      // Preparation part for adding figure and caption; also unwrapping **************

      if (typeof node.properties.alt === "string") {
        const alt = node.properties.alt;
        const { directive, value } = parseAltDirective(alt);

        if (directive) {
          node.properties.alt = node.tagName === "img" ? value! : undefined;
        }

        switch (directive) {
          case "directiveFigureCaption":
            node.properties.directiveCaption = value;
            if (!isFigureElement(parent)) {
              node.properties.directiveFigure = true;
            }
            break;

          case "directiveOnlyFigure":
            if (!isFigureElement(parent)) {
              node.properties.directiveFigure = true;
            }
            break;

          case "directiveUnwrap":
            node.properties.directiveUnwrap = true;
            break;

          case "directiveInline":
            node.properties.directiveInline = true;
            break;
        }
      }

      // Preparation part for adding autolink ***************************************

      if (node.properties.src) {
        let src = decodeURI(node.properties.src);

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
              const isAnchorParent = isAnchorElement(parent);
              const isFigurable = node.properties.directiveFigure;

              if (!isAnchorParent || (isFigurable && wrapper === "parenthesis")) {
                node.properties.directiveAutolink = wrapper;
              }

              break; // stop after the first match
            }
          }
        }
      }

      // Preparation part for conversion to video/audio ****************************

      if (node.tagName === "img") {
        const extension = getExtension(node.properties.src);
        const needsConversion = extension && (isVideoExt(extension) || isAudioExt(extension));

        if (needsConversion) {
          node.properties.directiveConversion = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
        }
      }

      // Preparation part for adding attributes utilizing title ************************

      if (node.properties.title && node.properties.title.includes(">")) {
        const [title, directive] = node.properties.title.split(">").map((t) => t.trim());
        node.properties.title = title || undefined;
        node.properties.directiveTitle = directive || undefined;
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

        if (!node.name || !["img", "video", "audio"].includes(node.name)) {
          return;
        }

        // just for type narrowing [node.data has always {_mdxExplicitJsx: true}]
        node.data ??= {};

        // Preparation part for adding figure and caption; also unwrapping **************

        const altAttribute = getMdxJsxAttribute(node.attributes, "alt");

        if (altAttribute) {
          const [altType, alt] = getMdxJsxAttributeValue(altAttribute);

          if (typeof alt === "string") {
            const { directive, value } = parseAltDirective(alt);

            if (directive) {
              if (node.name === "img") {
                altAttribute.value =
                  altType === "string"
                    ? value!
                    : composeMdxJsxAttributeValueExpressionLiteral(value!);
              } else if (node.name === "video" || node.name === "audio") {
                node.attributes = removeMdxJsxAttribute(node.attributes, "alt");
              }
            }

            switch (directive) {
              case "directiveFigureCaption":
                node.data.directiveCaption = value!;
                if (!isFigureMdxJsxElement(parent)) {
                  node.data.directiveFigure = true;
                }
                break;

              case "directiveOnlyFigure":
                if (!isFigureMdxJsxElement(parent)) {
                  node.data.directiveFigure = true;
                }
                break;

              case "directiveUnwrap":
                node.data.directiveUnwrap = true;
                break;

              case "directiveInline":
                node.data.directiveInline = true;
                break;
            }
          }
        }

        // Preparation part for adding autolink ***************************************

        const srcAttribute = getMdxJsxAttribute(node.attributes, "src");
        let monitoredSrc;

        if (srcAttribute) {
          const [srcType, srcValue] = getMdxJsxAttributeValue(srcAttribute);

          if (typeof srcValue === "string") {
            let src = decodeURI(srcValue);
            monitoredSrc = src;

            for (const { wrapper, regex } of SRC_WRAPPERS) {
              if (regex.test(src)) {
                src = src.slice(1, -1);
                monitoredSrc = src;

                if (srcType === "string") {
                  srcAttribute.value = src;
                } else {
                  srcAttribute.value = composeMdxJsxAttributeValueExpressionLiteral(src);
                }

                const isValidAutolink =
                  (imageFileExtensionRegex.test(src) && httpsRegex.test(src)) ||
                  rootRelativeRegex.test(src) ||
                  wwwRegex.test(src) ||
                  fileLinkRegex.test(src);

                if (node.name === "img" && isValidAutolink) {
                  const isAnchorParent = isAnchorMdxJsxElement(parent);
                  const isFigurable = node.data?.directiveFigure;

                  if (!isAnchorParent || (isFigurable && wrapper === "parenthesis")) {
                    node.data.directiveAutolink = wrapper;
                  }
                  break; // stop after the first match
                }
              }
            }
          }
        }

        // Preparation part for conversion to video/audio ****************************

        if (monitoredSrc) {
          const extension = getExtension(monitoredSrc);
          const needsConversion = extension && (isVideoExt(extension) || isAudioExt(extension));

          if (needsConversion && node.name === "img") {
            node.data.directiveConversion = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
          }
        }

        // Preparation part for adding attributes utilizing title ************************

        const titleAttribute = getMdxJsxAttribute(node.attributes, "title");

        if (titleAttribute) {
          const [titleType, titleValue] = getMdxJsxAttributeValue(titleAttribute);

          if (typeof titleValue === "string" && titleValue.includes(">")) {
            const [title, directive] = titleValue.split(">").map((t) => t.trim());

            if (title) {
              titleAttribute.value =
                titleType === "string"
                  ? title
                  : composeMdxJsxAttributeValueExpressionLiteral(title);
            } else {
              node.attributes = removeMdxJsxAttribute(node.attributes, "title");
            }

            node.data.directiveTitle = directive || undefined;
          }
        }
      },
    );

    /**
     * unravelling visit on <p> Elements or <p> MdxJsxFlowElements
     *
     * unravel images to be converted into videos/audio or to be wrapped with figure in paragraphs
     * unravel also videos/audio wrapped with a paragraph (it may happen while remark/rehype parsing)
     *
     * Mutates `children` of paragraph nodes.
     */
    visit(tree, ["element", "mdxJsxFlowElement"], function (node, index, parent) {
      /* v8 ignore next */
      if (!parent || index === undefined) return;

      if (!isParagraphElement(node) && !isParagraphMdxJsxFlowElement(node)) return;

      const newNodes: RootContent[] = [];
      let currentParagraph: Element | MdxJsxFlowElementHast = createEmptyParagraph();

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
        return !(
          (isParagraphElement(n) || isParagraphMdxJsxFlowElement(n)) &&
          n.children.every(whitespace)
        );
      });

      // trim the text on edges
      filtered.forEach((n) => {
        (isParagraphElement(n) || isParagraphMdxJsxFlowElement(n)) && trimParagraphEdges(n);
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

      function createEmptyParagraph(): Element | MdxJsxFlowElementHast {
        if (isMdxJsxElement(node)) {
          return {
            type: "mdxJsxFlowElement",
            name: "p",
            attributes: [],
            children: [],
          };
        }

        return {
          type: "element",
          tagName: "p",
          properties: {},
          children: [],
        };
      }

      function trimParagraphEdges(paragraph: Element | MdxJsxFlowElementHast) {
        const first = paragraph.children[0];
        const last = paragraph.children[paragraph.children.length - 1];

        if (first?.type === "text") {
          first.value = first.value.replace(/^[ ]+/, "");
        }

        if (last?.type === "text") {
          last.value = last.value.replace(/[ ]+$/, "");
        }
      }

      function checkInternallyRelevantElement(element: ElementContent): boolean {
        if (element.type !== "element") return false;

        const isVideo = element.tagName === "video" && !element.properties.directiveInline;
        const isAudio = element.tagName === "audio" && !element.properties.directiveInline;
        const isFigure = element.tagName === "figure";

        const isRelevantImage = element.tagName === "img" && isMarkedElement(element);

        element.properties.directiveUnwrap = undefined;
        element.properties.directiveInline = undefined;

        return isVideo || isAudio || isFigure || isRelevantImage;
      }

      function isRelevantElement(element: ElementContent): boolean {
        const isRelevant = checkInternallyRelevantElement(element);
        const isRelevantAnchor =
          isAnchorElement(element) && element.children.some(checkInternallyRelevantElement);

        return isRelevant || isRelevantAnchor;
      }

      function isMarkedElement(el: ElementContent | undefined | null): boolean {
        /* v8 ignore next */
        if (!el || !("properties" in el)) return false;
        return (
          !el.properties.directiveInline &&
          (el.properties.directiveUnwrap ||
            el.properties.directiveFigure ||
            Boolean(el.properties.directiveConversion))
        );
      }

      function checkInternallyRelevantMdxJsxElement(element: ElementContent): boolean {
        if (!isMdxJsxElement(element)) return false;

        const isVideo = element.name === "video" && !element.data?.directiveInline;
        const isAudio = element.name === "audio" && !element.data?.directiveInline;
        const isFigure = element.name === "figure";

        const isRelevantImage = element.name === "img" && isMarkedMdxJsxElement(element);

        if (element.data) {
          element.data.directiveUnwrap = undefined;
          element.data.directiveInline = undefined;
        }

        return isVideo || isAudio || isFigure || isRelevantImage;
      }

      function isRelevantMdxJsxElement(element: ElementContent): boolean {
        const isRelevant = checkInternallyRelevantMdxJsxElement(element);
        const isRelevantAnchor =
          isAnchorMdxJsxElement(element) &&
          element.children.some(checkInternallyRelevantMdxJsxElement);

        return isRelevant || isRelevantAnchor;
      }

      function isMarkedMdxJsxElement(el: ElementContent | undefined | null): boolean {
        /* v8 ignore next */
        if (!el || !("attributes" in el)) return false;
        return (
          !el.data?.directiveInline &&
          (el.data?.directiveUnwrap ||
            el.data?.directiveFigure ||
            Boolean(el.data?.directiveConversion))
        );
      }
    });

    // console.log before application; after preperation
    // console.dir(tree, { depth: 12 });

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

      if (node.properties.directiveFigure) {
        const caption = node.properties.directiveCaption;
        node.properties.directiveFigure = undefined;
        node.properties.directiveCaption = undefined;

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

        parent.children.splice(index, 1, figureElement);

        return index;
      } else if (node.properties.directiveCaption) {
        const caption = node.properties.directiveCaption;
        node.properties.directiveCaption = undefined;

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

        return index;
      }

      // The application part for conversion to video/audio ****************************

      if (node.properties.directiveConversion) {
        const [newTagName, extension] = node.properties.directiveConversion.split("/");
        node.properties.directiveConversion = undefined;

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
          data: node.data,
        };

        parent.children.splice(index, 1, newNode);

        return index;
      }

      // The application part for adding attributes utilizing title ************************

      if (node.properties.directiveTitle) {
        const attrs = split(node.properties.directiveTitle);
        node.properties.directiveTitle = undefined;

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

      if (node.properties.directiveAutolink) {
        const src = node.properties.src;
        const marker = node.properties.directiveAutolink;
        node.properties.directiveAutolink = undefined;

        const isFigureParent = isFigureElement(parent);
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
            const isGrandparentAnchor = isAnchorElement(grandparent);

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

        if (!node.name || !["img", "video", "audio"].includes(node.name)) {
          return;
        }

        // The application part for adding figure and caption ****************************

        if (node.data?.directiveFigure) {
          const caption = node.data.directiveCaption;
          node.data.directiveFigure = undefined;
          node.data.directiveCaption = undefined;

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

          parent.children.splice(index, 1, figureElement);

          return index;
        } else if (node.data?.directiveCaption) {
          const caption = node.data.directiveCaption;
          node.data.directiveCaption = undefined;

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

          return index;
        }

        // The application part for conversion to video/audio ****************************

        if (node.data?.directiveConversion) {
          const [newTagName, extension] = node.data.directiveConversion.split("/");
          node.data.directiveConversion = undefined;

          const srcAttribute = getMdxJsxAttribute(node.attributes, "src");
          node.attributes = removeMdxJsxAttribute(node.attributes, ["alt", "src"]);
          const attributes = structuredClone(node.attributes);

          if (settings.alwaysAddControlsForVideos && newTagName === "video") {
            attributes.push({
              type: "mdxJsxAttribute",
              name: "controls",
              value: null,
            });
          }

          if (settings.alwaysAddControlsForAudio && newTagName === "audio") {
            attributes.push({
              type: "mdxJsxAttribute",
              name: "controls",
              value: null,
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
                  srcAttribute!,
                  {
                    type: "mdxJsxAttribute",
                    name: "type",
                    value: mimeTypesMap[extension],
                  },
                ],
                children: [],
              },
            ],
            data: node.data,
          };

          parent.children.splice(index, 1, newNode);

          return index;
        }

        // The application part for adding attributes utilizing title ************************
        if (node.data?.directiveTitle) {
          const attrs = split(node.data.directiveTitle);
          node.data.directiveTitle = undefined;

          if (attrs.length) {
            const attributes = structuredClone(node.attributes);

            attrs.forEach((attr) => {
              if (attr.startsWith("#")) {
                updateOrAddMdxJsxAttribute(attributes, "id", attr.slice(1));
              } else if (attr.startsWith(".")) {
                updateOrAddMdxJsxAttribute(attributes, "className", attr.slice(1));
              } else if (attr.includes("=")) {
                const [key, value] = attr.split("=");
                if (key === "width" || key === "height") {
                  const match = value.match(/^(\d+)(?:px)?$/);
                  if (match) {
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      key,
                      composeMdxJsxAttributeValueExpressionLiteral(Number(match[1])),
                    );
                  } else {
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      "style",
                      composeMdxJsxAttributeValueExpressionStyle(`${key}:${value}`),
                    );
                  }
                } else if (key === "style") {
                  updateOrAddMdxJsxAttribute(
                    attributes,
                    key,
                    composeMdxJsxAttributeValueExpressionStyle(value.replaceAll("~", " ")),
                  );
                } else if (value === "undefined") {
                  updateOrAddMdxJsxAttribute(attributes, key, undefined);
                } else {
                  updateOrAddMdxJsxAttribute(attributes, htmlToReactAttrMap[key] || key, value);
                }
              } else if (attr.includes("x")) {
                const [width, height] = attr.split("x");

                if (width) {
                  const matchWidth = width.match(/^(\d+)(?:px)?$/);
                  if (matchWidth) {
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      "width",
                      composeMdxJsxAttributeValueExpressionLiteral(Number(matchWidth[1])),
                    );
                  } else {
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      "style",
                      composeMdxJsxAttributeValueExpressionStyle(`width:${width}`),
                    );
                  }
                }

                if (height) {
                  const matchHeight = height.match(/^(\d+)(?:px)?$/);
                  if (matchHeight) {
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      "height",
                      composeMdxJsxAttributeValueExpressionLiteral(Number(matchHeight[1])),
                    );
                  } else {
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      "style",
                      composeMdxJsxAttributeValueExpressionStyle(`height:${height}`),
                    );
                  }
                }
              } else {
                updateOrAddMdxJsxAttribute(attributes, htmlToReactAttrMap[attr] || attr, null);
              }
            });

            node.attributes = structuredClone(attributes);
          }
        }

        // The application part for adding autolink ***********************************

        if (node.data?.directiveAutolink) {
          const srcAttribute = getMdxJsxAttribute(node.attributes, "src");

          const isFigureParent = isFigureMdxJsxElement(parent);
          const marker = node.data.directiveAutolink;
          node.data.directiveAutolink = undefined;

          if (isFigureParent && marker === "bracket") {
            // find the parent index so as the anchor covers the parent
            visitParents(tree, "mdxJsxFlowElement", function (targetNode, ancestors) {
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
              const isGrandparentAnchor = isAnchorMdxJsxElement(grandparent);

              if (parentIndex !== -1 && !isGrandparentAnchor) {
                grandparent.children.splice(parentIndex, 1, {
                  type: "mdxJsxFlowElement",
                  name: "a",
                  attributes: [
                    {
                      type: "mdxJsxAttribute",
                      name: "href",
                      value: srcAttribute!.value,
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
                  value: srcAttribute!.value,
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
    // console.dir(tree, { depth: 12 });
  };
};

export default plugin;
