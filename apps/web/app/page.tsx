"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Boxes,
  Check,
  ChevronDown,
  Code2,
  Database,
  Headphones,
  Inbox,
  Instagram,
  Layers,
  MessagesSquare,
  Plug,
  Repeat,
  Send,
  Shield,
  Sparkles,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractiveInbox } from "@/components/landing/interactive-inbox";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 selection:bg-zinc-900 selection:text-white">
      <MarketingNav />
      <Hero />
      <PartnerBar />
      <ProblemSection />
      <SolutionSection />
      <FeaturesSection />
      <AISection />
      <IntegrationSection />
      <CoexistenceSection />
      <WhyUsSection />
      <PricingSection />
      <AboutSection />
      <FaqSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ============================== NAV ============================== */

function MarketingNav() {
  const nav = [
    { label: "Fitur", href: "#fitur" },
    { label: "Integrasi", href: "#integrasi" },
    { label: "Harga", href: "#harga" },
    { label: "Tentang", href: "#tentang" },
    { label: "Docs", href: "/dashboard/developer/api-docs" },
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950">
            <MessagesSquare className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold tracking-tight">AI Chat</span>
        </Link>
        <nav className="hidden items-center gap-1 text-sm text-zinc-600 md:flex">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-3 py-1.5 transition-colors hover:text-zinc-900"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Masuk
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="gap-1 bg-zinc-950 text-white hover:bg-zinc-800">
              Daftar
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============================= HERO ============================== */

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle dotted background pattern for texture */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_1px_1px,_theme(colors.zinc.200)_1px,_transparent_0)] bg-[size:24px_24px] opacity-50 [mask-image:radial-gradient(ellipse_at_top,_black_30%,_transparent_70%)]" />

      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1.2fr] lg:gap-8 lg:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col justify-center"
        >
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs text-zinc-600">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-900" />
            Official Meta Business Partner
          </div>

          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-[3.4rem]">
            Semua chat pelanggan.
            <br />
            <span className="text-zinc-500">Satu inbox.</span>
            <br />
            Tidak ada yang terlewat.
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-zinc-600 md:text-lg">
            WhatsApp, Instagram, dan Messenger dalam satu platform. AI menjaga
            inbox 24/7, tim Anda fokus jualan. Setup 5 menit, mulai gratis selamanya.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/register">
              <Button size="lg" className="gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800">
                Coba gratis sekarang
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <a href="#fitur">
              <Button size="lg" variant="outline" className="border-zinc-300">
                Lihat fitur
              </Button>
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-500">
            {[
              "Tanpa kartu kredit",
              "Setup < 5 menit",
              "Support lokal Indonesia",
            ].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-zinc-900" /> {t}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="relative"
        >
          <InteractiveInbox />
          <p className="mt-3 text-center text-xs text-zinc-400">
            Klik percakapan lain untuk ganti thread · pesan terketik otomatis
          </p>
        </motion.div>
      </div>
    </section>
  );
}

/* ========================= PARTNER / TRUST ======================= */

function PartnerBar() {
  const items = [
    { label: "WhatsApp Business API", sub: "Cloud · Resmi Meta" },
    { label: "Instagram Graph API", sub: "Business / Creator" },
    { label: "Messenger Platform", sub: "Page-scoped tokens" },
    { label: "Webhook + n8n", sub: "Outbound HMAC-SHA256" },
  ];
  return (
    <section className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <p className="text-center text-[11px] font-medium uppercase tracking-widest text-zinc-500">
          Powered by official APIs
        </p>
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-4">
          {items.map((i) => (
            <div key={i.label} className="bg-white px-4 py-5 text-center">
              <p className="text-sm font-semibold text-zinc-900">{i.label}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{i.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================== PROBLEM ============================= */

function ProblemSection() {
  const pains = [
    {
      n: "01",
      title: "Chat berserakan di 5 tab browser",
      desc:
        "WhatsApp Web, IG mobile, Messenger desktop — tim CS Anda terus pindah aplikasi dan kehilangan konteks pelanggan.",
    },
    {
      n: "02",
      title: "Tim CS kewalahan, respons lambat",
      desc:
        "Pelanggan mengirim pesan jam 11 malam. Besok pagi baru terjawab. Rata-rata first response time naik, conversion turun.",
    },
    {
      n: "03",
      title: "Data pelanggan tercecer",
      desc:
        "Riwayat chat di WA tidak nyambung dengan IG. Tidak tahu pelanggan ini siapa, sudah beli apa, sedang tertarik apa.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader
        eyebrow="Masalah"
        title="Chat berserakan? Tim kewalahan?"
        sub="Bisnis Anda tumbuh, channel komunikasi makin banyak — tapi tim CS Anda tidak ditambah. Hasilnya: respons lambat, pelanggan kabur."
      />
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-3">
        {pains.map((p) => (
          <div key={p.n} className="bg-white p-7">
            <span className="text-xs font-mono text-zinc-400">{p.n}</span>
            <h3 className="mt-3 text-lg font-semibold tracking-tight">{p.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* =========================== SOLUTION ============================ */

function SolutionSection() {
  const steps = [
    {
      n: "1",
      icon: Plug,
      title: "Hubungkan channel",
      desc: "WhatsApp Cloud API + IG Business + Messenger Page. Token dienkripsi AES-256.",
    },
    {
      n: "2",
      icon: Inbox,
      title: "Terima pesan real-time",
      desc: "Semua channel muncul di satu inbox dengan typing indicator + status delivered/read.",
    },
    {
      n: "3",
      icon: Bot,
      title: "Aktifkan AI chatbot",
      desc: "Upload knowledge base, atur tone, setel confidence threshold. Bot mulai jawab 24/7.",
    },
    {
      n: "4",
      icon: Workflow,
      title: "Otomasi dengan n8n",
      desc: "Webhook fire ke n8n / API Anda. Bangun workflow CRM, notifikasi, atau auto-tag.",
    },
  ];
  return (
    <section className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeader
          eyebrow="Solusi"
          title="Setup dalam 5 menit. Kerja 24 jam."
          sub="Empat langkah dari nol ke inbox terpusat dengan AI yang menjawab pelanggan saat tim Anda tidur."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.35 }}
              className="relative"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-950 text-xs font-semibold text-white">
                {s.n}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <s.icon className="h-4 w-4 text-zinc-700" />
                <h3 className="font-semibold tracking-tight">{s.title}</h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================== FEATURES ============================ */

function FeaturesSection() {
  const features = [
    {
      icon: Inbox,
      title: "Inbox terpusat",
      desc: "Semua pesan WhatsApp, Instagram, Messenger dalam satu layar realtime. Status sent/delivered/read terlihat.",
    },
    {
      icon: MessagesSquare,
      title: "WhatsApp Business API",
      desc: "Cloud API resmi Meta. Template message, interactive button, list, dan carousel — semua include.",
    },
    {
      icon: Instagram,
      title: "Instagram DM",
      desc: "Hubungkan IG Business / Creator yang ter-link ke Facebook Page. Terima DM real-time.",
    },
    {
      icon: Bot,
      title: "AI Chatbot 24/7",
      desc: "Bot menjawab pertanyaan umum berdasarkan knowledge base Anda — dengan handoff otomatis ke agent.",
    },
    {
      icon: Database,
      title: "Knowledge Base + RAG",
      desc: "Upload PDF, MD, atau artikel. AI menjawab dari konten Anda, bukan halusinasi. Audit log lengkap.",
    },
    {
      icon: Send,
      title: "Broadcast Campaign",
      desc: "Kirim ke ribuan kontak dengan rate-limit per channel + retry otomatis. Reputasi nomor terjaga.",
    },
    {
      icon: Users,
      title: "CRM Bawaan",
      desc: "Kontak, tag, segment, timeline aktivitas, import/export CSV. Tanpa integrasi pihak ketiga.",
    },
    {
      icon: Layers,
      title: "Template + Quick Reply",
      desc: "Snippet balasan via shortcut /qr, template approval workflow, interactive message builder.",
    },
    {
      icon: Code2,
      title: "API + Webhook + n8n",
      desc: "Public REST API, outbound webhook ber-HMAC, dan panduan n8n lengkap dengan sample workflow.",
    },
  ];
  return (
    <section id="fitur" className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader
        eyebrow="Fitur"
        title="Semua yang perlu untuk jualan via chat."
        sub="Tidak ada add-on. Tidak ada upsell terselubung. Setiap fitur dibangun untuk tim CS dan founder yang menjalankan bisnis nyata."
      />
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group bg-white p-6 transition-colors hover:bg-zinc-50/60"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-900 transition-colors group-hover:bg-zinc-900 group-hover:text-white">
              <f.icon className="h-[18px] w-[18px]" />
            </div>
            <h3 className="mt-4 text-base font-semibold tracking-tight">{f.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================== AI =============================== */

function AISection() {
  return (
    <section id="ai" className="bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            AI Chatbot
          </p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            AI yang benar-benar tahu produk Anda.
          </h2>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-400">
            Bukan chatbot generik. Upload knowledge base, atur tone, setel ambang
            kepercayaan. Bot menjawab berbasis fakta — kalau ragu, langsung
            diserahkan ke agent manusia. Setiap balasan tercatat.
          </p>

          <ul className="mt-8 space-y-4">
            {[
              { t: "Trained pada konten Anda", d: "Upload PDF / MD / artikel. RAG mengambil chunk relevan sebelum menjawab." },
              { t: "Confidence threshold + handoff", d: "Skor di bawah ambang? Conversation pindah ke pending, agent dapat notifikasi." },
              { t: "Provider pluggable", d: "Mock provider gratis untuk demo, OpenAI siap pakai. API key tidak pernah ke frontend." },
              { t: "Audit log lengkap", d: "Setiap balasan bot tersimpan: chunks yang dipakai, confidence, model, latency." },
            ].map((b) => (
              <li key={b.t} className="flex gap-3">
                <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-zinc-950">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <div>
                  <p className="font-medium text-zinc-100">{b.t}</p>
                  <p className="text-sm text-zinc-400">{b.d}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
        >
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-zinc-950">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Asisten AI · Toko Anda</p>
                <p className="text-xs text-zinc-500">Tone: ramah · Bahasa: ID</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full bg-white" /> approved
              </span>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-zinc-800 px-3 py-2 text-sm">
                  Berapa lama pengiriman ke Surabaya?
                </div>
              </div>
              <div className="flex">
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-zinc-900">
                  Untuk Surabaya, pengiriman reguler JNE estimasi 2–3 hari kerja
                  setelah pembayaran. Mau saya kirim opsi ekspres (1 hari) juga?
                </div>
              </div>
              <div className="ml-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">confidence 0.87</span>
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-zinc-300">gpt-4o-mini</span>
                <span className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                  ✓ matched: &quot;Pengiriman.pdf §3&quot;
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-zinc-800 pt-5">
              <StatTile label="Auto-reply" value="84%" />
              <StatTile label="Handoff rate" value="11%" />
              <StatTile label="Avg latency" value="1.2s" />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-[10px] text-zinc-500">{label}</p>
    </div>
  );
}

/* ============================ INTEGRASI ========================== */

function IntegrationSection() {
  const channels = [
    {
      icon: MessagesSquare,
      name: "WhatsApp Business API",
      desc: "Cloud API resmi Meta. Template message, button, list, dan carousel.",
    },
    {
      icon: Instagram,
      name: "Instagram DM",
      desc: "Meta Messenger Platform. IG Business / Creator yang ter-link ke FB Page.",
    },
    {
      icon: MessagesSquare,
      name: "Facebook Messenger",
      desc: "Page-scoped tokens. Subscribe webhook → langsung terima pesan.",
    },
  ];
  const benefits = [
    { icon: Inbox, t: "Satu dashboard" },
    { icon: Users, t: "Unified profile" },
    { icon: Repeat, t: "Real-time sync" },
    { icon: Shield, t: "AES-256 token" },
  ];
  return (
    <section id="integrasi" className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader
        eyebrow="Integrasi"
        title="Tiga channel. Satu pengalaman."
        sub="Hubungkan sekali, terima realtime. Setup channel pertama selesai sebelum kopi Anda dingin."
      />

      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-3">
        {channels.map((c) => (
          <div key={c.name} className="bg-white p-7">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-zinc-200 bg-white">
              <c.icon className="h-5 w-5 text-zinc-900" />
            </div>
            <h3 className="mt-4 font-semibold tracking-tight">{c.name}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{c.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 rounded-xl border border-zinc-200 bg-zinc-50 px-6 py-4">
        {benefits.map((b) => (
          <span key={b.t} className="inline-flex items-center gap-2 text-sm text-zinc-700">
            <b.icon className="h-4 w-4 text-zinc-500" />
            {b.t}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ========================== COEXISTENCE ========================== */

function CoexistenceSection() {
  const points = [
    "Satu nomor, dua akses",
    "Chat history personal tetap",
    "Transisi tanpa down-time",
    "Real-time sync dua arah",
  ];
  return (
    <section className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-900 bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
            <Sparkles className="h-3 w-3" /> Baru
          </div>
          <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
            WhatsApp Coexistence.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-zinc-600">
            Fitur terbaru dari Meta. Pakai satu nomor WhatsApp yang sama untuk
            personal dan business, tanpa kehilangan history. Transisi mulus dari
            WhatsApp Web ke Business API tanpa rewiring tim.
          </p>
          <ul className="mt-7 grid gap-2 sm:grid-cols-2">
            {points.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-zinc-700">
                <Check className="h-4 w-4 text-zinc-900" strokeWidth={3} />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual: nomor card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Nomor terhubung
          </p>
          <p className="mt-3 font-mono text-2xl font-semibold tracking-tight">
            +62 812-3456-7890
          </p>
          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-zinc-200 bg-zinc-200">
            <div className="bg-white px-3 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Personal</p>
              <p className="mt-1 text-sm font-medium">WhatsApp Web</p>
              <p className="mt-0.5 text-xs text-zinc-500">Tetap berjalan</p>
            </div>
            <div className="bg-zinc-950 px-3 py-3 text-white">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400">Bisnis</p>
              <p className="mt-1 text-sm font-medium">AI Chat (API)</p>
              <p className="mt-0.5 text-xs text-zinc-400">AI + tim CS</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============================ WHY US ============================= */

function WhyUsSection() {
  const reasons = [
    {
      icon: Boxes,
      t: "Dibuat untuk Indonesia",
      d: "Copy UI Bahasa Indonesia, integrasi Midtrans (placeholder), support pakai jam kerja WIB.",
    },
    {
      icon: Zap,
      t: "Setup < 5 menit",
      d: "Daftar → connect channel → terima pesan pertama. Tanpa rapat onboarding atau implementasi.",
    },
    {
      icon: Shield,
      t: "Aman by default",
      d: "Token channel dienkripsi AES-256-GCM. Webhook ber-HMAC-SHA256. Audit log lengkap.",
    },
    {
      icon: Headphones,
      t: "Tanpa lock-in",
      d: "Export CSV kontak + webhook event. API key milik Anda. Pindah kapan saja.",
    },
    {
      icon: Sparkles,
      t: "AI sudah include",
      d: "Tidak ada add-on terpisah. Plan Lite sudah dengan AI chatbot + knowledge base.",
    },
    {
      icon: Plug,
      t: "Developer-friendly",
      d: "Public REST API, webhook envelope ter-dokumentasi, sample n8n workflow JSON.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <SectionHeader
        eyebrow="Kenapa AI Chat"
        title="Dibangun untuk bisnis Indonesia."
        sub="Harga jujur dalam Rupiah, copy yang manusiawi, dan teknis yang tidak kompromi."
      />
      <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-zinc-200 bg-zinc-200 md:grid-cols-2 lg:grid-cols-3">
        {reasons.map((r) => (
          <div key={r.t} className="bg-white p-6">
            <r.icon className="h-5 w-5 text-zinc-900" />
            <h3 className="mt-3 font-semibold tracking-tight">{r.t}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">{r.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================ PRICING ============================ */

function PricingSection() {
  const plans = [
    {
      name: "Free",
      price: "Rp0",
      cadence: "selamanya",
      desc: "Untuk founder solo & tim kecil yang mulai jualan via chat.",
      cta: "Mulai gratis",
      ctaVariant: "outline" as const,
      features: [
        "WhatsApp · Instagram · Messenger",
        "Unlimited pesan",
        "Inbox terpusat + Quick Reply",
        "2 team members",
        "7-day message history",
      ],
    },
    {
      name: "Basic",
      price: "Rp25.000",
      cadence: "/bulan",
      desc: "Untuk bisnis berkembang yang butuh API & otomasi.",
      cta: "Pilih Basic",
      ctaVariant: "outline" as const,
      features: [
        "Semua fitur Free",
        "Public REST API access",
        "n8n integration + webhook",
        "30-day message history",
        "3 team members",
        "1 WhatsApp number",
      ],
    },
    {
      name: "Lite",
      featured: true,
      tag: "Paling populer",
      price: "Rp49.000",
      cadence: "/bulan",
      desc: "Untuk tim yang butuh AI chatbot + kolaborasi.",
      cta: "Pilih Lite",
      ctaVariant: "default" as const,
      features: [
        "Semua fitur Basic",
        "AI Chatbot 24/7",
        "5 Knowledge Documents",
        "5 team members",
        "90-day message history",
        "Media Library",
      ],
    },
  ];
  return (
    <section id="harga" className="border-y border-zinc-200 bg-zinc-50">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <SectionHeader
          eyebrow="Harga"
          title="Mulai gratis. Upgrade kapan butuh."
          sub="Tidak ada minimum commitment. Tidak ada biaya tersembunyi. Pindah plan sesuai pertumbuhan tim Anda."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`flex flex-col rounded-xl border bg-white p-7 ${
                p.featured ? "border-zinc-900 shadow-[0_0_0_1px_rgba(0,0,0,0.04)]" : "border-zinc-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700">{p.name}</p>
                {p.tag && (
                  <span className="inline-flex items-center rounded-full bg-zinc-950 px-2 py-0.5 text-[10px] font-medium text-white">
                    {p.tag}
                  </span>
                )}
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-sm text-zinc-500">{p.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-600">{p.desc}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-700">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-900" strokeWidth={2.5} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href="/register" className="mt-7">
                <Button
                  variant={p.ctaVariant}
                  className={`w-full ${
                    p.ctaVariant === "default"
                      ? "bg-zinc-950 text-white hover:bg-zinc-800"
                      : "border-zinc-300"
                  }`}
                >
                  {p.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-zinc-500">
          Semua harga dalam Rupiah · Pembayaran via Midtrans (placeholder mode di demo)
        </p>
      </div>
    </section>
  );
}

/* ============================ TENTANG ============================ */

function AboutSection() {
  return (
    <section id="tentang" className="mx-auto max-w-3xl px-6 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        Tentang
      </p>
      <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
        Misi kami sederhana.
      </h2>
      <p className="mt-5 text-lg leading-relaxed text-zinc-600">
        Bantu bisnis Indonesia berkomunikasi lebih efektif. Satu inbox untuk
        semua channel. AI yang membantu, bukan menggantikan. Harga yang jujur.
        Teknologi yang tidak kompromi.
      </p>
      <div className="mt-8 flex items-center justify-center gap-2 text-sm text-zinc-500">
        <span>Dibangun di Indonesia</span>
        <span>·</span>
        <span>Untuk bisnis Indonesia</span>
      </div>
    </section>
  );
}

/* ============================== FAQ ============================== */

function FaqSection() {
  const faqs = [
    {
      q: "Apakah pesan yang bisa dikirim unlimited?",
      a: "Ya. Semua paket — termasuk Free — tidak membatasi jumlah pesan inbound maupun outbound dari sisi platform kami. Biaya conversation tetap mengikuti tarif resmi Meta (untuk WhatsApp Business API).",
    },
    {
      q: "Apakah bisa kirim broadcast / bulk message?",
      a: "Bisa. Module Broadcast Campaign tersedia di semua paket berbayar dengan audience all/tag/segment/CSV, rate-limit per channel, dan retry otomatis untuk menjaga reputasi nomor Anda.",
    },
    {
      q: "Berapa biaya broadcast WhatsApp?",
      a: "Platform kami tidak mengenakan biaya per pesan. Biaya conversation mengikuti tarif resmi Meta yang ditagih langsung ke akun WhatsApp Business Anda.",
    },
    {
      q: "Apakah perlu nomor WhatsApp baru?",
      a: "Tidak wajib. Dengan fitur WhatsApp Coexistence dari Meta, Anda bisa pakai nomor yang sama untuk personal (WhatsApp Web) dan business (API), tanpa kehilangan chat history.",
    },
    {
      q: "Berapa lama proses setup?",
      a: "Sekitar 5 menit dari daftar sampai terima pesan pertama, asumsikan kredensial Meta App Anda sudah siap. Kami sediakan panduan setiap langkah.",
    },
    {
      q: "Apakah ada free trial?",
      a: "Plan Free berlaku selamanya — tanpa kartu kredit, tanpa expired. Mulai dari sini, upgrade saat tim butuh AI, API, atau lebih banyak seat.",
    },
  ];
  return (
    <section className="border-t border-zinc-200">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <SectionHeader
          eyebrow="FAQ"
          title="Pertanyaan yang sering ditanyakan."
          sub="Belum cukup? Hubungi tim kami — kami balas dalam jam kerja WIB."
        />
        <div className="mt-12 divide-y divide-zinc-200 border-y border-zinc-200">
          {faqs.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left">
                <span className="text-base font-medium text-zinc-900">{f.q}</span>
                <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500 transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* =========================== FINAL CTA =========================== */

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <div className="rounded-2xl border border-zinc-900 bg-zinc-950 px-8 py-16 text-center text-white md:px-16">
        <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">
          Siap menyatukan inbox Anda?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-zinc-400 md:text-lg">
          Daftar gratis dalam 60 detik. Tanpa kartu kredit. Setup channel pertama
          dalam 5 menit, lalu biarkan AI menjaga inbox 24/7.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg" className="gap-1.5 bg-white text-zinc-950 hover:bg-zinc-200">
              Mulai gratis sekarang
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-700 bg-transparent text-white hover:bg-white/10"
            >
              Masuk
            </Button>
          </Link>
        </div>
        <ul className="mt-7 flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-zinc-500">
          {[
            "Gratis tanpa kartu kredit",
            "Setup dalam 5 menit",
            "Langsung produktif",
          ].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} /> {t}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ============================= FOOTER ============================ */

function Footer() {
  return (
    <footer className="border-t border-zinc-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-5">
        <div className="md:col-span-2">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-950">
              <MessagesSquare className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-semibold tracking-tight">AI Chat</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm text-zinc-500">
            Platform omnichannel CRM yang menyatukan WhatsApp, Instagram, dan
            Messenger dalam satu dashboard. Dibangun di Indonesia, untuk bisnis
            Indonesia.
          </p>
          <div className="mt-5 flex items-center gap-3 text-xs text-zinc-500">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              AES-256 · HMAC
            </span>
            <span>·</span>
            <span>Made in Indonesia</span>
          </div>
        </div>

        <FooterCol
          title="Produk"
          links={[
            { label: "Fitur", href: "#fitur" },
            { label: "Integrasi", href: "#integrasi" },
            { label: "AI Chatbot", href: "#ai" },
            { label: "Harga", href: "#harga" },
          ]}
        />
        <FooterCol
          title="Developer"
          links={[
            { label: "API Docs", href: "/dashboard/developer/api-docs", external: true },
            { label: "Webhooks", href: "/dashboard/developer/webhooks", external: true },
            { label: "n8n Integration", href: "/dashboard/developer/n8n", external: true },
          ]}
        />
        <FooterCol
          title="Akun"
          links={[
            { label: "Masuk", href: "/login" },
            { label: "Daftar", href: "/register" },
            { label: "Tentang", href: "#tentang" },
            { label: "FAQ", href: "#faq" },
          ]}
        />
      </div>
      <div className="border-t border-zinc-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-5 text-xs text-zinc-500">
          <p>© {new Date().getFullYear()} AI Chat. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-zinc-900">Privacy</a>
            <a href="#" className="hover:text-zinc-900">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string; external?: boolean }[];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-zinc-700">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex items-center gap-1 hover:text-zinc-900"
            >
              {l.label}
              {l.external && <ArrowUpRight className="h-3 w-3 text-zinc-400" />}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ============================ helpers ============================ */

function SectionHeader({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-semibold leading-[1.15] tracking-tight md:text-4xl">
        {title}
      </h2>
      <p className="mt-4 text-base leading-relaxed text-zinc-600">{sub}</p>
    </div>
  );
}
