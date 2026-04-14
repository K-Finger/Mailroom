"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Upload, Sparkles, ShieldCheck, Download, Check, X, FileText, Table2, Clock, Users } from "lucide-react";

// Step connector
function StepConnector() {
  return (
    <div className="hidden md:flex items-center justify-center w-12">
      <div className="h-px w-full bg-gradient-to-r from-border via-brand/50 to-border" />
    </div>
  );
}

// How it works step
function HowItWorksStep({
  icon: Icon,
  title,
  description,
  step,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  step: number;
}) {
  return (
    <div className="flex flex-col items-center text-center group">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-brand/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-card border border-border group-hover:border-brand/50 transition-colors duration-300">
          <Icon className="w-7 h-7 text-brand" />
        </div>
        <span className="absolute -top-2 -right-2 flex items-center justify-center w-6 h-6 rounded-full bg-brand text-brand-foreground text-xs font-bold">
          {step}
        </span>
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-[200px]">{description}</p>
    </div>
  );
}

// Feature card
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="group relative p-6 rounded-2xl bg-card border border-border hover:border-brand/30 transition-all duration-300">
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand/10 mb-4">
          <Icon className="w-6 h-6 text-brand" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// Comparison cell
function ComparisonCell({ value }: { value: boolean }) {
  return (
    <td className="py-3 px-4 text-center">
      {value ? (
        <Check className="w-5 h-5 text-brand mx-auto" />
      ) : (
        <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />
      )}
    </td>
  );
}

// Comparison table row
function ComparisonRow({
  feature,
  mailroom,
  n8n,
  zapier,
  ocr,
  manual,
}: {
  feature: string;
  mailroom: boolean;
  n8n: boolean;
  zapier: boolean;
  ocr: boolean;
  manual: boolean;
}) {
  return (
    <tr className="border-b border-border/50 hover:bg-accent/30 transition-colors">
      <td className="py-3 px-4 text-sm font-medium">{feature}</td>
      <ComparisonCell value={mailroom} />
      <ComparisonCell value={n8n} />
      <ComparisonCell value={zapier} />
      <ComparisonCell value={ocr} />
      <ComparisonCell value={manual} />
    </tr>
  );
}

// App preview window — pipeline strip + hero screenshot
function AppPreview() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) el.classList.add("animate-in");
        });
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className="relative w-full max-w-6xl mx-auto opacity-0 translate-y-8 transition-all duration-700 ease-out [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0"
    >
      <div className="rounded-4xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.35)] border border-white/20">
        <Image
          src="/hero_splash.png"
          alt="Mailroom app"
          width={1200}
          height={700}
          className="w-full h-auto block"
          priority
        />
      </div>
    </div>
  );
}

// Value prop pill
function ValueProp({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand/10">
        <Check className="w-4 h-4 text-brand" />
      </div>
      <span className="text-sm font-medium">{children}</span>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── HERO (blue) ─────────────────────────────────── */}
      <section className="relative bg-gradient-to-b from-blue-800 via-blue-600 to-blue-500 overflow-hidden pb-0">
        {/* subtle radial glow */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.12),transparent)] pointer-events-none" />

        {/* Navbar */}
        <nav className="fixed top-4 left-0 right-0 z-50 flex items-center justify-center px-6">
          <div className="relative flex items-center bg-white rounded-full px-4 py-2.5 shadow-lg w-full max-w-3xl border border-blue-600">
            {/* Logo - left */}
            <span className="text-xl font-bold text-blue-700 tracking-tight pl-1 shrink-0">
              <a href="#hero">MailRoom</a>
            </span>
            {/* Nav links - absolutely centered */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1">
              {["How it works", "Pricing", "Features"].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
                >
                  {item}
                </a>
              ))}
            </div>
            {/* Auth - right */}
            <div className="flex items-center gap-2 ml-auto shrink-0">
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100 hidden sm:block"
              >
                Login
              </Link>
              <Link
                href="/pipeline"
                className="inline-flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 h-8 px-4 text-sm font-semibold transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero text */}
        <div id="hero" className="relative z-10 max-w-6xl mx-auto text-center px-4 pt-32 pb-14">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-medium tracking-tighter text-white mb-4 leading-tight max-w-5xl mx-auto">
            Replace Data Entry Workflows
            <br />
            With <em className="italic text-white/95 font-serif tracking-[-0.04em]">AI Automated Pipelines</em>
          </h1>
          <p className="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto mb-10">
            Upload documents, extract the data that matters, validate it automatically, and export to spreadsheets — in seconds, not hours.
          </p>
          <div className="flex items-center justify-center">
            <Link
              href="/pipeline"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-blue-700 hover:bg-white/90 h-12 px-8 text-base font-semibold transition-colors shadow-md"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* App preview — sits at bottom of hero, slightly overlapping next section */}
        <div className="relative z-10 px-4 md:px-8 pb-0">
          <AppPreview />
          <div className="pointer-events-none absolute inset-0 mt-80 bg-linear-to-b from-transparent to-white" />
          <div className="pointer-events-none absolute inset-0 mt-90 bg-linear-to-b from-transparent to-white" />
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────── */}
      <section className="py-20 px-4 bg-accent/30">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Manual document work is still <span className="text-brand">everywhere</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Teams still open PDFs, hunt for fields, fix formatting, and enter data by hand. Hours lost every week to repetitive work that should be automated.
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-lg text-muted-foreground">Four steps from document to spreadsheet</p>
          </div>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-6 md:gap-0">
            <HowItWorksStep icon={Upload} title="Upload" description="Drop invoices, forms, or any PDF documents" step={1} />
            <StepConnector />
            <HowItWorksStep icon={Sparkles} title="Extract" description="AI pulls the fields that matter from your documents" step={2} />
            <StepConnector />
            <HowItWorksStep icon={ShieldCheck} title="Validate" description="Catch missing or suspicious values before export" step={3} />
            <StepConnector />
            <HowItWorksStep icon={Download} title="Export" description="Get clean, spreadsheet-ready data instantly" step={4} />
          </div>
        </div>
      </section>

      {/* ── USE CASE SPOTLIGHT ─────────────────────────── */}
      <section className="py-20 px-4 bg-accent/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-sm font-medium mb-4">
                Use case spotlight
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Invoice capture</h2>
              <p className="text-lg text-muted-foreground mb-6">
                Mailroom reads invoices, pulls the key fields, standardizes the output, and returns spreadsheet-ready data. No manual data entry required.
              </p>
              <ul className="space-y-3">
                {["Vendor name & address", "Invoice number & date", "Line items & amounts", "Tax & total calculations"].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-brand/10">
                      <Check className="w-3.5 h-3.5 text-brand" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-brand/10 rounded-3xl blur-2xl" />
              <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
                  <FileText className="w-8 h-8 text-brand" />
                  <div>
                    <p className="font-semibold">Invoice_2024_001.pdf</p>
                    <p className="text-xs text-muted-foreground">Processed in 2.3 seconds</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {[
                    { field: "Vendor", value: "Acme Corp" },
                    { field: "Invoice #", value: "INV-2024-001" },
                    { field: "Date", value: "2024-01-15" },
                    { field: "Total", value: "$4,250.00" },
                  ].map(({ field, value }) => (
                    <div key={field} className="flex items-center justify-between py-2 px-3 rounded-lg bg-accent/50">
                      <span className="text-sm text-muted-foreground">{field}</span>
                      <span className="text-sm font-medium">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── COMPARISON TABLE ───────────────────────────── */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why Mailroom?</h2>
            <p className="text-lg text-muted-foreground">Built specifically for document workflows, not generic automation</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 px-4 text-left text-sm font-semibold">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand/10 text-brand text-sm font-semibold">
                      Mailroom
                    </span>
                  </th>
                  <th className="py-4 px-4 text-center text-sm font-semibold text-muted-foreground">n8n</th>
                  <th className="py-4 px-4 text-center text-sm font-semibold text-muted-foreground">Zapier</th>
                  <th className="py-4 px-4 text-center text-sm font-semibold text-muted-foreground">OCR Tools</th>
                  <th className="py-4 px-4 text-center text-sm font-semibold text-muted-foreground">Manual</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow feature="AI document extraction" mailroom={true} n8n={false} zapier={false} ocr={true} manual={false} />
                <ComparisonRow feature="Document-specific workflow nodes" mailroom={true} n8n={false} zapier={false} ocr={false} manual={false} />
                <ComparisonRow feature="Validation & error flagging" mailroom={true} n8n={false} zapier={false} ocr={false} manual={true} />
                <ComparisonRow feature="Spreadsheet-ready export" mailroom={true} n8n={true} zapier={true} ocr={false} manual={true} />
                <ComparisonRow feature="Built for non-technical users" mailroom={true} n8n={false} zapier={true} ocr={false} manual={true} />
                <ComparisonRow feature="Fast setup for document workflows" mailroom={true} n8n={false} zapier={false} ocr={false} manual={false} />
                <ComparisonRow feature="Invoice capture out of the box" mailroom={true} n8n={false} zapier={false} ocr={false} manual={false} />
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── FEATURES GRID ──────────────────────────────── */}
      <section id="features" className="py-20 px-4 bg-accent/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-lg text-muted-foreground">Powerful features for document automation</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={Sparkles} title="AI Extraction" description="Intelligent field extraction powered by Claude. Understands context, not just patterns." />
            <FeatureCard icon={ShieldCheck} title="Validation Rules" description="Define rules to catch errors before they reach your spreadsheet. Required fields, ranges, formats." />
            <FeatureCard icon={Table2} title="Template Matching" description="Create templates for consistent extraction. Map fields exactly where you need them." />
            <FeatureCard icon={Download} title="Flexible Export" description="Download as XLSX, CSV, or push directly to Google Sheets. Your data, your format." />
            <FeatureCard icon={Clock} title="Real-time Processing" description="Watch your documents process in real-time. No waiting, no refreshing." />
            <FeatureCard icon={Users} title="Team Ready" description="Invite your team, share pipelines, and collaborate on document workflows." />
          </div>
        </div>
      </section>

      {/* ── VALUE PROPS ────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why teams choose Mailroom</h2>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <ValueProp>Replace manual data entry</ValueProp>
            <ValueProp>Extract and structure data automatically</ValueProp>
            <ValueProp>Catch errors before export</ValueProp>
            <ValueProp>Go from PDF to spreadsheet in seconds</ValueProp>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────── */}
      <section className="relative py-24 px-4 overflow-hidden bg-linear-to-b from-blue-700 to-blue-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,rgba(255,255,255,0.08),transparent)] pointer-events-none" />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
            Stop retyping. Start processing.
          </h2>
          <p className="text-lg text-white/70 mb-8">
            See Mailroom in action. Process your first document in under a minute.
          </p>
          <Link
            href="/pipeline"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-blue-700 hover:bg-white/90 h-12 px-8 text-base font-semibold transition-colors shadow-md"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-lg font-bold text-brand">Mailroom</span>
          <div className="text-center sm:text-right">
            <p className="text-sm text-muted-foreground">
              Document workflow automation for modern teams
            </p>
            <p className="text-xs text-muted-foreground/80">
              © {new Date().getFullYear()} Mailroom. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
