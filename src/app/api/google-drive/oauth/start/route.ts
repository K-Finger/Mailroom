import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { buildGoogleOAuthStateValue, buildGoogleOAuthUrl } from "@/lib/google-drive/server";

const OAUTH_STATE_COOKIE = "google_drive_oauth_state";

export async function GET(request: Request) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/google-drive/oauth/callback", request.url).toString();
  const response = NextResponse.redirect(
    buildGoogleOAuthUrl({
      redirectUri,
      state,
    }),
  );

  response.cookies.set(OAUTH_STATE_COOKIE, buildGoogleOAuthStateValue(appUser.userId, state), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  return response;
}
