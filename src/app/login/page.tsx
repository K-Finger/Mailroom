import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-linear-to-b from-blue-800 via-blue-600 to-blue-400 px-4 overflow-hidden">
      {/* Radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.12),transparent)] pointer-events-none" />

      {/* Back to home */}
      <Link href="/" className="relative z-10 mb-6 text-sm text-white/70 hover:text-white transition-colors">
        ← Back to home
      </Link>

      {/* Sign in label above card */}
      <h2 className="relative z-10 text-3xl font-semibold text-white mb-2">Sign in</h2>

      {/* Card */}
      <Card className="relative z-10 w-full max-w-md border-0 shadow-2xl">
        <CardContent className="flex flex-col px-10 pt-10 pb-8">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Image src="/logo.svg" alt="Mailroom" width={56} height={44} className="w-14 h-auto" />
            <h1 className="text-5xl font-bold tracking-tight text-blue-700">Mailroom</h1>
          </div>
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive mb-2">
              {error}
            </p>
          )}
          <GoogleSignInButton />
        </CardContent>
      </Card>
    </div>
  );
}
