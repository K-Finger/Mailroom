import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listEmailsWithAttachments } from "@/lib/gmail/api";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const maxResults = Math.min(parseInt(searchParams.get("max") ?? "20"), 50);

  // Get Google OAuth token
  const { data: profile } = await supabase
    .from("users")
    .select("google_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.google_access_token) {
    return NextResponse.json(
      { error: "Gmail access not connected. Sign in with Google to enable." },
      { status: 403 }
    );
  }

  try {
    const messages = await listEmailsWithAttachments(profile.google_access_token, {
      maxResults,
      query,
    });

    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch emails" },
      { status: 500 }
    );
  }
}
