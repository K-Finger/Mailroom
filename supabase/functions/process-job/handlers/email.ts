import { shapeToResult } from "../helpers.ts";
import type { StepData, PipelineStep } from "../types.ts";

const RESEND_API = "https://api.resend.com/emails";

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export async function sendEmail(
  data: StepData,
  config: PipelineStep["config"],
): Promise<void> {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) throw new Error("RESEND_API_KEY not set");

  const to = config.emailTo;
  if (!to) throw new Error("Email step missing recipient address");

  const from = Deno.env.get("FROM_EMAIL") ?? "Mailroom <noreply@mailroom.app>";
  const subject = config.emailSubject || "Pipeline results";
  const body = config.emailBody || "";

  const { bytes, filename, contentType } = await shapeToResult(
    data,
    (config.emailFormat as "xlsx" | "csv") ?? "xlsx",
  );

  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text: body || "Your pipeline results are attached.",
      attachments: [
        {
          filename,
          content: toBase64(bytes),
          content_type: contentType,
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json() as { message?: string };
    throw new Error(`Resend error: ${err.message ?? res.status}`);
  }
}
