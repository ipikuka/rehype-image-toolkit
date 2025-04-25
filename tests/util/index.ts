import { unified } from "unified";
import remarkParse from "remark-parse";
import rehypeParse from "rehype-parse";
import gfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import type { VFileCompatible, VFile } from "vfile";

import plugin, { type ImageToolkitOptions } from "../../src";

const compilerCreatorFromHtml = (options?: ImageToolkitOptions) =>
  unified().use(rehypeParse, { fragment: true }).use(plugin, options).use(rehypeStringify);

export const processHtml = async (
  content: VFileCompatible,
  options?: ImageToolkitOptions,
): Promise<VFile> => {
  return compilerCreatorFromHtml(options).process(content);
};

const compilerCreatorFromMd = (options?: ImageToolkitOptions) =>
  unified()
    .use(remarkParse)
    .use(gfm)
    .use(remarkRehype)
    .use(plugin, options)
    .use(rehypeStringify);

export const processMd = async (
  content: VFileCompatible,
  options?: ImageToolkitOptions,
): Promise<VFile> => {
  return compilerCreatorFromMd(options).process(content);
};

const compilerCreatorRawFirst = (options?: ImageToolkitOptions) =>
  unified()
    .use(remarkParse)
    .use(gfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(plugin, options)
    .use(rehypeStringify);

export const processMdRawFirst = async (
  content: VFileCompatible,
  options?: ImageToolkitOptions,
): Promise<VFile> => {
  return compilerCreatorRawFirst(options).process(content);
};

const compilerCreatorRawLast = (options?: ImageToolkitOptions) =>
  unified()
    .use(remarkParse)
    .use(gfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(plugin, options)
    .use(rehypeRaw)
    .use(rehypeStringify);

export const processMdRawLast = async (
  content: VFileCompatible,
  options?: ImageToolkitOptions,
): Promise<VFile> => {
  return compilerCreatorRawLast(options).process(content);
};
