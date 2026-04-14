import { AuthPage } from "@/components/auth/AuthPage";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mode?: string }>;
}) {
  const { error, mode } = await searchParams;
  return <AuthPage error={error} initialMode={mode === "signup" ? "signup" : "signin"} />;
}
