import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, ArrowLeft, Zap, FileText, Mail, Sheet, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { buyCredits } from "./actions";

const CREDITS_PER_PACK = 50;
const PRICE = "$2.99";

const FEATURES = [
  { icon: Zap,        text: "Unlimited pipelines" },
  { icon: FileText,   text: `${CREDITS_PER_PACK} document runs` },
  { icon: FolderOpen, text: "Google Drive source" },
  { icon: Sheet,      text: "Google Sheets output" },
  { icon: Mail,       text: "Email delivery" },
];

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("document_credits")
    .eq("id", user.id)
    .single();

  const credits = profile?.document_credits ?? 0;

  return (
    <div className="relative flex min-h-screen flex-col items-center bg-linear-to-b from-blue-800 via-blue-600 to-blue-400 px-4 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.12),transparent)] pointer-events-none" />

      {/* Top nav */}
      <div className="relative z-10 w-full max-w-lg flex items-center gap-2 pt-6 pb-2">
        <Link href="/pipeline" className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors">
          <ArrowLeft className="size-4" />
          Pipeline
        </Link>
      </div>

      {/* Logo + title */}
      <div className="relative z-10 flex items-center gap-3 mt-6 mb-4">
        <Image src="/logo.svg" alt="Mailroom" width={40} height={32} className="w-10 h-auto" />
        <h1 className="text-4xl font-bold tracking-tight text-white">Mailroom</h1>
      </div>

      <h2 className="relative z-10 text-3xl font-semibold text-white mb-4">Billing</h2>

      {/* Success banner */}
      {success && (
        <div className="relative z-10 w-full max-w-lg flex items-center gap-3 rounded-xl bg-white/20 border border-white/30 px-5 py-4 text-white mb-4">
          <CheckCircle2 className="size-5 shrink-0" />
          Credits added — you&apos;re good to go!
        </div>
      )}

      <Card className="relative z-10 w-full max-w-lg border-0 shadow-2xl mb-10">
        <CardContent className="px-10 py-10 flex flex-col gap-8">

          {/* Current credits */}
          <div className="text-center">
            <p className="text-6xl font-bold text-blue-700 tabular-nums">{credits}</p>
            <p className="text-lg text-muted-foreground mt-1">document runs remaining</p>
          </div>

          <hr className="border-border" />

          {/* Pack details */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-2xl font-bold">Top up</p>
              <p className="text-3xl font-bold text-blue-700">{PRICE}</p>
            </div>
            <ul className="space-y-3 mb-6">
              {FEATURES.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-base">
                  <Icon className="size-5 text-blue-600 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
            <form action={buyCredits}>
              <button
                type="submit"
                className="w-full h-14 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
              >
                Buy {CREDITS_PER_PACK} runs for {PRICE}
              </button>
            </form>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
