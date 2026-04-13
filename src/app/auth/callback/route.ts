import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/pipeline";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const { provider_token, provider_refresh_token, user } = data.session;
      if (provider_token) {
        await supabase
          .from("users")
          .update({
            google_access_token: provider_token,
            ...(provider_refresh_token ? { google_refresh_token: provider_refresh_token } : {}),
          })
          .eq("id", user.id);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Authentication+failed`);
}
