import type { VFileCompatible } from "vfile";
import { evaluate } from "next-mdx-remote-client/rsc";
import ReactDOMServer from "react-dom/server";
import rehypeRaw from "rehype-raw";

// for typing in MDXComponents
import React from "react";

import plugin, { type ImageHackOptions } from "../../src";

export const processMdx = async (
  input: VFileCompatible,
  format: "md" | "mdx",
  options?: ImageHackOptions,
) => {
  const { content } = await evaluate({
    source: input,
    options: {
      mdxOptions: {
        format,
        rehypePlugins: [[plugin, options]],
      },
    },
    components: {
      Image: (props) => <img {...props} />,
    },
  });

  return ReactDOMServer.renderToStaticMarkup(content);
};

export const processMdxRaw = async (
  input: VFileCompatible,
  format: "md" | "mdx",
  options?: ImageHackOptions,
) => {
  const { content } = await evaluate({
    source: input,
    options: {
      mdxOptions: {
        format,
        rehypePlugins: [rehypeRaw, [plugin, options]],
      },
    },
    components: {
      Image: (props) => <img {...props} />,
    },
  });

  return ReactDOMServer.renderToStaticMarkup(content);
};
