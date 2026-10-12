type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export async function refreshGoogleToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  fetcher: Fetcher = fetch
): Promise<{ accessToken: string; expiresAt: number }> {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body
  });
  const payload = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !payload.access_token) throw new Error("Unable to refresh Google authorization");
  return {
    accessToken: payload.access_token,
    expiresAt: Math.floor(Date.now() / 1000) + (payload.expires_in ?? 3600)
  };
}
