export function getExtension(src: string | undefined): string | undefined {
  // consider also it may has a trailing query or hash
  const RE = /\.([a-zA-Z0-9]+)(?=[?#]|$)/i;

  const match = src?.match(RE);

  return match?.[1];
}

export function ensureSemiColon(str: string) {
  return str.endsWith(";") ? str : str + ";";
}

export function appendStyle(
  existing: string | number | boolean | (string | number)[] | null | undefined,
  patch: string,
): string {
  const base = typeof existing === "string" ? ensureSemiColon(existing) : "";
  return base + ensureSemiColon(patch);
}

export function parseAltDirective(alt: string): {
  directive?: string;
  value?: string;
} {
  const directiveMap: Record<string, string[]> = {
    directiveOnlyFigure: ["^^", "f:", "figure:"], // figure only, no caption
    directiveFigureCaption: ["^", "c:", "figcap:"], // caption inside figure
    directiveUnwrap: ["&", "u:", "unwrap:"], // extract from paragraph
    directiveInline: ["~", "i:", "inline:"], // stay inline
  };

  for (const [directive, prefixes] of Object.entries(directiveMap)) {
    for (const prefix of prefixes) {
      if (alt.startsWith(prefix)) {
        return {
          directive,
          value: alt.slice(prefix.length),
        };
      }
    }
  }

  return {
    directive: undefined,
    value: undefined,
  };
}
