import "server-only";

import type { TemplateBucket } from "@/store/pipeline";

const GOOGLE_OAUTH_SCOPE = "https://www.googleapis.com/auth/drive";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface GoogleProfile {
  id: string;
  email: string;
}

export interface GoogleDriveFolder {
  id: string;
  name: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  version: string;
  size?: string;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getTokenSecret() {
  return getRequiredEnv("GOOGLE_DRIVE_TOKEN_SECRET");
}

async function deriveKey(secret: string) {
  const encoder = new TextEncoder();
  const rawKey = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", rawKey, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string) {
  return new Uint8Array(Buffer.from(value, "base64"));
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

export function getGoogleDriveScopes() {
  return [GOOGLE_OAUTH_SCOPE];
}

export function getSupportedDriveUploadBuckets(): TemplateBucket[] {
  return ["source-files", "pipeline-assets"];
}

export function buildGoogleOAuthStateValue(userId: string, state: string) {
  return `${userId}.${state}`;
}

export function parseGoogleOAuthStateValue(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  const separator = value.indexOf(".");
  if (separator <= 0 || separator === value.length - 1) {
    return null;
  }

  return {
    userId: value.slice(0, separator),
    state: value.slice(separator + 1),
  };
}

export async function encryptRefreshToken(refreshToken: string) {
  const key = await deriveKey(getTokenSecret());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(refreshToken);
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `v1.${toBase64(iv)}.${toBase64(new Uint8Array(cipher))}`;
}

export async function decryptRefreshToken(encryptedValue: string) {
  const [version, ivPart, cipherPart] = encryptedValue.split(".");
  if (version !== "v1" || !ivPart || !cipherPart) {
    throw new Error("Invalid Google token format");
  }
  const key = await deriveKey(getTokenSecret());
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(ivPart) },
    key,
    fromBase64(cipherPart),
  );
  return new TextDecoder().decode(plaintext);
}

export function buildGoogleOAuthUrl({
  redirectUri,
  state,
}: {
  redirectUri: string;
  state: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", getRequiredEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getGoogleDriveScopes().join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  return url;
}

async function parseGoogleResponse(response: Response) {
  const text = await response.text();
  const payload = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new Error(getGoogleErrorMessage(payload) ?? "Google request failed");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Google returned an unexpected response");
  }

  return payload;
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

export async function exchangeGoogleCodeForTokens({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: getRequiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: getRequiredEnv("GOOGLE_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  return parseGoogleResponse(response) as Promise<GoogleTokenResponse>;
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

  return parseGoogleResponse(response) as Promise<GoogleTokenResponse>;
}

export async function fetchGoogleProfile(accessToken: string) {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  return parseGoogleResponse(response) as Promise<GoogleProfile>;
}

export async function listGoogleDriveFolders(accessToken: string) {
  const folders: GoogleDriveFolder[] = [];
  let pageToken: string | null = null;

  do {
    const url = new URL(DRIVE_FILES_ENDPOINT);
    url.searchParams.set(
      "q",
      "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    );
    url.searchParams.set("fields", "nextPageToken,files(id,name)");
    url.searchParams.set("orderBy", "name");
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

    const payload = (await parseGoogleResponse(response)) as {
      files?: GoogleDriveFolder[];
      nextPageToken?: string;
    };

    folders.push(...(payload.files ?? []));
    pageToken = payload.nextPageToken ?? null;
  } while (pageToken);

  return folders;
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
      "nextPageToken,files(id,name,mimeType,modifiedTime,version,size)",
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

    const payload = (await parseGoogleResponse(response)) as {
      files?: GoogleDriveFile[];
      nextPageToken?: string;
    };

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

  return parseGoogleResponse(response) as Promise<{ id: string; name: string }>;
}
