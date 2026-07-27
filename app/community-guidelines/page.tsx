import type { Metadata } from 'next'
import { generateMetadata as generateSEO, seoKeywords, siteConfig } from '@/lib/seo'

export const metadata: Metadata = generateSEO({
  title: 'Community Guidelines',
  description: 'Review behavior and safety rules for participating in WhisprSpace anonymous communities.',
  image: `${siteConfig.appUrl}/og`,
  url: '/community-guidelines',
  tags: [...seoKeywords.communityGuidelines],
})

const allowed = [
  'Honest conversations',
  'Thoughtful discussions',
  'Supportive interactions',
  'Creative expression',
  'Respectful disagreement',
]

const prohibited: Array<{ title: string; items: string[] }> = [
  {
    title: '1. Harassment and Abuse',
    items: ['Bullying or targeted harassment', 'Hate speech or discrimination', 'Threats or intimidation'],
  },
  {
    title: '2. Privacy Violations',
    items: ['Doxxing', 'Sharing private information', 'Stalking behavior', 'Malicious impersonation'],
  },
  {
    title: '3. Sexual and Exploitative Content',
    items: [
      'Sexual exploitation',
      'Non-consensual intimate content',
      'Any inappropriate content involving minors',
    ],
  },
  {
    title: '4. Platform Manipulation',
    items: ['Spam or mass promotion', 'Bot abuse', 'Coordinated manipulation', 'Malicious bug exploitation'],
  },
  {
    title: '5. Illegal or Dangerous Activity',
    items: ['Promotion of illegal acts', 'Credible violent threats', 'Distribution of malware or harmful links'],
  },
]

const enforcement = [
  'Content removal',
  'Warnings',
  'Temporary restrictions',
  'Permanent suspension',
  'IP blocking',
  'Legal reporting when required',
]

export default function CommunityGuidelinesPage() {
  return (
    <main className="min-h-screen bg-[#121212] text-gray-200 py-10 px-4">
      <article className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-800 bg-[#171717] p-6 md:p-10">
        <header className="mb-8 space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-white">WhisprSpace Community Guidelines</h1>
          <p className="text-sm text-gray-400">Last Updated: February 27, 2026</p>
        </header>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold text-white">Our Mission</h2>
          <p className="text-sm md:text-base text-gray-300 leading-relaxed">
            WhisprSpace enables free, anonymous, and meaningful expression while protecting community safety.
          </p>
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold text-white">What Belongs on WhisprSpace</h2>
          <p className="text-sm md:text-base text-gray-300">We encourage:</p>
          <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-300">
            {allowed.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-6 mb-8">
          <h2 className="text-xl font-semibold text-white">Prohibited Behavior</h2>
          {prohibited.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="text-lg font-semibold text-white">{group.title}</h3>
              <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-300">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="space-y-3 mb-8">
          <h2 className="text-xl font-semibold text-white">Enforcement</h2>
          <p className="text-sm md:text-base text-gray-300">Violations may result in:</p>
          <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-300">
            {enforcement.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold text-white">Reporting and Updates</h2>
          <p className="text-sm md:text-base text-gray-300">Report violations to: support@whisprspace.com</p>
          <p className="text-sm md:text-base text-gray-300">
            We may update these guidelines over time. WhisprSpace thrives when users balance freedom, responsibility,
            respect, and authenticity.
          </p>
        </section>
      </article>
    </main>
  )
}
