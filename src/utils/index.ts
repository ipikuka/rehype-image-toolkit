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

type ParseSrcResult = {
  src: string;
  isValidAutolink: boolean;
  wrapper: string | null;
};

export function parseSrcDirective(originalSrc: string): ParseSrcResult {
  const decodedSrc = decodeURI(originalSrc);

  const httpsRegex = /^https?:\/\/[^/]+/i; // HTTP or HTTPS links
  const rootRelativeRegex = /^\/[^/]+/; // Root-relative links (e.g., /image.png)
  const wwwRegex = /^www\./i; // www links
  const fileLinkRegex = /^[a-zA-Z0-9-_]+\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i;
  const imageFileExtensionRegex = /\.(png|jpe?g|gif|webp|svg)(?=[?#]|$)/i; // Check if the source refers to an image (by file extension)

  const SRC_WRAPPERS: {
    wrapper: "bracket" | "parenthesis";
    regex: RegExp;
  }[] = [
    { wrapper: "bracket", regex: /\[.*\]/ },
    { wrapper: "parenthesis", regex: /\(.*\)/ },
  ] as const;

  for (const { wrapper, regex } of SRC_WRAPPERS) {
    if (regex.test(decodedSrc)) {
      const src = decodedSrc.slice(1, -1);

      const isValidAutolink =
        (imageFileExtensionRegex.test(src) && httpsRegex.test(src)) ||
        rootRelativeRegex.test(src) ||
        wwwRegex.test(src) ||
        fileLinkRegex.test(src);

      return { src, isValidAutolink, wrapper };
    }
  }

  // No matching wrapper found; return original src with invalid status
  return { src: originalSrc, isValidAutolink: false, wrapper: null };
}

const videoMimeTypes: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  ogv: "video/ogg",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
};

const audioMimeTypes: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  m4a: "audio/mp4",
};

export const mimeTypesMap = { ...videoMimeTypes, ...audioMimeTypes };

const isVideoExt = (ext: string) => Object.keys(videoMimeTypes).indexOf(ext) >= 0;
const isAudioExt = (ext: string) => Object.keys(audioMimeTypes).indexOf(ext) >= 0;

function getExtension(src: string | undefined): string | undefined {
  // consider also it may has a trailing query or hash
  const RE = /\.([a-zA-Z0-9]+)(?=[?#]|$)/i;

  const match = src?.match(RE);

  return match?.[1];
}

export function parseSrcExtension(src: string | undefined): string | undefined {
  const extension = getExtension(src);

  if (!extension) return;

  const needsConversion = isVideoExt(extension) || isAudioExt(extension);

  if (needsConversion) {
    return `${isVideoExt(extension) ? "video" : "audio"}/${extension}`;
  }

  return undefined;
}
