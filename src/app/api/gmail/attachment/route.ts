import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { downloadAttachment } from "@/lib/gmail/api";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const messageId = searchParams.get("messageId");
  const attachmentId = searchParams.get("attachmentId");
  const filename = searchParams.get("filename") ?? "attachment";
  const mimeType = searchParams.get("mimeType") ?? "application/octet-stream";

  if (!messageId || !attachmentId) {
    return NextResponse.json(
      { error: "Missing messageId or attachmentId" },
      { status: 400 }
    );
  }

  // Get Google OAuth token
  const { data: profile } = await supabase
    .from("users")
    .select("google_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.google_access_token) {
    return NextResponse.json(
      { error: "Gmail access not connected" },
      { status: 403 }
    );
  }

  try {
    const buffer = await downloadAttachment(
      profile.google_access_token,
      messageId,
      attachmentId
    );

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to download attachment" },
      { status: 500 }
    );
  }
}
