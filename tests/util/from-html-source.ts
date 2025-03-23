import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import type { VFileCompatible, VFile } from "vfile";

import plugin, { type ImageHackOptions } from "../../src";

const compilerCreator = (options?: ImageHackOptions) =>
  unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeHighlight)
    .use(plugin, options)
    .use(rehypeStringify);

export const processFromHtml = async (
  content: VFileCompatible,
  options?: ImageHackOptions,
): Promise<VFile> => {
  return compilerCreator(options).process(content);
};
