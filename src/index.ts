import type { Plugin } from "unified";
import type { Root } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

type Prettify<T> = { [K in keyof T]: T[K] } & {};

type PartiallyRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

declare module "hast" {
  interface Data {
    xxx?: string;
  }
  interface Properties {
    xxx?: string;
  }
}

export type ImageHackOptions = {
  enable: boolean; //TODO
};

const DEFAULT_SETTINGS: ImageHackOptions = {
  enable: false,
};

type PartiallyRequiredImageHackOptions = Prettify<
  PartiallyRequired<ImageHackOptions, "enable">
>;

/**
 *
 * enhance image/video/audio asset properties //TODO
 *
 */
const plugin: Plugin<[ImageHackOptions?], Root> = (options) => {
  // eslint-disable-next-line
  const settings = Object.assign(
    {},
    DEFAULT_SETTINGS,
    options,
  ) as PartiallyRequiredImageHackOptions;

  /**
   * Transform.
   *
   * @param {Root} tree
   *   Tree.
   * @returns {undefined}
   *   Nothing.
   */
  return (tree: Root): undefined => {
    // console.dir(tree, { depth: 8 });
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || node.tagName !== "img") {
        return;
      }

      // console.log(node);
    });

    visit(tree, "mdxJsxFlowElement", function (node, index, parent): VisitorResult {
      /* v8 ignore next 3 */
      if (!parent || index === undefined || node.type !== "mdxJsxFlowElement") {
        return;
      }

      // console.log(node);
    });
  };
};

export default plugin;
