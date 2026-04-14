"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { EmailAuthForm } from "@/components/auth/EmailAuthForm";
import { HeroBg } from "@/components/HeroBg";

export function AuthPage({ error, initialMode = "signin" }: { error?: string; initialMode?: "signin" | "signup" }) {
  const [mode, setMode] = useState<"signin" | "signup">(initialMode);

  const isSignup = mode === "signup";

  return (
    <div
      className={`relative flex min-h-screen flex-col items-center justify-center px-4 overflow-hidden transition-all duration-500 ${
        isSignup
          ? "bg-linear-to-b from-violet-900 via-violet-700 to-violet-500"
          : "bg-linear-to-b from-blue-800 via-blue-600 to-blue-400"
      }`}
    >
      <HeroBg />

      {/* Back to home */}
      <Link href="/" className="relative z-10 mb-6 text-sm text-white/70 hover:text-white transition-colors">
        ← Back to home
      </Link>

      {/* Title */}
      <h2 className="relative z-10 text-3xl font-semibold text-white mb-2">
        {isSignup ? "Sign up" : "Login"}
      </h2>

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
          <div className="relative">
            <GoogleSignInButton />
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-700">
            <span className="text-base">⚠️</span>
            <span><strong>New Google accounts are temporarily unavailable</strong> pending OAuth verification. Existing users can still sign in with Google.</span>
          </div>
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <EmailAuthForm mode={mode} onModeChange={setMode} />
        </CardContent>
      </Card>
    </div>
  );
}
