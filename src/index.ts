import type { Plugin } from "unified";

import type { MdxJsxFlowElementHast, MdxJsxTextElementHast } from "mdast-util-mdx-jsx";
import type { Element, Root, RootContent, Text, ElementContent } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { whitespace } from "hast-util-whitespace";
import { parse as split } from "space-separated-tokens";

import {
  appendStyle,
  mimeTypesMap,
  parseAltDirective,
  parseSrcDirective,
  parseSrcExtension,
} from "./utils/index.js";
import {
  getMdxJsxAttribute,
  removeMdxJsxAttribute,
  updateOrAddMdxJsxAttribute,
  getMdxJsxAttributeValueString,
  composeMdxJsxAttributeValueExpressionLiteral,
  composeMdxJsxAttributeValueExpressionStyle,
  hasExpressionValueLiteral,
} from "./utils/util.mdxjsx.js";

type ElementX = Element | MdxJsxFlowElementHast | MdxJsxTextElementHast;

interface DirectiveData {
  directiveAutolink?: "bracket" | "parenthesis";
  directiveFigure?: boolean;
  directiveCaption?: string;
  directiveConversion?: string;
  directiveTitle?: string;
  directiveUnwrap?: boolean;
  directiveInline?: boolean;
}

declare module "hast" {
  interface Properties {
    src?: string;
    title?: string;
    alt?: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ElementData extends DirectiveData {}
}

declare module "mdast-util-mdx-jsx" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface MdxJsxFlowElementHastData extends DirectiveData {}

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface MdxJsxTextElementHastData extends DirectiveData {}
}

export type ImageToolkitOptions = {
  explicitAutolink?: boolean;
  explicitFigure?: boolean;
  implicitFigure?: boolean;
  figureCaptionPosition?: "above" | "below";
  addControlsForVideos?: boolean;
  addControlsForAudio?: boolean;
  enableMdxJsx?: boolean;
};

const DEFAULT_SETTINGS: ImageToolkitOptions = {
  explicitAutolink: true,
  explicitFigure: true,
  implicitFigure: false,
  figureCaptionPosition: "below",
  addControlsForVideos: false,
  addControlsForAudio: false,
  enableMdxJsx: true,
};

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

/**
 *
 * `rehype-image-toolkit` enhances markdown image syntax and MDX media elements (img, audio, video) by;
 *  - adding style and attributes,
 *  - adding figure captions,
 *  - auto-linking images to originals,
 *  - converting images to video/audio based on the file extension
 *
 */
const plugin: Plugin<[ImageToolkitOptions?], Root> = (options) => {
  const settings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    options,
  ) as Required<ImageToolkitOptions>;

  function isMediaElement(node: ElementContent): boolean {
    return node.type === "element" && ["img", "video", "audio"].includes(node.tagName);
  }

  function isFigureElement(
    node: Root | ElementContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): node is Element {
    return node.type === "element" && node.tagName === "figure";
  }

  function isAnchorElement(
    node: Root | ElementContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): node is Element {
    return node.type === "element" && node.tagName === "a";
  }

  function isParagraphElement(node: RootContent | ElementContent): node is Element {
    return node.type === "element" && node.tagName === "p";
  }

  function isMdxJsxElement(node: Root | ElementContent | ElementContent) {
    return node?.type === "mdxJsxTextElement" || node?.type === "mdxJsxFlowElement";
  }

  function isMediaMdxJsxElement(node: ElementContent): boolean {
    return (
      isMdxJsxElement(node) &&
      (node.name === "img" || node.name === "video" || node.name === "audio")
    );
  }

  function isFigureMdxJsxElement(
    node: Root | ElementContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): boolean {
    return isMdxJsxElement(node) && node.name === "figure";
  }

  function isAnchorMdxJsxElement(
    node: Root | ElementContent | MdxJsxTextElementHast | MdxJsxFlowElementHast,
  ): node is MdxJsxTextElementHast | MdxJsxFlowElementHast {
    return isMdxJsxElement(node) && node.name === "a";
  }

  function isParagraphMdxJsxFlowElement(
    node: RootContent | ElementContent,
  ): node is MdxJsxFlowElementHast {
    return node?.type === "mdxJsxFlowElement" && node.name === "p";
  }

  function isParagraph(
    node: RootContent | ElementContent,
  ): node is Element | MdxJsxFlowElementHast {
    return isParagraphElement(node) || isParagraphMdxJsxFlowElement(node);
  }

  // function isElementX(node: ElementContent): node is ElementX {
  //   return node.type === "element" || isMdxJsxElement(node);
  // }

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

      node.data ??= {};

      // Preparation part for adding figure and caption; also unwrapping **************

      if (typeof node.properties.alt === "string") {
        const alt = node.properties.alt;
        const { directive, value } = parseAltDirective(alt);

        if (directive) {
          node.properties.alt = node.tagName === "img" ? value! : undefined;
        }

        switch (directive) {
          case "directiveFigureCaption":
            if (settings.explicitFigure) {
              node.data.directiveCaption = value;
              if (!isFigureElement(parent)) {
                node.data.directiveFigure = true;
              }
            }
            break;

          case "directiveOnlyFigure":
            // a syntactical parsing issue in the coverage tool's logic when dealing with
            // the loose structure of a case block containing multiple statements. (needed curly braces)
            {
              // classic V8 coverage false negative
              /* v8 ignore next -- @preserve */
              if (settings.explicitFigure) {
                if (!isFigureElement(parent)) {
                  node.data.directiveFigure = true;
                }
              }
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

      // Preparation part for adding autolink ***************************************

      if (node.properties.src) {
        const { src, isValidAutolink, wrapper } = parseSrcDirective(node.properties.src);
        node.properties.src = src;

        if (settings.explicitAutolink && node.tagName === "img" && isValidAutolink) {
          const isAnchorParent = isAnchorElement(parent);
          const isFigurable = node.data.directiveFigure;

          if (!isAnchorParent || (isFigurable && wrapper === "parenthesis")) {
            node.data.directiveAutolink = wrapper! as "bracket" | "parenthesis";
          }
        }
      }

      // Preparation part for conversion to video/audio ****************************

      if (node.tagName === "img") {
        const directiveConversion = parseSrcExtension(node.properties.src);
        if (directiveConversion) node.data.directiveConversion = directiveConversion;
      }

      // Preparation part for adding attributes utilizing title ************************

      if (node.properties.title?.includes(">")) {
        const [title, directive] = node.properties.title.split(">").map((t) => t.trim());
        node.properties.title = title || undefined;
        node.data.directiveTitle = directive || undefined;
      }

      // clean node.data if it is empty
      if (!Object.entries(node.data).length) {
        node.data = undefined;
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
    if (settings.enableMdxJsx) {
      visit(
        tree,
        ["mdxJsxFlowElement", "mdxJsxTextElement"],
        function (node, index, parent): VisitorResult {
          /* v8 ignore next -- @preserve */
          if (!parent || index === undefined) return;

          /* v8 ignore next -- @preserve */
          if (node.type !== "mdxJsxFlowElement" && node.type !== "mdxJsxTextElement") return;

          if (!node.name || !["img", "video", "audio"].includes(node.name)) {
            return;
          }

          node.data ??= {};

          // Preparation part for adding figure and caption; also unwrapping **************

          const altAttribute = getMdxJsxAttribute(node.attributes, "alt");
          const alt = getMdxJsxAttributeValueString(altAttribute);

          if (alt && altAttribute) {
            const { directive, value } = parseAltDirective(alt);

            if (directive) {
              if (node.name === "img") {
                altAttribute.value = hasExpressionValueLiteral(altAttribute)
                  ? composeMdxJsxAttributeValueExpressionLiteral(value!)
                  : value!;
              } else {
                // node.name is "video" or "audio"
                node.attributes = removeMdxJsxAttribute(node.attributes, "alt");
              }
            }

            switch (directive) {
              case "directiveFigureCaption":
                if (settings.explicitFigure) {
                  node.data.directiveCaption = value;
                  if (!isFigureMdxJsxElement(parent)) {
                    node.data.directiveFigure = true;
                  }
                }
                break;

              case "directiveOnlyFigure":
                // a syntactical parsing issue in the coverage tool's logic when dealing with
                // the loose structure of a case block containing multiple statements. (needed curly braces)
                {
                  // classic V8 coverage false negative
                  /* v8 ignore next -- @preserve */
                  if (settings.explicitFigure) {
                    if (!isFigureMdxJsxElement(parent)) {
                      node.data.directiveFigure = true;
                    }
                  }
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

          // Preparation part for adding autolink ***************************************

          const srcAttribute = getMdxJsxAttribute(node.attributes, "src");
          const src = getMdxJsxAttributeValueString(srcAttribute);
          let monitoredSrc = src;

          // classic V8 coverage false negative
          /* v8 ignore next -- @preserve */
          if (src && srcAttribute) {
            const { src: parsedSrc, isValidAutolink, wrapper } = parseSrcDirective(src);
            monitoredSrc = parsedSrc;

            srcAttribute.value = hasExpressionValueLiteral(srcAttribute)
              ? composeMdxJsxAttributeValueExpressionLiteral(parsedSrc)
              : parsedSrc;

            if (settings.explicitAutolink && node.name === "img" && isValidAutolink) {
              const isAnchorParent = isAnchorMdxJsxElement(parent);
              const isFigurable = node.data?.directiveFigure;

              if (!isAnchorParent || (isFigurable && wrapper === "parenthesis")) {
                node.data.directiveAutolink = wrapper! as "bracket" | "parenthesis";
              }
            }
          }

          // Preparation part for conversion to video/audio ****************************
          if (node.name === "img") {
            const directiveConversion = parseSrcExtension(monitoredSrc);
            if (directiveConversion) node.data.directiveConversion = directiveConversion;
          }

          // Preparation part for adding attributes utilizing title ************************

          const titleAttribute = getMdxJsxAttribute(node.attributes, "title");
          const titleValue = getMdxJsxAttributeValueString(titleAttribute);

          if (titleAttribute && titleValue?.includes(">")) {
            const [title, directive] = titleValue.split(">").map((t) => t.trim());

            if (title) {
              titleAttribute.value = hasExpressionValueLiteral(titleAttribute)
                ? composeMdxJsxAttributeValueExpressionLiteral(title)
                : title;
            } else {
              node.attributes = removeMdxJsxAttribute(node.attributes, "title");
            }

            node.data.directiveTitle = directive || undefined;
          }

          // do NOT clean node.data since [node.data has always {_mdxExplicitJsx: true}]
          // if (!Object.entries(node.data).length) {
          //   node.data = undefined;
          // }
        },
      );
    }

    // console.log before unravelling
    // console.dir(tree, { depth: 12 });

    /**
     * unravelling visit on <p> Elements or <p> MdxJsxFlowElements
     *
     * unravel images to be converted into videos/audio or to be wrapped with figure in paragraphs
     * unravel also videos/audio wrapped with a paragraph (it may happen while remark/rehype parsing)
     *
     * Mutates `children` of paragraph nodes.
     */
    visit(tree, ["element", "mdxJsxFlowElement"], function (node, index, parent) {
      /* v8 ignore next -- @preserve */
      if (!parent || index === undefined) return;

      /* v8 ignore next -- @preserve */
      if (node.type === "root" || node.type === "doctype") return;

      if (!isParagraph(node)) return;

      /********** Check the node if it has a implicit figure **********************/
      if (settings.implicitFigure && node.children.length === 1) {
        let implicitFigureElement: ElementX | undefined = undefined;

        const child = node.children[0];
        if (isMediaElement(child)) {
          implicitFigureElement = child as Element;
        } else if (isAnchorElement(child) && child.children.length === 1) {
          const grandChild = child.children[0];

          // classic V8 coverage false negative
          /* v8 ignore next -- @preserve */
          if (isMediaElement(grandChild)) {
            implicitFigureElement = grandChild as Element;
          }
        }

        // classic V8 coverage false negative
        /* v8 ignore next -- @preserve */
        if (settings.enableMdxJsx) {
          if (isMediaMdxJsxElement(child)) {
            implicitFigureElement = child as MdxJsxFlowElementHast;
          } else if (isAnchorMdxJsxElement(child) && child.children.length === 1) {
            const grandChild = child.children[0];
            if (isMediaMdxJsxElement(grandChild)) {
              implicitFigureElement = grandChild as MdxJsxFlowElementHast;
            }
          }
        }

        if (
          implicitFigureElement &&
          !implicitFigureElement.data?.directiveInline &&
          !implicitFigureElement.data?.directiveUnwrap
        ) {
          let alt: string | undefined = undefined;

          if ("properties" in implicitFigureElement) {
            alt = implicitFigureElement.properties.alt;
          }

          // classic V8 coverage false negative
          /* v8 ignore next -- @preserve */
          if ("attributes" in implicitFigureElement) {
            const altAttribute = getMdxJsxAttribute(implicitFigureElement.attributes, "alt");
            if (altAttribute) {
              const altOriginal = getMdxJsxAttributeValueString(altAttribute);
              if (altOriginal !== undefined) {
                alt = altOriginal;
              }
            }
          }

          // classic V8 coverage false negative
          /* v8 ignore next -- @preserve */
          if ((implicitFigureElement.data ??= {})) {
            implicitFigureElement.data.directiveFigure = true;
            implicitFigureElement.data.directiveCaption = alt;
          }
        }
      }

      /**********************************************************************************/

      const newNodes: RootContent[] = [];
      let currentParagraph: Element | MdxJsxFlowElementHast = createEmptyParagraph();

      for (const child of node.children) {
        if (isRelevantElement(child) || isRelevantMdxJsxElement(child)) {
          flushParagraph();
          newNodes.push(child);
        } else {
          currentParagraph.children.push(child);
        }
      }

      flushParagraph();

      function isEffectivelyEmptyParagraph(n: RootContent): boolean {
        return isParagraph(n) && n.children.every(whitespace);
      }

      // filter empty paragraphs
      const filtered = newNodes.filter((n) => !isEffectivelyEmptyParagraph(n));

      // trim the text on edges
      filtered.forEach((n) => {
        if (isParagraph(n)) trimParagraphEdges(n);
      });

      function insertBetween(arr: RootContent[], seperator: Text): RootContent[] {
        return arr.flatMap((item, index) =>
          index < arr.length - 1 ? [item, seperator] : [item],
        );
      }

      // insert new line between each nodes
      const inserted = insertBetween(filtered, { type: "text", value: "\n" });

      parent.children.splice(index, 1, ...inserted);

      function flushParagraph() {
        if (currentParagraph.children.length > 0) {
          newNodes.push(currentParagraph);
        }

        currentParagraph = createEmptyParagraph();
      }

      function createEmptyParagraph(): Element | MdxJsxFlowElementHast {
        if ("attributes" in node) {
          return {
            type: "mdxJsxFlowElement",
            name: "p",
            attributes: node.attributes,
            children: [],
          };
        }

        /* v8 ignore next -- @preserve */
        if ("properties" in node) {
          return {
            type: "element",
            tagName: "p",
            properties: node.properties,
            children: [],
          };
        }

        /* v8 ignore next -- @preserve */
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
          first.value = first.value.replace(/^[ ]+/, ""); // not trimend();
        }

        if (last?.type === "text") {
          last.value = last.value.replace(/[ ]+$/, ""); // not trimStart();
        }
      }

      function isRelevantElement(element: ElementContent): boolean {
        if (checkInternallyRelevantElement(element)) {
          return true;
        }

        if (isAnchorElement(element)) {
          return element.children.some(checkInternallyRelevantElement);
        }

        return false;
      }

      function checkInternallyRelevantElement(element: ElementContent): boolean {
        if (element.type !== "element") return false;

        function isMarked(el: Element): boolean {
          return (
            !el.data?.directiveInline &&
            (el.data?.directiveUnwrap ||
              el.data?.directiveFigure ||
              Boolean(el.data?.directiveConversion))
          );
        }

        const isRelevantImage = element.tagName === "img" && isMarked(element);
        const isVideo = element.tagName === "video" && !element.data?.directiveInline;
        const isAudio = element.tagName === "audio" && !element.data?.directiveInline;
        const isFigure = element.tagName === "figure";

        function cleanDirectives(el: Element) {
          delete el.data?.directiveUnwrap;
          delete el.data?.directiveInline;
        }

        cleanDirectives(element);

        return isVideo || isAudio || isFigure || isRelevantImage;
      }

      function isRelevantMdxJsxElement(element: ElementContent): boolean {
        if (!settings.enableMdxJsx) return false;

        if (checkInternallyRelevantMdxJsxElement(element)) {
          return true;
        }

        if (isAnchorMdxJsxElement(element)) {
          return element.children.some(checkInternallyRelevantMdxJsxElement);
        }

        return false;
      }

      function checkInternallyRelevantMdxJsxElement(element: ElementContent): boolean {
        if (!isMdxJsxElement(element)) return false;

        function isMarked(el: MdxJsxTextElementHast | MdxJsxFlowElementHast): boolean {
          return (
            !el.data?.directiveInline &&
            (el.data?.directiveUnwrap ||
              el.data?.directiveFigure ||
              Boolean(el.data?.directiveConversion))
          );
        }

        const isRelevantImage = element.name === "img" && isMarked(element);
        const isVideo = element.name === "video" && !element.data?.directiveInline;
        const isAudio = element.name === "audio" && !element.data?.directiveInline;
        const isFigure = element.name === "figure";

        function cleanDirectives(el: MdxJsxTextElementHast | MdxJsxFlowElementHast) {
          // classic V8 coverage false negative
          /* v8 ignore next -- @preserve */
          if (el.data) {
            delete el.data.directiveUnwrap;
            delete el.data.directiveInline;
          }
        }

        cleanDirectives(element);

        return isVideo || isAudio || isFigure || isRelevantImage;
      }
    });

    // console.log before application; after unrevealing
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

      if (node.data?.directiveFigure) {
        const caption = node.data.directiveCaption;
        node.data.directiveFigure = undefined;
        node.data.directiveCaption = undefined;

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
      } else if (node.data?.directiveCaption) {
        const caption = node.data.directiveCaption;
        node.data.directiveCaption = undefined;

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

      if (node.data?.directiveConversion) {
        const [newTagName, extension] = node.data.directiveConversion.split("/");
        node.data.directiveConversion = undefined;

        const src = node.properties.src;
        node.properties.src = undefined;
        node.properties.alt = undefined;

        const properties = structuredClone(node.properties);

        if (settings.addControlsForVideos && newTagName === "video") {
          properties["controls"] = true;
        }

        if (settings.addControlsForAudio && newTagName === "audio") {
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

      if (node.data?.directiveTitle) {
        const attrs = split(node.data.directiveTitle);
        node.data.directiveTitle = undefined;

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

      if (node.data?.directiveAutolink) {
        const src = node.properties.src;
        const marker = node.data.directiveAutolink;
        node.data.directiveAutolink = undefined;

        const isFigureParent = isFigureElement(parent);
        if (isFigureParent && marker === "bracket") {
          // find the parent index so as the anchor covers the parent
          visitParents(tree, "element", function (targetNode, ancestors) {
            if (targetNode !== parent) return;

            const grandparent = ancestors.at(-1);

            /* v8 ignore next -- @preserve */
            if (
              !grandparent ||
              !("children" in grandparent) ||
              !Array.isArray(grandparent.children)
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
    if (settings.enableMdxJsx) {
      visit(
        tree,
        ["mdxJsxFlowElement", "mdxJsxTextElement"],
        function (node, index, parent): VisitorResult {
          /* v8 ignore next -- @preserve */
          if (!parent || index === undefined) return;

          /* v8 ignore next -- @preserve */
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

            if (settings.addControlsForVideos && newTagName === "video") {
              attributes.push({
                type: "mdxJsxAttribute",
                name: "controls",
                value: null,
              });
            }

            if (settings.addControlsForAudio && newTagName === "audio") {
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

            // classic V8 coverage false negative
            /* v8 ignore next -- @preserve */
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
                    updateOrAddMdxJsxAttribute(
                      attributes,
                      htmlToReactAttrMap[key] || key,
                      value,
                    );
                  }
                } else if (attr.includes("x")) {
                  const [width, height] = attr.split("x");

                  // classic V8 coverage false negative
                  /* v8 ignore next -- @preserve */
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

                  // classic V8 coverage false negative
                  /* v8 ignore next -- @preserve */
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
                  updateOrAddMdxJsxAttribute(
                    attributes,
                    htmlToReactAttrMap[attr] || attr,
                    null,
                  );
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

                /* v8 ignore next -- @preserve */
                if (
                  !grandparent ||
                  !("children" in grandparent) ||
                  !Array.isArray(grandparent.children)
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
    }

    // console.log after application
    // console.dir(tree, { depth: 12 });
  };
};

export default plugin;
