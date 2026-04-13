import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Try refreshing the session first — Supabase will call Google's refresh
  // endpoint and return a fresh provider_token if a refresh_token exists.
  const { data: refreshed } = await supabase.auth.refreshSession();
  if (refreshed?.session?.provider_token) {
    const freshToken = refreshed.session.provider_token;
    await supabase
      .from("users")
      .update({ google_access_token: freshToken })
      .eq("id", user.id);
    return NextResponse.json({ token: freshToken });
  }

  // Fall back to stored token
  const { data, error } = await supabase
    .from("users")
    .select("google_access_token")
    .eq("id", user.id)
    .single();

  if (error || !data?.google_access_token) {
    return NextResponse.json({ error: "No Drive token — re-sign in with Google" }, { status: 404 });
  }

  return NextResponse.json({ token: data.google_access_token });
}
