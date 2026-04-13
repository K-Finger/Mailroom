import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAppUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  encryptRefreshToken,
  exchangeGoogleCodeForTokens,
  fetchGoogleProfile,
  parseGoogleOAuthStateValue,
} from "@/lib/google-drive/server";

const OAUTH_STATE_COOKIE = "google_drive_oauth_state";
const OAUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

function clearOAuthStateCookie(response: NextResponse) {
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    ...OAUTH_COOKIE_OPTIONS,
    expires: new Date(0),
  });
  return response;
}

function redirectWithError(request: Request, message: string) {
  const url = new URL("/automations", request.url);
  url.searchParams.set("error", message);
  return clearOAuthStateCookie(NextResponse.redirect(url));
}

function getOAuthErrorMessage(error: unknown) {
  if (error instanceof Error && error.message === "Google did not return a refresh token. Reconnect with consent.") {
    return error.message;
  }
  return "Failed to connect Google Drive";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectWithError(request, "Google Drive connection was canceled or failed");
  }

  if (!code || !state) {
    return redirectWithError(request, "Missing OAuth callback parameters");
  }

  const cookieStore = await cookies();
  const expectedState = parseGoogleOAuthStateValue(
    cookieStore.get(OAUTH_STATE_COOKIE)?.value,
  );

  if (!expectedState || expectedState.state !== state) {
    return redirectWithError(request, "Google OAuth state did not match");
  }

  const appUser = await getAppUser();
  if (!appUser) {
    return clearOAuthStateCookie(NextResponse.redirect(new URL("/login", request.url)));
  }

  if (expectedState.userId !== appUser.userId) {
    return redirectWithError(request, "Google OAuth session did not match the signed-in user");
  }

  try {
    const redirectUri = new URL("/api/google-drive/oauth/callback", request.url).toString();
    const tokens = await exchangeGoogleCodeForTokens({ code, redirectUri });
    const refreshToken = tokens.refresh_token;

    if (!refreshToken) {
      throw new Error("Google did not return a refresh token. Reconnect with consent.");
    }

    const profile = await fetchGoogleProfile(tokens.access_token);
    const encryptedRefreshToken = await encryptRefreshToken(refreshToken);
    const admin = createAdminClient();
    const { error } = await admin.from("google_drive_connections").upsert(
      {
        user_id: appUser.userId,
        google_account_id: profile.id,
        email: profile.email,
        encrypted_refresh_token: encryptedRefreshToken,
        scopes: tokens.scope.split(" ").filter(Boolean),
      },
      {
        onConflict: "user_id,google_account_id",
      },
    );

    if (error) {
      throw error;
    }

    return clearOAuthStateCookie(
      NextResponse.redirect(new URL("/automations?connected=1", request.url)),
    );
  } catch (error) {
    console.error("Google Drive OAuth callback failed", error);
    return redirectWithError(request, getOAuthErrorMessage(error));
  }
}
