import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Set AUTH_ENABLED=true in env to enforce authentication.
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export async function POST(request: Request) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (AUTH_ENABLED && !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userId = user?.id ?? "00000000-0000-0000-0000-000000000000";

  const { files } = await request.json() as {
    files: Array<{ name: string; type: string }>;
  };

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const storageClient = AUTH_ENABLED
    ? supabase
    : createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

  const signed = await Promise.all(
    files.map(async (f) => {
      const ext = f.name.split(".").pop() ?? "bin";
      const path = `${userId}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await storageClient.storage
        .from("source-files")
        .createSignedUploadUrl(path);

      if (error) throw new Error(error.message);
      return { name: f.name, path, signedUrl: data.signedUrl, token: data.token };
    })
  );

  return NextResponse.json({ files: signed });
}
