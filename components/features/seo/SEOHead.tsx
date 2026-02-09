'use client'

import Head from 'next/head';
import { generateStructuredData } from '@/lib/seo';

interface SEOHeadProps {
  structuredData?: any;
  structuredDataType?: 'website' | 'thread' | 'profile';
}

export function SEOHead({ structuredData, structuredDataType }: SEOHeadProps) {
  const data = structuredDataType 
    ? generateStructuredData(structuredDataType, structuredData)
    : structuredData;

  if (!data) return null;

  return (
    <Head>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
      />
    </Head>
  );
}

// Breadcrumbs component
export function Breadcrumbs({ items }: { items: { name: string; url: string }[] }) {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center gap-2 text-sm text-gray-400">
          {items.map((item, index) => (
            <li key={item.url} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              {index === items.length - 1 ? (
                <span className="text-white">{item.name}</span>
              ) : (
                <a href={item.url} className="hover:text-purple-400 transition-colors">
                  {item.name}
                </a>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
    </>
  );
}
