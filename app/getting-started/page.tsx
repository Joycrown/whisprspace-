import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Getting Started — WhisprSpace',
  description:
    'Learn how to use WhisprSpace: share your anonymous inbox, start threads, and earn with premium content.',
}

const steps = [
  {
    number: '01',
    emoji: '📬',
    title: 'Your Personal Inbox Link',
    color: 'purple',
    description:
      'Every WhisprSpace account comes with a personal link. Share it with anyone — on WhatsApp, Twitter, in your bio, wherever. People click it and can send you an anonymous message without knowing who you are.',
    details: [
      {
        heading: 'One-off messages',
        body: 'Someone sends a single anonymous message. It lands in your inbox. No back-and-forth, just a drop. Great for confessions, opinions, or anonymous feedback.',
      },
      {
        heading: 'Conversational messages',
        body: 'The sender decides to keep the thread open. You can reply, they reply back — a full anonymous conversation where neither side knows who the other is.',
      },
      {
        heading: 'How to find your link',
        body: 'Go to your inbox and copy your link from there. It looks like: whisprspace.com/message/your-handle. Share it anywhere.',
      },
    ],
    cta: { label: 'Go to my inbox', href: '/inbox' },
  },
  {
    number: '02',
    emoji: '💬',
    title: 'Start a Thread',
    color: 'orange',
    description:
      'Got something on your mind that you\'d normally keep to yourself? Drop it as a thread. Share the link, and anyone who has it can respond anonymously — no account needed to reply.',
    details: [
      {
        heading: 'What to post',
        body: 'A question you\'re scared to ask. A rant. A confession. A poll. A hot take. Anything you want honest, unfiltered responses to.',
      },
      {
        heading: 'How it works',
        body: 'Create your thread, copy the link, share it wherever your audience is. Responses come in anonymously. You moderate your own space.',
      },
      {
        heading: 'Privacy',
        body: 'You control who sees the link. If you share it publicly, you get public responses. Share it with a private group, it stays private.',
      },
    ],
    cta: { label: 'Create a thread', href: '/threads' },
  },
  {
    number: '03',
    emoji: '✨',
    title: 'Premium Threads — Earn From Your Content',
    color: 'green',
    description:
      'Premium threads are gated conversations that people pay to join. You set the access fee. Anyone who wants in pays before they can see the content or reply. You earn directly.',
    details: [
      {
        heading: 'How to create one',
        body: 'When creating a thread, toggle it to Premium and set your price. The thread gets a shareable link just like a regular thread.',
      },
      {
        heading: 'What people pay for',
        body: 'Exclusive advice. Private group discussions. Anonymous AMAs (Ask Me Anything). Community vaults. Anything your audience finds worth paying for.',
      },
      {
        heading: 'Payouts',
        body: 'Earnings accumulate in your creator wallet. Request a payout from your profile at any time. We process it directly to your account.',
      },
      {
        heading: 'Who can go Premium',
        body: 'Any registered account can create premium threads. Anonymous/guest accounts cannot — create a full account to unlock this.',
      },
    ],
    cta: { label: 'Create a premium thread', href: '/threads' },
  },
  {
    number: '04',
    emoji: '🛡️',
    title: 'Staying Anonymous',
    color: 'gray',
    description:
      'Everything on WhisprSpace is built around anonymity. Here\'s what that means in practice.',
    details: [
      {
        heading: 'No identity attached to messages',
        body: 'When someone messages you via your inbox link, you have no way to know who they are. The anonymity is absolute.',
      },
      {
        heading: 'Thread replies are anonymous',
        body: 'Everyone who replies to your thread appears without a name or identity. You see the content, not the person.',
      },
      {
        heading: 'Guest accounts are temporary',
        body: 'If you signed in as a guest, your account is tied to that specific browser session. Clear your cache or switch devices and you lose access permanently. Create a real account to keep your history safe.',
      },
    ],
    cta: { label: 'Create an account', href: '/auth?view=signup' },
  },
]

const colorMap: Record<string, { badge: string; border: string; dot: string; tag: string }> = {
  purple: {
    badge: 'bg-purple-100 text-purple-700',
    border: 'border-purple-200',
    dot: 'bg-purple-500',
    tag: 'text-purple-600',
  },
  orange: {
    badge: 'bg-orange-100 text-orange-700',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
    tag: 'text-orange-600',
  },
  green: {
    badge: 'bg-emerald-100 text-emerald-700',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    tag: 'text-emerald-600',
  },
  gray: {
    badge: 'bg-gray-100 text-gray-700',
    border: 'border-gray-200',
    dot: 'bg-gray-500',
    tag: 'text-gray-600',
  },
}

export default function GettingStartedPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-orange-500 px-4 py-16 text-center text-white">
        <Link href="/" className="inline-block mb-6 text-white/70 hover:text-white text-sm transition-colors">
          ← Back to WhisprSpace
        </Link>
        <h1 className="text-4xl font-bold mb-3">How WhisprSpace Works</h1>
        <p className="text-white/85 text-lg max-w-xl mx-auto leading-relaxed">
          Everything you need to know to get the most out of your space — from your inbox link to earning with premium content.
        </p>
      </div>

      {/* Quick nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex gap-4 overflow-x-auto scrollbar-hide">
          {steps.map((step) => (
            <a
              key={step.number}
              href={`#step-${step.number}`}
              className="whitespace-nowrap text-sm font-medium text-gray-500 hover:text-purple-600 transition-colors flex-shrink-0"
            >
              {step.emoji} {step.title}
            </a>
          ))}
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">
        {steps.map((step) => {
          const c = colorMap[step.color]
          return (
            <section key={step.number} id={`step-${step.number}`} className="scroll-mt-16">
              {/* Step header */}
              <div className="flex items-start gap-4 mb-6">
                <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${c.badge}`}>
                  {step.emoji}
                </div>
                <div>
                  <span className={`text-xs font-bold uppercase tracking-widest ${c.tag}`}>
                    Step {step.number}
                  </span>
                  <h2 className="text-2xl font-bold text-gray-900 mt-0.5">{step.title}</h2>
                </div>
              </div>

              {/* Description */}
              <p className="text-gray-600 text-base leading-relaxed mb-6">{step.description}</p>

              {/* Detail cards */}
              <div className={`border ${c.border} rounded-xl divide-y divide-gray-100 overflow-hidden`}>
                {step.details.map((detail, i) => (
                  <div key={i} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full ${c.dot} mt-2 flex-shrink-0`} />
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{detail.heading}</p>
                        <p className="text-gray-600 text-sm mt-1 leading-relaxed">{detail.body}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-5">
                <Link
                  href={step.cta.href}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  {step.cta.label} →
                </Link>
              </div>
            </section>
          )
        })}

        {/* Footer CTA */}
        <div className="text-center py-8 border-t border-gray-100">
          <p className="text-gray-500 text-sm mb-4">Ready to dive in?</p>
          <Link
            href="/threads"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-purple-500 to-orange-500 text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Take me to WhisprSpace →
          </Link>
        </div>
      </div>
    </div>
  )
}
