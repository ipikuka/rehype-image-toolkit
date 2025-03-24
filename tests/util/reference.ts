import { unified } from "unified";
import remarkParse from "remark-parse";
import rehypeParse from "rehype-parse";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import type { VFileCompatible, VFile } from "vfile";

// This util is designed for testing markdown/html content without plugin "rehype-image-hack"

export const processHtml = async (content: VFileCompatible) => {
  return unified().use(rehypeParse, { fragment: true }).use(rehypeStringify).process(content);
};

export const processMd = async (content: VFileCompatible): Promise<VFile> => {
  return unified().use(remarkParse).use(remarkRehype).use(rehypeStringify).process(content);
};

export const processMdRaw = async (content: VFileCompatible): Promise<VFile> => {
  return unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeStringify)
    .process(content);
};
