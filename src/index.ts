import type { Plugin } from "unified";
import type { Element, Root, RootContent, Text, ElementContent } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";
import { visitParents } from "unist-util-visit-parents";
import { whitespace } from "hast-util-whitespace";

import type {
  MdxJsxAttribute,
  MdxJsxAttributeValueExpression,
  MdxJsxExpressionAttribute,
  MdxJsxFlowElementHast,
} from "mdast-util-mdx-jsx";

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
  const httpsRegex = /^https?:\/\/[^/]+/i; // HTTP or HTTPS links
  const rootRelativeRegex = /^\/[^/]+/; // Root-relative links (e.g., /image.png)
  const wwwRegex = /^www\./i; // www links
  const fileLinkRegex = /^[a-zA-Z0-9-_]+\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;
  const imageFileExtensionRegex = /\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i; // Check if the source refers to an image (by file extension)

  /**
   * Transform.
   */
  return (tree: Root): undefined => {
    console.dir(tree, { depth: 12 });

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

      // const src = decodeURI(String(node.properties.src));

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
      let currentParagraph: Element = createEmptyParagraph();

      for (const element of node.children) {
        if (isRelevant(element)) {
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
            node.properties[attr] = "x";
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

        // Preparation part for adding autolink ***************************************

        const isAnchorParent = parent.type === "mdxJsxFlowElement" && parent.name === "a";

        const srcAttribute = node.attributes.find(
          (attr) => attr.type === "mdxJsxAttribute" && attr.name === "src",
        );

        if (srcAttribute && typeof srcAttribute.value === "string") {
          let src = srcAttribute.value;
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
              srcAttribute.value = src;

              const isValidAutolink =
                (imageFileExtensionRegex.test(src) && httpsRegex.test(src)) ||
                rootRelativeRegex.test(src) ||
                wwwRegex.test(src) ||
                fileLinkRegex.test(src);

              if (node.name === "img" && !isAnchorParent && isValidAutolink) {
                node.data ??= {};
                node.data.markedAsToBeAutoLinked = wrapper as "bracket" | "parenthesis";
                break; // stop after the first match
              }
            }
          }
        }

        // Preparation part for adding figure and caption *****************************

        const altAttribute = node.attributes.find(
          (attr) => attr.type === "mdxJsxAttribute" && attr.name === "alt",
        );

        if (altAttribute && typeof altAttribute.value === "string") {
          const alt = altAttribute.value;
          const startsWith = {
            plus: alt.startsWith("+"),
            star: alt.startsWith("*"),
            caption: alt.startsWith("caption:"),
          };

          if (startsWith.plus || startsWith.star || startsWith.caption) {
            node.data ??= {};
            node.data.markedAsToBeInFigure = true;

            const figcaptionText =
              startsWith.plus || startsWith.star ? alt.slice(1) : alt.slice(8);

            node.data.captionInFigure = !startsWith.plus ? figcaptionText : undefined;
            altAttribute.value = node.name === "img" ? figcaptionText : undefined;
          }
        }

        // Preparation part for convertion to video/audio ****************************
        if (srcAttribute && typeof srcAttribute.value === "string") {
          const extension = getExtension(srcAttribute.value);
          const needsConversion = extension && (isVideoExt(extension) || isAudioExt(extension));
          if (needsConversion && node.name === "img") {
            node.data ??= {};
            node.data.markedAsToBeConverted = true;
            node.data.convertionString = `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
          }
        }
      },
    );

    console.dir(tree, { depth: 8 });

    function updateOrAddMdxAttribute(
      attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>,
      name: string,
      value: MdxJsxAttributeValueExpression | string | number | boolean | null | undefined,
    ): void {
      const existing = attributes.find(
        (attr) => attr.type === "mdxJsxAttribute" && attr.name === name,
      );

      if (value === undefined) {
        if (existing) attributes.splice(attributes.indexOf(existing), 1);

        return;
      }

      if (value === null || value === true) {
        if (existing) {
          existing.value = null;
        } else {
          attributes.push({ type: "mdxJsxAttribute", name, value: null });
        }

        return;
      }

      // Normalize value into a usable form
      const isExpression = typeof value === "object";
      const newValueStr = isExpression ? value.value : String(value);

      if (existing) {
        if (name === "class") {
          const current =
            typeof existing.value === "string"
              ? existing.value
              : existing.value != null
                ? existing.value.value
                : existing.value;

          const currentClasses = new Set(current?.split(/\s+/).filter(Boolean));
          currentClasses.add(newValueStr);
          const merged = Array.from(currentClasses).join(" ");

          // Keep it a string unless it was originally an expression
          existing.value =
            typeof existing.value === "string"
              ? merged
              : {
                  type: "mdxJsxAttributeValueExpression",
                  value: JSON.stringify(merged),
                };
        } else if (name === "style") {
          const current =
            typeof existing.value === "string"
              ? existing.value
              : existing.value != null
                ? existing.value.value
                : existing.value;

          const appended =
            current == null ? newValueStr : current + current.endsWith(";") ? "" : ";";

          existing.value =
            typeof existing.value === "string"
              ? appended
              : { type: "mdxJsxAttributeValueExpression", value: JSON.stringify(appended) };
        } else {
          existing.value = String(value);
        }
      } else {
        attributes.push({
          type: "mdxJsxAttribute",
          name,
          value: isExpression ? value : String(value),
        });
      }
    }

    // function getAttributeValue(
    //   attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>,
    //   name: string,
    // ): string | undefined {
    //   for (const attr of attributes) {
    //     if (
    //       attr.type === "mdxJsxAttribute" &&
    //       attr.name === name &&
    //       typeof attr.value === "string"
    //     ) {
    //       return attr.value;
    //     }
    //   }

    //   return undefined;
    // }
    // function getAttribute(
    //   attributes: Array<MdxJsxAttribute | MdxJsxExpressionAttribute>,
    //   name: string,
    // ): MdxJsxAttribute | undefined {
    //   for (const attr of attributes) {
    //     if (attr.type === "mdxJsxAttribute" && attr.name === name) {
    //       return attr;
    //     }
    //   }

    //   return undefined;
    // }

    function program(body: any[]): any {
      return {
        estree: {
          type: "Program",
          body: body,
          sourceType: "module",
          comments: [],
        },
      };
    }

    function getLiteralAttribute(value: string): any {
      return {
        type: "mdxJsxAttributeValueExpression",
        value: "",
        data: program([
          {
            type: "ExpressionStatement",
            expression: {
              type: "Literal",
              value: value,
              raw: JSON.stringify(value),
            },
          },
        ]),
      };
    }

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

        // The part for adding figure and caption ****************************

        if (node.data?.markedAsToBeInFigure) {
          const caption = node.data.captionInFigure;

          const figcaptionElement: MdxJsxFlowElementHast | undefined =
            caption === undefined
              ? undefined
              : {
                  type: "mdxJsxFlowElement",
                  name: "figcaption",
                  attributes: [],
                  children: [{ type: "text", value: caption }],
                };

          const figureElement: MdxJsxFlowElementHast = {
            type: "mdxJsxFlowElement",
            name: "figure",
            attributes: [],
            children: figcaptionElement
              ? settings.figureCaptionPosition === "above"
                ? [figcaptionElement, node]
                : [node, figcaptionElement]
              : [node],
          };

          node.data.markedAsToBeInFigure = undefined;
          node.data.captionInFigure = undefined;

          parent.children.splice(index, 1, figureElement);
          return index;
        }

        // The part for convertion to video/audio ****************************

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

        // The part for adding attributes utilizing title ************************

        const titleAttribute = node.attributes.find(
          (attr) => attr.type === "mdxJsxAttribute" && attr.name === "title",
        );

        console.log({ titleAttribute: titleAttribute?.value });

        if (
          titleAttribute?.type === "mdxJsxAttribute" &&
          typeof titleAttribute.value === "string"
        ) {
          const title = titleAttribute.value;
          if (title.includes(">")) {
            const [mainTitle, directives] = title.split(">");
            titleAttribute.value = mainTitle.trim() || undefined;

            const attrs = directives.trim().split(" ").filter(Boolean);
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
                      updateOrAddMdxAttribute(attributes, "style", `${key}:${value};`);
                    }
                  } else if (key === "style") {
                    updateOrAddMdxAttribute(attributes, "style", `${value};`);
                  } else {
                    updateOrAddMdxAttribute(attributes, key, value);
                  }
                } else if (attr.includes("x")) {
                  const [width, height] = attr.split("x");
                  console.log({ width, height });

                  if (width) {
                    const matchWidth = width.match(/^(\d+)(?:px)?$/);
                    if (matchWidth) {
                      updateOrAddMdxAttribute(attributes, "width", Number(matchWidth[1]));
                    } else {
                      updateOrAddMdxAttribute(attributes, "style", `width:${width};`);
                    }
                  }

                  if (height) {
                    const matchHeight = height.match(/^(\d+)(?:px)?$/);
                    if (matchHeight) {
                      updateOrAddMdxAttribute(attributes, "height", Number(matchHeight[1]));
                    } else {
                      updateOrAddMdxAttribute(attributes, "style", `height:${height};`);
                    }
                  }
                } else {
                  updateOrAddMdxAttribute(attributes, attr, null);
                  // updateOrAddMdxAttribute(attributes, attr, {
                  //   type: "mdxJsxAttributeValueExpression",
                  //   value: "true",
                  //   data: {
                  //     estree: {
                  //       type: "Program",
                  //       body: [
                  //         {
                  //           type: "ExpressionStatement",
                  //           expression: {
                  //             type: "Literal",
                  //             value: true,
                  //             raw: "true",
                  //           },
                  //         },
                  //       ],
                  //       sourceType: "module",
                  //     },
                  //   },
                  // });
                }
              });
              console.log({ before: node.attributes, after: attributes });
              node.attributes = structuredClone(attributes);
              console.log(node.attributes);
            }
          }
        }

        // The part for adding autolink ***********************************

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

    // console.dir(tree, { depth: 8 });
  };
};

export default plugin;
