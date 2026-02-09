/**
 * SEO Configuration and Utilities
 * Centralized SEO settings for WhisprSpace
 */

export const siteConfig = {
  name: 'WhisprSpace',
  title: 'WhisprSpace - Anonymous Platform for Free Expression',
  description: 'A digital sanctuary for honest expression without identity-based judgment. Share thoughts, join discussions, and connect anonymously on topics that matter.',
  url: process.env.NEXT_PUBLIC_SITE_URL || 'https://whisprspace.com',
  ogImage: '/og-image.png',
  twitterHandle: '@whisprspace',
  keywords: [
    'anonymous chat',
    'anonymous threads',
    'free expression',
    'anonymous messaging',
    'private discussions',
    'anonymous polls',
    'safe space',
    'judgment-free',
    'anonymous community',
    'whisper platform',
  ],
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
  const pageImage = image || `${siteConfig.url}${siteConfig.ogImage}`;
  const pageUrl = url || siteConfig.url;

  return {
    title: pageTitle,
    description: pageDescription,
    keywords: [...siteConfig.keywords, ...(tags || [])].join(', '),
    authors: [{ name: author || siteConfig.name }],
    creator: siteConfig.name,
    publisher: siteConfig.name,
    robots: noindex ? 'noindex, nofollow' : 'index, follow',
    
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
export function generateStructuredData(type: 'website' | 'thread' | 'profile', data: any) {
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
          name: data.author.anonymousId,
        },
        interactionStatistic: [
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/CommentAction',
            userInteractionCount: data.messageCount,
          },
          {
            '@type': 'InteractionCounter',
            interactionType: 'https://schema.org/LikeAction',
            userInteractionCount: data.likes,
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
