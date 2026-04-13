import { createClient } from "jsr:@supabase/supabase-js@2";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

export function getFunctionUrl(name: string) {
  return `${Deno.env.get("SUPABASE_URL")}/functions/v1/${name}`;
}

export function getServiceRoleKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
}

export function isInternalRequest(req: Request) {
  return req.headers.get("Authorization") === `Bearer ${getServiceRoleKey()}`;
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
