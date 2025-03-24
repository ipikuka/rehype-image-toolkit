import type { VFileCompatible } from "vfile";
import { evaluate } from "next-mdx-remote-client/rsc";
import ReactDOMServer from "react-dom/server";
import rehypeRaw from "rehype-raw";

// for typing in MDXComponents
import React from "react";

// This util is designed for testing MDX content without plugin "rehype-image-hack"

export const processMdx = async (input: VFileCompatible, format: "md" | "mdx") => {
  const { content } = await evaluate({
    source: input,
    options: {
      mdxOptions: {
        format,
      },
    },
    components: {
      Image: (props) => <img {...props} />,
    },
  });

  return ReactDOMServer.renderToStaticMarkup(content);
};

export const processMdxRaw = async (input: VFileCompatible, format: "md" | "mdx") => {
  const { content } = await evaluate({
    source: input,
    options: {
      mdxOptions: {
        format,
        rehypePlugins: [rehypeRaw],
      },
    },
    components: {
      Image: (props) => <img {...props} />,
    },
  });

  return ReactDOMServer.renderToStaticMarkup(content);
};
