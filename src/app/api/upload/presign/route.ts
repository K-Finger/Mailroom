import { NextResponse } from "next/server";
import { getAppUser } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupportedDriveUploadBuckets } from "@/lib/google-drive/server";

const ALLOWED_BUCKETS = new Set(getSupportedDriveUploadBuckets());

export async function POST(request: Request) {
  const appUser = await getAppUser();
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { files, bucket = "source-files" } = await request.json() as {
    files: Array<{ name: string; type: string }>;
    bucket?: "source-files" | "pipeline-assets";
  };

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: "Unsupported upload bucket" }, { status: 400 });
  }

  const admin = createAdminClient();

  const signed = await Promise.all(
    files.map(async (f) => {
      const ext = f.name.split(".").pop() ?? "bin";
      const path = `${appUser.userId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await admin.storage
        .from(bucket)
        .createSignedUploadUrl(path);

      if (error) throw new Error(error.message);
      return { name: f.name, path, signedUrl: data.signedUrl, token: data.token };
    })
  );

  return NextResponse.json({ files: signed });
}
