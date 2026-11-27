let imperialSessionToken: string | null = null;

export function getImperialSessionToken(): string | null {
  return imperialSessionToken;
}

export function setImperialSessionToken(token: string | null): void {
  const trimmed = token?.trim() || null;
  imperialSessionToken = trimmed && trimmed.length > 0 ? trimmed : null;
}

export function clearImperialSessionToken(): void {
  imperialSessionToken = null;
}
