/**
 * SEO Configuration and Utilities
 * Centralized SEO settings for WhisprSpace
 */

const DEFAULT_SITE_URL = 'https://whisprspace.com';
const DEFAULT_APP_URL = 'https://app.whisprspace.com';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const toAbsoluteUrl = (value: string, fallback: string): string => {
  try {
    return new URL(value, fallback).toString();
  } catch {
    return fallback;
  }
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const siteUrl = trimTrailingSlash(
  toAbsoluteUrl(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL, DEFAULT_SITE_URL)
);
const appUrl = trimTrailingSlash(
  toAbsoluteUrl(process.env.NEXT_PUBLIC_APP_URL || siteUrl || DEFAULT_APP_URL, DEFAULT_APP_URL)
);
const indexingEnabled = parseBooleanEnv(process.env.NEXT_PUBLIC_ENABLE_INDEXING, false);

export const seoKeywords = {
  home: [
    'anonymous social platform',
    'anonymous community app',
    'private discussion platform',
    'safe anonymous conversations',
    'judgment-free expression',
    'anonymous threads',
    'secure anonymous messaging',
  ],
  privacyPolicy: [
    'anonymous platform privacy policy',
    'how anonymous apps protect data',
    'whisprspace privacy',
  ],
  communityGuidelines: [
    'anonymous community guidelines',
    'social platform safety rules',
    'whisprspace moderation policy',
  ],
} as const;

export const siteConfig = {
  name: 'WhisprSpace',
  title: 'WhisprSpace | Anonymous Social Platform for Honest Conversations',
  description:
    'WhisprSpace is an anonymous social platform for honest conversations, private communities, and judgment-free expression.',
  url: siteUrl,
  appUrl,
  authUrl: `${appUrl}/auth`,
  indexingEnabled,
  ogImage: '/assets/whisprspaceLogoExICON.png',
  twitterHandle: '@whisprspace',
  keywords: [...seoKeywords.home],
};

export interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  tags?: string[];
  noindex?: boolean;
}

type StructuredDataInput = {
  title?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: {
    anonymousId?: string;
  };
  messageCount?: number;
  likes?: number;
  anonymousId?: string;
  bio?: string;
  id?: string;
};

export function generateMetadata({
  title,
  description,
  image,
  url,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  tags,
  noindex = false,
}: SEOProps = {}) {
  const pageTitle = title ? `${title} | ${siteConfig.name}` : siteConfig.title;
  const pageDescription = description || siteConfig.description;
  const pageImage = toAbsoluteUrl(image || siteConfig.ogImage, siteConfig.url);
  const pageUrl = toAbsoluteUrl(url || siteConfig.url, siteConfig.url);
  const keywords = [...new Set([...siteConfig.keywords, ...(tags || [])])];
  const shouldIndex = siteConfig.indexingEnabled && !noindex;

  const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bingSiteVerification = process.env.BING_SITE_VERIFICATION?.trim();
  const verification =
    googleSiteVerification || bingSiteVerification
      ? {
          ...(googleSiteVerification ? { google: googleSiteVerification } : {}),
          ...(bingSiteVerification
            ? {
                other: {
                  'msvalidate.01': bingSiteVerification,
                },
              }
            : {}),
        }
      : undefined;

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: keywords.join(', '),
    authors: [{ name: author || siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    robots: shouldIndex
      ? {
          index: true,
          follow: true,
          nocache: false,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        }
      : {
          index: false,
          follow: false,
          nocache: true,
          googleBot: {
            index: false,
            follow: false,
            noimageindex: true,
          },
        },

    // Open Graph
    openGraph: {
      type,
      locale: 'en_US',
      url: pageUrl,
      title: pageTitle,
      description: pageDescription,
      siteName: siteConfig.name,
      images: [
        {
          url: pageImage,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
      ...(publishedTime && { publishedTime }),
      ...(modifiedTime && { modifiedTime }),
    },

    // Twitter Card
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [pageImage],
      creator: siteConfig.twitterHandle,
      site: siteConfig.twitterHandle,
    },

    // Additional Meta
    metadataBase: new URL(siteConfig.url),
    alternates: {
      canonical: pageUrl,
    },
    verification,
    
    // App-specific
    applicationName: siteConfig.name,
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent' as const,
      title: siteConfig.name,
    },
    formatDetection: {
      telephone: false,
    },
  };
}

// Generate structured data (JSON-LD)
export function generateStructuredData(
  type: 'website' | 'thread' | 'profile',
  data: StructuredDataInput = {}
) {
  const baseStructure = {
    '@context': 'https://schema.org',
  };

  switch (type) {
    case 'website':
      return {
        ...baseStructure,
        '@type': 'WebSite',
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteConfig.url}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      };

    case 'thread':
      return {
        ...baseStructure,
        '@type': 'DiscussionForumPosting',
        headline: data.title,
        text: data.content,
        datePublished: data.createdAt,
        dateModified: data.updatedAt,
        author: {
          '@type': 'Person',
          name: data.author?.anonymousId || 'Anonymous',
        },
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/CommentAction',
            userInteractionCount: data.messageCount || 0,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: data.likes || 0,
          },
        ],
      };

    case 'profile':
      return {
        ...baseStructure,
        '@type': 'Person',
        name: data.anonymousId,
        description: data.bio,
        url: `${siteConfig.url}/profile/${data.id}`,
      };

    default:
      return baseStructure;
  }
}

// Breadcrumb structured data
export function generateBreadcrumbs(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  };
}
