const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  version: string;
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function deriveKey(secret: string) {
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["decrypt"]);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function concat(parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    buffer.set(part, offset);
    offset += part.length;
  }
  return buffer;
}

function tryParseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function getGoogleErrorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    error?: unknown;
    error_description?: unknown;
  };

  if (typeof record.error_description === "string" && record.error_description.trim()) {
    return record.error_description;
  }

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error;
  }

  if (record.error && typeof record.error === "object") {
    const message = (record.error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return null;
}

async function parseGoogleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new Error(getGoogleErrorMessage(payload) ?? "Google request failed");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Google returned an unexpected response");
  }

  return payload as T;
}

export async function decryptRefreshToken(encryptedValue: string) {
  const [version, ivPart, cipherPart] = encryptedValue.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) {
    throw new Error("Invalid Google token format");
  }

  const key = await deriveKey(getRequiredEnv("GOOGLE_DRIVE_TOKEN_SECRET"));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    key,
    fromBase64(cipherPart),
  );
  return new TextDecoder().decode(plaintext);
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  return await parseGoogleResponse<{ access_token: string }>(response);
}

export async function listGoogleDriveFilesInFolder(
  accessToken: string,
  folderId: string,
) {
  const files: GoogleDriveFile[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL(DRIVE_FILES_ENDPOINT);
    url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
    url.searchParams.set(
      "fields",
      "nextPageToken,files(id,name,mimeType,modifiedTime,version)",
    );
    url.searchParams.set("orderBy", "modifiedTime desc");
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

      const payload = await parseGoogleResponse<{
        files?: GoogleDriveFile[];
        nextPageToken?: string;
      }>(response);

    files.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);

  return files;
}

export async function downloadGoogleDriveFile(accessToken: string, fileId: string) {
  const response = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Failed to download Google Drive file");
  }

  return new Uint8Array(await response.arrayBuffer());
}

export async function uploadGoogleDriveFile({
  accessToken,
  folderId,
  filename,
  bytes,
  contentType,
}: {
  accessToken: string;
  folderId: string;
  filename: string;
  bytes: Uint8Array;
  contentType: string;
}) {
  const boundary = `formattr-${crypto.randomUUID()}`;
  const encoder = new TextEncoder();
  const metadata = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({
      name: filename,
      parents: [folderId],
    })}\r\n`,
  );
  const fileHeader = encoder.encode(
    `--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`,
  );
  const trailer = encoder.encode(`\r\n--${boundary}--`);

  const response = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: concat([metadata, fileHeader, bytes, trailer]),
    },
  );

  return await parseGoogleResponse<{ id: string; name: string }>(response);
}

export function isSupportedSourceFile(file: GoogleDriveFile) {
  if (file.mimeType.startsWith("application/vnd.google-apps")) {
    return false;
  }

  const lower = file.name.toLowerCase();
  return (
    lower.endsWith(".pdf") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".csv")
  );
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function matchesFileNamePattern(name: string, pattern: string | null) {
  if (!pattern) {
    return true;
  }

  const regex = new RegExp(
    `^${Array.from(pattern).map((char) => {
      if (char === "*") {
        return ".*";
      }
      if (char === "?") {
        return ".";
      }
      return escapeRegex(char);
    }).join("")}$`,
    "i",
  );

  return regex.test(name);
}

export function sanitizeFilename(filename: string) {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-").replace(/\s+/g, " ").trim();
}

export function buildExportFilename(sourceName: string | null, resultPath: string) {
  const resultName = resultPath.split("/").pop() ?? "result.bin";
  const baseName = sourceName
    ? sourceName.replace(/\.[^.]+$/, "")
    : "formattr-output";
  const extension = resultName.includes(".")
    ? resultName.slice(resultName.lastIndexOf("."))
    : "";
  return sanitizeFilename(`${baseName}--formattr${extension || ".bin"}`);
}

export function guessContentType(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".zip")) {
    return "application/zip";
  }
  return "application/octet-stream";
}
