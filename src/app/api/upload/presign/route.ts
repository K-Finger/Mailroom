import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { files } = await request.json() as {
    files: Array<{ name: string; type: string }>;
  };

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const signed = await Promise.all(
    files.map(async (f) => {
      const ext = f.name.split(".").pop() ?? "bin";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("source-files")
        .createSignedUploadUrl(path);

      if (error) throw new Error(error.message);
      return { name: f.name, path, token: data.token };
    })
  );

  return NextResponse.json({ files: signed });
}
