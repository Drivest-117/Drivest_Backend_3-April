export function normalizeFcmPushToken(rawToken?: string | null): string | null {
  const trimmed = (rawToken ?? '').trim();
  if (!trimmed) return null;

  if (/^fcm:/i.test(trimmed)) {
    const candidate = trimmed.slice(trimmed.indexOf(':') + 1).trim();
    return candidate || null;
  }

  if (/^ExponentPushToken\[[^\]]+\]$/.test(trimmed)) return null;
  if (/^[0-9a-fA-F]{64,200}$/.test(trimmed)) return null;

  if (trimmed.includes(':') || /^[A-Za-z0-9_\-:.]{80,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function buildFcmDataPayload(
  title: string,
  body: string,
  payload?: Record<string, unknown>,
): Record<string, string> {
  const data: Record<string, string> = {
    title: title.trim(),
    body: body.trim(),
  };

  const routePayload: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (value == null) continue;

    const normalizedValue =
      typeof value === 'string'
        ? value.trim()
        : typeof value === 'number' || typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);

    if (!normalizedValue) continue;
    data[key] = normalizedValue;
    routePayload[key] = normalizedValue;
  }

  if (Object.keys(routePayload).length > 0) {
    data.payload = JSON.stringify(routePayload);
  }

  return data;
}
