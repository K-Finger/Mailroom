import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { getAutomationForUser } from "@/lib/automations/server";
import { invokeSupabaseFunction } from "@/lib/supabase/functions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await getAutomationForUser(appUser.userId, id);
    const result = await invokeSupabaseFunction<{
      exported: number;
      failed: number;
      pending: number;
    }>("drive-export", { automationId: id });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export Drive runs" },
      { status: 500 },
    );
  }
}
