export function pipelineHref(basePath: string, query: Record<string, string>): string {
  const qs = new URLSearchParams(query);
  return `${basePath}?${qs.toString()}`;
}
