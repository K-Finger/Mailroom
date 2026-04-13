import "server-only";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function invokeSupabaseFunction<T>(
  functionName: string,
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(
    `${getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL")}/functions/v1/${functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify(payload),
    },
  );

  const text = await response.text();
  let parsed = {} as T & { error?: string };
  if (text) {
    try {
      parsed = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(response.ok ? "Supabase function returned invalid JSON" : text);
    }
  }

  if (!response.ok) {
    throw new Error(parsed.error ?? "Supabase function request failed");
  }

  return parsed;
}
