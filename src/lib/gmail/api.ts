// Gmail API helpers for fetching emails with attachments
// Requires gmail.readonly scope in Google OAuth

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  attachments: GmailAttachment[];
}

export interface GmailAttachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
}

/** List recent emails with PDF/spreadsheet attachments */
export async function listEmailsWithAttachments(
  token: string,
  options: { maxResults?: number; query?: string } = {}
): Promise<GmailMessage[]> {
  const { maxResults = 20, query = "" } = options;

  // Search for emails with attachments, optionally filtered by query
  const searchQuery = `has:attachment ${query}`.trim();
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  listUrl.searchParams.set("q", searchQuery);
  listUrl.searchParams.set("maxResults", String(maxResults));

  const listRes = await fetch(listUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!listRes.ok) {
    const error = await listRes.text();
    throw new Error(`Failed to list emails: ${error}`);
  }

  const { messages } = await listRes.json() as { messages?: { id: string; threadId: string }[] };
  if (!messages?.length) return [];

  // Fetch full message details for each
  const results: GmailMessage[] = [];

  for (const msg of messages.slice(0, maxResults)) {
    try {
      const detail = await getMessageDetails(token, msg.id);
      if (detail && detail.attachments.length > 0) {
        results.push(detail);
      }
    } catch {
      // Skip messages that fail to load
    }
  }

  return results;
}

/** Get message details including attachments */
async function getMessageDetails(token: string, messageId: string): Promise<GmailMessage | null> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  const headers = data.payload?.headers ?? [];

  const getHeader = (name: string) =>
    headers.find((h: { name: string; value: string }) =>
      h.name.toLowerCase() === name.toLowerCase()
    )?.value ?? "";

  // Extract attachments from parts
  const attachments: GmailAttachment[] = [];
  const supportedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
  ];

  function extractAttachments(parts: unknown[] = []) {
    for (const part of parts as Array<{
      filename?: string;
      mimeType?: string;
      body?: { attachmentId?: string; size?: number };
      parts?: unknown[];
    }>) {
      if (part.filename && part.body?.attachmentId) {
        if (supportedTypes.includes(part.mimeType ?? "")) {
          attachments.push({
            id: part.body.attachmentId,
            messageId,
            filename: part.filename,
            mimeType: part.mimeType ?? "application/octet-stream",
            size: part.body.size ?? 0,
          });
        }
      }
      if (part.parts) {
        extractAttachments(part.parts);
      }
    }
  }

  extractAttachments(data.payload?.parts ?? []);

  // Also check top-level body
  if (data.payload?.body?.attachmentId && data.payload?.filename) {
    const mimeType = data.payload.mimeType ?? "";
    if (supportedTypes.includes(mimeType)) {
      attachments.push({
        id: data.payload.body.attachmentId,
        messageId,
        filename: data.payload.filename,
        mimeType,
        size: data.payload.body.size ?? 0,
      });
    }
  }

  return {
    id: messageId,
    threadId: data.threadId,
    subject: getHeader("Subject"),
    from: getHeader("From"),
    date: getHeader("Date"),
    attachments,
  };
}

/** Download an attachment */
export async function downloadAttachment(
  token: string,
  messageId: string,
  attachmentId: string
): Promise<ArrayBuffer> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/attachments/${attachmentId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error("Failed to download attachment");
  }

  const { data } = await res.json() as { data: string };

  // Gmail returns base64url encoded data
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}
