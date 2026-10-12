import type { JobEmail } from "./parser";

export const gmailSearchQuery =
  'newer_than:90d -in:spam -in:trash {subject:(application) subject:(interview) subject:(assessment) subject:(offer) subject:(candidate) subject:(next steps) subject:(hiring process)}';

type GmailPart = {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: GmailPart[];
};

type GmailMessage = {
  id: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class GmailAuthorizationError extends Error {
  constructor() {
    super("Gmail authorization has expired. Sign in again to reconnect.");
  }
}

export class GmailPermissionError extends Error {}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function collectParts(part: GmailPart | undefined, texts: string[], html: string[]): void {
  if (!part) return;
  if (part.body?.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (part.mimeType === "text/plain") texts.push(decoded);
    if (part.mimeType === "text/html") html.push(decoded);
  }
  for (const child of part.parts ?? []) collectParts(child, texts, html);
}

export function decodeGmailMessage(message: GmailMessage): JobEmail {
  const headers = new Map((message.payload?.headers ?? []).map((header) => [header.name.toLowerCase(), header.value]));
  const texts: string[] = [];
  const html: string[] = [];
  collectParts(message.payload, texts, html);
  const body = texts.join("\n").trim() || htmlToText(html.join("\n")) || message.snippet || "";

  return {
    messageId: message.id,
    threadId: message.threadId ?? null,
    receivedAt: new Date(Number(message.internalDate ?? Date.now())),
    from: headers.get("from") ?? "",
    subject: headers.get("subject") ?? "",
    text: body
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  };
}

async function gmailFetch<T>(accessToken: string, url: string, fetcher: Fetcher = fetch): Promise<T> {
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (response.status === 401) throw new GmailAuthorizationError();
  if (response.status === 403) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string; errors?: Array<{ reason?: string }> };
    } | null;
    const reason = payload?.error?.errors?.[0]?.reason;
    if (reason === "insufficientPermissions") {
      throw new GmailPermissionError(
        "Google did not grant Gmail read access. Remove the Job Dashboard connection, then sign in and approve the Gmail permission."
      );
    }
    if (reason === "accessNotConfigured" || reason === "serviceDisabled") {
      throw new GmailPermissionError(
        "The Gmail API is not enabled in the Google Cloud project used by this OAuth client."
      );
    }
    if (
      reason === "rateLimitExceeded" ||
      reason === "userRateLimitExceeded" ||
      payload?.error?.message?.includes("Quota exceeded")
    ) {
      throw new GmailPermissionError(
        "Gmail's per-minute quota was reached. Wait one minute, then click Sync Gmail again."
      );
    }
    throw new GmailPermissionError(payload?.error?.message ?? "Google denied access to Gmail.");
  }
  if (!response.ok) throw new Error(`Gmail request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export async function listGmailMessageIds(accessToken: string, fetcher: Fetcher = fetch): Promise<string[]> {
  const messageIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({ q: gmailSearchQuery, maxResults: "100" });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await gmailFetch<{ messages?: Array<{ id: string }>; nextPageToken?: string }>(
      accessToken,
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      fetcher
    );
    messageIds.push(...(page.messages ?? []).map(({ id }) => id));
    pageToken = page.nextPageToken;
  } while (pageToken);

  return messageIds;
}

export async function getGmailMessages(
  accessToken: string,
  messageIds: string[],
  fetcher: Fetcher = fetch
): Promise<JobEmail[]> {
  const emails: JobEmail[] = [];
  for (let offset = 0; offset < messageIds.length; offset += 10) {
    const batch = messageIds.slice(offset, offset + 10);
    const messages = await Promise.all(
      batch.map((id) =>
        gmailFetch<GmailMessage>(
          accessToken,
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
          fetcher
        )
      )
    );
    emails.push(...messages.map(decodeGmailMessage));
  }
  return emails;
}

export async function listJobEmails(accessToken: string, fetcher: Fetcher = fetch): Promise<JobEmail[]> {
  const messageIds = await listGmailMessageIds(accessToken, fetcher);
  return getGmailMessages(accessToken, messageIds, fetcher);
}
