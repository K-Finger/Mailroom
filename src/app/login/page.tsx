import { AuthPage } from "@/components/auth/AuthPage";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <AuthPage error={error} />;
}
