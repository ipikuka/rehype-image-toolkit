import type { VFileCompatible } from "vfile";
import { evaluate } from "next-mdx-remote-client/rsc";
import ReactDOMServer from "react-dom/server";
import rehypeRaw from "rehype-raw";
import remarkFlexibleParagraphs from "remark-flexible-paragraphs";

// for typing in MDXComponents
import React from "react";

import plugin, { type ImageToolkitOptions } from "../../src";

export const processMdx = async (
  input: VFileCompatible,
  format: "md" | "mdx",
  options?: ImageToolkitOptions,
) => {
  const { content } = await evaluate({
    source: input,
    options: {
      mdxOptions: {
        format,
        remarkPlugins: [remarkFlexibleParagraphs],
        rehypePlugins: [[plugin, options]],
      },
    },
    components: {
      Image: (props) => <img {...props} />,
      Video: (props) => <video {...props} />,
      Audio: (props) => <audio {...props} />,
    },
  });

  return ReactDOMServer.renderToStaticMarkup(content);
};

export const processMdxRaw = async (
  input: VFileCompatible,
  format: "md" | "mdx",
  options?: ImageToolkitOptions,
) => {
  const { content, error } = await evaluate({
    source: input,
    options: {
      mdxOptions: {
        format,
        remarkPlugins: [remarkFlexibleParagraphs],
        rehypePlugins: [rehypeRaw, [plugin, options]],
      },
    },
    components: {
      Image: (props) => <img {...props} />,
      Video: (props) => <video {...props} />,
    },
  });

  if (error) console.log({ error });

  return ReactDOMServer.renderToStaticMarkup(content);
};
