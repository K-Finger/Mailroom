"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Sparkles, Download, Check, X, GitBranch, Zap, Bookmark, BookOpen } from "lucide-react";
import { HeroBg } from "@/components/HeroBg";

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


export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── HERO (blue) ─────────────────────────────────── */}
      <section className="relative bg-gradient-to-b from-blue-800 via-blue-600 to-blue-500 overflow-hidden pb-0">
        {/* subtle radial glow */}
        {/* <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.12),transparent)] pointer-events-none" /> */}

        <div className="absolute inset-0 overflow-hidden opacity-25">
        {/* Grid pattern */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)
            `,
              backgroundSize: "40px 40px",
            }}
          ></div>

          {/* Mathematical symbols */}
          <div className="absolute top-20 left-10 text-6xl font-mono text-white opacity-70">
            ∑
          </div>
          <div className="absolute top-40 right-20 text-5xl font-mono text-white opacity-60">
            ∫
          </div>
          <div className="absolute bottom-40 left-20 text-4xl font-mono text-white opacity-65">
            π
          </div>
          <div className="absolute top-60 right-40 text-5xl font-mono text-white opacity-60">
            ≈
          </div>
          <div className="absolute bottom-60 right-60 text-4xl font-mono text-white opacity-70">
            ∞
          </div>

          {/* Data points and connections */}
          <svg className="absolute inset-0 w-full h-full"><circle></circle><circle></circle><circle></circle><circle></circle><circle></circle><circle></circle><circle></circle><line></line><circle
              cx="15%"
              cy="25%"
              r="3"
              fill="white"
              opacity="0.7"
            /><circle></circle><circle></circle><line></line><line></line><circle
              cx="25%"
              cy="35%"
              r="3"
              fill="white"
              opacity="0.7"
            /><circle></circle><line></line><line></line><circle></circle><circle
              cx="35%"
              cy="28%"
              r="3"
              fill="white"
              opacity="0.7"
            /><circle></circle><line></line><circle></circle><circle></circle><line
              x1="15%"
              y1="25%"
              x2="25%"
              y2="35%"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            /><line></line><circle></circle><circle></circle><line></line><line
              x1="25%"
              y1="35%"
              x2="35%"
              y2="28%"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            /><line></line><circle></circle><line></line><circle
              cx="70%"
              cy="30%"
              r="3"
              fill="white"
              opacity="0.7"
            /><circle></circle><circle
              cx="80%"
              cy="40%"
              r="3"
              fill="white"
              opacity="0.7"
            /><line></line><circle
              cx="85%"
              cy="25%"
              r="3"
              fill="white"
              opacity="0.7"
            /><line></line><line
              x1="70%"
              y1="30%"
              x2="80%"
              y2="40%"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            /><line
              x1="80%"
              y1="40%"
              x2="85%"
              y2="25%"
              stroke="white"
              strokeWidth="1"
              opacity="0.5"
            /></svg>

          {/* Binary numbers */}
          <div className="absolute top-10 right-10 text-xs font-mono text-white opacity-40">
            01001001 10101010 11010011
          </div>
          <div className="absolute bottom-20 left-40 text-xs font-mono text-white opacity-40">
            11100101 00110101 10010110
          </div>

          {/* Matrix notation */}
          <div className="absolute top-1/3 left-5 font-mono text-white opacity-40 text-sm">
            [x₁ x₂ x₃]
          </div>
          <div className="absolute bottom-1/3 right-10 font-mono text-white opacity-40 text-sm">
            ∂f/∂x
          </div>
        </div>

        {/* Navbar */}
        <nav className="fixed top-4 left-0 right-0 z-50 flex items-center justify-center px-6">
          <div className="relative flex items-center bg-white rounded-full px-4 py-2.5 shadow-lg w-full max-w-5xl border border-blue-600">
            {/* Logo - left */}
            <a href="#hero" className="flex items-center gap-2 pl-1 shrink-0">
              <Image src="/logo.svg" alt="" width={20} height={16} className="h-5 w-auto shrink-0" />
              <span className="text-xl font-bold text-blue-700 tracking-tight">Mailroom</span>
            </a>
            {/* Nav links - absolutely centered */}
            <div className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center gap-1">
              {[["How it works", "how-it-works"], ["Demo", "how-it-works"], ["Features", "features"]].map(([label, id]) => (
                <a
                  key={label}
                  href={`#${id}`}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-full hover:bg-gray-100"
                >
                  {label}
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
                href="/login"
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
            Upload documents, extract the data that matters, validate it automatically, and export to spreadsheets. In seconds, not hours.
          </p>
          <div className="flex items-center justify-center">
            <Link
              href="/pipeline"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-blue-700 hover:bg-white/90 h-12 px-8 text-base font-semibold transition-colors shadow-md"
            >
              Try it out
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* App preview — sits at bottom of hero, slightly overlapping next section */}
        <div className="relative z-10 px-4 md:px-8 pb-0">
          <AppPreview />
          <div className="pointer-events-none absolute inset-0 mt-95 bg-linear-to-b from-transparent to-white" />
          <div className="pointer-events-none absolute inset-0 mt-105 bg-linear-to-b from-transparent to-white" />
        </div>
      </section>

      {/* ── PROBLEM ────────────────────────────────────── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-6">
            Manual document work is still <span className="text-brand">everywhere</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Teams still open PDFs, hunt for fields, fix formatting, and enter data by hand. Hours lost every week to repetitive work that should be automated.
          </p>
        </div>

        {/* Scrolling pill tags */}
        <div className="relative mt-10 overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-linear-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-linear-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex gap-3 animate-scroll-x w-max">
            {[
              "Invoice Data Capture", "Data Entry", "Purchase Order Processing",
              "Contract Review", "Expense Report Parsing", "Resume Screening",
              "Medical Records Extraction", "Bank Statement Analysis", "Tax Form Processing",
              "Shipping Label Reading", "Quote Comparison", "Compliance Checks",
              "Invoice Data Capture", "Data Entry", "Purchase Order Processing",
              "Contract Review", "Expense Report Parsing", "Resume Screening",
              "Medical Records Extraction", "Bank Statement Analysis", "Tax Form Processing",
              "Shipping Label Reading", "Quote Comparison", "Compliance Checks",
            ].map((label, i) => (
              <span
                key={i}
                className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 whitespace-nowrap"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── USE CASE SPOTLIGHT ─────────────────────────── */}
      <section className="px-8 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand/10 border border-brand/20 text-brand text-sm font-medium mb-4">
          Use case spotlight
        </div>
            <h2
              className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              From PDF to Structured Data in Seconds
            </h2>
            <p
              className="text-gray-600 text-lg"
              style={{ fontFamily: "Outfit, sans-serif" }}
            >
              Let AI Extraction tools automatically convert PDF data into spreadsheets
            </p>
          </div>

          <div className="grid items-center gap-6" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            {/* Multiple PDF Invoices Stacked */}
            <div className="flex justify-end pr-10">
            <div className="relative shrink-0" style={{ width: '384px', height: '420px' }}>
                {/* Invoice 2 (left/back) - INV-10013 */}
                <div className="absolute inset-0 w-96 z-10" style={{ transform: 'translate(-18px, 14px) rotate(-2deg)' }}>
                  <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 text-xs">
                    {/* Header */}
                    <div className="flex justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>INVOICE</h3>
                        <div className="text-[10px] text-gray-400" style={{ fontFamily: "Outfit, sans-serif" }}>Acme Corp · 2021</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>ACME CORP</div>
                        <div className="text-gray-600 text-[10px] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                          1234 Business Ave<br />
                          San Francisco, CA<br />
                          94102<br />
                          United States<br />
                          1-888-555-0123
                        </div>
                      </div>
                    </div>

                    {/* Billed To and Invoice Details */}
                    <div className="flex justify-between mb-6 pb-4 border-b border-gray-200">
                      <div>
                        <div className="text-blue-600 font-semibold mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Billed To</div>
                        <div className="text-gray-700" style={{ fontFamily: "Outfit, sans-serif" }}>
                          Tech Solutions Inc<br />
                          5678 Client Street<br />
                          Austin, TX<br />
                          78701
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <span className="text-blue-600 font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>Date Issued</span>
                          <span className="font-mono">15/3/2021</span>
                          <span className="text-blue-600 font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>Invoice Number</span>
                          <span className="font-mono">INV-10013</span>
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-4">
                      <div className="border-b-2 border-blue-600 pb-1 mb-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-blue-600" style={{ fontFamily: "Outfit, sans-serif" }}>
                          <div className="col-span-7">DESCRIPTION</div>
                          <div className="col-span-5 text-right">AMOUNT</div>
                        </div>
                      </div>

                      <div className="space-y-2 text-[10px]">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>Mechanical Keyboard</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$159.99</div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>Noise-Cancelling Headphones</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$299.00</div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>4K Webcam</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$179.99</div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>USB Hub</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$39.99</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[9px] text-gray-400 text-center" style={{ fontFamily: "Outfit, sans-serif" }}>
                      PDF Document
                    </div>
                  </div>
                </div>

                {/* Invoice 1 (right/front) - INV-10012 - Fully visible */}
                <div className="absolute inset-0 w-96 z-20">
                  <div className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 text-xs">
                    {/* Header */}
                    <div className="flex justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>INVOICE</h3>
                        <div className="text-[10px] text-gray-400" style={{ fontFamily: "Outfit, sans-serif" }}>Acme Corp · 2021</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm" style={{ fontFamily: "Outfit, sans-serif" }}>ACME CORP</div>
                        <div className="text-gray-600 text-[10px] mt-1" style={{ fontFamily: "Outfit, sans-serif" }}>
                          1234 Business Ave<br />
                          San Francisco, CA<br />
                          94102<br />
                          United States<br />
                          1-888-555-0123
                        </div>
                      </div>
                    </div>

                    {/* Billed To and Invoice Details */}
                    <div className="flex justify-between mb-6 pb-4 border-b border-gray-200">
                      <div>
                        <div className="text-blue-600 font-semibold mb-1" style={{ fontFamily: "Outfit, sans-serif" }}>Billed To</div>
                        <div className="text-gray-700" style={{ fontFamily: "Outfit, sans-serif" }}>
                          Tech Solutions Inc<br />
                          5678 Client Street<br />
                          Austin, TX<br />
                          78701
                        </div>
                      </div>
                      <div className="text-right space-y-2">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <span className="text-blue-600 font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>Date Issued</span>
                          <span className="font-mono">26/3/2021</span>
                          <span className="text-blue-600 font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>Invoice Number</span>
                          <span className="font-mono">INV-10012</span>
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <div className="mb-4">
                      <div className="border-b-2 border-blue-600 pb-1 mb-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-blue-600" style={{ fontFamily: "Outfit, sans-serif" }}>
                          <div className="col-span-7">DESCRIPTION</div>
                          <div className="col-span-5 text-right">AMOUNT</div>
                        </div>
                      </div>

                      <div className="space-y-2 text-[10px]">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>Laptop Computer</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$1,299.00</div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>Wireless Mouse</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$49.98</div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>USB-C Cables</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$29.97</div>
                        </div>

                        <div className="grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-7">
                            <div className="font-semibold text-gray-800" style={{ fontFamily: "Outfit, sans-serif" }}>Monitor Stand</div>
                          </div>
                          <div className="col-span-5 text-right font-mono font-semibold">$89.00</div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 text-[9px] text-gray-400 text-center" style={{ fontFamily: "Outfit, sans-serif" }}>
                      PDF Document
                    </div>
                  </div>
                </div>
            </div>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="text-blue-600 font-medium text-sm px-4 py-2 rounded-lg bg-blue-50 border border-blue-300" style={{ fontFamily: "Outfit, sans-serif" }}>
                AI Extract →
              </div>
              <div className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>
                2 PDFs
              </div>
            </div>

            {/* Excel Sheet Mockup */}
            <div className="min-w-0 pl-10">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
                <div className="bg-green-600 text-white px-4 py-2 flex items-center gap-2">
                  <div className="w-5 h-5 bg-white/20 rounded"></div>
                  <span className="text-sm font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>invoice_data.xlsx</span>
                </div>

                <div className="overflow-x-auto bg-gray-50">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      {/* Column Letters */}
                      <tr className="bg-gray-200">
                        <th className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}></th>
                        <th className="px-3 py-1 text-center text-xs font-semibold text-gray-600 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>A</th>
                        <th className="px-3 py-1 text-center text-xs font-semibold text-gray-600 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>B</th>
                        <th className="px-3 py-1 text-center text-xs font-semibold text-gray-600 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>C</th>
                        <th className="px-3 py-1 text-center text-xs font-semibold text-gray-600 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>D</th>
                      </tr>
                      {/* Header Row */}
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>1</td>
                        <th className="px-3 py-2 text-left font-semibold text-gray-800 bg-blue-50 border border-gray-300 cursor-pointer hover:bg-blue-100 active:bg-blue-200 w-32" style={{ fontFamily: "JetBrains Mono, monospace" }}>Product</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-800 bg-blue-50 border border-gray-300 cursor-pointer hover:bg-blue-100 active:bg-blue-200" style={{ fontFamily: "JetBrains Mono, monospace" }}>Price</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-800 bg-blue-50 border border-gray-300 cursor-pointer hover:bg-blue-100 active:bg-blue-200" style={{ fontFamily: "JetBrains Mono, monospace" }}>Invoice#</th>
                        <th className="px-3 py-2 text-left font-semibold text-gray-800 bg-blue-50 border border-gray-300 cursor-pointer hover:bg-blue-100 active:bg-blue-200" style={{ fontFamily: "JetBrains Mono, monospace" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Items from Invoice INV-10012 */}
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>2</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>Laptop Computer</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$1,299.00</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10012</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">26/3/2021</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>3</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>Wireless Mouse</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$49.98</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10012</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">26/3/2021</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>4</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>USB-C Cables</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$29.97</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10012</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">26/3/2021</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>5</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>Monitor Stand</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$89.00</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10012</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">26/3/2021</td>
                      </tr>

                      {/* Items from Invoice INV-10013 */}
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>6</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>Mechanical Keyboard</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$159.99</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10013</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">15/3/2021</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>7</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>Noise-Cancelling Headphones</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$299.00</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10013</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">15/3/2021</td>
                      </tr>
                      <tr className="bg-white">
                        <td className="w-10 px-2 py-1 text-center text-xs font-semibold text-gray-600 bg-gray-200 border border-gray-300" style={{ fontFamily: "JetBrains Mono, monospace" }}>8</td>
                        <td className="px-3 py-2 border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>4K Webcam</td>
                        <td className="px-3 py-2 font-mono border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">$179.99</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">INV-10013</td>
                        <td className="px-3 py-2 font-mono text-sm border border-gray-300 cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors">15/3/2021</td>
                      </tr>

                    </tbody>
                  </table>
                </div>

                <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 flex justify-between items-center">
                  <span className="text-xs text-gray-500" style={{ fontFamily: "Outfit, sans-serif" }}>7 rows extracted from 2 invoices</span>
                  <span className="text-xs text-green-600 font-semibold" style={{ fontFamily: "Outfit, sans-serif" }}>✓ Ready to export</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-4 bg-accent/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4"><span className="text-brand">Mailroom</span> in action</h2>
            <p className="text-lg text-muted-foreground">Customize workflows to upload documents from Google Drive or email, run an AI extract step to pull structured fields, validate the results, then download as XLSX or push directly to Google Sheets.</p>
          </div>
          <video
            src="https://ubbyekwquutsslqqnpkg.supabase.co/storage/v1/object/public/public-assets/demo.mp4"
            autoPlay
            muted
            loop
            playsInline
            className="w-full mx-auto rounded-2xl shadow-2xl"
          />
        </div>
      </section>

      {/* ── COMPARISON TABLE ───────────────────────────── */}
      <section id="pricing" className="py-20 px-4 bg-accent/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Why <span className="text-brand">Mailroom</span>?</h2>
            <p className="text-lg text-muted-foreground">Built specifically for document workflows, not generic automation</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-3xl border-collapse justify-center mx-auto">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-4 px-4 text-left text-sm font-semibold">Feature</th>
                  <th className="py-4 px-4 text-center">
                    <span className="inline-flex items-center gap-1.5 px-1 py-1 rounded-full bg-brand/10 text-brand text-sm font-semibold">
                      Mailroom
                    </span>
                  </th>
                  <th className="py-4 px-5 text-center text-sm font-semibold text-muted-foreground">n8n</th>
                  <th className="py-4 px-1 text-center text-sm font-semibold text-muted-foreground">Zapier</th>
                  <th className="py-4 px-1 text-center text-sm font-semibold text-muted-foreground">OCR Tools</th>
                  <th className="py-4 px-1 text-center text-sm font-semibold text-muted-foreground">Manual</th>
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
      <section id="features" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Everything you need</h2>
            <p className="text-lg text-muted-foreground">Powerful features for document automation</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard icon={Sparkles} title="AI Extraction" description="Intelligent field extraction powered by AI. Understands full file contexts and messy data." />
            <FeatureCard icon={GitBranch} title="Customizable Workflows" description="Develop custom pipelines for any document workflow you encounter." />
            <FeatureCard icon={Zap} title="End-to-End" description="Set up listeners in email and Google Drive to automatically capture relevant data." />
            <FeatureCard icon={Download} title="Flexible Export" description="Download as XLSX, CSV, or push directly to Google Sheets. Your data, your format." />
            <FeatureCard icon={BookOpen} title="Create Templates" description="Build reusable extraction templates that define exactly which fields to pull from any document type." />
            <FeatureCard icon={Bookmark} title="Save Pipelines" description="Save pipelines to your account for reuse across any document workflow." />
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF LOGOS ─────────────────────────── */}
      <section className="py-16 border-y border-border/50 overflow-hidden">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-widest mb-10 text-center px-4">
          Used by teams at
        </p>
        <div className="relative">
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-linear-to-r from-white to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-linear-to-l from-white to-transparent z-10 pointer-events-none" />
          <div className="flex items-center animate-scroll-x" style={{ width: "max-content" }}>
            {[...Array(8)].flatMap((_, d) =>
              [
                { name: "Lotus", src: "/Companies/lotus.png" },
                { name: "OTO", src: "/Companies/oto.png" },
                { name: "UMN", src: "/Companies/umn.png" },
                { name: "Images", src: "/Companies/images.jpg" },
              ].map(({ name, src }) => (
                <div key={`${d}-${name}`} className="mx-10 shrink-0">
                  <Image src={src} alt={name} width={120} height={40} className="h-10 w-auto object-contain opacity-50 grayscale hover:opacity-80 hover:grayscale-0 transition-all" />
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────── */}
      <section className="relative py-24 px-4 overflow-hidden bg-blue-800">
        <HeroBg />
        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-white">
            Get Started Now
          </h2>
          <p className="text-lg text-white/70 mb-8">
            Sign in and start processing documents for pennies each. No subscription, no commitment.
          </p>
          <Link
            href="/pipeline"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-white text-blue-700 hover:bg-white/90 h-12 px-8 text-base font-semibold transition-colors shadow-md"
          >
            Try it out
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
