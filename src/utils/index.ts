export function toObjectLiteral(obj: Record<string, unknown>): string {
  return `{${Object.entries(obj)
    .map(([key, value]) => `${key}:${JSON.stringify(value)}`)
    .join(",")}}`;
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
