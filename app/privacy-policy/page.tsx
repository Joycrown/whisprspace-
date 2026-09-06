import type { Metadata } from 'next'
import { generateMetadata as generateSEO, seoKeywords, siteConfig } from '@/lib/seo'

export const metadata: Metadata = generateSEO({
  title: 'Privacy Policy',
  description: 'Learn how WhisprSpace collects, stores, and protects your data on our anonymous social platform.',
  image: `${siteConfig.appUrl}/og`,
  url: '/privacy-policy',
  tags: [...seoKeywords.privacyPolicy],
})

const sections: Array<{ heading: string; paragraphs: string[]; bullets?: string[] }> = [
  {
    heading: '1. Introduction',
    paragraphs: [
      'Welcome to WhisprSpace ("we", "our", or "us").',
      'WhisprSpace is an anonymous social platform designed to enable open expression while maintaining strong respect for user privacy and platform safety.',
      'By using WhisprSpace, you agree to this Privacy Policy.',
    ],
  },
  {
    heading: '2. Our Privacy-First Philosophy',
    paragraphs: ['WhisprSpace is built on:'],
    bullets: ['Data minimization', 'Privacy by design', 'Responsible anonymity'],
  },
  {
    heading: '3. Information We Collect',
    paragraphs: ['We may collect:'],
    bullets: [
      'Username or display name',
      'Email address (if provided)',
      'Profile preferences',
      'Content you create (discussions, replies, messages, uploads)',
      'Communications with support',
      'IP address',
      'Device identifiers',
      'Browser and OS information',
      'Usage data',
      'Approximate location from IP',
      'Cookies and similar technologies',
    ],
  },
  {
    heading: '4. How We Use Information',
    paragraphs: ['We use data to:'],
    bullets: [
      'Provide and operate the platform',
      'Maintain security and integrity',
      'Detect fraud and abuse',
      'Improve performance and experience',
      'Enforce policies',
      'Comply with legal obligations',
      'We do not sell your personal data.',
    ],
  },
  {
    heading: '5. Data Sharing',
    paragraphs: ['We may share limited data with:'],
    bullets: [
      'Service providers (hosting, analytics, security)',
      'Legal authorities when required by law or safety needs',
    ],
  },
  {
    heading: '6. Data Retention',
    paragraphs: [
      'We retain data only as long as necessary for operations, security, legal compliance, and dispute resolution.',
    ],
  },
  {
    heading: '7. Data Security',
    paragraphs: ['We implement reasonable safeguards, but no system is completely secure.'],
  },
  {
    heading: '8. International Users',
    paragraphs: ['Your data may be processed in countries outside your own.'],
  },
  {
    heading: '9. Your Rights',
    paragraphs: [
      'Depending on your location, you may request access, correction, or deletion of your data.',
      'Contact: support@whisprspace.com',
    ],
  },
  {
    heading: "10. Children's Privacy",
    paragraphs: ['WhisprSpace is not intended for users under 13.'],
  },
  {
    heading: '11. Changes',
    paragraphs: ['We may update this policy periodically.'],
  },
  {
    heading: '12. Contact',
    paragraphs: ['Email: support@whisprspace.com', 'Website: https://whisprspace.com'],
  },
]

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#121212] text-gray-200 py-10 px-4">
      <article className="mx-auto w-full max-w-4xl rounded-2xl border border-gray-800 bg-[#171717] p-6 md:p-10">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white">WhisprSpace Privacy Policy</h1>
          <p className="mt-2 text-sm text-gray-400">Last Updated: February 27, 2026</p>
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-xl font-semibold text-white">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-sm md:text-base text-gray-300 leading-relaxed">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="list-disc list-inside space-y-1 text-sm md:text-base text-gray-300">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      </article>
    </main>
  )
}
