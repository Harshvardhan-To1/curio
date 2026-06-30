'use client';

import { useState } from 'react';
import {
  ArrowRight,
  Bot,
  ChevronDown,
  Cpu,
  FileText,
  Github,
  Globe,
  GraduationCap,
  Headset,
  Layers,
  Link2,
  Lock,
  Mail,
  MessageSquareText,
  Quote,
  ShieldCheck,
  Sparkles,
  Twitter,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { Logo } from './logo';
import { UrlForm } from './url-form';
import { SavedSessions } from './session-bar';
import { CapabilityWarning } from './capability-gate';

/* ──────────────────────────────────────────────────────────────────────────
 * Edit CONTACT to point at your real product contact details.
 * ──────────────────────────────────────────────────────────────────────── */
const CONTACT = {
  email: 'hello@curio.app',
  github: 'https://github.com/curio-ai/curio',
  twitter: 'https://twitter.com/curio_ai',
};

export function Landing() {
  const { degraded, capabilities } = useStore();
  const [warningDismissed, setWarningDismissed] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />

      {/* HERO ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <Backdrop />
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-14 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <a
              href="#how"
              className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur transition hover:border-brand/40"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand" />
              Agentic RAG that runs in your browser
              <ChevronDown className="h-3.5 w-3.5" />
            </a>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
              Turn any website into a{' '}
              <span className="bg-gradient-to-r from-brand to-[#ffb892] bg-clip-text text-transparent">
                private AI
              </span>{' '}
              you can chat with
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg text-muted">
              Paste a URL. Curio crawls it, builds a knowledge base, and answers
              your questions with citations — and the language model runs{' '}
              <strong className="text-fg">entirely in your browser</strong>.
              Nothing you ask ever leaves your device.
            </p>
          </div>

          <div className="mx-auto mt-9 max-w-2xl">
            {degraded && !warningDismissed && capabilities && (
              <div className="mb-5">
                <CapabilityWarning
                  caps={capabilities}
                  onContinue={() => setWarningDismissed(true)}
                />
              </div>
            )}
            <UrlForm />
            <TrustRow />
          </div>

          <div className="mx-auto mt-10 max-w-2xl">
            <SavedSessions />
          </div>
        </div>
      </section>

      <HowItWorks />
      <Features />
      <PrivacySpotlight />
      <UseCases />
      <Comparison />
      <Faq />
      <CtaBand />
      <Footer />
    </div>
  );
}

/* ── Nav ──────────────────────────────────────────────────────────────── */
function Nav() {
  const links = [
    ['How it works', '#how'],
    ['Features', '#features'],
    ['Use cases', '#use-cases'],
    ['FAQ', '#faq'],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex">
          {links.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="text-sm text-muted transition hover:text-fg"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <a
            href={CONTACT.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden text-muted transition hover:text-fg sm:block"
            aria-label="GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: 'smooth' });
              document.querySelector<HTMLInputElement>('input[inputmode="url"]')?.focus();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-fg shadow-sm transition hover:bg-brand-muted"
          >
            Try it free <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

function Backdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
      <div className="absolute left-1/2 top-[-10%] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-brand/25 via-[#ff9a6b]/10 to-transparent blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.5]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, rgb(255 255 255 / 0.05) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
    </div>
  );
}

function TrustRow() {
  const items = [
    [<ShieldCheck key="a" className="h-4 w-4" />, 'No sign-up'],
    [<Lock key="b" className="h-4 w-4" />, 'On-device generation'],
    [<Globe key="c" className="h-4 w-4" />, 'Robots-respecting'],
    [<Zap key="d" className="h-4 w-4" />, 'WebGPU accelerated'],
  ] as const;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted">
      {items.map(([icon, label]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="text-brand">{icon}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

/* ── How it works ─────────────────────────────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      icon: <Globe className="h-5 w-5" />,
      title: 'Paste a URL',
      body: 'We crawl and clean the site server-side — robots-aware, sitemap-first, boilerplate stripped into tidy Markdown.',
    },
    {
      icon: <Cpu className="h-5 w-5" />,
      title: 'Your browser indexes it',
      body: 'Embeddings and the language model load on your device via WebGPU. The corpus is cached so revisits are instant.',
    },
    {
      icon: <MessageSquareText className="h-5 w-5" />,
      title: 'Chat with citations',
      body: 'An agent retrieves the right passages and answers — grounded, streamed, and linked back to the source pages.',
    },
  ];
  return (
    <Section id="how" eyebrow="How it works" title="From URL to answers in three steps">
      <div className="relative grid gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <div
            key={s.title}
            className="relative rounded-2xl border border-line bg-surface p-6 shadow-sm"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              {s.icon}
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">
              Step {i + 1}
            </div>
            <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Features ─────────────────────────────────────────────────────────── */
function Features() {
  const features = [
    {
      icon: <Cpu className="h-5 w-5" />,
      title: 'In-browser LLM',
      body: 'Generation runs on WebGPU via WebLLM. Your prompts never hit a server — true on-device privacy, zero inference cost.',
    },
    {
      icon: <Bot className="h-5 w-5" />,
      title: 'Agentic retrieval',
      body: 'A constrained ReAct agent decides when to search, look up an exact term, read a page, or crawl one more — then answers.',
    },
    {
      icon: <Link2 className="h-5 w-5" />,
      title: 'Always cited',
      body: 'Every answer links the exact source pages it used, so you can verify in one click. No hand-wavy hallucinations.',
    },
    {
      icon: <Lock className="h-5 w-5" />,
      title: 'Private by design',
      body: 'The model, your questions, and the answers stay on your machine. The only server step is crawling public pages.',
    },
    {
      icon: <WifiOff className="h-5 w-5" />,
      title: 'Works offline',
      body: 'Indexed sites and the model are cached in your browser. Reopen a knowledge base later with no network at all.',
    },
    {
      icon: <Layers className="h-5 w-5" />,
      title: 'Pick your model',
      body: 'Trade speed for quality — Llama 3.2 1B/3B, Phi-3.5, Qwen 2.5. Switch any time; downloads are cached.',
    },
  ];
  return (
    <Section
      id="features"
      eyebrow="Features"
      title="Everything you need to chat with a site — privately"
      subtitle="Built on a hybrid architecture: heavy crawling on the server, private inference on your device."
      tinted
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-line bg-surface p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand transition group-hover:bg-brand group-hover:text-brand-fg">
              {f.icon}
            </div>
            <h3 className="mb-1.5 font-semibold">{f.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Privacy spotlight ────────────────────────────────────────────────── */
function PrivacySpotlight() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16">
      <div className="relative overflow-hidden rounded-3xl bg-[#0f1115] px-6 py-12 text-white sm:px-12">
        <div className="pointer-events-none absolute right-0 top-0 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative grid items-center gap-10 md:grid-cols-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-surface/10 px-3 py-1 text-xs font-medium">
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy is the product
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Your questions never leave your device
            </h2>
            <p className="mt-4 text-neutral-300">
              Most “chat with your site” tools pipe every message to a cloud LLM.
              Curio flips that: the model is downloaded once and runs locally on
              your GPU. We literally cannot see your conversations — there’s no
              inference server to log them.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                'Zero generation tokens sent to any server',
                'Corpus and vectors stored only in your browser',
                'Open, auditable hybrid architecture',
              ].map((t) => (
                <li key={t} className="flex items-center gap-2 text-neutral-200">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-brand/20 text-brand">
                    <ShieldCheck className="h-3 w-3" />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              ['100%', 'on-device answers'],
              ['0', 'servers see your chats'],
              ['∞', 'sessions cached offline'],
              ['4+', 'on-device models'],
              ['1-click', 'source citations'],
              ['robots', 'aware crawler'],
            ].map(([big, small]) => (
              <div
                key={small}
                className="rounded-2xl border border-white/10 bg-surface/5 p-4"
              >
                <div className="text-2xl font-bold text-white">{big}</div>
                <div className="mt-1 text-[11px] uppercase tracking-wide text-muted">
                  {small}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Use cases ────────────────────────────────────────────────────────── */
function UseCases() {
  const cases = [
    {
      icon: <FileText className="h-5 w-5" />,
      title: 'Documentation Q&A',
      body: 'Drop in your docs site and let users ask in plain language instead of grepping pages.',
    },
    {
      icon: <Headset className="h-5 w-5" />,
      title: 'Support deflection',
      body: 'Answer “how do I…” from your help center, with links to the exact article.',
    },
    {
      icon: <GraduationCap className="h-5 w-5" />,
      title: 'Research & analysis',
      body: 'Index a competitor or a knowledge base and interrogate it privately.',
    },
    {
      icon: <Globe className="h-5 w-5" />,
      title: 'Internal wikis',
      body: 'Make a sprawling intranet searchable and conversational — without shipping data to a vendor.',
    },
  ];
  return (
    <Section
      id="use-cases"
      eyebrow="Use cases"
      title="One paste away from a useful assistant"
      tinted
    >
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {cases.map((c) => (
          <div
            key={c.title}
            className="rounded-2xl border border-line bg-surface p-6 shadow-sm"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              {c.icon}
            </div>
            <h3 className="mb-1.5 font-semibold">{c.title}</h3>
            <p className="text-sm leading-relaxed text-muted">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── Comparison ───────────────────────────────────────────────────────── */
function Comparison() {
  const rows: [string, string, boolean][] = [
    ['Generation runs on your device', 'Sends every prompt to a cloud LLM', true],
    ['No API keys, no per-token billing', 'Pay per token, forever', true],
    ['Answers cite the exact source pages', 'Often unsourced', true],
    ['Works offline after first index', 'Always needs the network', true],
    ['Respects robots.txt by default', 'Varies', true],
  ];
  return (
    <Section
      eyebrow="Why Curio"
      title="A different deal than cloud RAG tools"
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
        <div className="grid grid-cols-[1.4fr_1fr] border-b border-line bg-elevated text-sm font-semibold sm:grid-cols-[1.6fr_1fr]">
          <div className="px-5 py-3 text-brand">Curio</div>
          <div className="px-5 py-3 text-muted">Typical cloud RAG</div>
        </div>
        {rows.map(([a, b]) => (
          <div
            key={a}
            className="grid grid-cols-[1.4fr_1fr] border-b border-line text-sm last:border-0 sm:grid-cols-[1.6fr_1fr]"
          >
            <div className="flex items-center gap-2 px-5 py-3.5">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
              <span className="text-fg">{a}</span>
            </div>
            <div className="flex items-center px-5 py-3.5 text-muted">
              {b}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */
function Faq() {
  const faqs = [
    {
      q: 'Is my data really private?',
      a: 'Yes. The language model is downloaded to your browser and runs on your GPU, so your questions and the generated answers never reach a server. The only server-side step is crawling the public pages of the URL you submit.',
    },
    {
      q: 'Which browsers are supported?',
      a: 'A recent desktop Chrome or Edge (113+) with WebGPU. Without WebGPU the app still works in a retrieval-only mode that shows the most relevant passages with citations.',
    },
    {
      q: 'How large a site can it handle?',
      a: 'In-browser vector search is comfortable up to a few thousand chunks. For bigger sites you can cap the crawl, or run the backend in fat-server mode where embeddings are precomputed.',
    },
    {
      q: 'Does it respect robots.txt?',
      a: 'Always. The crawler honors robots rules and crawl-delay, discovers sitemaps, throttles politely, and identifies itself with a clear user agent.',
    },
    {
      q: 'Can I put this on my own website?',
      a: 'Yes — an embeddable chat widget lets you drop a corner bubble onto your site that chats with your pre-indexed content. Get in touch and we’ll set you up.',
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" eyebrow="FAQ" title="Questions, answered">
      <div className="mx-auto max-w-3xl divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {faqs.map((f, i) => (
          <div key={f.q}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="font-medium text-fg">{f.q}</span>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-muted transition-transform ${
                  open === i ? 'rotate-180' : ''
                }`}
              />
            </button>
            {open === i && (
              <p className="px-5 pb-5 text-sm leading-relaxed text-muted">
                {f.a}
              </p>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

/* ── CTA band ─────────────────────────────────────────────────────────── */
function CtaBand() {
  return (
    <section className="mx-auto max-w-6xl px-4 pb-4">
      <div className="relative overflow-hidden rounded-3xl border border-line bg-surface px-6 py-12 text-center sm:py-16">
        <div className="pointer-events-none absolute left-1/2 top-0 h-48 w-[600px] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
        <div className="relative">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to chat with your site?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            No account, no setup. Paste a URL and start asking — privately.
          </p>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: 'smooth' });
              setTimeout(
                () =>
                  document
                    .querySelector<HTMLInputElement>('input[inputmode="url"]')
                    ?.focus(),
                350,
              );
            }}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-brand px-6 py-3 font-semibold text-brand-fg shadow-sm transition hover:bg-brand-muted"
          >
            Try Curio free <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ───────────────────────────────────────────────────────────── */
function Footer() {
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: 'Product',
      links: [
        ['How it works', '#how'],
        ['Features', '#features'],
        ['Use cases', '#use-cases'],
        ['FAQ', '#faq'],
      ],
    },
    {
      title: 'Resources',
      links: [
        ['Documentation', CONTACT.github],
        ['GitHub', CONTACT.github],
        ['Privacy', '#'],
        ['Terms', '#'],
      ],
    },
  ];
  return (
    <footer className="mt-8 border-t border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1.2fr]">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-sm text-muted">
              Chat with any website, privately. The language model runs in your
              browser — your questions stay yours.
            </p>
            <div className="mt-4 flex gap-3">
              <a
                href={CONTACT.github}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-fg"
              >
                <Github className="h-4 w-4" />
              </a>
              <a
                href={CONTACT.twitter}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Twitter"
                className="grid h-9 w-9 place-items-center rounded-lg border border-line text-muted transition hover:text-fg"
              >
                <Twitter className="h-4 w-4" />
              </a>
            </div>
          </div>

          {cols.map((c) => (
            <div key={c.title}>
              <div className="mb-3 text-sm font-semibold text-fg">
                {c.title}
              </div>
              <ul className="space-y-2 text-sm">
                {c.links.map(([label, href]) => (
                  <li key={label}>
                    <a
                      href={href}
                      className="text-muted transition hover:text-fg"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Contact */}
          <div id="contact">
            <div className="mb-3 text-sm font-semibold text-fg">
              Get in touch
            </div>
            <p className="mb-3 text-sm text-muted">
              Questions, demos, or the embeddable widget for your site? We’d love
              to hear from you.
            </p>
            <a
              href={`mailto:${CONTACT.email}`}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-brand-fg transition hover:bg-brand-muted"
            >
              <Mail className="h-4 w-4" /> {CONTACT.email}
            </a>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-xs text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Curio. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            <Quote className="h-3.5 w-3.5" />
            On-device AI · WebGPU · Privacy-first
          </span>
        </div>
      </div>
    </footer>
  );
}

/* ── Section shell ────────────────────────────────────────────────────── */
function Section({
  id,
  eyebrow,
  title,
  subtitle,
  tinted,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={tinted ? 'border-y border-line/60 bg-surface/40' : ''}
    >
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-brand">
            {eyebrow}
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {title}
          </h2>
          {subtitle && (
            <p className="mx-auto mt-3 max-w-xl text-muted">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
