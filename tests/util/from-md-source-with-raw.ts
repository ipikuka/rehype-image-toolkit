import { unified } from "unified";
import remarkParse from "remark-parse";
import gfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import rehypeHighlight from "rehype-highlight";
import type { VFileCompatible, VFile } from "vfile";

import plugin, { type ImageHackOptions } from "../../src";

const compilerCreatorRawFirst = (options?: ImageHackOptions) =>
  unified()
    .use(remarkParse)
    .use(gfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeHighlight)
    .use(plugin, options)
    .use(rehypeStringify);

export const processRawFirst = async (
  content: VFileCompatible,
  options?: ImageHackOptions,
): Promise<VFile> => {
  return compilerCreatorRawFirst(options).process(content);
};

const compilerCreatorRawAfter = (options?: ImageHackOptions) =>
  unified()
    .use(remarkParse)
    .use(gfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeHighlight)
    .use(plugin, options)
    .use(rehypeRaw)
    .use(rehypeStringify);

export const processRawAfter = async (
  content: VFileCompatible,
  options?: ImageHackOptions,
): Promise<VFile> => {
  return compilerCreatorRawAfter(options).process(content);
};
