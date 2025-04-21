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
  type DirectiveKey = "plus" | "fig" | "star" | "cap" | "tilda" | "ext" | "minus" | "nox";

  const directives: Record<DirectiveKey, string> = {
    plus: "+",
    fig: "fig:",
    star: "*",
    cap: "cap:",
    tilda: "~",
    ext: "ext:",
    minus: "-",
    nox: "nox:",
  };

  const directiveMap: Record<DirectiveKey, string> = {
    plus: "directiveFigure",
    fig: "directiveFigure",
    star: "directiveCaption",
    cap: "directiveCaption",
    tilda: "directiveExtract",
    ext: "directiveExtract",
    minus: "directiveNoExtract",
    nox: "directiveNoExtract",
  };

  for (const key of Object.keys(directives) as DirectiveKey[]) {
    const prefix = directives[key];
    if (alt.startsWith(prefix)) {
      return {
        directive: directiveMap[key],
        value: alt.slice(prefix.length),
      };
    }
  }

  return {
    directive: undefined,
    value: undefined,
  };
}
