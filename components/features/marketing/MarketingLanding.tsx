import React from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  EyeOff,
  Flag,
  Link2,
  Lock,
  MessageCircle,
  MessagesSquare,
  PenLine,
  Share2,
  Sparkles,
  Ticket,
  Timer,
  UserX,
} from 'lucide-react';

const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '') || '';
const linkHost = 'app.whisprspace.com';
const appHref = (path: string, params?: Record<string, string>) =>
  `${appBaseUrl}${path}${params ? `?${new URLSearchParams(params).toString()}` : ''}`;

const links = {
  signIn: appHref('/auth', { view: 'login' }),
  getStarted: appHref('/auth', { force: '1', view: 'signup' }),
  inbox: appHref('/auth', { force: '1', view: 'signup', reason: 'inbox', redirect: '/inbox' }),
  ask: appHref('/auth', { force: '1', view: 'signup', reason: 'prompt', redirect: '/curiosity-ask/create' }),
  startDiscussion: appHref('/auth', { force: '1', view: 'signup', redirect: '/discussions/create' }),
  paidDiscussion: appHref('/auth', { force: '1', view: 'signup', redirect: '/discussions/create' }),
  tellStory: appHref('/stories/new'),
  premium: appHref('/auth', { force: '1', view: 'signup', redirect: '/profile' }),
};

interface MarketingLandingProps {
  storiesHref: string;
  storiesStrip?: React.ReactNode;
}

const gradientText = 'bg-gradient-to-r from-purple-600 to-orange-500 bg-clip-text text-transparent';
const primaryBtn =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-orange-500 px-8 text-base font-semibold text-white shadow-lg shadow-purple-500/25 transition-transform hover:scale-[1.03] active:scale-[0.98]';
const secondaryBtn =
  'inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-gray-900/10 bg-white px-8 text-base font-semibold text-gray-900 transition-colors hover:border-purple-500 hover:text-purple-700';

function Bubble({ children, tone = 'light', className = '' }: { children: React.ReactNode; tone?: 'light' | 'dark'; className?: string }) {
  return (
    <div
      className={`rounded-2xl px-4 py-3 text-sm leading-6 shadow-xl ${
        tone === 'dark' ? 'bg-gray-900 text-white shadow-gray-900/20' : 'bg-white text-gray-800 shadow-purple-900/10 ring-1 ring-gray-900/5'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function HeroVisual() {
  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 py-4" aria-hidden>
      <div className="absolute inset-0 -z-10 rounded-[40px] bg-gradient-to-br from-purple-200/60 via-pink-100/60 to-orange-200/60 blur-2xl" />
      <div className="w-[85%] self-start rotate-[-2deg]">
        <Bubble>
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-purple-600">
            <MessageCircle className="h-3.5 w-3.5" /> Anonymous message
          </p>
          Honestly? You&apos;re the reason I didn&apos;t drop out that year. Never had the guts to say it ❤️
        </Bubble>
      </div>
      <div className="w-[85%] self-end rotate-[2deg]">
        <Bubble tone="dark">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-400">
            <BookOpen className="h-3.5 w-3.5" /> True story · Regrets
          </p>
          <p className="font-semibold">I never told my dad I didn&apos;t finish uni</p>
          <p className="mt-1 text-gray-400">He framed a photo from a graduation that never happened…</p>
          <div className="mt-2 flex gap-2 text-xs text-gray-300">
            <span>😢 214</span>
            <span>❤️ 97</span>
            <span>💬 58</span>
          </div>
        </Bubble>
      </div>
      <div className="ml-6 w-[75%] self-start rotate-[-1deg]">
        <Bubble>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-orange-500">
            <Sparkles className="h-3.5 w-3.5" /> Curiosity Ask
          </p>
          <p className="font-semibold">Which of these is the lie?</p>
          <div className="mt-2 space-y-1.5 text-xs">
            <div className="rounded-lg bg-purple-50 px-3 py-1.5">I&apos;ve met Burna Boy</div>
            <div className="rounded-lg bg-purple-600 px-3 py-1.5 text-white">I can&apos;t swim · 62%</div>
            <div className="rounded-lg bg-purple-50 px-3 py-1.5">I&apos;ve never been on a plane</div>
          </div>
        </Bubble>
      </div>
    </div>
  );
}

function InboxVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm space-y-3" aria-hidden>
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm text-gray-700 shadow-lg ring-1 ring-gray-900/5">
        <Link2 className="h-4 w-4 text-purple-600" />
        <span className="truncate">{linkHost}/message/<b>you</b></span>
      </div>
      <Bubble className="ml-6">You give the best advice but never take any of it. Please look after yourself too.</Bubble>
      <Bubble className="mr-6">Okay I&apos;ll say it. I&apos;ve had a crush on you since SS2 😭</Bubble>
      <Bubble className="ml-10" tone="dark">
        Be honest: is it normal that your manager texts you at 11pm and expects a reply?
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1">
            <MessageCircle className="h-3 w-3" /> Reply anonymously
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 px-3 py-1 font-semibold">
            <MessagesSquare className="h-3 w-3" /> Turn into discussion
          </span>
        </div>
      </Bubble>
      <p className="text-center text-xs text-gray-500">3 new messages · nobody knows who sent them</p>
    </div>
  );
}

function PaidDiscussionVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm space-y-3" aria-hidden>
      <div className="overflow-hidden rounded-3xl bg-gray-900 text-white shadow-2xl">
        <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-purple-600 px-6 py-2 text-xs font-bold uppercase tracking-[0.14em]">
          Exclusive discussion
        </div>
        <div className="p-6">
          <p className="text-sm text-amber-300">Hosted by @amaka.money</p>
          <p className="mt-1 text-xl font-semibold leading-snug">How I cleared all my debt in 14 months: ask me anything</p>
          <p className="mt-2 text-sm text-gray-400">42 members · everyone joins anonymously</p>
          <div className="mt-4 space-y-2 text-sm">
            <p className="rounded-xl bg-white/5 px-3 py-2 text-gray-200"><span className="text-purple-300">Anonymous ·</span> How much were you earning when you started?</p>
            <p className="rounded-xl bg-white/5 px-3 py-2 text-gray-200"><span className="text-purple-300">Anonymous ·</span> Did you ever borrow from family? Be honest 😅</p>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
            <span className="flex items-center gap-2 text-sm"><Lock className="h-4 w-4 text-amber-300" /> Unlock to join</span>
            <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-gray-900">$2.99</span>
          </div>
        </div>
      </div>
      <Bubble className="ml-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Your earnings</p>
        <p className="mt-1 text-2xl font-bold text-gray-900">42 people joined</p>
        <p className="text-sm text-gray-500">You keep up to 70% of every entry</p>
      </Bubble>
    </div>
  );
}

function StoryVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm" aria-hidden>
      <div className="rounded-3xl bg-gray-900 p-6 text-white shadow-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-400">True story · Everyday Events</p>
        <p className="mt-3 text-xl font-semibold leading-snug">My landlord gave us 7 days to leave. Day 3.</p>
        <p className="mt-2 text-sm leading-6 text-gray-400">Episode 3 · We found a place, but there&apos;s a catch nobody told us about…</p>
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          {['👍 41', '❤️ 88', '😂 6', '😢 132', '😡 57'].map((reaction) => (
            <span key={reaction} className="rounded-full border border-white/10 px-3 py-1">{reaction}</span>
          ))}
        </div>
        <div className="mt-5 space-y-2 border-t border-white/10 pt-4 text-sm">
          <p className="text-gray-300"><span className="text-purple-300">Anonymous ·</span> Same thing happened to my sister. Know your rights 🙏</p>
          <p className="text-gray-300"><span className="text-purple-300">Anonymous ·</span> Please update us tomorrow!!</p>
        </div>
      </div>
    </div>
  );
}

function AskVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm space-y-3" aria-hidden>
      <div className="rounded-3xl bg-gradient-to-br from-purple-600 to-orange-500 p-6 text-white shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Your question</p>
        <p className="mt-2 text-xl font-semibold leading-snug">What&apos;s one thing you&apos;d never tell me to my face?</p>
        <p className="mt-4 text-sm text-white/80">27 anonymous answers · only you can see them</p>
      </div>
      <Bubble className="ml-6">That you laugh at your own jokes before the punchline 😂 and it&apos;s the best part</Bubble>
      <Bubble className="mr-6">You were right about him. I just didn&apos;t want to hear it.</Bubble>
    </div>
  );
}

function DiscussionVisual() {
  return (
    <div className="relative mx-auto w-full max-w-sm space-y-4" aria-hidden>
      <div className="rounded-3xl bg-gray-900 p-6 text-white shadow-2xl">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full bg-white/10 px-2.5 py-1 font-semibold text-orange-300">Closes in 19h</span>
          <span className="text-gray-400">88 replies</span>
        </div>
        <p className="mt-3 text-lg font-semibold leading-snug">My boss takes credit for my work in every meeting. Do I say something?</p>
        <div className="mt-4 space-y-2 text-sm">
          <p className="rounded-xl bg-white/5 px-3 py-2 text-gray-200"><span className="text-purple-300">Anonymous ·</span> Start cc’ing him on everything. Paper trail wins.</p>
          <p className="rounded-xl bg-white/5 px-3 py-2 text-gray-200"><span className="text-purple-300">Anonymous ·</span> Same thing happened to me. I left and doubled my salary.</p>
        </div>
      </div>
      <div className="ml-6 rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-gray-900/5">
        <div className="flex items-center justify-between text-xs">
          <span className="rounded-full bg-orange-100 px-2.5 py-1 font-semibold text-orange-600">Closes in 31h</span>
          <span className="text-gray-500">146 people</span>
        </div>
        <p className="mt-3 text-lg font-semibold leading-snug text-gray-900">Is it okay to tell your partner how much you earn?</p>
        <div className="mt-4 space-y-2 text-sm">
          <div className="relative overflow-hidden rounded-xl bg-gray-100 px-3 py-2">
            <div className="absolute inset-y-0 left-0 w-[64%] bg-purple-200" />
            <span className="relative flex justify-between text-gray-800"><span>Yes, always</span><b>64%</b></span>
          </div>
          <div className="relative overflow-hidden rounded-xl bg-gray-100 px-3 py-2">
            <div className="absolute inset-y-0 left-0 w-[36%] bg-orange-200" />
            <span className="relative flex justify-between text-gray-800"><span>Only after marriage</span><b>36%</b></span>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-600"><span className="font-medium text-purple-600">Anonymous ·</span> I hid it for 2 years and it almost ended us.</p>
      </div>
    </div>
  );
}

interface FeatureBlockProps {
  id: string;
  icon: typeof MessageCircle;
  label: string;
  hook: string;
  title: React.ReactNode;
  body: string;
  bullets: string[];
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  visual: React.ReactNode;
  reverse?: boolean;
  note?: string;
}

function FeatureBlock({ id, icon: Icon, label, hook, title, body, bullets, cta, secondary, visual, reverse, note }: FeatureBlockProps) {
  return (
    <section id={id} className="scroll-mt-24 py-16 lg:py-24">
      <div className={`mx-auto grid max-w-6xl items-center gap-12 px-6 lg:grid-cols-2 lg:gap-20 ${reverse ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1 text-sm font-semibold text-purple-700">
            <Icon className="h-4 w-4" /> {label}
          </p>
          <p className="mt-6 text-lg italic text-gray-500">“{hook}”</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-gray-900 lg:text-5xl">{title}</h2>
          <p className="mt-5 text-lg leading-8 text-gray-600">{body}</p>
          <ul className="mt-6 space-y-3">
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-start gap-3 text-gray-700">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                </span>
                {bullet}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href={cta.href} className={primaryBtn}>
              {cta.label} <ArrowRight className="h-5 w-5" />
            </a>
            {secondary && (
              <a href={secondary.href} className={secondaryBtn}>
                {secondary.label}
              </a>
            )}
          </div>
          {note && <p className="mt-3 text-sm text-gray-500">{note}</p>}
        </div>
        <div>{visual}</div>
      </div>
    </section>
  );
}

const USE_CASES = [
  'find out what friends really think of them',
  'get something heavy off their chest',
  'confess a crush without the awkwardness',
  'settle a debate with an honest poll',
  'play “which one is the lie?” with their audience',
  'ask for feedback people won’t give to their face',
  'follow a story as it unfolds, day by day',
  'get paid to share what they know',
  'turn one brave message into a whole conversation',
  'hear a stranger say “me too”',
];

const WhisprSpaceLanding = ({ storiesHref, storiesStrip }: MarketingLandingProps) => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-gray-900">
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <a href="#top" className="flex items-center gap-2">
            <img src="/assets/WS icon.png" alt="" className="h-9 w-9 object-contain" />
            <span className="text-xl font-bold">WhisprSpace</span>
          </a>
          <div className="hidden items-center gap-7 text-sm font-medium text-gray-600 lg:flex">
            <a href={storiesHref} className="hover:text-purple-700">Stories</a>
            <a href="#messages" className="hover:text-purple-700">Anonymous link</a>
            <a href="#curiosity-ask" className="hover:text-purple-700">Curiosity Ask</a>
            <a href="#discussions" className="hover:text-purple-700">Discussions</a>
          </div>
          <div className="flex items-center gap-2">
            <a href={links.signIn} className="hidden rounded-full px-4 py-2 text-sm font-semibold text-gray-700 hover:text-purple-700 sm:inline-flex">
              Sign in
            </a>
            <a
              href={links.getStarted}
              className="inline-flex h-10 items-center rounded-full bg-gray-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-purple-700"
            >
              Get started
            </a>
          </div>
        </div>
      </nav>

      <header id="top" className="relative pt-28 lg:pt-36">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[620px] bg-gradient-to-b from-purple-50 via-orange-50/40 to-white" />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 pb-16 lg:grid-cols-[1.1fr_1fr] lg:pb-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-purple-200 bg-white px-3 py-1 text-sm font-medium text-purple-700">
              <EyeOff className="h-4 w-4" /> No names. No trace.
            </p>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight lg:text-7xl">
              Say what you <span className={gradientText}>really</span> think.
              <br />
              Hear what they <span className={gradientText}>really</span> think.
            </h1>
            <p className="mt-6 max-w-xl text-xl leading-8 text-gray-600">
              Read real stories people could never post with their name on them. Get honest messages from your audience. Ask the questions you&apos;d never ask face to face.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href={storiesHref} className={primaryBtn}>
                <BookOpen className="h-5 w-5" /> Read stories
              </a>
              <a href={links.inbox} className={secondaryBtn}>
                <Link2 className="h-5 w-5" /> Get your anonymous link
              </a>
            </div>
            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Free</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> No real name needed</span>
              <span className="inline-flex items-center gap-1.5"><Check className="h-4 w-4 text-emerald-500" /> Reading needs no account</span>
            </p>
          </div>
          <HeroVisual />
        </div>
      </header>

      {storiesStrip}

      <div className="bg-gradient-to-b from-white via-gray-50 to-white">
        <FeatureBlock
          id="messages"
          icon={MessageCircle}
          label="Your anonymous link"
          hook="Everyone has an opinion about you. Hardly anyone says it."
          title={<>Find out what your audience <span className={gradientText}>really</span> thinks about you, or about that moment everyone saw.</>}
          body="Put your link on your WhatsApp status, Instagram story or bio. Your audience sends you honest messages: compliments, confessions, advice, the things they’ve been holding back. You’ll never know who sent what."
          bullets={[
            'Your link is ready in 10 seconds',
            'Reply and keep it going as a two-way anonymous conversation',
            'Got a message everyone should weigh in on? Turn it into a discussion in one tap. The sender stays anonymous.',
          ]}
          cta={{ label: 'Get my anonymous link', href: links.inbox }}
          visual={<InboxVisual />}
        />

        <FeatureBlock
          id="stories"
          icon={BookOpen}
          label="Stories"
          hook="Some things are too heavy to post with your name on them."
          title={<>Tell it without the <span className={gradientText}>weight</span>.</>}
          body="Regrets. Bad experiences. Something happening in your life right now. Or fiction and poetry you’ve never shown anyone. Share it anonymously and let strangers who’ve been there say “me too”."
          bullets={[
            'Read and post without an account',
            'Keep a story going in episodes, and readers follow along',
            'Readers react and comment, and nobody knows it’s you',
          ]}
          cta={{ label: 'Read stories', href: storiesHref }}
          secondary={{ label: 'Tell your story', href: links.tellStory }}
          visual={<StoryVisual />}
          reverse
        />

        <FeatureBlock
          id="curiosity-ask"
          icon={Sparkles}
          label="Curiosity Ask"
          hook="There’s a question you’ve always wanted to ask them."
          title={<>Ask it. Get <span className={gradientText}>honest</span> answers.</>}
          body="What does your audience really think of your cooking, your ex, your business idea? Share one question and collect anonymous answers. Or play an icebreaker: list three things about yourself and let your audience guess which one is the lie."
          bullets={[
            'Everyone answers anonymously',
            'Only you see the answers until you decide to share',
            'Turn the best answers into slides for your story',
          ]}
          cta={{ label: 'Ask my first question', href: links.ask }}
          visual={<AskVisual />}
        />

        <FeatureBlock
          id="discussions"
          icon={MessagesSquare}
          label="Discussions"
          hook="The group chat is too awkward. Social media is too loud."
          title={<>Talk about it honestly. <span className={gradientText}>Gone in 48 hours.</span></>}
          body="Put a topic in front of your audience: money, relationships, work, family. Ask an open question and let the replies roll in, or run a poll. Nobody knows who anyone is, and it all closes after 48 hours, so your audience says what they really mean."
          bullets={[
            'Open questions for real answers, or polls for a quick verdict',
            'No names, no followers, no history following anyone around',
            'A summary of every perspective when it closes',
          ]}
          cta={{ label: 'See what your audience says about it', href: links.startDiscussion }}
          visual={<DiscussionVisual />}
          reverse
        />

        <FeatureBlock
          id="paid-discussions"
          icon={Ticket}
          label="Exclusive discussions"
          hook="You have an audience curious about how you did it."
          title={<>Teach what you know. <span className={gradientText}>Charge a token</span> to get in.</>}
          body="Your audience wants the how: how you landed the job, grew the business, cleared the debt. Host an exclusive discussion, set a small entry fee and share the link. They pay to join because they know you, and they stay anonymous, so they finally ask the questions they’d never ask in public."
          bullets={[
            'Set your own entry price, from $1',
            'Your audience joins and asks anonymously',
            'Keep 50% of every entry, or 70% with Premium',
            'With Premium, extend it past 48 hours or keep it forever',
          ]}
          cta={{ label: 'Host an exclusive discussion', href: links.paidDiscussion }}
          visual={<PaidDiscussionVisual />}
        />
      </div>

      <section className="py-20" aria-labelledby="how-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="how-heading" className="text-4xl font-bold tracking-tight lg:text-5xl">Start in under a minute</h2>
            <p className="mt-4 text-lg text-gray-600">No real name, no photo, no personal details. Just a way in.</p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { icon: PenLine, title: 'Pick what you need', body: 'Read a story, get your anonymous link, or ask your first question. Reading doesn’t even need an account.' },
              { icon: Share2, title: 'Share it with your audience', body: 'Drop your link on your WhatsApp status, Instagram story, X or bio. One tap from the app.' },
              { icon: MessageCircle, title: 'Hear the truth', body: 'Honest messages and answers come in, and nobody finds out who said what, not even you.' },
            ].map((step, index) => (
              <div key={step.title} className="rounded-3xl border border-gray-200 bg-white p-7">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-orange-500 text-white">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <span className="text-sm font-semibold text-gray-400">Step {index + 1}</span>
                </div>
                <h3 className="mt-5 text-xl font-semibold">{step.title}</h3>
                <p className="mt-2 leading-7 text-gray-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-900 py-20 text-white" aria-labelledby="safety-heading">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl">
            <h2 id="safety-heading" className="text-4xl font-bold tracking-tight lg:text-5xl">Anonymous means anonymous.</h2>
            <p className="mt-4 text-lg text-gray-400">Honesty only happens when people feel safe. So we built for that first.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: UserX, title: 'No real identity', body: 'No real name or photo, ever. You get a handle, not a profile.' },
              { icon: EyeOff, title: 'Senders stay hidden', body: 'People you hear from are never revealed. Neither are you.' },
              { icon: Timer, title: 'Nothing lingers', body: 'Discussions close after 48 hours. Say it, then let it go.' },
              { icon: Flag, title: 'Safe by default', body: 'Report anything harmful. Content reported by several people is hidden until reviewed.' },
            ].map((item) => (
              <div key={item.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <item.icon className="h-6 w-6 text-purple-300" />
                <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-400">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20" aria-labelledby="use-heading">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 id="use-heading" className="text-4xl font-bold tracking-tight lg:text-5xl">People come here to…</h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {USE_CASES.map((useCase) => (
              <span key={useCase} className="rounded-full border border-gray-200 bg-white px-5 py-2.5 text-base text-gray-700 shadow-sm">
                {useCase}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="scroll-mt-24 bg-gray-50 py-20" aria-labelledby="pricing-heading">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="pricing-heading" className="text-4xl font-bold tracking-tight lg:text-5xl">Free to start. Premium when you want more.</h2>
            <p className="mt-4 text-lg text-gray-600">Everything that makes WhisprSpace work is free. Premium is for keeping what matters and earning more.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-gray-200 bg-white p-8">
              <h3 className="text-xl font-semibold">Free</h3>
              <p className="mt-2 text-4xl font-extrabold">$0</p>
              <ul className="mt-6 space-y-3 text-gray-700">
                {[
                  'Your anonymous link and inbox',
                  'Read, tell and comment on stories',
                  'Curiosity Asks and icebreakers',
                  'Start and join discussions (open for 48 hours)',
                  'Host paid discussions up to $2.99, keep 50%',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" /> {item}
                  </li>
                ))}
              </ul>
              <a href={links.getStarted} className={`${secondaryBtn} mt-8 w-full`}>Get started free</a>
            </div>
            <div className="relative rounded-3xl bg-gray-900 p-8 text-white shadow-2xl">
              <span className="absolute right-6 top-6 rounded-full bg-gradient-to-r from-purple-500 to-orange-500 px-3 py-1 text-xs font-semibold">Save 25% yearly</span>
              <h3 className="text-xl font-semibold">Premium</h3>
              <p className="mt-2 text-4xl font-extrabold">$2.50<span className="text-lg font-medium text-gray-400">/month</span></p>
              <p className="text-sm text-gray-400">or $22.50/year</p>
              <ul className="mt-6 space-y-3 text-gray-200">
                {[
                  'Extend discussions past 48 hours, or save them forever',
                  'Keep 70% of paid discussion sales, at any price',
                  'Unlimited polls and paid discussions',
                  'Keep Curiosity Asks open for 7 days, and save them',
                  'Unlimited ongoing story series',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-purple-300" /> {item}
                  </li>
                ))}
              </ul>
              <a href={links.premium} className={`${primaryBtn} mt-8 w-full`}>Go Premium</a>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24 pt-20">
        <div className="mx-auto max-w-5xl overflow-hidden rounded-[36px] bg-gradient-to-br from-purple-600 via-fuchsia-600 to-orange-500 px-8 py-16 text-center text-white shadow-2xl shadow-purple-500/30 lg:py-20">
          <Lock className="mx-auto h-8 w-8 text-white/80" />
          <h2 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight lg:text-6xl">
            Someone has been wanting to tell you something.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">Give them a way to say it. Your anonymous link is free and ready in seconds.</p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <a href={links.inbox} className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-semibold text-gray-900 transition-transform hover:scale-[1.03]">
              Get my anonymous link <ArrowRight className="h-5 w-5" />
            </a>
            <a href={storiesHref} className="inline-flex h-14 items-center justify-center rounded-full border-2 border-white/40 px-8 text-base font-semibold text-white hover:bg-white/10">
              Read stories first
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-200 bg-gray-50 py-12">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <img src="/assets/WS icon.png" alt="" className="h-8 w-8 object-contain" />
              <span className="text-lg font-bold">WhisprSpace</span>
            </div>
            <p className="mt-3 text-sm text-gray-600">Say what you really think. No names. No trace.</p>
          </div>
          <div>
            <h4 className="font-semibold">Product</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><a href={storiesHref} className="hover:text-purple-700">Stories</a></li>
              <li><a href="#messages" className="hover:text-purple-700">Anonymous link</a></li>
              <li><a href="#curiosity-ask" className="hover:text-purple-700">Curiosity Ask</a></li>
              <li><a href="#discussions" className="hover:text-purple-700">Discussions</a></li>
              <li><a href="#paid-discussions" className="hover:text-purple-700">Exclusive discussions</a></li>
              <li><a href="#pricing" className="hover:text-purple-700">Pricing</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Get going</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><a href={links.tellStory} className="hover:text-purple-700">Tell your story</a></li>
              <li><a href={links.getStarted} className="hover:text-purple-700">Create an account</a></li>
              <li><a href={links.signIn} className="hover:text-purple-700">Sign in</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold">Trust</h4>
            <ul className="mt-3 space-y-2 text-sm text-gray-600">
              <li><a href="/community-guidelines" className="hover:text-purple-700">Community guidelines</a></li>
              <li><a href="/privacy-policy" className="hover:text-purple-700">Privacy policy</a></li>
            </ul>
          </div>
        </div>
        <p className="mx-auto mt-10 max-w-6xl border-t border-gray-200 px-6 pt-6 text-center text-sm text-gray-500">
          &copy; {currentYear} WhisprSpace. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default WhisprSpaceLanding;
