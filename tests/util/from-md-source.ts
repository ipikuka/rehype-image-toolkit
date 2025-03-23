import { unified } from "unified";
import remarkParse from "remark-parse";
import gfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import type { VFileCompatible, VFile } from "vfile";

import plugin, { type ImageHackOptions } from "../../src";

const compilerCreator = (options?: ImageHackOptions) =>
  unified()
    .use(remarkParse)
    .use(gfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(plugin, options)
    .use(rehypeStringify);

export const processFromMd = async (
  content: VFileCompatible,
  options?: ImageHackOptions,
): Promise<VFile> => {
  return compilerCreator(options).process(content);
};
