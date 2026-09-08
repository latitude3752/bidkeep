export function startPilotHref(url: string | undefined): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}
