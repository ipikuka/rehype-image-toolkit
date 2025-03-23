import { unified } from "unified";
import remarkParse from "remark-parse";
import rehypeParse from "rehype-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import type { VFileCompatible, VFile } from "vfile";

// This util is designed for testing without plugin "rehype-image-hack"

const compilerCreatorFromHtml = unified()
  .use(rehypeParse, { fragment: true })
  .use(rehypeStringify);

export const processHtml = async (content: VFileCompatible): Promise<VFile> => {
  return compilerCreatorFromHtml.process(content);
};

const compilerCreatorFromMd = unified().use(remarkParse).use(remarkRehype).use(rehypeStringify);

export const processMd = async (content: VFileCompatible): Promise<VFile> => {
  return compilerCreatorFromMd.process(content);
};

const compilerCreatorRawFirst = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

export const processMdRawFirst = async (content: VFileCompatible): Promise<VFile> => {
  return compilerCreatorRawFirst.process(content);
};

const compilerCreatorRawLast = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

export const processMdRawLast = async (content: VFileCompatible): Promise<VFile> => {
  return compilerCreatorRawLast.process(content);
};
