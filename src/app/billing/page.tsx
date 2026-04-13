import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, Zap, FileText, Mail, Sheet, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { createCheckoutSession, createPortalSession } from "./actions";

const MONTHLY_LIMIT = 500;

type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive";

const STATUS: Record<SubscriptionStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active:   { label: "Active",   variant: "default"     },
  trialing: { label: "Trial",    variant: "secondary"   },
  past_due: { label: "Past due", variant: "destructive" },
  canceled: { label: "Canceled", variant: "outline"     },
  inactive: { label: "No plan",  variant: "outline"     },
};

const FEATURES = [
  { icon: Zap,        text: "Unlimited pipelines" },
  { icon: FileText,   text: `${MONTHLY_LIMIT} documents / month` },
  { icon: FolderOpen, text: "Google Drive source" },
  { icon: Sheet,      text: "Google Sheets output" },
  { icon: Mail,       text: "Email delivery" },
];

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

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
    .select("stripe_subscription_status, stripe_current_period_end")
    .eq("id", user.id)
    .single();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { count: docsThisMonth } = await supabase
    .from("jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "done")
    .gte("created_at", startOfMonth.toISOString());

  const status = (profile?.stripe_subscription_status ?? "inactive") as SubscriptionStatus;
  const isActive = status === "active" || status === "trialing" || status === "past_due";
  const periodEnd = profile?.stripe_current_period_end;
  const docs = docsThisMonth ?? 0;
  const pct = Math.min(100, Math.round((docs / MONTHLY_LIMIT) * 100));

  return (
    <div className="flex flex-col min-h-full bg-background">
      {/* Top bar */}
      <div className="border-b bg-card shrink-0">
        <div className="flex items-center gap-3 px-6 py-3">
          <Link
            href="/pipeline"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Pipeline
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm font-semibold">Billing</span>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{user.email}</span>
        </div>
      </div>

      <div className="flex-1 px-6 py-12">
        <div className="max-w-2xl mx-auto space-y-8">

          {/* Success banner */}
          {success && (
            <div className="flex items-center gap-3 rounded-lg bg-primary/10 border border-primary/20 px-4 py-3 text-sm text-primary">
              <CheckCircle2 className="size-4 shrink-0" />
              Subscription activated — welcome to Mailroom Pro!
            </div>
          )}

          {isActive ? (
            /* ── Active subscription ── */
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Plan card */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">Mailroom Pro</CardTitle>
                    <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
                  </div>
                  {status === "trialing" && (
                    <CardDescription className="flex items-center gap-1.5">
                      <Clock className="size-3" />
                      Trial ends {periodEnd ? fmt(periodEnd) : "soon"}
                    </CardDescription>
                  )}
                  {status === "active" && periodEnd && (
                    <CardDescription>Renews {fmt(periodEnd)}</CardDescription>
                  )}
                  {status === "past_due" && (
                    <CardDescription className="flex items-center gap-1.5 text-destructive">
                      <AlertCircle className="size-3" />
                      Payment failed — update payment method
                    </CardDescription>
                  )}
                </CardHeader>
                <CardFooter>
                  <form action={createPortalSession} className="w-full">
                    <Button variant="outline" size="sm" className="w-full">
                      Manage billing
                    </Button>
                  </form>
                </CardFooter>
              </Card>

              {/* Usage card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Usage this month</CardTitle>
                  <CardDescription>
                    Resets {periodEnd ? fmt(new Date(new Date(periodEnd).setMonth(new Date(periodEnd).getMonth() - 1 + 1, 1)).toISOString()) : "next month"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-end justify-between text-sm">
                    <span className="font-semibold tabular-nums">{docs.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">of {MONTHLY_LIMIT.toLocaleString()} docs</span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  {pct >= 90 && (
                    <p className="text-xs text-destructive flex items-center gap-1.5">
                      <AlertCircle className="size-3" />
                      Approaching monthly limit
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            /* ── No subscription — pricing ── */
            <div className="space-y-6">
              <div>
                <h1 className="text-xl font-semibold">Get started with Mailroom</h1>
                <p className="mt-1 text-sm text-muted-foreground">Automate your document workflows.</p>
              </div>

              <Card className="max-w-sm">
                <CardHeader>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">Pro</span>
                  </div>
                  <CardDescription>14-day free trial, then billed monthly.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {FEATURES.map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-center gap-2 text-sm">
                        <Icon className="size-3.5 text-muted-foreground shrink-0" />
                        {text}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <form action={createCheckoutSession} className="w-full">
                    <Button className="w-full">
                      Start free trial
                    </Button>
                  </form>
                </CardFooter>
              </Card>

              {status === "canceled" && (
                <p className="text-sm text-muted-foreground">
                  Your previous subscription was canceled. Subscribe above to reactivate.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
