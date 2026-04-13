import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { getGoogleDriveConnectionForUser } from "@/lib/automations/server";
import {
  decryptRefreshToken,
  listGoogleDriveFolders,
  refreshGoogleAccessToken,
} from "@/lib/google-drive/server";

export async function GET(request: Request) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");

  if (!connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }

  try {
    const connection = await getGoogleDriveConnectionForUser(appUser.userId, connectionId);
    const refreshToken = await decryptRefreshToken(connection.encrypted_refresh_token);
    const token = await refreshGoogleAccessToken(refreshToken);
    const folders = await listGoogleDriveFolders(token.access_token);
    return NextResponse.json({ folders });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list folders" },
      { status: 500 },
    );
  }
}
