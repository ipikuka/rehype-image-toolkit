import type { Plugin } from "unified";
import type { Root } from "hast";
import { visit, type VisitorResult } from "unist-util-visit";

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

// check if it is a string array
/* v8 ignore next 6 */
function isStringArray(value: unknown): value is string[] {
  return (
    // type-coverage:ignore-next-line
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

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
    visit(tree, "element", function (node, index, parent): VisitorResult {
      if (!parent || index === undefined || node.tagName !== "img") {
        return;
      }

      // for type narrowing
      /* v8 ignore next 6 */
      if (
        !isStringArray(node.properties.className) &&
        node.properties.className !== undefined
      ) {
        return;
      }
    });
  };
};

export default plugin;
